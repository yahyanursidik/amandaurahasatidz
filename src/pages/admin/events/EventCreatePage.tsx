import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EventForm, EventFormValues } from "@/components/admin/events/EventForm";
import { eventApi } from "@/lib/eventApi";

export const EventCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (values: EventFormValues) => {
    setSubmitting(true);
    setError("");
    try {
      const created = await eventApi<{ id: string }>("/events", {
        method: "POST",
        body: JSON.stringify({
          ...values,
          capacity: values.capacity ? Number(values.capacity) : null,
          defaultInstitutionQuota: values.defaultInstitutionQuota ? Number(values.defaultInstitutionQuota) : null,
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
      <PageHeader title="Buat Event Daurah" description="Event baru disimpan sebagai draft sampai seluruh kesiapan ditinjau." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" }, { label: "Buat event" }]} />
      {error && <div role="alert" className="mb-5 border-t-2 border-rose-500 bg-rose-50 p-3 text-xs text-rose-900">{error}</div>}
      <EventForm submitLabel="Simpan sebagai draft" submitting={submitting} onCancel={() => navigate("/admin/events")} onSubmit={submit} />
    </AdminLayout>
  );
};
