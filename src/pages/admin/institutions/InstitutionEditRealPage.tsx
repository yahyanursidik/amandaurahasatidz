import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { InstitutionWorkspaceNav } from "@/components/admin/institutions/InstitutionWorkspaceNav";
import { InstitutionForm } from "@/components/admin/institutions/InstitutionForm";
import { Institution, InstitutionFormValues, institutionApi } from "@/lib/institutionApi";

const toValues = (item: Institution): InstitutionFormValues => ({
  code: item.code, name: item.name, legalName: item.legalName || "", institutionType: item.institutionType || "",
  email: item.email || "", phone: item.phone || "", whatsapp: item.whatsapp || "", address: item.address || "",
  provinceCode: item.provinceCode || "", cityCode: item.cityCode || "", district: item.district || "",
  postalCode: item.postalCode || "", website: item.website || "", notes: item.notes || "",
  status: item.status, verificationStatus: item.verificationStatus,
});

export const InstitutionEditRealPage: React.FC = () => {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Institution | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { institutionApi.get(id).then(setItem).catch((cause) => setError(cause instanceof Error ? cause.message : "Data gagal dimuat.")); }, [id]);
  return (
    <AdminLayout>
      <div className="institution-workspace">
        <InstitutionWorkspaceNav />
        <PageHeader title={item ? `Edit ${item.name}` : "Edit lembaga"} description="Perbarui identitas, wilayah, kontak, dan status verifikasi." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Lembaga", href: "/admin/institutions" }, { label: "Edit" }]} />
        {!item ? <div className="institution-loading">{error || "Memuat data lembaga…"}</div> : (
          <InstitutionForm
            key={item.updatedAt}
            mode="edit"
            initialValues={toValues(item)}
            submitLabel="Simpan perubahan"
            pending={pending}
            error={error}
            onCancel={() => navigate(`/admin/institutions/${id}`)}
            onSubmit={async (values) => {
              setPending(true); setError("");
              try {
                await institutionApi.update(id, values);
                navigate(`/admin/institutions/${id}`);
              } catch (cause) {
                setError(cause instanceof Error ? cause.message : "Perubahan gagal disimpan.");
              } finally { setPending(false); }
            }}
          />
        )}
      </div>
    </AdminLayout>
  );
};
