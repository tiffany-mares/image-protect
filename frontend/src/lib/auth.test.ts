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

import { clearToken, getEmail, getToken, setToken } from "./auth";

// payload: {"sub":"u1","email":"a@b.com"} - signature irrelevant for display decode
const FAKE_JWT =
  "eyJhbGciOiJIUzI1NiJ9." +
  Buffer.from(JSON.stringify({ sub: "u1", email: "a@b.com" })).toString("base64url") +
  ".sig";

describe("auth token store", () => {
  beforeEach(() => store.clear());

  it("round-trips a token", () => {
    expect(getToken()).toBeNull();
    setToken(FAKE_JWT);
    expect(getToken()).toBe(FAKE_JWT);
    clearToken();
    expect(getToken()).toBeNull();
  });

  it("decodes email for display", () => {
    setToken(FAKE_JWT);
    expect(getEmail()).toBe("a@b.com");
  });

  it("returns null email for garbage token", () => {
    setToken("not-a-jwt");
    expect(getEmail()).toBeNull();
  });
});
