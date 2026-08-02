/**
 * Module-level store for the Protection Lab run.
 *
 * The PGD run (a 30s–1min server round-trip) and its elapsed-time ticker live
 * here, OUTSIDE the React tree, so they survive navigation: the user can start a
 * run in the lab, browse the gallery or other pages while it keeps running, and
 * come back to find it still in progress or finished. Component state would be
 * torn down on unmount; this isn't.
 *
 * Consumed via useSyncExternalStore in ProtectionLab. Actions never throw.
 */
import { authHeaders, publish as publishImage } from "@/lib/api";

export type Prediction = { index: number; label: string; confidence: number };
export type ModelPredictions = { original: Prediction; protected: Prediction };
export type ProtectResult = {
  original_url: string;
  protected_url: string;
  download_url?: string;
  job_id: string;
  image_id?: string;
  predictions: {
    resnet50: ModelPredictions;
    mobilenet: ModelPredictions;
  };
};

export type ProtectionState = {
  file: File | null;
  previewUrl: string | null;
  epsilon: number;
  loading: boolean;
  elapsed: number;
  error: string | null;
  result: ProtectResult | null;
  publishing: boolean;
  published: boolean;
  publishError: string | null;
};

let state: ProtectionState = {
  file: null,
  previewUrl: null,
  epsilon: 0.02,
  loading: false,
  elapsed: 0,
  error: null,
  result: null,
  publishing: false,
  published: false,
  publishError: null,
};

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
// Monotonic id so a newer run's async completion can't be clobbered by an older
// one, and stale timers stop ticking.
let runId = 0;

function emit() {
  listeners.forEach((l) => l());
}

function set(patch: Partial<ProtectionState>) {
  state = { ...state, ...patch };
  emit();
}

export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

// Stable reference between emits — required by useSyncExternalStore. Server
// snapshot is the same (runs only ever start from client interaction).
export function getSnapshot(): ProtectionState {
  return state;
}

export function setEpsilon(v: number) {
  set({ epsilon: v });
}

/** Load a new image and immediately kick off protection. */
export function loadFile(f: File) {
  if (!f.type.startsWith("image/")) return;
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  set({
    file: f,
    previewUrl: URL.createObjectURL(f),
    result: null,
    error: null,
    published: false,
    publishError: null,
  });
  void runProtection();
}

/** Run the ensemble PGD attack against the currently loaded file. */
export async function runProtection() {
  const f = state.file;
  if (!f) return;
  const myRun = ++runId;

  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  set({
    loading: true,
    elapsed: 0,
    error: null,
    result: null,
    published: false,
    publishError: null,
  });
  timer = setInterval(() => {
    if (runId === myRun) set({ elapsed: state.elapsed + 1 });
  }, 1000);

  const form = new FormData();
  form.append("file", f);
  form.append("epsilon", String(state.epsilon));

  try {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL ?? "http://localhost:8082"}/protect`,
      { method: "POST", body: form, headers: authHeaders() },
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Server error ${res.status}: ${text.slice(0, 200)}`);
    }
    const data: ProtectResult = await res.json();
    if (runId === myRun) set({ result: data });
  } catch (e: unknown) {
    if (runId === myRun) {
      set({ error: e instanceof Error ? e.message : "Protection failed" });
    }
  } finally {
    if (runId === myRun) {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      set({ loading: false });
    }
  }
}

/**
 * Publish the current result to the gallery. Returns true on success. The caller
 * owns the auth check and post-publish navigation (those need React hooks).
 */
export async function publishResult(): Promise<boolean> {
  if (!state.result?.image_id) {
    set({ publishError: "couldn't save this image — re-run protection, then publish" });
    return false;
  }
  set({ publishing: true, publishError: null });
  try {
    await publishImage(state.result.image_id);
    set({ published: true });
    return true;
  } catch (e: unknown) {
    set({ publishError: e instanceof Error ? e.message : "Publish failed" });
    return false;
  } finally {
    set({ publishing: false });
  }
}
