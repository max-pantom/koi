import Image from "next/image";
import type { ReactNode } from "react";
import appIcon from "../../src-tauri/icons/128x128@2x.png";
import libraryImage from "../../docs/images/image.png";
import dockImage from "../../docs/images/koi-icon-dock-earthy.jpg";

const githubUrl = "https://github.com/max-pantom/koi";
const releaseUrl = `${githubUrl}/releases/latest`;
const captureUrl = `${githubUrl}/releases`;

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
            <a href="#downloads">Downloads</a>
            <a href={githubUrl}>GitHub</a>
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
          <p className="section-label">Everything in one place</p>
          <h2 id="features-title">Save quickly. Find anything. Keep the original.</h2>
          <p className="section-intro">Koi 0.2 covers the full reference workflow without accounts, uploads, or a new folder system.</p>
          <div className="feature-grid">
            <Feature icon={<CaptureIcon />} title="Koi Capture">
              Save images, GIFs, videos, pages, and articles from Chrome while preserving their source details.
            </Feature>
            <Feature icon={<DownloadIcon />} title="Original social media">
              Resolve supported social links to their original image or video instead of storing a flattened bookmark.
            </Feature>
            <Feature icon={<FolderIcon />} title="Folders you control">
              Turn existing folders into visual libraries and watch them for changes without moving your files.
            </Feature>
            <Feature icon={<SearchIcon />} title="Find it naturally">
              Search names, tags, article text, colors, and sources from one compact command surface.
            </Feature>
            <Feature icon={<VideoIcon />} title="Images, GIFs, and video">
              Browse mixed media together, play supported video in place, and inspect originals in a focused preview.
            </Feature>
            <Feature icon={<ArticleIcon />} title="Read saved articles">
              Preserve readable article text as Markdown and return to it inside a distraction-free preview.
            </Feature>
            <Feature icon={<PaletteIcon />} title="Use the colors">
              Extract useful palettes in the background and copy them as HEX, RGB, or HSL when you need them.
            </Feature>
            <Feature icon={<CommandIcon />} title="Stay on the keyboard">
              Search, rescan, paste, reveal, copy, and connect MCP clients through Command-K.
            </Feature>
            <Feature icon={<LockIcon />} title="Local and private">
              Your originals, tags, palettes, and capture metadata stay on your computer in folders you control.
            </Feature>
          </div>
        </section>

        <section className="capture-section section" aria-labelledby="capture-title">
          <div>
            <p className="section-label">Koi Capture</p>
            <h2 id="capture-title">Send the web straight to your library.</h2>
          </div>
          <div className="capture-copy">
            <p>The optional Chrome extension adds quick save and folder selection to your browser. It can collect visible Instagram carousels, discover direct social media, preserve article text and bylines, and save videos alongside images.</p>
            <a className="text-link" href={captureUrl}>Download Koi Capture <span aria-hidden="true">↗</span></a>
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

        <section className="downloads section" id="downloads" aria-labelledby="downloads-title">
          <p className="section-label">Downloads</p>
          <h2 id="downloads-title">Choose your platform.</h2>
          <p className="section-intro">Every desktop build and the browser extension are published together on GitHub Releases.</p>
          <div className="download-grid">
            <DownloadCard platform="macOS" detail="Apple Silicon or Intel · DMG" href={releaseUrl} />
            <DownloadCard platform="Windows" detail="64-bit · MSI or setup EXE" href={releaseUrl} />
            <DownloadCard platform="Linux" detail="64-bit · AppImage or DEB" href={releaseUrl} />
            <DownloadCard platform="Koi Capture" detail="Chrome extension · ZIP" href={captureUrl} />
          </div>
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

function DownloadCard({ platform, detail, href }: { platform: string; detail: string; href: string }) {
  return <a className="download-card" href={href}><span><strong>{platform}</strong><small>{detail}</small></span><span aria-hidden="true">↓</span></a>;
}

function CaptureIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4" width="17" height="16" rx="3" /><circle cx="9" cy="9.5" r="1.5" /><path d="m5.5 17 4.2-4 3 2.7 2.5-2.3 3.3 3.6" /></svg>;
}
function SearchIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m15.5 15.5 4 4" /></svg>;
}
function DownloadIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></svg>;
}
function FolderIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6l2-2h9v13h-17z" /></svg>;
}
function VideoIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="13" height="14" rx="3" /><path d="m16.5 10 4-2v8l-4-2" /></svg>;
}
function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="9.5" width="16" height="11" rx="3" /><path d="M8 9.5V7a4 4 0 0 1 8 0v2.5M12 14v2" /></svg>;
}
function ArticleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M9 12h6M9 15.5h6" /></svg>;
}
function PaletteIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 0 0 17h1.2a1.8 1.8 0 0 0 0-3.6h-.7a1.4 1.4 0 0 1 0-2.8H16a4.5 4.5 0 0 0 4.5-4.5c0-3.4-3.8-6.1-8.5-6.1Z" /><circle cx="7.8" cy="10" r=".8" /><circle cx="10" cy="6.8" r=".8" /><circle cx="14" cy="6.8" r=".8" /></svg>;
}
function CommandIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 8H6.8a2.8 2.8 0 1 1 2.8-2.8V19a2.8 2.8 0 1 1-2.8-2.8H17a2.8 2.8 0 1 1-2.8 2.8V5.2A2.8 2.8 0 1 1 17 8Z" /></svg>;
}
