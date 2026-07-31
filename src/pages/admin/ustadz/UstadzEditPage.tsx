import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { PageHeader } from "@/components/common/PageHeader";
import { UstadzForm } from "@/components/admin/ustadz/UstadzForm";
import { UstadzWorkspaceNav } from "@/components/admin/ustadz/UstadzWorkspaceNav";
import { UstadzProfile, ustadzApi } from "@/lib/ustadzApi";
import { getUstadzPreviewProfile } from "@/lib/ustadzPreview";

const toFormValues = (profile: UstadzProfile) => ({
  fullName: profile.fullName || "",
  titlePrefix: profile.titlePrefix || "",
  titleSuffix: profile.titleSuffix || "",
  email: profile.email || "",
  phone: profile.phone || "",
  whatsapp: profile.whatsapp || "",
  birthPlace: profile.birthPlace || "",
  birthDate: profile.birthDate || "",
  address: profile.address || "",
  cityCode: profile.cityCode || "",
  provinceCode: profile.provinceCode || "",
  educationSummary: profile.educationSummary || "",
  expertiseSummary: profile.expertiseSummary || "",
  institutionId: "",
  positionAtInstitution: "",
  isPrimaryInstitution: true,
  profileStatus: profile.profileStatus,
});

export const UstadzEditPage: React.FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<UstadzProfile | null>(null);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    if (!id) return;
    if (id.startsWith("preview-")) {
      setProfile(getUstadzPreviewProfile(id));
      setPreview(true);
      return;
    }
    ustadzApi
      .get(id)
      .then((data) => active && setProfile(data))
      .catch((loadError) => active && setError(loadError instanceof Error ? loadError.message : "Profil tidak ditemukan."));
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <AdminLayout>
      <div className="ustadz-workspace">
        <PageHeader
          title="Perbarui profil asatidz"
          description="Perubahan terhubung ke data lembaga, undangan, dan riwayat event tanpa menghapus rekam jejak."
          breadcrumbs={[
            { label: "Admin", href: "/admin" },
            { label: "Asatidz", href: "/admin/ustadz" },
            { label: "Edit profil" },
          ]}
        />
        <UstadzWorkspaceNav />
        {!profile && !error && (
          <div className="ustadz-loading" role="status">
            <Loader2 className="animate-spin" aria-hidden="true" />
            Memuat profil…
          </div>
        )}
        {error && (
          <div className="ustadz-error" role="alert">
            <AlertTriangle aria-hidden="true" />
            <div>
              <strong>Profil belum dapat dimuat</strong>
              <p>{error}</p>
              <Link to="/admin/ustadz">Kembali ke direktori</Link>
            </div>
          </div>
        )}
        {profile && (
          <UstadzForm
            mode="edit"
            profileId={profile.id}
            initialValues={toFormValues(profile)}
            preview={preview}
          />
        )}
      </div>
    </AdminLayout>
  );
};
