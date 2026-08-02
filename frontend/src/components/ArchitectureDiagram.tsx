type Accent = "lime" | "amber" | "magenta" | "foreground";

const accents: Record<Accent, { bar: string; tag: string; hover: string }> = {
  lime: { bar: "bg-lime", tag: "text-lime", hover: "hover:border-lime" },
  amber: { bar: "bg-amber", tag: "text-amber", hover: "hover:border-amber" },
  magenta: { bar: "bg-magenta", tag: "text-magenta", hover: "hover:border-magenta" },
  foreground: {
    bar: "bg-foreground/60",
    tag: "text-foreground",
    hover: "hover:border-foreground",
  },
};

function Node({
  accent,
  tag,
  title,
  sub,
}: {
  accent: Accent;
  tag: string;
  title: string;
  sub: string;
}) {
  const a = accents[accent];
  return (
    <div
      className={`relative flex h-full flex-col border border-border bg-background/50 transition-colors hover-lift ${a.hover}`}
    >
      <span className={`h-1 w-full ${a.bar}`} />
      <div className="p-4">
        <div className={`font-mono text-[0.6rem] uppercase tracking-widest ${a.tag}`}>
          {tag}
        </div>
        <div className="mt-1 font-display font-bold uppercase tracking-tight text-lg leading-none">
          {title}
        </div>
        <div className="mt-2 font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
          {sub}
        </div>
      </div>
    </div>
  );
}

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-3">
      <span className="h-5 w-px bg-border" />
      {label && (
        <span className="my-1 font-mono text-[0.6rem] uppercase tracking-widest text-muted-foreground/70">
          {label}
        </span>
      )}
      <span className="text-lime leading-none">▼</span>
    </div>
  );
}

/** Colour-coded architecture diagram of the InkShield stack (frontend → gateway
 * → services → data), built from the design tokens so it themes automatically. */
export function ArchitectureDiagram() {
  return (
    <div className="border border-border bg-ink/40 plus-grid p-5 sm:p-8">
      {/* Tier 1 — frontend */}
      <div className="mx-auto max-w-md">
        <Node
          accent="lime"
          tag="frontend · vercel"
          title="inkshield.art"
          sub="React 19 · TanStack Start · Tailwind — talks only to the gateway"
        />
      </div>

      <Connector label="HTTPS · CORS pinned" />

      {/* Tier 2 — ingress + gateway */}
      <div className="mx-auto max-w-2xl">
        <Node
          accent="amber"
          tag="ingress + gateway · go"
          title="Traefik TLS → API Gateway"
          sub="one entry point · verifies JWT locally · gallery / likes / favorites SQL · presigns S3 · reverse-proxies /auth and /protect"
        />
      </div>

      <Connector label="/auth/*        /protect" />

      {/* Tier 3 — services */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Node
          accent="lime"
          tag="auth · spring boot"
          title="Identity"
          sub="email + password · Google OAuth · password reset · issues the shared JWT"
        />
        <Node
          accent="magenta"
          tag="ml · fastapi"
          title="Protection"
          sub="ensemble PGD attack · ResNet-50 (PyTorch) + MobileNetV2 (TensorFlow)"
        />
      </div>

      <Connector />

      {/* Tier 4 — data & external */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Node
          accent="lime"
          tag="postgres · neon"
          title="Relational"
          sub="users · images · likes"
        />
        <Node
          accent="amber"
          tag="mongodb · atlas"
          title="Job metadata"
          sub="epsilon · steps · predictions"
        />
        <Node
          accent="magenta"
          tag="aws s3"
          title="Image store"
          sub="private · presigned URLs"
        />
        <Node
          accent="foreground"
          tag="aws ses"
          title="Email"
          sub="password-reset links"
        />
      </div>
    </div>
  );
}
