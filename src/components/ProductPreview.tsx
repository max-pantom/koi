import { useEffect, useRef, useState, type KeyboardEvent, type PointerEventHandler } from "react";
import {
  ArrowLeft,
  ArrowRight,
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

export type ProductPreviewKind = "installer" | "onboarding";

const onboardingSteps = [
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
  initialPreview,
  onClose,
  onStartWindowDrag,
}: {
  initialPreview: ProductPreviewKind;
  onClose: () => void;
  onStartWindowDrag: PointerEventHandler<HTMLElement>;
}) {
  const [preview, setPreview] = useState<ProductPreviewKind>(initialPreview);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onboardingHeadingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    (initialPreview === "onboarding" ? onboardingHeadingRef.current : closeRef.current)?.focus({ preventScroll: true });
    return () => previouslyFocused?.focus({ preventScroll: true });
  }, [initialPreview]);

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

  const selectPreview = (nextPreview: ProductPreviewKind) => {
    setPreview(nextPreview);
    if (nextPreview === "onboarding") setOnboardingStep(0);
  };

  const goToOnboardingStep = (nextStep: number) => {
    setOnboardingStep(nextStep);
    requestAnimationFrame(() => onboardingHeadingRef.current?.focus({ preventScroll: true }));
  };

  const movePreviewTab = (event: KeyboardEvent<HTMLButtonElement>, current: ProductPreviewKind) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = current === "installer" ? "onboarding" : "installer";
    selectPreview(next);
    document.querySelector<HTMLButtonElement>(`[data-preview-tab="${next}"]`)?.focus();
  };

  const step = onboardingSteps[onboardingStep];

  return (
    <section
      ref={dialogRef}
      className="product-preview"
      role="dialog"
      aria-modal="true"
      aria-label="Koi product previews"
      onKeyDown={keepFocusInside}
    >
      <header className="product-preview-header" onPointerDown={onStartWindowDrag}>
        <div className="product-preview-heading">
          <span>{preview === "installer" ? "Installer" : "Onboarding"}</span>
          <span className="product-preview-badge">Preview</span>
        </div>

        <div className="product-preview-tabs" role="tablist" aria-label="Preview surface">
          <button
            type="button"
            role="tab"
            data-preview-tab="installer"
            aria-controls="product-preview-surface"
            tabIndex={preview === "installer" ? 0 : -1}
            aria-selected={preview === "installer"}
            className={preview === "installer" ? "is-active" : undefined}
            onKeyDown={(event) => movePreviewTab(event, "installer")}
            onClick={() => selectPreview("installer")}
          >
            Mac installer
          </button>
          <button
            type="button"
            role="tab"
            data-preview-tab="onboarding"
            aria-controls="product-preview-surface"
            tabIndex={preview === "onboarding" ? 0 : -1}
            aria-selected={preview === "onboarding"}
            className={preview === "onboarding" ? "is-active" : undefined}
            onKeyDown={(event) => movePreviewTab(event, "onboarding")}
            onClick={() => selectPreview("onboarding")}
          >
            Onboarding
          </button>
        </div>

        <button ref={closeRef} className="product-preview-close" type="button" aria-label="Close preview" onClick={onClose}>
          <X size={15} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </header>

      <div id="product-preview-surface" className="product-preview-stage" role="tabpanel">
        {preview === "installer" ? (
          <InstallerPreview />
        ) : (
          <div className="onboarding-preview-wrap">
            <div className="onboarding-window">
              <NativeWindowBar title="Koi" />
              <div className="onboarding-content">
                <div className="onboarding-copy">
                  <p className="onboarding-eyebrow">{step.label}</p>
                  <h1 ref={onboardingHeadingRef} tabIndex={-1}>{step.title}</h1>
                  <p>{step.body}</p>
                </div>

                <div className="onboarding-visual" aria-hidden="true">
                  <OnboardingVisual step={onboardingStep} />
                </div>

                <div className="onboarding-footer">
                  <div className="onboarding-progress" aria-label={`Step ${onboardingStep + 1} of ${onboardingSteps.length}`}>
                    {onboardingSteps.map((item, index) => (
                      <button
                        key={item.label}
                        type="button"
                        className={index === onboardingStep ? "is-current" : undefined}
                        aria-label={`Go to ${item.label}`}
                        aria-current={index === onboardingStep ? "step" : undefined}
                        onClick={() => goToOnboardingStep(index)}
                      />
                    ))}
                  </div>

                  <div className="onboarding-actions">
                    {onboardingStep > 0 && (
                      <button type="button" className="onboarding-secondary" onClick={() => goToOnboardingStep(onboardingStep - 1)}>
                        <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
                        Back
                      </button>
                    )}
                    <button
                      type="button"
                      className="onboarding-primary"
                      onClick={() => {
                        if (onboardingStep === onboardingSteps.length - 1) onClose();
                        else goToOnboardingStep(onboardingStep + 1);
                      }}
                    >
                      {onboardingStep === onboardingSteps.length - 1 ? "Open Koi" : "Next"}
                      {onboardingStep === onboardingSteps.length - 1
                        ? <Check size={14} strokeWidth={1.8} aria-hidden="true" />
                        : <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="product-preview-note">
        {preview === "installer"
          ? "This artwork is now connected to the release DMG."
          : "Shown once on first launch. You can reopen it from Settings anytime."}
      </p>
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

function OnboardingVisual({ step }: { step: number }) {
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
