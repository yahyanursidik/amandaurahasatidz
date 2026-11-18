import { useEffect, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { RecordingPlayer } from "@/components/common/RecordingPlayer";
import { PortalLayout } from "@/components/layouts/PortalLayout";
import { eventApi } from "@/lib/eventApi";
import { formatEventDate } from "@/lib/eventDateTime";
import { parseRecordingSource, type PortalRecordingGroup } from "@/lib/eventRecording";

const button = "inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-emerald-800 bg-white px-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700";

export function PortalRecordingsPage() {
  const [groups, setGroups] = useState<PortalRecordingGroup[] | null>(null);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void eventApi<PortalRecordingGroup[]>("/portal/recordings", { cache: "no-store", signal: controller.signal }).then((data) => {
      if (!controller.signal.aborted) setGroups(data);
    }).catch((cause) => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Daftar rekaman gagal dimuat.");
    });
    return () => controller.abort();
  }, [revision]);

  return (
    <PortalLayout>
      <PageHeader title="Rekaman kajian" description="Rekaman yang dibagikan panitia untuk event yang Anda ikuti." />
      {error && <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900">
        <p role="alert">{error}</p>
        <button type="button" className={`${button} mt-3`} onClick={() => setRevision((value) => value + 1)}>Coba lagi</button>
      </div>}
      {!error && !groups && <p role="status" className="text-sm text-slate-700">Memuat rekaman…</p>}
      {groups?.length === 0 && <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-700">
        Panitia belum membagikan rekaman untuk event yang Anda ikuti.
      </p>}
      <div className="max-w-4xl space-y-5">
        {groups?.map((group) => (
          <section key={group.id} aria-labelledby={`recording-event-${group.id}`} className="rounded-lg border border-slate-200 bg-white">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
              <h2 id={`recording-event-${group.id}`} className="text-lg font-bold text-slate-950 [overflow-wrap:anywhere]">{group.name}</h2>
              <p className="mt-1 text-sm text-slate-700">
                {formatEventDate(group.startDate)}{group.startDate !== group.endDate ? ` – ${formatEventDate(group.endDate)}` : ""}
              </p>
            </div>
            <ul className="divide-y divide-slate-200">
              {group.recordings.map((item) => {
                const source = parseRecordingSource(item.url);
                const open = openId === item.id;
                const panelId = `recording-player-${item.id}`;
                return (
                  <li key={item.id} className="px-4 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-slate-950 [overflow-wrap:anywhere]">{item.title}</h3>
                        <p className="mt-1 text-sm text-slate-700">{source?.provider ?? "Tautan rekaman sedang tidak tersedia."}</p>
                      </div>
                      {source && <button type="button" aria-expanded={open} aria-controls={panelId} className={button}
                        aria-label={`${open ? "Tutup pemutar" : "Tonton"} ${item.title}`}
                        onClick={() => setOpenId(open ? null : item.id)}>
                        {open ? "Tutup pemutar" : "Tonton"}
                      </button>}
                    </div>
                    <div id={panelId}>{open && source && <RecordingPlayer source={source} title={item.title} />}</div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </PortalLayout>
  );
}
