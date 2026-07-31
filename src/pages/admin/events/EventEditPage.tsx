import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { EventForm, EventFormValues } from "@/components/admin/events/EventForm";
import { EventWorkspaceNav } from "@/components/admin/events/EventWorkspaceNav";
import { eventApi } from "@/lib/eventApi";

export const EventEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id = "" } = useParams<{ id: string }>();
  const previewMode = !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
  const [values, setValues] = useState<EventFormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      if (previewMode) {
        setValues({
          code: "DAURAH-1448-01",
          slug: "daurah-asatidz-1448",
          name: "Daurah Asatidz Nasional 1448 H",
          subtitle: "Penguatan ilmu dan silaturahmi antar lembaga",
          description: "Event contoh untuk meninjau alur pengelolaan sebelum data produksi tersedia.",
          posterUrl: "/images/event-poster-library-interior.png",
          posterAlt: "Interior perpustakaan sebagai poster Daurah Asatidz Nasional",
          posterFocalPoint: "CENTER",
          audienceMode: "INSTITUTION_INVITATION",
          attendanceMode: "DAILY_AND_SESSION",
          timezone: "Asia/Jakarta",
          startDate: "2026-08-15",
          endDate: "2026-08-17",
          registrationOpenAt: "2026-07-20T08:00",
          registrationCloseAt: "2026-08-05T17:00",
          invitationResponseDeadline: "2026-08-05T17:00",
          attendanceConfirmationDeadline: "2026-08-10T17:00",
          attendanceConfirmationRequired: true,
          lateConfirmationPolicy: "REVIEW",
          venueName: "Aula Markaz",
          venueAddress: "Alamat lokasi kegiatan",
          mapsUrl: "",
          defaultInstitutionQuota: "3",
          capacity: "300",
        });
        return;
      }
      try {
        const event = await eventApi<any>(`/events/${id}`);
        setValues({
          code: event.code || "",
          slug: event.slug || "",
          name: event.name || "",
          subtitle: event.subtitle || "",
          description: event.description || "",
          posterUrl: event.posterUrl || "",
          posterAlt: event.posterAlt || "",
          posterFocalPoint: event.posterFocalPoint || "CENTER",
          audienceMode: event.audienceMode || "INSTITUTION_INVITATION",
          attendanceMode: event.attendanceMode || "DAILY_AND_SESSION",
          timezone: event.timezone || "Asia/Jakarta",
          startDate: event.startDate || "",
          endDate: event.endDate || "",
          registrationOpenAt: event.registrationOpenAt ? String(event.registrationOpenAt).slice(0, 16) : "",
          registrationCloseAt: event.registrationCloseAt ? String(event.registrationCloseAt).slice(0, 16) : "",
          invitationResponseDeadline: event.invitationResponseDeadline ? String(event.invitationResponseDeadline).slice(0, 16) : "",
          attendanceConfirmationDeadline: event.attendanceConfirmationDeadline ? String(event.attendanceConfirmationDeadline).slice(0, 16) : "",
          attendanceConfirmationRequired: event.attendanceConfirmationRequired !== false,
          lateConfirmationPolicy: event.lateConfirmationPolicy || "BLOCK",
          venueName: event.venueName || "",
          venueAddress: event.venueAddress || "",
          mapsUrl: event.mapsUrl || "",
          defaultInstitutionQuota: event.defaultInstitutionQuota ? String(event.defaultInstitutionQuota) : "",
          capacity: event.capacity ? String(event.capacity) : "",
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Rincian event gagal dimuat.");
      }
    };
    void load();
  }, [id, previewMode]);

  const submit = async (nextValues: EventFormValues) => {
    if (previewMode) {
      setValues(nextValues);
      setError("Mode pratinjau tidak menyimpan perubahan. Buat event baru atau buka event yang tersimpan.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await eventApi(`/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...nextValues,
          code: undefined,
          slug: undefined,
          capacity: nextValues.capacity ? Number(nextValues.capacity) : null,
          defaultInstitutionQuota: nextValues.defaultInstitutionQuota ? Number(nextValues.defaultInstitutionQuota) : null,
          mapsUrl: nextValues.mapsUrl || null,
        }),
      });
      navigate(`/admin/events/${id}`, { replace: true });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Event gagal diperbarui.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <PageHeader title="Pengaturan Event" description="Perbarui rincian event. Status hanya berubah melalui perintah pada halaman ringkasan." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Event", href: "/admin/events" }, { label: "Pengaturan" }]} />
      <EventWorkspaceNav eventId={id} />
      {previewMode && <div role="status" className="mb-5 border-t-2 border-amber-500 bg-amber-50 p-3 text-xs text-amber-950">Mode pratinjau: formulir dapat dicoba, tetapi perubahan tidak disimpan.</div>}
      {error && <div role="alert" className="mb-5 border-t-2 border-rose-500 bg-rose-50 p-3 text-xs text-rose-900">{error}</div>}
      {values ? <EventForm key={id} initialValues={values} lockIdentity submitLabel="Simpan perubahan" submitting={submitting} onCancel={() => navigate(`/admin/events/${id}`)} onSubmit={submit} /> : !error && <div className="h-96 animate-pulse bg-slate-100" />}
    </AdminLayout>
  );
};
