export interface CookieOptions {
  maxAge?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
  path?: string;
}

function isProductionRuntime() {
  return process.env.APP_ENV === "production" || process.env.CONTEXT === "production";
}

export function parseCookies(cookieHeader?: string): Record<string, string> {
  const list: Record<string, string> = {};
  if (!cookieHeader) return list;

  cookieHeader.split(";").forEach((cookie) => {
    const parts = cookie.split("=");
    const name = parts.shift()?.trim();
    const value = parts.join("=").trim();
    if (name) {
      list[name] = decodeURIComponent(value);
    }
  });

  return list;
}

export function serializeCookie(name: string, value: string, options: CookieOptions = {}): string {
  const {
    maxAge = 604800, // 7 days default
    httpOnly = true,
    secure = isProductionRuntime(),
    sameSite = "Lax",
    path = "/",
  } = options;

  let cookieStr = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=${path}`;

  if (maxAge !== undefined) {
    cookieStr += `; Max-Age=${maxAge}`;
  }
  if (httpOnly) {
    cookieStr += `; HttpOnly`;
  }
  if (secure) {
    cookieStr += `; Secure`;
  }
  if (sameSite) {
    cookieStr += `; SameSite=${sameSite}`;
  }

  return cookieStr;
}

export function clearCookie(name: string): string {
  return serializeCookie(name, "", { maxAge: 0, path: "/" });
}
