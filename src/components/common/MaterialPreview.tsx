import { lazy, Suspense, useId, useState } from "react";
import { ExternalLink, FileText, Play } from "lucide-react";
import { MATERIAL_KINDS, materialKindLabel, type MaterialKind, type MaterialSource } from "@/lib/eventMaterial";

const S3PdfPreview = lazy(() => import("./S3PdfPreview"));

const focus = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";
const button = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 text-sm font-bold ${focus} disabled:cursor-not-allowed disabled:opacity-60`;
export const materialPrimary = `${button} bg-emerald-800 text-white hover:bg-emerald-900`;
export const materialSecondary = `${button} border border-slate-500 bg-white text-slate-800 hover:bg-slate-50`;
export const materialField = `block min-h-11 w-full min-w-0 rounded-lg border border-slate-500 bg-white px-3 text-base text-slate-950 ${focus}`;

export function MaterialKindIcon({ kind }: { kind: MaterialKind }) {
  return <span className={`inline-grid h-10 w-10 shrink-0 place-items-center rounded-lg ${kind === "PDF" ? "bg-amber-100 text-amber-950" : "bg-teal-100 text-teal-950"}`}>
    {kind === "PDF" ? <FileText className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
  </span>;
}

export type MaterialKindFilterValue = MaterialKind | "ALL";

export function MaterialKindFilter({ value, onChange }: { value: MaterialKindFilterValue; onChange: (value: MaterialKindFilterValue) => void }) {
  return <div role="group" aria-label="Jenis materi" className="flex flex-wrap gap-2">
    {(["ALL", ...MATERIAL_KINDS] as const).map((kind) => <button key={kind} type="button"
      aria-pressed={kind === value} className={kind === value ? materialPrimary : materialSecondary}
      onClick={() => onChange(kind)}>
      {kind === "ALL" ? "Semua" : materialKindLabel[kind]}
    </button>)}
  </div>;
}

export function MaterialPreview({ sources, title, kind, pdfPreviewPath }: {
  sources: MaterialSource[]; title: string; kind: MaterialKind; pdfPreviewPath: string;
}) {
  const [selected, setSelected] = useState(0);
  const sourceId = useId();
  const active = sources[selected] ? selected : 0;
  const source = sources[active];
  if (!source) return <p className="text-sm text-slate-700">Tautan materi belum tersedia.</p>;
  const pdf = kind === "PDF";

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        {sources.length > 1 ? <div className="min-w-0 flex-1 sm:max-w-64">
          <label htmlFor={sourceId} className="mb-1 block text-sm font-semibold text-slate-800">Sumber pratinjau</label>
          <select id={sourceId} className={materialField} value={active} onChange={(event) => setSelected(Number(event.target.value))}>
            {sources.map((item, index) => <option key={item.url} value={index}>
              {item.provider}{index === 0 ? " · utama" : ` · alternatif ${index}`}
            </option>)}
          </select>
        </div> : <span className="pb-2 text-sm font-semibold text-slate-700">{source.provider}</span>}
        <a href={source.url} target="_blank" rel="noopener noreferrer" className={materialSecondary}>
          {pdf ? "Buka PDF" : `Buka di ${source.provider}`} <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
      {source.provider === "S3" ? <Suspense fallback={<p role="status" className="rounded-lg bg-slate-100 p-4 text-sm text-slate-700">Memuat pratinjau PDF…</p>}>
        <S3PdfPreview key={`${pdfPreviewPath}:${source.url}`} path={pdfPreviewPath} url={source.url} title={title} buttonClass={materialSecondary} />
      </Suspense> : <iframe key={source.previewUrl} src={source.previewUrl} title={`Pratinjau ${title}`}
        className={`block w-full rounded-lg border border-slate-300 ${pdf ? "h-[min(68vh,780px)] min-h-72 bg-white" : "aspect-video h-auto min-h-[200px] bg-slate-950"}`}
        width="640" height={pdf ? 700 : 360} loading="lazy" allowFullScreen
        referrerPolicy={source.provider === "YouTube" ? "strict-origin-when-cross-origin" : "no-referrer"}
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow={pdf ? undefined : "encrypted-media; picture-in-picture"}
      />}
    </div>
  );
}
