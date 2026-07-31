export const DEFAULT_EVENT_POSTER = "/images/event-poster-library-interior.png";
export const EVENT_POSTER_MAX_INPUT_BYTES = 5 * 1024 * 1024;

const loadImage = (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Berkas gambar tidak dapat dibaca."));
    };
    image.src = url;
  });

export async function optimizeEventPoster(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Gunakan gambar JPG, PNG, atau WebP.");
  }
  if (file.size > EVENT_POSTER_MAX_INPUT_BYTES) {
    throw new Error("Ukuran gambar maksimal 5 MB.");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, 1600 / image.naturalWidth, 900 / image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Peramban tidak mendukung optimasi gambar.");
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  let quality = 0.86;
  let output = canvas.toDataURL("image/webp", quality);
  while (output.length > 820_000 && quality > 0.42) {
    quality -= 0.08;
    output = canvas.toDataURL("image/webp", quality);
  }
  if (output.length > 900_000) {
    throw new Error("Gambar tetap terlalu besar setelah dioptimalkan. Pilih gambar yang lebih sederhana.");
  }
  return output;
}

export const posterObjectPosition = (focalPoint?: string | null) => {
  if (focalPoint === "TOP") return "center top";
  if (focalPoint === "BOTTOM") return "center bottom";
  return "center center";
};
