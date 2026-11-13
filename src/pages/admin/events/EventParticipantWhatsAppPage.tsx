/* Hallmark · component: event WhatsApp workspace · genre: modern-minimal · theme: existing emerald-slate
 * pre-emit critique: P5 H5 E4 S5 R5 V4 · Uses the existing event shell.
 */
import { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EventWorkspaceNav } from "@/components/admin/events/EventWorkspaceNav";
import { WhatsAppBatchWizard } from "@/components/communications/WhatsAppBatchWizard";
import { eventApi } from "@/lib/eventApi";
import { eventWhatsAppHref, parseEventWhatsAppFilters, type EventWhatsAppContext } from "@/lib/eventParticipantWhatsApp";
import { participantStaffPermissions } from "@/lib/participantManagement";
import type { AuthIdentity } from "@/lib/refine/authProvider";

export function EventParticipantWhatsAppPage() {
  const { id = "" } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { data: identity, isLoading } = useGetIdentity<AuthIdentity>();
  const filters = parseEventWhatsAppFilters(params);
  const back = eventWhatsAppHref(id, filters, "participants");
  const ownerId = identity?.id || "";
  const staff = participantStaffPermissions(identity?.assignments, id);
  const permitted = Boolean(ownerId && staff.includes("participants.read") && staff.includes("participants.contact_batch"));
  const [result, setResult] = useState<{ key: string; event?: EventWhatsAppContext; error?: string }>({ key: "" });
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify([id, ownerId, attempt]);
  useEffect(() => {
    if (!permitted) return;
    const controller = new AbortController();
    void eventApi<EventWhatsAppContext>(`/events/${encodeURIComponent(id)}/registration-settings`, { signal: controller.signal, cache: "no-store" })
      .then((event) => { if (!controller.signal.aborted) setResult({ key, event }); })
      .catch((cause) => {
        if (!controller.signal.aborted) setResult({ key, error: cause instanceof Error ? cause.message : "Informasi event belum dapat dimuat." });
      });
    return () => controller.abort();
  }, [id, permitted, key]);
  const event = permitted && result.key === key ? result.event : undefined;

  return <AdminLayout>
    <PageHeader title="WhatsApp bertahap"
      description={event ? `${event.name} · khusus peserta event ini` : "Kirim pesan pribadi satu per satu."}
      breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" }, { label: "Peserta", href: back }, { label: "WhatsApp" }]}
      actions={<Link to={back} className="wa-batch__secondary wa-batch__entry"><ArrowLeft aria-hidden="true" /> Daftar peserta</Link>} />
    <EventWorkspaceNav eventId={id} />
    {isLoading ? <p role="status" className="wa-batch__notice">Memuat identitas admin…</p>
      : !permitted ? <p role="alert" className="wa-batch__alert">Akses WhatsApp bertahap hanya tersedia untuk admin yang berwenang pada event ini.</p>
        : result.key !== key ? <p role="status" className="wa-batch__notice">Memuat informasi event…</p>
          : event ? <WhatsAppBatchWizard key={`${ownerId}:${id}`} ownerId={ownerId} sender={identity?.name || ""} event={event} initialFilters={filters} />
            : <div role="alert" className="wa-batch__notice"><p>{result.error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)}>Coba muat lagi</button></div>}
  </AdminLayout>;
}
