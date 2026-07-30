import { AccessControlProvider } from "@refinedev/core";
import { PermissionCode } from "@/config/permissions";
import { ENV } from "@/config/env";

export const accessControlProvider: AccessControlProvider = {
  can: async ({ resource, action, params }) => {
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/me/permissions`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        return { can: false, reason: "Akses ditolak oleh backend (401/403)" };
      }

      const result = await response.json();
      const effectivePermissions: PermissionCode[] = result.data?.effectivePermissions || [];

      // Map Refine resource + action to PermissionCode
      let targetPermission: PermissionCode = "events.read";

      if (resource === "events") {
        if (action === "list" || action === "show") targetPermission = "events.read";
        else if (action === "create") targetPermission = "events.create";
        else if (action === "edit") targetPermission = "events.update";
        else if (action === "delete") targetPermission = "events.cancel";
      } else if (resource === "institutions") {
        if (action === "list" || action === "show") targetPermission = "institutions.read";
        else if (action === "create") targetPermission = "institutions.create";
        else if (action === "edit") targetPermission = "institutions.update";
      } else if (resource === "ustadz") {
        if (action === "list" || action === "show") targetPermission = "ustadz.read";
        else if (action === "create") targetPermission = "ustadz.create";
        else if (action === "edit") targetPermission = "ustadz.update";
      } else if (resource === "audit-logs") {
        targetPermission = "audit.read";
      }

      const isAllowed = effectivePermissions.includes(targetPermission);
      return {
        can: isAllowed,
        reason: isAllowed ? undefined : `Anda tidak memiliki hak akses '${targetPermission}'`,
      };
    } catch (_err) {
      return { can: false, reason: "Gagal memeriksa izin akses" };
    }
  },
};
