import { createHash } from "node:crypto";

const env = (name: string): string | undefined => {
  const fromProcess = process.env[name];
  const fromMeta = (import.meta.env as Record<string, string | undefined>)[name];
  const value = fromProcess || fromMeta;
  return value && value.length > 0 ? value : undefined;
};

const ADMIN_PASSWORD = env("ADMIN_PASSWORD");
const ADMIN_SESSION_SECRET = env("ADMIN_SESSION_SECRET");

export const ADMIN_SESSION_COOKIE = "blogx_admin_session";

export function isAdminAuthConfigured(): boolean {
  return Boolean(ADMIN_PASSWORD && ADMIN_SESSION_SECRET);
}

export function getAdminPassword(): string | null {
  return ADMIN_PASSWORD || null;
}

export function getAdminSessionToken(): string | null {
  if (!ADMIN_PASSWORD || !ADMIN_SESSION_SECRET) return null;
  return createHash("sha256")
    .update(`${ADMIN_PASSWORD}:${ADMIN_SESSION_SECRET}`)
    .digest("hex");
}

export function verifyAdminSession(sessionValue?: string | null): boolean {
  const expected = getAdminSessionToken();
  return Boolean(expected && sessionValue === expected);
}

export function buildAdminCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 8,
  };
}
