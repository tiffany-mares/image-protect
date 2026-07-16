import { createFileRoute } from "@tanstack/react-router";
import heroAsset from "@/assets/carmen-aguado.png.asset.json";
const heroImg = heroAsset.url;
import gradcamImg from "@/assets/gradcam-viz.jpg";
import { ProtectionLab } from "@/components/ProtectionLab";

export const Route = createFileRoute("/")({
  component: Index,
});

const strengths = [
  { name: "Ultra-Subtle", eps: "0.005", quality: "Very High", visibility: "Virtually invisible" },
  { name: "Recommended", eps: "0.010", quality: "High", visibility: "Indistinguishable" },
  { name: "Moderate", eps: "0.020", quality: "Medium", visibility: "Minor grain on zoom" },
  { name: "Aggressive", eps: "0.040", quality: "Lower", visibility: "Visible artifacts" },
];

const privacy = [
  "Protected by presigned S3 URLs",
  "Images stored privately on AWS S3",
  "ResNet-50 runs server-side on EC2",
  "No third-party AI services",
];

const stack = {
  Engine: ["PyTorch ResNet-50", "PGD adversarial attack", "8-step iterative"],
  Backend: ["FastAPI on EC2", "AWS S3 storage", "boto3 presigned URLs"],
  Frontend: ["React 19", "TanStack Start", "Tailwind v4"],
};


