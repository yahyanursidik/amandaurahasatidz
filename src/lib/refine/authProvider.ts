import { AuthProvider } from "@refinedev/core";
import { ENV } from "@/config/env";

const DEV_ACCOUNTS: Record<string, { password: string; portal: string; name: string }> = {
  "admin@yts.or.id": {
    password: "DemoAsatidz2026!",
    portal: "admin",
    name: "Super Admin YTS",
  },
  "panitia@yts.or.id": {
    password: "DemoAsatidz2026!",
    portal: "committee",
    name: "Panitia Daurah YTS",
  },
  "ustadz.demo@yts.or.id": {
    password: "DemoAsatidz2026!",
    portal: "ustadz",
    name: "Ustadz Peserta Demo",
  },
};

const destinationForPortal = (portal: string) =>
  portal === "committee" ? "/committee" : portal === "ustadz" ? "/portal" : "/admin";

const saveDevelopmentIdentity = (email: string, portal: string) => {
  if (!import.meta.env.DEV) return;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const account = DEV_ACCOUNTS[normalizedEmail];
  if (!account || account.portal !== portal) return;
  localStorage.setItem(
    "yts_dev_session",
    JSON.stringify({ email: normalizedEmail, name: account.name, portal })
  );
};

const tryDevelopmentFallback = (email: string, password: string, portal: string) => {
  if (!import.meta.env.DEV) return null;
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const account = DEV_ACCOUNTS[normalizedEmail];
  if (!account || account.password !== password || account.portal !== portal) return null;
  saveDevelopmentIdentity(normalizedEmail, portal);
  return account;
};

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
        // Keep the local identity only as a display fallback. Authentication still
        // goes through the API first so the HttpOnly session cookie is created.
        saveDevelopmentIdentity(email, portal);
        return {
          success: true,
          redirectTo: destinationForPortal(portal),
        };
      }

      // Offline development is still usable when the local API is genuinely
      // unavailable, but invalid credentials or portal-role mismatches are never bypassed.
      if (response.status >= 500 && tryDevelopmentFallback(email, password, portal)) {
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
      if (tryDevelopmentFallback(email, password, portal)) {
        return {
          success: true,
          redirectTo: destinationForPortal(portal),
        };
      }
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
    if (import.meta.env.DEV && localStorage.getItem("yts_dev_session")) {
      return { authenticated: true };
    }
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
    if (import.meta.env.DEV) {
      const stored = localStorage.getItem("yts_dev_session");
      if (stored) {
        const devIdentity = JSON.parse(stored);
        return { id: devIdentity.email, name: devIdentity.name, email: devIdentity.email };
      }
    }
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
          email: res.data?.email || "admin@yts.or.id",
        };
      }
    } catch (_err) {
      // Fallback identity
    }
    return { name: "Pengguna Daurah", email: "admin@yts.or.id" };
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
