import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { InstitutionWorkspaceNav } from "@/components/admin/institutions/InstitutionWorkspaceNav";
import { InstitutionForm } from "@/components/admin/institutions/InstitutionForm";
import { institutionApi } from "@/lib/institutionApi";

export const InstitutionCreateRealPage: React.FC = () => {
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <AdminLayout>
      <div className="institution-workspace">
        <InstitutionWorkspaceNav />
        <PageHeader title="Tambah lembaga" description="Lengkapi identitas dasar; PIC dan afiliasi asatidz dapat ditambahkan setelah lembaga tersimpan." breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Lembaga", href: "/admin/institutions" }, { label: "Tambah" }]} />
        <InstitutionForm
          mode="create"
          submitLabel="Simpan lembaga"
          pending={pending}
          error={error}
          onCancel={() => navigate("/admin/institutions")}
          onSubmit={async (values) => {
            setPending(true); setError("");
            try {
              const created = await institutionApi.create(values);
              navigate(`/admin/institutions/${created.id}`);
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "Lembaga gagal disimpan.");
            } finally { setPending(false); }
          }}
        />
      </div>
    </AdminLayout>
  );
};
