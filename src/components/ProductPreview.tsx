import { useEffect, useRef, useState, type PointerEventHandler } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
  Folder,
  FolderOpen,
  Image,
  MousePointer2,
  RotateCcw,
  X,
} from "lucide-react";
import koiIcon from "../../src-tauri/icons/128x128@2x.png";

type Preview = "installer" | "onboarding";

const onboardingSteps = [
  {
    eyebrow: "Welcome to Koi",
    title: "Your references, close to home.",
    body: "Turn folders on your Mac into a fast visual library—without accounts, uploads, or a new way to organize.",
  },
  {
    eyebrow: "Your library",
    title: "Start with folders you already use.",
    body: "Koi watches the folders you choose. Your originals stay where they are, and you can disconnect a folder at any time.",
  },
  {
    eyebrow: "Capture anything",
    title: "Save inspiration while it is fresh.",
    body: "Drop in files, paste from your clipboard, or use Koi Capture to save images and videos from the web.",
  },
] as const;

export type ProductPreviewKind = "installer" | "onboarding";

export function ProductPreview({
  initialPreview,
  onClose,
  onStartWindowDrag,
}: {
  initialPreview: ProductPreviewKind;
  onClose: () => void;
  onStartWindowDrag: PointerEventHandler<HTMLElement>;
}) {
  const [preview, setPreview] = useState<Preview>(initialPreview);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const step = onboardingSteps[onboardingStep];

  return (
    <section className="product-preview" aria-label="Koi product previews">
      <header className="product-preview-header" onPointerDown={onStartWindowDrag}>
        <div className="product-preview-heading">
          <span>{preview === "installer" ? "Installer" : "Onboarding"}</span>
          <span className="product-preview-badge">Preview</span>
        </div>

        <div className="product-preview-tabs" role="tablist" aria-label="Preview surface">
          <button
            type="button"
            role="tab"
            aria-selected={preview === "installer"}
            className={preview === "installer" ? "is-active" : undefined}
            onClick={() => setPreview("installer")}
          >
            Mac installer
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={preview === "onboarding"}
            className={preview === "onboarding" ? "is-active" : undefined}
            onClick={() => setPreview("onboarding")}
          >
            Onboarding
          </button>
        </div>

        <button ref={closeRef} className="product-preview-close" type="button" aria-label="Close preview" onClick={onClose}>
          <X size={15} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </header>

      <div className="product-preview-stage">
        {preview === "installer" ? (
          <InstallerPreview />
        ) : (
          <div className="onboarding-preview-wrap">
            <div className="onboarding-window">
              <NativeWindowBar title="Set up Koi" />
              <div className="onboarding-content">
                <div className="onboarding-visual" aria-hidden="true">
                  <OnboardingVisual step={onboardingStep} />
                </div>

                <div className="onboarding-copy">
                  <p className="onboarding-eyebrow">{step.eyebrow}</p>
                  <h1>{step.title}</h1>
                  <p>{step.body}</p>
                </div>

                <div className="onboarding-footer">
                  <div className="onboarding-progress" aria-label={`Step ${onboardingStep + 1} of ${onboardingSteps.length}`}>
                    {onboardingSteps.map((item, index) => (
                      <span key={item.eyebrow} className={index === onboardingStep ? "is-current" : undefined} />
                    ))}
                  </div>
                  <div className="onboarding-actions">
                    {onboardingStep > 0 && (
                      <button type="button" className="onboarding-secondary" onClick={() => setOnboardingStep((value) => value - 1)}>
                        <ArrowLeft size={14} aria-hidden="true" />
                        Back
                      </button>
                    )}
                    <button
                      type="button"
                      className="onboarding-primary"
                      onClick={() => setOnboardingStep((value) => Math.min(value + 1, onboardingSteps.length - 1))}
                    >
                      {onboardingStep === onboardingSteps.length - 1 ? "Open Koi" : "Continue"}
                      {onboardingStep === onboardingSteps.length - 1 ? <Check size={14} aria-hidden="true" /> : <ArrowRight size={14} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button className="product-preview-reset" type="button" onClick={() => setOnboardingStep(0)} disabled={onboardingStep === 0}>
              <RotateCcw size={13} aria-hidden="true" />
              Restart preview
            </button>
          </div>
        )}
      </div>

      <p className="product-preview-note">
        {preview === "installer"
          ? "Previewed at the same 660 × 420 proportions as the release DMG."
          : "This is a visual prototype. It does not run automatically on first launch yet."}
      </p>
    </section>
  );
}

function InstallerPreview() {
  return (
    <div className="installer-preview-wrap">
      <div className="installer-window" role="img" aria-label="Preview of the Koi macOS drag-to-Applications installer">
        <NativeWindowBar title="Koi" />
        <div className="installer-canvas">
          <div className="installer-glow is-one" />
          <div className="installer-glow is-two" />
          <div className="installer-mark" aria-hidden="true">K</div>

          <div className="installer-item is-koi">
            <img src={koiIcon} alt="" />
            <span>Koi</span>
          </div>

          <div className="installer-arrow" aria-hidden="true">
            <span />
            <ArrowRight size={24} strokeWidth={1.5} />
          </div>

          <div className="installer-item is-applications">
            <div className="applications-icon">
              <Folder size={64} strokeWidth={1.25} />
              <span>A</span>
            </div>
            <span>Applications</span>
          </div>

          <div className="installer-instruction">
            <strong>Drag Koi to Applications</strong>
            <span>Keep your visual references close to home.</span>
          </div>
        </div>
      </div>
      <span className="installer-size">660 × 420</span>
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

function OnboardingVisual({ step }: { step: number }) {
  if (step === 1) {
    return (
      <div className="onboarding-folder-stack">
        <div><FolderOpen size={21} /><span>Inspiration</span><small>248 items</small></div>
        <div><FolderOpen size={21} /><span>Brand</span><small>86 items</small></div>
        <div><FolderOpen size={21} /><span>Archive</span><small>1,204 items</small></div>
      </div>
    );
  }

  if (step === 2) {
    return (
      <div className="onboarding-capture">
        <div className="capture-browser">
          <span /><span /><span />
          <div className="capture-image"><Image size={26} /></div>
          <div className="capture-pointer"><MousePointer2 size={19} fill="currentColor" /></div>
        </div>
        <div className="capture-chip"><ClipboardPaste size={15} /> Save to Koi</div>
      </div>
    );
  }

  return (
    <div className="onboarding-welcome-mark">
      <div className="welcome-tile is-a" />
      <div className="welcome-tile is-b" />
      <div className="welcome-tile is-c" />
      <img src={koiIcon} alt="" />
    </div>
  );
}