function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      {/* NAV */}
      <header className="fixed top-0 inset-x-0 z-50 backdrop-blur-md bg-background/60 border-b border-border">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2 font-mono text-sm tracking-tight">
            <span className="inline-block w-2 h-2 bg-lime rounded-full animate-pulse" />
            <span className="text-foreground">inkshield</span>
            <span className="text-muted-foreground">/ protect</span>
          </a>
          <nav className="hidden md:flex items-center gap-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            <a href="#lab" className="hover:text-lime transition-colors">Lab</a>
            <a href="#how" className="hover:text-lime transition-colors">How it works</a>
            <a href="#strength" className="hover:text-lime transition-colors">Strength</a>
            <a href="#privacy" className="hover:text-lime transition-colors">Privacy</a>
            <a href="#stack" className="hover:text-lime transition-colors">Stack</a>
          </nav>
          <a
            href="#lab"
            className="font-mono text-xs uppercase tracking-widest px-4 py-2 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors"
          >
            Open lab
          </a>

        </div>
      </header>

      {/* HERO */}
      <section id="top" className="relative pt-16 min-h-screen">
        <div className="absolute inset-0 z-0">
          <img
            src={heroImg}
            alt="Portrait of Carmen Aguado, Duchesse de Montmorency, by Franz Xaver Winterhalter, 1860"
            className="w-full h-full object-cover object-[right_25%] opacity-70"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
          <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-10 pt-20 pb-24 lg:pt-32 lg:pb-40 grid lg:grid-cols-12 gap-8 items-end min-h-[calc(100vh-4rem)]">
          <div className="lg:col-span-8">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-lime mb-8 flex items-center gap-3">
              <span className="w-8 h-px bg-lime" />
              v0.1 · server-side · adversarial ML
            </div>
            <h1 className="font-display font-light text-5xl sm:text-7xl lg:text-[8.5rem] leading-[0.9] tracking-tight text-foreground">
              Ink
              <br />
              <span className="italic text-lime">shield</span>
              <span className="text-lime">.</span>
            </h1>
            <p className="mt-10 max-w-xl text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Protecting creative work in the age of generative AI. Inkshield applies
              carefully generated perturbations to artwork — nearly invisible to
              humans, disruptive to the vision models behind large-scale scraping.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="#how"
                className="group font-mono text-xs uppercase tracking-widest px-6 py-4 bg-lime text-primary-foreground hover:bg-amber transition-colors flex items-center gap-3"
              >
                Read the pipeline
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
              <a
                href="#strength"
                className="font-mono text-xs uppercase tracking-widest px-6 py-4 border border-border text-foreground hover:border-lime hover:text-lime transition-colors"
              >
                Protection settings
              </a>
            </div>
          </div>

          <div className="lg:col-span-4 lg:pl-6 space-y-4 font-mono text-xs">
            <TerminalRow label="runtime" value="server + browser" accent />
            <TerminalRow label="attack" value="PGD (iterative)" />
            <TerminalRow label="epsilon" value="0.005 – 0.040" />
            <TerminalRow label="uploads" value="S3 (presigned)" />
            <TerminalRow label="model" value="ResNet-50" />
            <TerminalRow label="status" value="protected" accent />
          </div>

        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-10 pb-6 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground/70">
          image · Franz Xaver Winterhalter, <span className="italic">Carmen Aguado, Duchesse de Montmorency</span>, 1860 — courtesy Musée National du Château de Versailles
        </div>
      </section>


      {/* MARQUEE */}
      <section className="border-y border-border bg-ink overflow-hidden py-6">
        <div className="flex whitespace-nowrap font-display italic text-3xl md:text-5xl text-muted-foreground" style={{ animation: "marquee 30s linear infinite" }}>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-10 pr-10 shrink-0">
              <span>digital self-defense</span>
              <span className="text-lime">✦</span>
              <span className="italic">for artists who refuse to feed the machine</span>
              <span className="text-amber">✦</span>
              <span>gradient · sign · perturb · protect</span>
              <span className="text-magenta">✦</span>
              <span className="italic">ink, not datasets</span>
              <span className="text-lime">✦</span>
            </div>
          ))}
        </div>
      </section>

      {/* PROTECTION LAB (interactive demo) */}
      <ProtectionLab />

      {/* INSPIRATION */}
      <section className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-40 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-3">
          <SectionLabel>§ 01 · Inspiration</SectionLabel>
        </div>
        <div className="lg:col-span-9 space-y-8">
          <p className="font-display text-3xl lg:text-5xl leading-tight text-foreground">
            The line between{" "}
            <span className="italic text-lime">inspiration</span> and{" "}
            <span className="italic text-amber">scraping</span> has blurred. The
            essence of a body of work now dissolves into training sets — without
            permission, without attribution, without consent.
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Inkshield was created as a form of digital self-defense. A way for artists
            to protect their visual identity and retain control over how their
            work is used online — using the same adversarial techniques that
            expose weaknesses in neural networks.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-t border-border bg-ink">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-32">
          <div className="grid lg:grid-cols-12 gap-10 mb-16">
            <div className="lg:col-span-3">
              <SectionLabel>§ 02 · How it works</SectionLabel>
            </div>
            <div className="lg:col-span-9">
              <h2 className="font-display text-4xl lg:text-6xl leading-none">
                An adversarial pipeline,
                <br />
                <span className="italic text-lime">tuned for artists.</span>
              </h2>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 space-y-8">
              <p className="text-lg text-muted-foreground leading-relaxed">
                Inkshield applies a real PyTorch PGD attack server-side against
                a pretrained ResNet-50. The perturbation is nearly imperceptible
                to a viewer, but disruptive to the feature extractors that power
                scrapers and AI captioners.
              </p>


              <div className="border border-border bg-background/40 p-6 font-mono text-sm overflow-x-auto">
                <div className="text-muted-foreground text-xs mb-3">
                  # adversarial formulation
                </div>
                <div className="text-lime text-lg">
                  x<sub>adv</sub> = Clip<sub>x,ε</sub>{" "}
                  <span className="text-foreground">
                    {`{ x + ε · sign(∇`}<sub>x</sub> L(θ, x, y){`) }`}
                  </span>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <MethodCard
                  tag="Iterative · multi-step"
                  name="PGD"
                  desc="Projected Gradient Descent. Iteratively nudges pixels in the gradient direction for 8 steps, clipped to an epsilon-ball — stronger protection than single-step FGSM."
                  accent
                />
                <MethodCard
                  tag="Server-side · AWS EC2"
                  name="API"
                  desc="The PyTorch model and attack run on the server. Your image is sent over HTTPS, processed, and returned as a presigned URL — no model weights needed in the browser."
                />
              </div>

            </div>

            <div className="lg:col-span-5">
              <figure className="border border-border relative group">
                <img
                  src={gradcamImg}
                  alt="Grad-CAM attention heatmap over a portrait"
                  loading="lazy"
                  width={1280}
                  height={960}
                  className="w-full h-full object-cover"
                />
                <figcaption className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-ink to-transparent">
                  <div className="font-mono text-xs uppercase tracking-widest text-lime">
                    Grad-CAM · attention drift
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    The model's focus shifts away from the subject after
                    perturbation — feature recognition disrupted.
                  </div>
                </figcaption>
              </figure>
            </div>
          </div>

          {/* Perf */}
          <div className="mt-24 grid lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-5">
              <div className="font-mono text-xs uppercase tracking-widest text-amber mb-4">
                Server-side pipeline
              </div>
              <h3 className="font-display text-3xl lg:text-5xl leading-tight">
                  Real model,
                  <br /><span className="italic">real attack.</span>
                </h3>
              </div>
              <div className="lg:col-span-7 space-y-4 text-muted-foreground text-lg leading-relaxed">
                <p>
                  The full PyTorch PGD attack runs server-side on EC2 against a
                  pretrained ResNet-50 — not a browser approximation:
                </p>
                <ul className="space-y-2 font-mono text-sm">
                  <li className="flex gap-3"><span className="text-lime">→</span> image uploaded to FastAPI on EC2</li>
                  <li className="flex gap-3"><span className="text-lime">→</span> 8-step PGD iterates gradient sign against ResNet-50</li>
                  <li className="flex gap-3"><span className="text-lime">→</span> protected image stored privately in S3, returned as presigned URL</li>
                </ul>
              </div>

          </div>
        </div>
      </section>

      {/* STRENGTH */}
      <section id="strength" className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-12 gap-10 mb-14">
          <div className="lg:col-span-3">
            <SectionLabel>§ 03 · Protection strength</SectionLabel>
          </div>
          <div className="lg:col-span-9">
            <h2 className="font-display text-4xl lg:text-6xl leading-none">
              Pick your <span className="italic text-amber">epsilon</span>.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              A dial from invisible to unmistakable. Recommended for most artists
              sits at 0.010 — indistinguishable from the original at any normal
              viewing distance.
            </p>
          </div>
        </div>

        <div className="border border-border">
          <div className="hidden md:grid grid-cols-12 font-mono text-[0.7rem] uppercase tracking-widest text-muted-foreground border-b border-border px-6 py-4">
            <div className="col-span-3">Setting</div>
            <div className="col-span-2">Epsilon</div>
            <div className="col-span-3">Visual quality</div>
            <div className="col-span-4">Visibility</div>
          </div>
          {strengths.map((s, i) => (
            <div
              key={s.name}
              className={`grid grid-cols-2 md:grid-cols-12 px-6 py-6 items-center gap-y-2 ${
                i !== strengths.length - 1 ? "border-b border-border" : ""
              } ${s.name === "Recommended" ? "bg-lime/5" : ""} hover:bg-secondary/50 transition-colors`}
            >
              <div className="col-span-2 md:col-span-3 font-display text-2xl">
                {s.name}
                {s.name === "Recommended" && (
                  <span className="ml-2 font-mono text-[0.6rem] uppercase tracking-widest px-2 py-0.5 bg-lime text-primary-foreground align-middle">
                    default
                  </span>
                )}
              </div>
              <div className="col-span-1 md:col-span-2 font-mono text-lime">ε = {s.eps}</div>
              <div className="col-span-1 md:col-span-3 text-muted-foreground">{s.quality}</div>
              <div className="col-span-2 md:col-span-4 text-muted-foreground italic">
                {s.visibility}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PRIVACY */}
      <section id="privacy" className="border-t border-border bg-ink">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-32 grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5">
            <SectionLabel>§ 04 · Privacy</SectionLabel>
            <h2 className="mt-6 font-display text-4xl lg:text-6xl leading-none">
              Your images,
              <br />
              <span className="italic text-lime">privately stored.</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-md">
              Images are uploaded over HTTPS, processed in isolation, and stored
              in a private S3 bucket. No third-party AI services, no telemetry,
              no public access — only you hold the presigned download link.
            </p>
          </div>
          <div className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {privacy.map((p, i) => (
              <div
                key={p}
                className="border border-border p-6 bg-background/40 hover:border-lime transition-colors group"
              >
                <div className="font-mono text-xs text-muted-foreground mb-3">
                  0{i + 1}
                </div>
                <div className="font-display text-xl leading-snug group-hover:text-lime transition-colors">
                  {p}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STACK & FEATURES */}
      <section id="stack" className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-32">
        <div className="grid lg:grid-cols-12 gap-10 mb-14">
          <div className="lg:col-span-3">
            <SectionLabel>§ 05 · Under the hood</SectionLabel>
          </div>
          <div className="lg:col-span-9">
            <h2 className="font-display text-4xl lg:text-6xl leading-none">
              Open source,
              <br />
              <span className="italic text-amber">self-hostable.</span>
            </h2>

          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-16">
          {Object.entries(stack).map(([group, items]) => (
            <div key={group} className="border border-border p-6">
              <div className="font-mono text-xs uppercase tracking-widest text-lime mb-4">
                {group}
              </div>
              <ul className="space-y-2 font-display text-xl">
                {items.map((it) => (
                  <li key={it} className="text-foreground">{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 font-mono text-sm">
          {[
            "Server-side PGD adversarial attack",
            "Adjustable epsilon slider",
            "Before/after image comparison",
            "ResNet-50 prediction before/after",
            "Presigned S3 download URLs",
            "One-click PNG download",
          ].map((f) => (
            <div key={f} className="flex items-start gap-3 border-t border-border pt-4">
              <span className="text-lime">✦</span>
              <span className="text-muted-foreground">{f}</span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="get" className="border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <img src={heroImg} alt="" aria-hidden="true" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/70 to-background" />
        </div>
        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-32 lg:py-48 text-center">
          <SectionLabel className="justify-center">§ 06 · Take it back</SectionLabel>
          <h2 className="mt-8 font-display text-5xl md:text-7xl lg:text-9xl leading-[0.9]">
            Ink,
            <br />
            <span className="italic text-lime">not datasets.</span>
          </h2>
          <p className="mt-8 max-w-xl mx-auto text-lg text-muted-foreground">
            Inkshield sends your image over HTTPS to a real PyTorch PGD attack
            running on EC2. The protected file lands in private S3 storage and
            comes back as a time-limited download link. Load your art, dial in
            a shield, download the protected file.
          </p>
          <div className="mt-12 flex flex-wrap gap-4 justify-center">
            <a href="#lab" className="font-mono text-xs uppercase tracking-widest px-8 py-4 bg-lime text-primary-foreground hover:bg-amber transition-colors">
              Open the lab
            </a>
            <a href="#how" className="font-mono text-xs uppercase tracking-widest px-8 py-4 border border-border hover:border-lime hover:text-lime transition-colors">
              How it works
            </a>

          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-lime rounded-full" />
            <span>inkshield — a form of digital self-defense</span>
          </div>
          <div className="flex gap-6 uppercase tracking-widest">
            <a href="#" className="hover:text-lime transition-colors">GitHub</a>
            <a href="#" className="hover:text-lime transition-colors">Docs</a>
            <a href="#" className="hover:text-lime transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`font-mono text-xs uppercase tracking-[0.3em] text-lime flex items-center gap-3 ${className}`}>
      <span className="w-8 h-px bg-lime" />
      {children}
    </div>
  );
}

function TerminalRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between border-b border-border/60 pb-2 backdrop-blur-sm">
      <span className="text-muted-foreground uppercase tracking-widest text-[0.65rem]">
        {label}
      </span>
      <span className={accent ? "text-lime" : "text-foreground"}>{value}</span>
    </div>
  );
}

function MethodCard({ tag, name, desc, accent }: { tag: string; name: string; desc: string; accent?: boolean }) {
  return (
    <div className={`border p-6 ${accent ? "border-lime bg-lime/5" : "border-border"}`}>
      <div className="font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground mb-3">
        {tag}
      </div>
      <div className={`font-display text-4xl mb-3 ${accent ? "text-lime" : "text-foreground"}`}>
        {name}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
