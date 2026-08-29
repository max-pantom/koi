import { useEffect, useRef, type KeyboardEvent, type PointerEventHandler } from "react";
import {
  Check,
  ClipboardPaste,
  Folder,
  FolderOpen,
  Image,
  MousePointer2,
  X,
} from "lucide-react";
import koiIcon from "../../src-tauri/icons/128x128@2x.png";
import dmgBackground from "../../src-tauri/dmg-background.png";
import applicationsFolderIcon from "../assets/macos-applications-folder.png";
import libraryPreview from "../assets/onboarding-library.jpg";

export const onboardingSteps = [
  {
    label: "Welcome",
    title: "Everything you save,\nin one beautiful place.",
    body: "Koi turns the folders on your Mac into a fast visual library. No uploads, no accounts, and no new way to organize.",
  },
  {
    label: "Your folders",
    title: "Start with folders\nyou already trust.",
    body: "Choose the places where your references already live. Koi watches them quietly and never moves the originals.",
  },
  {
    label: "Koi Capture",
    title: "Catch inspiration\nwithout breaking flow.",
    body: "Drop in files, paste from your clipboard, or save images and videos from the web with Koi Capture.",
  },
] as const;

export function ProductPreview({
  onClose,
  onStartWindowDrag,
}: {
  initialPreview: "installer";
  onClose: () => void;
  onStartWindowDrag: PointerEventHandler<HTMLElement>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    closeRef.current?.focus({ preventScroll: true });
    return () => previouslyFocused?.focus({ preventScroll: true });
  }, []);

  const keepFocusInside = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <section
      ref={dialogRef}
      className="product-preview"
      role="dialog"
      aria-modal="true"
      aria-label="Koi installer preview"
      onKeyDown={keepFocusInside}
    >
      <header className="product-preview-header" onPointerDown={onStartWindowDrag}>
        <div className="product-preview-heading">
          <span>Installer</span>
          <span className="product-preview-badge">Preview</span>
        </div>

        <button ref={closeRef} className="product-preview-close" type="button" aria-label="Close preview" onClick={onClose}>
          <X size={15} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </header>

      <div id="product-preview-surface" className="product-preview-stage">
        <InstallerPreview />
      </div>

      <p className="product-preview-note">This artwork is connected to the release DMG.</p>
    </section>
  );
}

function InstallerPreview() {
  return (
    <div className="installer-preview-wrap">
      <div className="installer-window" role="img" aria-label="Preview of the Koi macOS drag-to-Applications installer">
        <NativeWindowBar title="Koi" />
        <div className="installer-canvas" style={{ backgroundImage: `url(${dmgBackground})` }}>
          <div className="installer-item is-koi">
            <img src={koiIcon} alt="" />
            <span>Koi</span>
          </div>

          <div className="installer-item is-applications">
            <img className="applications-folder-icon" src={applicationsFolderIcon} alt="" />
            <span>Applications</span>
          </div>
        </div>
      </div>
      <span className="installer-size">520 × 620</span>
    </div>
  );
}

function NativeWindowBar({ title }: { title: string }) {
  return (
    <div className="native-window-bar" aria-hidden="true">
      <span className="native-dot is-red" />
      <span className="native-dot is-yellow" />
      <span className="native-dot is-green" />
      <strong>{title}</strong>
    </div>
  );
}

export function OnboardingVisual({ step }: { step: number }) {
  return (
    <div className={`onboarding-product-scene is-step-${step}`}>
      <div className="onboarding-library-window">
        <div className="onboarding-library-bar">
          <span /><span /><span />
          <small>Koi library</small>
        </div>
        <img src={libraryPreview} alt="" />
      </div>

      {step === 0 && (
        <div className="onboarding-local-chip">
          <img src={koiIcon} alt="" />
          <span><strong>3,716 references</strong><small>Indexed locally</small></span>
        </div>
      )}

      {step === 1 && (
        <div className="onboarding-folder-panel">
          <div className="folder-panel-heading"><FolderOpen size={15} /><span>Choose folders</span></div>
          <div><FolderOpen size={17} /><span>Inspiration</span><Check size={13} /></div>
          <div><FolderOpen size={17} /><span>Pond studies</span><Check size={13} /></div>
          <div className="folder-panel-add"><Folder size={14} /> Add another folder</div>
        </div>
      )}

      {step === 2 && (
        <div className="onboarding-capture-panel">
          <div className="capture-panel-preview"><Image size={25} /></div>
          <div className="capture-panel-copy"><small>pond.jpg · original</small><strong>Original image</strong></div>
          <div className="capture-panel-action"><ClipboardPaste size={14} /> Save to Koi</div>
          <MousePointer2 className="capture-panel-pointer" size={20} fill="currentColor" />
        </div>
      )}
    </div>
  );
}
