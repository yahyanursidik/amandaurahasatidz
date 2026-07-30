import { AuthProvider } from "@refinedev/core";
import { ENV } from "@/config/env";

export const authProvider: AuthProvider = {
  login: async ({ email, otp }) => {
    try {
      if (otp) {
        // Verify OTP code
        const response = await fetch(`${ENV.API_BASE_URL}/auth/email-otp/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email || "admin@yts.or.id", otp }),
          credentials: "include",
        });
        const res = await response.json();
        if (response.ok) {
          return {
            success: true,
            redirectTo: "/admin",
          };
        }
        return {
          success: false,
          error: {
            name: "OTPError",
            message: res.error?.message || "Verifikasi OTP gagal",
          },
        };
      }

      // Request Email OTP
      const response = await fetch(`${ENV.API_BASE_URL}/auth/email-otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email || "admin@yts.or.id" }),
        credentials: "include",
      });
      const res = await response.json();
      if (response.ok) {
        return {
          success: true,
          redirectTo: "/admin",
        };
      }
      return {
        success: false,
        error: {
          name: "LoginError",
          message: res.error?.message || "Gagal meminta OTP",
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
