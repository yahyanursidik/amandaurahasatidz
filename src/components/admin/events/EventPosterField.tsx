import React, { useRef, useState } from "react";
import { ImagePlus, LibraryBig, RefreshCw, Trash2, Upload } from "lucide-react";
import { DEFAULT_EVENT_POSTER, optimizeEventPoster, posterObjectPosition } from "@/lib/eventPoster";

type Props = {
  source: string;
  altText: string;
  focalPoint: string;
  eventName: string;
  onSourceChange: (value: string) => void;
  onAltTextChange: (value: string) => void;
  onFocalPointChange: (value: string) => void;
};

export const EventPosterField: React.FC<Props> = ({
  source,
  altText,
  focalPoint,
  eventName,
  onSourceChange,
  onAltTextChange,
  onFocalPointChange,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleFile = async (file?: File) => {
    if (!file) return;
    setProcessing(true);
    setError("");
    try {
      const optimized = await optimizeEventPoster(file);
      onSourceChange(optimized);
      if (!altText.trim()) onAltTextChange(`Poster ${eventName || "event daurah"}`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Poster gagal diproses.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section id="poster" className="scroll-mt-28 border border-slate-200 bg-white">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 p-4">
        <ImagePlus className="h-5 w-5 text-emerald-700" />
        <div>
          <h2 className="text-base font-black text-slate-900">Poster & cover event</h2>
          <p className="mt-1 text-sm text-slate-600">Tampil pada daftar event, halaman publik, dan tautan undangan lembaga maupun individu.</p>
        </div>
      </header>
      <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(17rem,.75fr)]">
        <figure className="event-poster-preview">
          <img
            src={source || DEFAULT_EVENT_POSTER}
            alt={altText || `Pratinjau poster ${eventName || "event"}`}
            style={{ objectPosition: posterObjectPosition(focalPoint) }}
          />
          <figcaption>
            <LibraryBig className="h-4 w-4" />
            Pratinjau rasio 16:9
          </figcaption>
        </figure>

        <div className="space-y-4">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
          <div
            className="event-poster-dropzone"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              void handleFile(event.dataTransfer.files?.[0]);
            }}
          >
            <Upload className="h-6 w-6 text-emerald-700" />
            <p className="font-bold text-slate-900">Letakkan gambar di sini</p>
            <p className="text-sm leading-5 text-slate-600">JPG, PNG, atau WebP · maks. 5 MB · otomatis dioptimalkan hingga 1600×900 dan di bawah 900 KB.</p>
            <button
              type="button"
              disabled={processing}
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-50"
            >
              {processing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {processing ? "Mengoptimalkan…" : "Pilih gambar"}
            </button>
          </div>

          {error && <p role="alert" className="border-l-2 border-rose-500 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">Teks alternatif gambar</span>
            <input
              value={altText}
              onChange={(event) => onAltTextChange(event.target.value)}
              maxLength={180}
              placeholder={`Poster ${eventName || "nama event"}`}
              className="min-h-[48px] w-full rounded-lg border border-slate-300 px-3 text-sm outline-2 outline-transparent focus-visible:outline-emerald-700"
            />
            <span className="mt-1 block text-xs leading-5 text-slate-500">Jelaskan isi gambar untuk pengguna pembaca layar. Hindari menyalin seluruh judul event.</span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">Fokus pemotongan</span>
            <select
              value={focalPoint}
              onChange={(event) => onFocalPointChange(event.target.value)}
              className="min-h-[48px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-2 outline-transparent focus-visible:outline-emerald-700"
            >
              <option value="CENTER">Tengah</option>
              <option value="TOP">Bagian atas</option>
              <option value="BOTTOM">Bagian bawah</option>
            </select>
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onSourceChange(DEFAULT_EVENT_POSTER)} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" /> Gunakan cover bawaan
            </button>
            <button type="button" onClick={() => onSourceChange("")} className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-bold text-rose-700 hover:bg-rose-50">
              <Trash2 className="h-4 w-4" /> Hapus
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
