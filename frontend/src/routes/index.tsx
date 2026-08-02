import { createFileRoute, Link } from "@tanstack/react-router";
import { type CSSProperties, useEffect, useState } from "react";
import { ChevronsDown, Github, Linkedin } from "lucide-react";
import { Header } from "@/components/Header";
import { ProtectionLab } from "@/components/ProtectionLab";
import { BootLoader } from "@/components/BootLoader";
import { WordCycle } from "@/components/WordCycle";
import { ScrollReveal } from "@/components/ScrollReveal";
import { fetchGallery, type GalleryImage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import gradcamImg from "@/assets/gradcam-viz.jpg";

const heroImg = "/carmen-aguado.png";

export const Route = createFileRoute("/")({
  component: Index,
});

function timeAgo(date: string | null): string {
  if (!date) return "just now";
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (Number.isNaN(seconds) || seconds < 0) return "just now";
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

const strengths = [
  { name: "Ultra-Subtle", eps: "0.005", quality: "Very High", visibility: "Virtually invisible" },
  { name: "Subtle",       eps: "0.010", quality: "High",      visibility: "Indistinguishable" },
  { name: "Recommended",  eps: "0.020", quality: "Medium",    visibility: "Minor grain on zoom" },
  { name: "Aggressive",   eps: "0.040", quality: "Lower",     visibility: "Visible artifacts" },
  { name: "Maximum",      eps: "0.050", quality: "Lowest",    visibility: "Visible noise" },
];

const privacy = [
  "Uploaded over HTTPS, processed in isolation",
  "Stored privately in an AWS S3 bucket",
  "Ensemble PGD runs server-side, not in your browser",
  "Downloaded via time-limited presigned URLs",
];

const stack = {
  Models: ["PyTorch ResNet-50", "TF MobileNetV2", "Ensemble PGD attack"],
  Services: ["FastAPI ML service", "Go API gateway", "Spring Boot auth"],
  Infra: ["PostgreSQL", "MongoDB", "AWS S3", "k3s cluster"],
  Frontend: ["React 19", "TanStack Start", "Tailwind v4"],
};

function Index() {
  const { loggedIn } = useAuth();
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      <BootLoader />
      <ScrollReveal />

      {/* NAV */}
      <Header />

      {/* HERO */}
      <section id="top" className="relative pt-16 min-h-screen">
        <div className="absolute inset-0 z-0 overflow-hidden">
          <img
            src={heroImg}
            alt="Portrait of Carmen Aguado, Duchesse de Montmorency, by Franz Xaver Winterhalter, 1860"
            className="hero-portrait w-full h-full object-cover object-[right_25%] opacity-70"
          />

          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/40" />
          <div className="absolute inset-0 scanlines opacity-40 pointer-events-none" />
          <div className="absolute inset-0 noise pointer-events-none" />
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-10 pt-20 pb-24 lg:pt-32 lg:pb-40 grid lg:grid-cols-12 gap-8 items-end min-h-[calc(100vh-4rem)]">
          <div className="lg:col-span-8">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-lime mb-8 flex items-center gap-3 flex-wrap">
              <span className="w-8 h-px bg-lime" />
              <span>v0.1 · server-side · resists models that{" "}</span>
              <WordCycle
                words={["scrape", "train", "mimic", "clone"]}
                className="text-amber"
              />
            </div>
            <h1 className="font-display font-extrabold uppercase text-5xl sm:text-7xl lg:text-[8.5rem] leading-[0.85] tracking-tighter text-foreground">
              Ink
              <br />
              <span className="text-outline-lime">shield</span>
              <span className="text-lime">.</span>
            </h1>
            <p className="mt-10 max-w-xl text-lg lg:text-xl text-muted-foreground leading-relaxed">
              Protecting creative work in the age of generative AI. Inkshield applies
              carefully generated perturbations to artwork, nearly invisible to
              humans, disruptive to the vision models behind large-scale scraping.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="#lab"
                className="group font-mono text-xs uppercase tracking-widest px-6 py-4 bg-lime text-primary-foreground hover:bg-amber transition-colors flex items-center gap-3 hover-lift"
              >
                Open the lab
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </a>
              <a
                href="#how"
                className="font-mono text-xs uppercase tracking-widest px-6 py-4 border border-border text-foreground hover:border-lime hover:text-lime transition-colors hover-lift"
              >
                Read the pipeline
              </a>
              {!loggedIn && (
                <Link
                  to="/auth"
                  className="font-mono text-xs uppercase tracking-widest px-6 py-4 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors hover-lift"
                >
                  Create an account
                </Link>
              )}
            </div>
          </div>

          <div className="lg:col-span-4 lg:pl-6 space-y-4 font-mono text-xs">
            <TerminalRow label="runtime" value="server-side" accent />
            <TerminalRow label="attack" value="ensemble PGD" />
            <TerminalRow label="models" value="RN-50 + MNv2" />
            <TerminalRow label="epsilon" value="0.005 – 0.050" />
            <TerminalRow label="storage" value="S3 (private)" />
            <TerminalRow label="status" value="protected" accent />
          </div>
        </div>

        <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-10 pb-6 font-mono text-[0.65rem] uppercase tracking-[0.25em] text-muted-foreground/70">
          image · Franz Xaver Winterhalter, <span className="italic">Carmen Aguado, Duchesse de Montmorency</span>, 1860, courtesy Musée National du Château de Versailles
        </div>

        <a
          href="#lab"
          aria-label="Scroll to the lab"
          className="scroll-cue absolute bottom-6 left-1/2 -translate-x-1/2 z-10 text-lime hover:text-amber transition-colors"
        >
          <ChevronsDown size={28} strokeWidth={1.5} />
        </a>
      </section>

      {/* MARQUEE */}
      <section className="relative border-y border-border bg-ink overflow-hidden py-6 plus-grid">
        <div className="relative z-10 flex whitespace-nowrap font-display italic text-3xl md:text-5xl text-muted-foreground" style={{ animation: "marquee 22s linear infinite" }}>
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
        <div data-reveal className="lg:col-span-9 space-y-8">
          <p className="font-display text-3xl lg:text-5xl leading-tight text-foreground">
            The line between{" "}
            <span className="italic text-lime">inspiration</span> and{" "}
            <span className="italic text-amber">scraping</span> has blurred. The
            essence of a body of work now dissolves into training sets, without
            permission, without attribution, without consent.
          </p>
          <p className="text-lg text-muted-foreground max-w-2xl leading-relaxed">
            Inkshield was created as a form of digital self-defense. A way for artists
            to protect their visual identity and retain control over how their
            work is used online, using the same adversarial techniques that
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
            <div data-reveal className="lg:col-span-9">
              <h2 className="font-display font-bold uppercase tracking-tight text-4xl lg:text-6xl leading-[0.95]">
                An adversarial pipeline,
                <br />
                <span className="text-lime">tuned for artists.</span>
              </h2>
            </div>
          </div>

          <div className="grid lg:grid-cols-12 gap-10">
            <div data-reveal className="lg:col-span-7 space-y-8">
              <p className="text-lg text-muted-foreground leading-relaxed">
                Inkshield runs a real ensemble PGD attack server-side against a
                pretrained ResNet-50 and MobileNetV2. The perturbation is nearly
                imperceptible to a viewer, but disruptive to the feature extractors
                that power scrapers and AI captioners.
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
                  desc="Projected Gradient Descent. Iteratively nudges pixels along the gradient sign, clipped to an epsilon-ball, stronger protection than single-step FGSM."
                  accent
                />
                <MethodCard
                  tag="Two models · one attack"
                  name="Ensemble"
                  desc="Gradients are averaged across ResNet-50 and MobileNetV2 so the perturbation transfers, disrupting more than a single architecture would."
                />
              </div>
            </div>

            <div data-reveal style={{ "--reveal-delay": "120ms" } as CSSProperties} className="lg:col-span-5">
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
                    perturbation, feature recognition disrupted.
                  </div>
                </figcaption>
              </figure>
            </div>
          </div>

          {/* Pipeline */}
          <div data-reveal className="mt-24 grid lg:grid-cols-12 gap-10 items-end">
            <div className="lg:col-span-5">
              <div className="font-mono text-xs uppercase tracking-widest text-amber mb-4">
                Server-side pipeline
              </div>
              <h3 className="font-display text-3xl lg:text-5xl leading-tight">
                Real models,
                <br /><span className="italic">real attack.</span>
              </h3>
            </div>
            <div className="lg:col-span-7 space-y-4 text-muted-foreground text-lg leading-relaxed">
              <p>
                The full PyTorch and TensorFlow ensemble PGD attack runs on the
                ML service, not a browser approximation:
              </p>
              <ul className="space-y-2 font-mono text-sm">
                <li className="flex gap-3"><span className="text-lime">→</span> image uploaded through the Go API gateway to the FastAPI ML service</li>
                <li className="flex gap-3"><span className="text-lime">→</span> multi-step PGD iterates the gradient sign against the ResNet-50 + MobileNetV2 ensemble</li>
                <li className="flex gap-3"><span className="text-lime">→</span> protected image stored privately in S3, tied to your account, returned as a presigned URL</li>
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
            <h2 className="font-display font-bold uppercase tracking-tight text-4xl lg:text-6xl leading-[0.95]">
              Pick your <span className="text-amber">epsilon</span>.
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
              A dial from invisible to unmistakable. The default of 0.020 sits at
              the sweet spot, minor grain only visible at zoom, strong enough to
              disrupt the ensemble's classification.
            </p>
          </div>
        </div>

        <div data-reveal className="border border-border">
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
            <h2 className="mt-6 font-display font-bold uppercase tracking-tight text-4xl lg:text-6xl leading-[0.95]">
              Your images,
              <br />
              <span className="text-lime">privately stored.</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-md">
              Images are uploaded over HTTPS, protected in isolation, and stored
              in a private S3 bucket tied to your account. No third-party AI
              services and no public access, unless you choose to publish to the
              gallery, only you hold the presigned download link.
            </p>
          </div>
          <div data-reveal className="lg:col-span-7 grid sm:grid-cols-2 gap-4">
            {privacy.map((p, i) => (
              <div
                key={p}
                className="border border-border p-6 bg-background/40 hover:border-lime transition-colors group hover-lift"
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
            <h2 className="font-display font-bold uppercase tracking-tight text-4xl lg:text-6xl leading-[0.95]">
              A real backend,
              <br />
              <span className="text-amber">not a browser trick.</span>
            </h2>
          </div>
        </div>

        <div data-reveal className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {Object.entries(stack).map(([group, items]) => (
            <div key={group} className="border border-border p-6 hover-lift">
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

        <div data-reveal className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 font-mono text-sm">
          {[
            "Ensemble PGD attack (ResNet-50 + MobileNetV2)",
            "Adjustable epsilon slider",
            "Before/after image comparison",
            "Both model predictions shown side by side",
            "MongoDB job history logging",
            "Presigned S3 download URLs",
            "Private accounts + optional publishing",
            "One-click PNG download",
          ].map((f) => (
            <div key={f} className="flex items-start gap-3 border-t border-border pt-4">
              <span className="text-lime">✦</span>
              <span className="text-muted-foreground">{f}</span>
            </div>
          ))}
        </div>
      </section>

      {/* GALLERY PREVIEW */}
      <section id="gallery" className="border-t border-border bg-ink">
        <GalleryPreview />
      </section>

      {/* CTA */}
      <section id="get" className="border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 opacity-30">
          <img src={heroImg} alt="" aria-hidden="true" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background/70 to-background" />
        </div>
        <div className="relative max-w-[1400px] mx-auto px-6 lg:px-10 py-32 lg:py-48 text-center">
          <SectionLabel className="justify-center">§ 06 · Take it back</SectionLabel>
          <h2 data-reveal className="mt-8 font-display font-extrabold uppercase tracking-tighter text-5xl md:text-7xl lg:text-9xl leading-[0.85]">
            Ink,
            <br />
            <span className="text-outline-lime">not datasets.</span>
          </h2>
          <p className="mt-8 max-w-xl mx-auto text-lg text-muted-foreground">
            Inkshield sends your image to a real ensemble PGD attack running on
            the ML service. The protected file lands in private S3 storage on
            your account and comes back as a time-limited download link. Load
            your art, dial in a shield, download the protected file.
          </p>
          <div className="mt-12 flex flex-wrap gap-4 justify-center">
            <a href="#lab" className="font-mono text-xs uppercase tracking-widest px-8 py-4 bg-lime text-primary-foreground hover:bg-amber transition-colors hover-lift">
              Open the lab
            </a>
            <Link
              to="/auth"
              className="font-mono text-xs uppercase tracking-widest px-8 py-4 border border-border hover:border-lime hover:text-lime transition-colors hover-lift"
            >
              Create an account
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-lime rounded-full" />
            <span>inkshield, a form of digital self-defense</span>
          </div>
          <div className="flex gap-6 items-center uppercase tracking-widest">
            <a href="https://github.com/tiffany-mares/image-protect" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="hover:text-lime transition-colors hover-lift"><Github size={16} strokeWidth={1.5} /></a>
            <a href="https://www.linkedin.com/in/tiffanymares/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="hover:text-lime transition-colors hover-lift"><Linkedin size={16} strokeWidth={1.5} /></a>
            <a href="https://tiffanymares.com/" target="_blank" rel="noopener noreferrer" className="hover:text-lime transition-colors hover-lift">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function GalleryPreview() {
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchGallery("popular")
      .then((data) => {
        if (!cancelled) setImages(data.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setImages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-24 lg:py-32">
      <div className="grid lg:grid-cols-12 gap-10 mb-14">
        <div className="lg:col-span-3">
          <SectionLabel>§ 07 · Gallery</SectionLabel>
        </div>
        <div data-reveal className="lg:col-span-9">
          <h2 className="font-display font-bold uppercase tracking-tight text-4xl lg:text-6xl leading-[0.95]">
            Works from the
            <br />
            <span className="text-lime">community.</span>
          </h2>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Protected images that Inkshield users chose to publish. Open the full
            gallery to browse, sort, and like your favorites.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="font-mono text-sm text-muted-foreground">loading gallery…</div>
      ) : images.length === 0 ? (
        <div className="border border-dashed border-border p-12 text-center">
          <div className="font-mono text-xs uppercase tracking-widest text-muted-foreground mb-4">
            nothing published yet
          </div>
          <a
            href="#lab"
            className="inline-block font-mono text-xs uppercase tracking-widest px-4 py-3 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors hover-lift"
          >
            ▶ Protect &amp; publish yours
          </a>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {images.map((img) => (
            <article
              key={img.id}
              className="border border-border bg-background/40 flex flex-col group hover-lift"
            >
              <div className="relative aspect-square bg-black/40 overflow-hidden">
                <img
                  src={img.url}
                  alt="Published protected image"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center gap-3 font-mono text-xs text-white pointer-events-none">
                  <div className="flex items-center gap-2">
                    <span className="text-lg leading-none">♥</span>
                    <span className="text-sm">{img.like_count} {img.like_count === 1 ? "like" : "likes"}</span>
                  </div>
                  <div className="text-[0.65rem] uppercase tracking-widest text-white/70">
                    {timeAgo(img.created_at)}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="flex justify-center">
        <Link
          to="/gallery"
          className="inline-flex items-center gap-3 font-mono text-xs uppercase tracking-widest px-6 py-4 border border-lime text-lime hover:bg-lime hover:text-primary-foreground transition-colors hover-lift"
        >
          Open full gallery
          <span>→</span>
        </Link>
      </div>
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
