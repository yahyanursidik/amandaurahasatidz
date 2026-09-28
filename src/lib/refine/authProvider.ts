import { AuthProvider } from "@refinedev/core";
import { ENV } from "@/config/env";

const destinationForPortal = (portal: string) =>
  portal === "committee" ? "/committee" : portal === "ustadz" ? "/portal" : "/admin";

export interface AuthIdentity {
  id?: string;
  name: string;
  email: string;
  assignments: Array<{ roleCode: string; eventId?: string | null; institutionId?: string | null }>;
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
        error: {
          name: "LoginError",
          message: res.error?.message || "Email atau password tidak sesuai",
        },
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
    localStorage.removeItem("yts_auth_token");
    localStorage.removeItem("yts_dev_session");
    try {
      await fetch(`${ENV.API_BASE_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (_err) {
      // Ignore network failure on logout
    }
    return {
      success: true,
      redirectTo: "/login",
    };
  },

  check: async () => {
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/auth/session`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        return { authenticated: true };
      }
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
      return { logout: true, redirectTo: "/login" };
    }
    return { error };
  },

  getIdentity: async () => {
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/auth/session`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const res = await response.json();
        return {
          id: res.data?.userId,
          name: res.data?.name || "Pengguna Daurah",
          email: res.data?.email || "",
          assignments: res.data?.assignments || [],
        } satisfies AuthIdentity;
      }
    } catch (_err) {
      // Fallback identity
    }
    return { name: "Pengguna Daurah", email: "", assignments: [] } satisfies AuthIdentity;
  },

  getPermissions: async () => {
    try {
      const response = await fetch(`${ENV.API_BASE_URL}/me/permissions`, {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const res = await response.json();
        return res.data?.assignments || [];
      }
    } catch (_err) {
      return [];
    }
    return [];
  },
};
