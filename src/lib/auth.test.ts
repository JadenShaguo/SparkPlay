import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };
const originalCwd = process.cwd();
let tempDir: string | null = null;

afterEach(async () => {
  process.chdir(originalCwd);
  process.env = { ...originalEnv };
  vi.resetModules();
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = null;
  }
});

async function useTempStore() {
  tempDir = await mkdtemp(path.join(tmpdir(), "sparkplay-auth-test-"));
  process.chdir(tempDir);
}

describe("auth", () => {
  it("creates and reads signed SparkPlay sessions", async () => {
    await useTempStore();
    process.env.SPARKPLAY_AUTH_SECRET = "test-secret";
    vi.resetModules();
    const auth = await import("@/lib/auth");
    const cookie = auth.createSessionCookie({
      id: "github_123",
      name: "GitHub Creator",
      avatarColor: "#6d5dfc",
      createdAt: new Date(0).toISOString()
    });
    const user = await auth.getCurrentUser(new Request("http://localhost/api/me", {
      headers: { cookie }
    }));

    expect(user.id).toBe("github_123");
    expect(user.name).toBe("GitHub Creator");
    expect(auth.isAuthenticated(new Request("http://localhost/api/me", { headers: { cookie } }))).toBe(true);
  });

  it("builds GitHub authorize URL with state and return cookies", async () => {
    await useTempStore();
    process.env.SPARKPLAY_AUTH_SECRET = "test-secret";
    process.env.SPARKPLAY_PUBLIC_APP_URL = "http://localhost:3000";
    process.env.SPARKPLAY_GITHUB_CLIENT_ID = "client-id";
    process.env.SPARKPLAY_GITHUB_CLIENT_SECRET = "client-secret";
    vi.resetModules();
    const auth = await import("@/lib/auth");
    const result = auth.buildGitHubAuthorizeUrl(new Request("http://localhost:3000/api/auth/github/start?returnTo=/play/demo"));
    const url = new URL(result.url);

    expect(url.origin).toBe("https://github.com");
    expect(url.searchParams.get("client_id")).toBe("client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/auth/github/callback");
    expect(result.stateCookie).toContain("sparkplay_oauth_state=");
    expect(result.returnCookie).toContain("sparkplay_oauth_return=");
  });

  it("falls back to demo user without a signed session", async () => {
    await useTempStore();
    vi.resetModules();
    const auth = await import("@/lib/auth");
    const request = new Request("http://localhost/api/me");

    expect(auth.isAuthenticated(request)).toBe(false);
    await expect(auth.getCurrentUser(request)).resolves.toMatchObject({
      id: "user_demo",
      name: "SparkPlay Studio"
    });
  });

  it("creates a guest user session for anonymous visitors", async () => {
    await useTempStore();
    vi.resetModules();
    const auth = await import("@/lib/auth");
    const session = await auth.getOrCreateCurrentUser(new Request("http://localhost/api/me"));

    expect(session.authenticated).toBe(false);
    expect(session.guest).toBe(true);
    expect(session.user.id).toMatch(/^guest_/);
    expect(session.setCookie).toContain("sparkplay_guest_id=");

    const request = new Request("http://localhost/api/me", {
      headers: { cookie: session.setCookie ?? "" }
    });
    const resumed = await auth.getOrCreateCurrentUser(request);
    expect(resumed.user.id).toBe(session.user.id);
    expect(resumed.setCookie).toBeUndefined();
  });
});
