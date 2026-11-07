import React from "react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { UstadzForm } from "@/components/admin/ustadz/UstadzForm";

export const UstadzCreatePage: React.FC = () => (
  <AdminLayout>
    <div className="ustadz-workspace">
      <PageHeader
        title="Tambah profil asatidz"
        description="Bangun satu sumber data yang dapat dipakai lintas undangan, event, lembaga, dan check-in."
        breadcrumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Asatidz", href: "/admin/ustadz" },
          { label: "Tambah profil" },
        ]}
      />
      <UstadzForm mode="create" />
    </div>
  </AdminLayout>
);
