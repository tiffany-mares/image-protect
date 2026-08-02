import { beforeEach, describe, expect, it, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  },
  dispatchEvent: () => true,
  addEventListener: () => {},
  removeEventListener: () => {},
});

import { ApiError, apiBase, fetchGallery, like, login, toggleFavorite } from "./api";
import { setToken } from "./auth";

const okJson = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe("api client", () => {
  const fetchMock = vi.fn();
  // Note: no unstubAllGlobals(), it would also remove the module-level
  // window stub that auth.ts's token storage depends on.
  beforeEach(() => {
    store.clear();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("login posts credentials and returns the token", async () => {
    fetchMock.mockReturnValue(okJson({ token: "tok123" }));
    const token = await login("a@b.com", "pw12345678");
    expect(token).toBe("tok123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${apiBase()}/auth/login`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ email: "a@b.com", password: "pw12345678" });
  });

  it("login surfaces server error message and status", async () => {
    fetchMock.mockReturnValue(okJson({ error: "email not verified" }, 403));
    await expect(login("a@b.com", "pw")).rejects.toMatchObject({
      status: 403,
      message: "email not verified",
    });
    fetchMock.mockReturnValue(okJson({ error: "bad credentials" }, 401));
    await expect(login("a@b.com", "pw")).rejects.toBeInstanceOf(ApiError);
  });

  it("authenticated calls attach the bearer token", async () => {
    setToken("tok-abc");
    fetchMock.mockReturnValue(okJson({ message: "favorite toggled" }));
    await toggleFavorite("img-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${apiBase()}/images/img-1/favorite`);
    expect(init.method).toBe("PATCH");
    expect(init.headers.Authorization).toBe("Bearer tok-abc");
  });

  it("gallery builds sort query and needs no auth", async () => {
    fetchMock.mockReturnValue(okJson([]));
    await fetchGallery("popular");
    expect(fetchMock.mock.calls[0][0]).toBe(`${apiBase()}/gallery?sort=popular`);
  });

  it("like posts to the like route", async () => {
    setToken("tok-abc");
    fetchMock.mockReturnValue(okJson({ message: "liked" }));
    await like("img-9");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${apiBase()}/images/img-9/like`);
    expect(init.method).toBe("POST");
  });
});
