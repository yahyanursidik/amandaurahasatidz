import type { RecordingSource } from "@/lib/eventRecording";

export function RecordingPlayer({ source, title }: { source: RecordingSource; title: string }) {
  return (
    <div className="mt-3">
      <iframe
        src={source.previewUrl}
        title={`Pemutar ${title}`}
        className="block aspect-video h-auto min-h-[200px] w-full rounded-lg border border-slate-300 bg-slate-950"
        width="640"
        height="360"
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="encrypted-media; picture-in-picture"
        allowFullScreen
      />
      <a href={source.url} target="_blank" rel="noopener noreferrer"
        className="inline-flex min-h-11 items-center rounded px-1 text-sm font-semibold text-emerald-800 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700">
        Buka di {source.provider}
      </a>
    </div>
  );
}
