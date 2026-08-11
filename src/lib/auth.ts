import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { User } from "@/types/domain";
import { ensureUser } from "@/lib/store";

export const defaultUserId = "user_demo";
export const sessionCookieName = "sparkplay_session";
const oauthStateCookieName = "sparkplay_oauth_state";
const oauthReturnCookieName = "sparkplay_oauth_return";
const sessionMaxAgeSeconds = 60 * 60 * 24 * 30;
const oauthStateMaxAgeSeconds = 60 * 10;

export async function getCurrentUser(request?: Request): Promise<User> {
  const session = readSignedSession(request);
  if (session) {
    return ensureUser({
      id: session.id,
      name: session.name,
      avatarColor: session.avatarColor
    });
  }

  const userId = readHeaderOrCookie(request, "x-sparkplay-user-id", "sparkplay_user_id") ?? defaultUserId;
  const userName = readHeaderOrCookie(request, "x-sparkplay-user-name", "sparkplay_user_name") ?? defaultNameForUser(userId);
  const avatarColor = readHeaderOrCookie(request, "x-sparkplay-avatar-color", "sparkplay_avatar_color") ?? colorForUser(userId);

  return ensureUser({
    id: normalizeUserId(userId),
    name: userName.slice(0, 40),
    avatarColor
  });
}

export function isAuthenticated(request?: Request): boolean {
  return Boolean(readSignedSession(request));
}

export function buildGitHubAuthorizeUrl(request: Request): {
  url: string;
  stateCookie: string;
  returnCookie: string;
} {
  const config = getGitHubOAuthConfig(request);
  const requestUrl = new URL(request.url);
  const returnTo = sanitizeReturnTo(requestUrl.searchParams.get("returnTo") ?? "/");
  const state = randomBytes(24).toString("base64url");
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", config.clientId);
  authorizeUrl.searchParams.set("redirect_uri", config.redirectUri);
  authorizeUrl.searchParams.set("scope", "read:user user:email");
  authorizeUrl.searchParams.set("state", state);

  return {
    url: authorizeUrl.toString(),
    stateCookie: serializeCookie(oauthStateCookieName, signValue(state), {
      maxAge: oauthStateMaxAgeSeconds,
      httpOnly: true,
      sameSite: "Lax"
    }),
    returnCookie: serializeCookie(oauthReturnCookieName, returnTo, {
      maxAge: oauthStateMaxAgeSeconds,
      httpOnly: true,
      sameSite: "Lax"
    })
  };
}

export async function completeGitHubOAuth(request: Request): Promise<{
  user: User;
  returnTo: string;
  sessionCookie: string;
  clearStateCookie: string;
  clearReturnCookie: string;
}> {
  const config = getGitHubOAuthConfig(request);
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const signedState = readCookie(request, oauthStateCookieName);
  if (!code || !state || !signedState || verifySignedValue(signedState) !== state) {
    throw new Error("GitHub OAuth state 校验失败，请重新登录");
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      redirect_uri: config.redirectUri
    })
  });
  const tokenPayload = (await tokenResponse.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenResponse.ok || !tokenPayload.access_token) {
    throw new Error(`GitHub OAuth token 交换失败：${tokenPayload.error_description ?? tokenPayload.error ?? tokenResponse.status}`);
  }

  const githubUser = await fetchGitHubUser(tokenPayload.access_token);
  const user = await ensureUser({
    id: `github_${githubUser.id}`,
    name: githubUser.name || githubUser.login,
    avatarColor: colorForUser(`github_${githubUser.id}`)
  });
  const returnTo = sanitizeReturnTo(readCookie(request, oauthReturnCookieName) ?? "/");

  return {
    user,
    returnTo,
    sessionCookie: createSessionCookie(user),
    clearStateCookie: clearCookie(oauthStateCookieName),
    clearReturnCookie: clearCookie(oauthReturnCookieName)
  };
}

