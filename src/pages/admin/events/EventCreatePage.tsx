import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EventForm, EventFormValues } from "@/components/admin/events/EventForm";
import { eventApi } from "@/lib/eventApi";
import { toEventIso } from "@/lib/eventDateTime";

export const EventCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (error) document.getElementById("event-submit-error")?.focus();
  }, [error]);

  const submit = async (values: EventFormValues) => {
    setSubmitting(true);
    setError("");
    try {
      const created = await eventApi<{ id: string }>("/events", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          registrationOpenAt: toEventIso(values.registrationOpenAt, values.timezone),
          registrationCloseAt: toEventIso(values.registrationCloseAt, values.timezone),
          invitationResponseDeadline: toEventIso(values.invitationResponseDeadline, values.timezone),
          attendanceConfirmationDeadline: toEventIso(values.attendanceConfirmationDeadline, values.timezone),
          capacity: values.capacity ? Number(values.capacity) : null,
          defaultInstitutionQuota: values.defaultInstitutionQuota ? Number(values.defaultInstitutionQuota) : null,
          regularQuota: values.regularQuota === "" ? null : Number(values.regularQuota),
          invitationQuota: values.invitationQuota === "" ? null : Number(values.invitationQuota),
          mapsUrl: values.mapsUrl || null,
        }),
      });
      navigate(`/admin/events/${created.id}`, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Event gagal dibuat.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <PageHeader title="Buat Event Daurah" description="Simpan draft, lalu lengkapi hari kegiatan dan undangan sebelum menerbitkan." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" }, { label: "Buat event" }]} />
      {error && <div id="event-submit-error" tabIndex={-1} role="alert" className="mb-5 border border-rose-300 bg-rose-50 p-4 text-sm font-semibold text-rose-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-rose-700">{error}</div>}
      <EventForm submitLabel="Simpan sebagai draft" submitting={submitting} onCancel={() => navigate("/admin/events")} onSubmit={submit} />
    </AdminLayout>
  );
};
