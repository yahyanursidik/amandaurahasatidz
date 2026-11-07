import React from "react";
import { useGetIdentity } from "@refinedev/core";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { AdminLayout } from "@/components/layouts/AdminLayout";
import { AuthIdentity } from "@/lib/refine/authProvider";
import { canManageUstadz, canMergeUstadz } from "@/lib/ustadzPermissions";

export const UstadzManageGuard: React.FC<{ children: React.ReactNode; action?: "manage" | "merge" }> = ({ children, action = "manage" }) => {
  const { data: identity, isLoading } = useGetIdentity<AuthIdentity>();
  if (isLoading) return <AdminLayout><div className="ustadz-loading" role="status">Memeriksa hak akses…</div></AdminLayout>;
  if (action === "merge" ? canMergeUstadz(identity?.assignments) : canManageUstadz(identity?.assignments)) return <>{children}</>;
  return <AdminLayout>
    <section className="ustadz-access-denied" role="alert">
      <ShieldAlert aria-hidden="true" />
      <div>
        <h1>Akses pengelolaan terbatas</h1>
        <p>{action === "merge" ? "Akun Anda tidak memiliki izin menggabungkan profil duplikat." : "Anda dapat melihat profil dan riwayat asatidz, tetapi tidak dapat menambah atau mengubah profil."}</p>
        <Link to="/admin/ustadz">Kembali ke direktori</Link>
      </div>
    </section>
  </AdminLayout>;
};
