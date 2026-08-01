// Client-side JWT storage. The token is issued by the auth service (via the
// gateway) and attached to every authenticated request. SSR renders as
// logged-out; the browser hydrates real state via useSyncExternalStore.
import { useSyncExternalStore } from "react";

const KEY = "inkshield_token";
const EVENT = "inkshield-auth";

const hasWindow = () => typeof window !== "undefined";

export function getToken(): string | null {
  return hasWindow() ? window.localStorage.getItem(KEY) : null;
}

export function setToken(token: string): void {
  if (!hasWindow()) return;
  window.localStorage.setItem(KEY, token);
  window.dispatchEvent(new Event(EVENT));
}

export function clearToken(): void {
  if (!hasWindow()) return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function getEmail(): string | null {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

function subscribe(cb: () => void): () => void {
  if (!hasWindow()) return () => {};
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function useAuth(): { loggedIn: boolean; email: string | null } {
  const token = useSyncExternalStore(subscribe, getToken, () => null);
  return { loggedIn: token !== null, email: token ? getEmail() : null };
}
