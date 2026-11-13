import { AuthProvider } from "@refinedev/core";
import { ENV } from "@/config/env";
import { invalidateAuthRequests, readAuthResource } from "./authRequestCache";
import { PORTAL_LOGIN_PATHS, type PortalCode } from "@/config/portalAccess";

export type PortalLoginError = Error & { details?: { recommendedPortal: PortalCode; loginPath: string } };

function safePortalCorrection(error: unknown) {
  const details = (error as { details?: { recommendedPortal?: string; loginPath?: string } } | undefined)?.details;
  const portal = details?.recommendedPortal as PortalCode;
  return portal && Object.hasOwn(PORTAL_LOGIN_PATHS, portal) && details?.loginPath === PORTAL_LOGIN_PATHS[portal]
    ? { recommendedPortal: portal, loginPath: PORTAL_LOGIN_PATHS[portal] } : undefined;
}

const destinationForPortal = (portal: string) =>
  portal === "committee" ? "/committee" : portal === "ustadz" ? "/portal" : "/admin";

export interface AuthIdentity {
  id?: string;
  name: string;
  email: string;
  assignments: Array<{ roleCode: string; eventId?: string | null; institutionId?: string | null; startsAt?: string | null; endsAt?: string | null }>;
}

export async function verifyPersistedSession(
  request: typeof fetch = fetch,
  apiBaseUrl = ENV.API_BASE_URL,
) {
  const response = await request(`${apiBaseUrl}/auth/session`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  return response.ok;
}

export const authProvider: AuthProvider = {
  login: async ({ email, password, portal }) => {
    invalidateAuthRequests();
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/auth/password/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, portal }),
        credentials: "include",
      });
      const res = await response.json().catch(() => ({}));
      if (response.ok) {
        // Confirm the browser has accepted the HttpOnly cookie before the
        // protected route is mounted. This prevents the first navigation from
        // reading a stale anonymous auth state and bouncing back to login.
        if (!(await verifyPersistedSession())) {
          return {
            success: false,
            error: {
              name: "SessionError",
              message: "Login berhasil, tetapi sesi belum tersimpan. Periksa konfigurasi cookie dan SESSION_SECRET.",
            },
          };
        }
        return {
          success: true,
          redirectTo: destinationForPortal(portal),
        };
      }

      return {
        success: false,
        error: Object.assign(new Error(res.error?.message || "Email atau password tidak sesuai"), {
          name: safePortalCorrection(res.error) ? "PortalAccessError" : "LoginError",
          details: response.status === 403 ? safePortalCorrection(res.error) : undefined,
        }),
      };
    } catch (_err) {
      return {
        success: false,
        error: {
          name: "LoginError",
          message: "Koneksi ke server gagal",
        },
      };
    }
  },

  logout: async () => {
    invalidateAuthRequests();
    localStorage.removeItem("yts_auth_token");
    localStorage.removeItem("yts_dev_session");
    try {
      await fetch(`${ENV.API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (_err) {
      // Ignore network failure on logout
    } finally {
      invalidateAuthRequests();
    }
    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    try {
      await readAuthResource("/auth/session");
      return { authenticated: true };
    } catch (_err) {
      // Fail check on network error
    }
    return {
      authenticated: false,
      redirectTo: "/login",
    };
  },

  onError: async (error) => {
    if (error?.status === 401) {
      invalidateAuthRequests();
      return { logout: true, redirectTo: "/login" };
    }
    return { error };
  },

  getIdentity: async () => {
    try {
        const data = await readAuthResource<{ userId: string; name?: string; email: string; assignments: AuthIdentity["assignments"] }>("/auth/session");
        return {
          id: data.userId,
          name: data.name || "Pengguna Daurah",
          email: data.email || "",
          assignments: data.assignments || [],
        } satisfies AuthIdentity;
    } catch (_err) {
      // Fallback identity
    }
    return { name: "Pengguna Daurah", email: "", assignments: [] } satisfies AuthIdentity;
  },

  getPermissions: async () => {
    try {
      const data = await readAuthResource<{ assignments: AuthIdentity["assignments"] }>("/me/permissions");
      return data.assignments || [];
    } catch (_err) {
      return [];
    }
    return [];
  },
};