export function createSessionCookie(user: User): string {
  return serializeCookie(
    sessionCookieName,
    signJson({
      id: user.id,
      name: user.name,
      avatarColor: user.avatarColor
    }),
    {
      maxAge: sessionMaxAgeSeconds,
      httpOnly: true,
      sameSite: "Lax"
    }
  );
}

export function clearSessionCookie(): string {
  return clearCookie(sessionCookieName);
}

function readHeaderOrCookie(request: Request | undefined, headerName: string, cookieName: string): string | null {
  if (!request) return null;
  const headerValue = request.headers.get(headerName);
  if (headerValue?.trim()) return headerValue.trim();

  return readCookie(request, cookieName);
}

function readCookie(request: Request | undefined, cookieName: string): string | null {
  if (!request) return null;
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${cookieName}=`));
  if (!match) return null;
  return decodeURIComponent(match.slice(cookieName.length + 1));
}

function readSignedSession(request: Request | undefined): Pick<User, "id" | "name" | "avatarColor"> | null {
  const cookie = readCookie(request, sessionCookieName);
  if (!cookie) return null;
  const value = verifySignedValue(cookie);
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<User>;
    if (!parsed.id || !parsed.name || !parsed.avatarColor) return null;
    return {
      id: normalizeUserId(parsed.id),
      name: parsed.name.slice(0, 40),
      avatarColor: parsed.avatarColor
    };
  } catch {
    return null;
  }
}

function normalizeUserId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 48) || defaultUserId;
}

function defaultNameForUser(userId: string): string {
  if (userId === defaultUserId) return "SparkPlay Studio";
  return `Creator ${normalizeUserId(userId).slice(-6)}`;
}

function colorForUser(userId: string): string {
  if (userId === defaultUserId) return "#7f7cff";
  const palette = ["#1f6b4a", "#6d5dfc", "#d97706", "#0f766e", "#be185d", "#2563eb"];
  const index = [...userId].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index];
}

function getGitHubOAuthConfig(request: Request): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
} {
  const clientId = process.env.SPARKPLAY_GITHUB_CLIENT_ID;
  const clientSecret = process.env.SPARKPLAY_GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth 未配置：请设置 SPARKPLAY_GITHUB_CLIENT_ID 和 SPARKPLAY_GITHUB_CLIENT_SECRET");
  }
  const baseUrl = process.env.SPARKPLAY_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return {
    clientId,
    clientSecret,
    redirectUri: `${baseUrl.replace(/\/+$/, "")}/api/auth/github/callback`
  };
}

async function fetchGitHubUser(accessToken: string): Promise<{
  id: number;
  login: string;
  name: string | null;
}> {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!response.ok) {
    throw new Error(`GitHub 用户信息读取失败：${response.status}`);
  }
  const payload = (await response.json()) as {
    id?: unknown;
    login?: unknown;
    name?: unknown;
  };
  if (typeof payload.id !== "number" || typeof payload.login !== "string") {
    throw new Error("GitHub 用户信息结构不完整");
  }
  return {
    id: payload.id,
    login: payload.login,
    name: typeof payload.name === "string" ? payload.name : null
  };
}

function sanitizeReturnTo(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

function signJson(value: unknown): string {
  return signValue(Buffer.from(JSON.stringify(value), "utf8").toString("base64url"));
}

function signValue(value: string): string {
  const signature = createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
  return `${value}.${signature}`;
}

function verifySignedValue(value: string): string | null {
  const separator = value.lastIndexOf(".");
  if (separator < 0) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  return timingSafeEqual(signatureBuffer, expectedBuffer) ? payload : null;
}

function getAuthSecret(): string {
  return process.env.SPARKPLAY_AUTH_SECRET ?? "sparkplay-local-development-secret";
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAge: number;
    httpOnly: boolean;
    sameSite: "Lax" | "Strict";
  }
): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const httpOnly = options.httpOnly ? "; HttpOnly" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${options.maxAge}; SameSite=${options.sameSite}${httpOnly}${secure}`;
}

function clearCookie(name: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=; Path=/; Max-Age=0; SameSite=Lax; HttpOnly${secure}`;
}
