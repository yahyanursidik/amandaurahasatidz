import { useCallback, useEffect, useRef, useState } from "react";

type NativeDetector = { detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue?: string }>> };

/** Decode frames locally; also stop tracks granted after navigation or cancellation. */
export function useQrCamera(onCode: (value: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number>();
  const generation = useRef(0);
  const callback = useRef(onCode);
  callback.current = onCode;
  const [cameraState, setCameraState] = useState<"idle" | "starting" | "active">("idle");
  const [cameraError, setCameraError] = useState("");

  const release = useCallback(() => {
    generation.current += 1;
    window.clearTimeout(timerRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const stopCamera = useCallback(() => { release(); setCameraState("idle"); }, [release]);
  useEffect(() => release, [release]);

  const startCamera = async () => {
    release();
    const ticket = generation.current;
    const video = videoRef.current;
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia || !video) {
      setCameraError("Kamera tidak tersedia di halaman ini. Gunakan HTTPS atau cara cadangan.");
      setCameraState("idle");
      return;
    }
    setCameraState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (ticket !== generation.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      if (ticket !== generation.current) return;

      const Detector = (window as Window & { BarcodeDetector?: new (options: { formats: string[] }) => NativeDetector }).BarcodeDetector;
      let detector: NativeDetector | undefined;
      try { if (Detector) detector = new Detector({ formats: ["qr_code"] }); } catch { /* Software decoder below. */ }
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d", { willReadFrequently: true });
      let decoder: typeof import("jsqr").default | undefined;
      const decode = async () => {
        if (detector) {
          try { return (await detector.detect(video))[0]?.rawValue; }
          catch { detector = undefined; }
        }
        if (!context) throw new Error("Canvas tidak tersedia");
        if (!video.videoWidth || !video.videoHeight) return;
        decoder ??= (await import("jsqr")).default;
        if (ticket !== generation.current) return;
        const scale = Math.min(1, 800 / Math.max(video.videoWidth, video.videoHeight));
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        return decoder(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height,
          { inversionAttempts: "dontInvert" })?.data;
      };
      setCameraState("active");
      const scan = async () => {
        if (ticket !== generation.current) return;
        try {
          const value = (await decode())?.trim();
          if (ticket !== generation.current) return;
          if (value) { stopCamera(); callback.current(value); return; }
          timerRef.current = window.setTimeout(scan, 250);
        } catch {
          if (ticket !== generation.current) return;
          stopCamera(); setCameraError("Pemindai tidak dapat membaca kamera. Coba lagi atau gunakan cara cadangan.");
        }
      };
      void scan();
    } catch {
      if (ticket !== generation.current) return;
      stopCamera(); setCameraError("Kamera tidak dapat dibuka. Periksa izin kamera atau gunakan cara cadangan.");
    }
  };
  return { videoRef, cameraState, cameraError, startCamera, stopCamera };
}
