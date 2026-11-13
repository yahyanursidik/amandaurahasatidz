/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · Workbench · calm-operational */
import { useGetIdentity } from "@refinedev/core";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { UstadzWorkspaceNav } from "@/components/admin/ustadz/UstadzWorkspaceNav";
import { WhatsAppBatchWizard } from "@/components/communications/WhatsAppBatchWizard";
import type { AuthIdentity } from "@/lib/refine/authProvider";

export function UstadzWhatsAppWizardPage() {
  const { data: identity, isLoading } = useGetIdentity<AuthIdentity>();
  return <AdminLayout><div className="ustadz-workspace">
    <PageHeader title="Hubungi asatidz via WhatsApp" description="Satu pesan, penerima terpilih, lalu kirim pribadi satu per satu."
      breadcrumbs={[{ label: "Admin", href: "/admin" }, { label: "Asatidz", href: "/admin/ustadz" }, { label: "WhatsApp bertahap" }]}
      actions={<Link to="/admin/ustadz" className="ustadz-button ustadz-button--secondary"><ArrowLeft aria-hidden="true" /> Direktori</Link>} />
    <UstadzWorkspaceNav />
    {isLoading ? <p role="status">Memuat identitas admin…</p> : identity?.id
      ? <WhatsAppBatchWizard key={identity.id} ownerId={identity.id} sender={identity.name} />
      : <p className="wa-batch__alert" role="alert">Identitas admin belum tersedia. Masuk ulang sebelum membuat sesi.</p>}
  </div></AdminLayout>;
}
