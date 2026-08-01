// Typed client for the Go gateway - the single base URL for auth, protect,
// dashboard, gallery, and likes (phase2-architecture.md section 3).
import { getToken } from "./auth";

export type GalleryImage = {
  id: string;
  url: string;
  is_favorite: boolean;
  is_published: boolean;
  like_count: number;
  created_at: string;
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function apiBase(): string {
  return import.meta.env.VITE_API_URL ?? "http://localhost:8082";
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, init);
  if (!res.ok) {
    let message = `request failed (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body.error === "string") message = body.error;
    } catch {
      // non-JSON error body - keep the generic message
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

const jsonPost = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export async function signup(email: string, password: string): Promise<void> {
  await request("/auth/signup", jsonPost({ email, password }));
}

export async function login(email: string, password: string): Promise<string> {
  const { token } = await request<{ token: string }>("/auth/login", jsonPost({ email, password }));
  return token;
}

export const fetchDashboard = () =>
  request<GalleryImage[]>("/dashboard", { headers: authHeaders() });

export const fetchLiked = () =>
  request<GalleryImage[]>("/dashboard/liked", { headers: authHeaders() });

export const fetchGallery = (sort: "recent" | "popular") =>
  request<GalleryImage[]>(`/gallery?sort=${sort}`);

const act = (path: string, method: string) =>
  request<{ message: string }>(path, { method, headers: authHeaders() });

export const toggleFavorite = (id: string) => act(`/images/${id}/favorite`, "PATCH");
export const publish = (id: string) => act(`/images/${id}/publish`, "PATCH");
export const like = (id: string) => act(`/images/${id}/like`, "POST");
export const unlike = (id: string) => act(`/images/${id}/like`, "DELETE");
