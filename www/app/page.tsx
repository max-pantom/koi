import Image from "next/image";
import type { ReactNode } from "react";
import appIcon from "../../src-tauri/icons/128x128@2x.png";
import libraryImage from "../../docs/images/koi-library.png";
import dockImage from "../../docs/images/koi-icon-dock-earthy.jpg";
import { ThemeToggle } from "./theme-toggle";

const githubUrl = "https://github.com/max-pantom/koi";
const releaseUrl = `${githubUrl}/releases/latest`;

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <nav className="nav-shell" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="Koi home">
            <Image src={appIcon} alt="" width={28} height={28} priority />
            <span>Koi</span>
          </a>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href={githubUrl}>GitHub</a>
            <ThemeToggle />
          </div>
        </nav>
      </header>

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="eyebrow"><span aria-hidden="true" /> Koi 0.2 for macOS</div>
          <h1 id="hero-title">Keep what inspires you close.</h1>
          <p className="hero-copy">
            A fast, local-first home for images, videos, and articles. Save from anywhere, then find the right reference in seconds.
          </p>
          <div className="hero-actions">
            <a className="button primary" href={releaseUrl}>Download for macOS</a>
            <a className="button secondary" href={githubUrl}>View on GitHub</a>
          </div>
          <p className="hero-note">Free and open source. Your library stays on your computer.</p>
        </section>

        <section className="product-stage" aria-label="Koi application preview">
          <div className="app-frame">
            <div className="frame-bar" aria-hidden="true">
              <span className="traffic red" /><span className="traffic yellow" /><span className="traffic green" />
              <span className="frame-title">Koi</span>
            </div>
            <Image src={libraryImage} alt="Koi showing a visual library in a responsive masonry grid" priority sizes="(max-width: 900px) 94vw, 1080px" />
          </div>
        </section>

        <section className="features section" id="features" aria-labelledby="features-title">
          <p className="section-label">One quiet place</p>
          <h2 id="features-title">Made for collecting, not managing.</h2>
          <p className="section-intro">Koi gets out of the way while keeping every reference useful.</p>
          <div className="feature-grid">
            <Feature icon={<CaptureIcon />} title="Save from anywhere">
              Capture original media from the web, paste a link, or watch a folder on your Mac.
            </Feature>
            <Feature icon={<SearchIcon />} title="Find it naturally">
              Search names, tags, article text, colors, and sources from one compact command surface.
            </Feature>
            <Feature icon={<LockIcon />} title="Local by default">
              Your originals stay in folders you control. Koi indexes them without taking ownership.
            </Feature>
          </div>
        </section>

        <section className="ai-section section" aria-labelledby="ai-title">
          <div className="ai-copy">
            <p className="section-label">Open by design</p>
            <h2 id="ai-title">Your references, available to the tools you choose.</h2>
            <p>Connect Koi through MCP to Codex, Claude, ChatGPT, or any compatible client—with a local server and a revocable access token.</p>
          </div>
          <div className="command-card" aria-label="Example Koi command">
            <div className="command-top"><span>⌘</span><span>Search Koi</span><kbd>Esc</kbd></div>
            <div className="command-result"><SearchIcon /><span>Find warm editorial references</span><kbd>↵</kbd></div>
          </div>
        </section>

        <section className="dock-section section" aria-labelledby="dock-title">
          <div>
            <p className="section-label">At home on macOS</p>
            <h2 id="dock-title">Familiar from the first click.</h2>
            <p>Native window behavior, keyboard shortcuts, light and dark appearances, and an interface that feels calm beside your other tools.</p>
          </div>
          <Image src={dockImage} alt="Koi in a macOS Dock beside familiar apps" sizes="(max-width: 760px) 92vw, 520px" />
        </section>

        <section className="final-cta section" aria-labelledby="cta-title">
          <Image src={appIcon} alt="Koi app icon" width={76} height={76} />
          <h2 id="cta-title">Build a library worth returning to.</h2>
          <p>Save the spark now. Keep the context for later.</p>
          <a className="button primary" href={releaseUrl}>Get Koi 0.2</a>
        </section>
      </main>

      <footer>
        <a className="brand footer-brand" href="#top"><Image src={appIcon} alt="" width={24} height={24} /> Koi</a>
        <p>Local-first visual reference software.</p>
        <a href={githubUrl}>Source on GitHub</a>
      </footer>
    </>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return <article className="feature"><div className="feature-icon">{icon}</div><h3>{title}</h3><p>{children}</p></article>;
}

function CaptureIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="3" /><circle cx="9" cy="9.5" r="1.5" /><path d="m5.5 17 4.2-4 3 2.7 2.5-2.3 3.3 3.6" /></svg>;
}
function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" /></svg>;
}
function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9.5" width="16" height="11" rx="3" /><path d="M8 9.5V7a4 4 0 0 1 8 0v2.5M12 14v2" /></svg>;
}
