import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import { onboardingSteps, OnboardingVisual } from "./ProductPreview";

// This key is intentionally not versioned. Completing onboarding once should remain
// valid across app updates; versioned keys made existing users see it again.
export const ONBOARDING_STORAGE_KEY = "koi.onboarding.completed";
export const LEGACY_ONBOARDING_STORAGE_KEYS = [
  "koi.onboarding.v1.completed",
  "koi.onboarding.v2.completed",
] as const;

export function OnboardingWindow() {
  const [stepIndex, setStepIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const step = onboardingSteps[stepIndex];

  const finish = async () => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    await getCurrentWindow().hide();
  };

  const goToStep = (next: number) => {
    setStepIndex(next);
    requestAnimationFrame(() => headingRef.current?.focus({ preventScroll: true }));
  };

  useEffect(() => {
    document.documentElement.classList.add("koi-dark", "is-onboarding-surface");
    headingRef.current?.focus({ preventScroll: true });
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow().onCloseRequested((event) => {
      event.preventDefault();
      void finish();
    }).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    });
    return () => {
      disposed = true;
      unlisten?.();
      document.documentElement.classList.remove("koi-dark", "is-onboarding-surface");
    };
  }, []);

  return (
    <main className="onboarding-surface" onKeyDown={(event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        void finish();
      }
    }}>
      <div className="onboarding-window-drag" data-tauri-drag-region aria-hidden="true" />
      <section className="onboarding-content" aria-labelledby="onboarding-heading">
        <div className="onboarding-copy">
          <p className="onboarding-eyebrow">{step.label}</p>
          <h1 id="onboarding-heading" ref={headingRef} tabIndex={-1}>{step.title}</h1>
          <p>{step.body}</p>
        </div>

        <div className="onboarding-visual" aria-hidden="true">
          <OnboardingVisual step={stepIndex} />
        </div>

        <footer className="onboarding-footer">
          <div className="onboarding-progress" aria-label={`Step ${stepIndex + 1} of ${onboardingSteps.length}`}>
            {onboardingSteps.map((item, index) => (
              <button
                key={item.label}
                type="button"
                className={index === stepIndex ? "is-current" : undefined}
                aria-label={`Go to ${item.label}`}
                aria-current={index === stepIndex ? "step" : undefined}
                onClick={() => goToStep(index)}
              />
            ))}
          </div>

          <div className="onboarding-actions">
            {stepIndex > 0 && (
              <button type="button" className="onboarding-secondary" onClick={() => goToStep(stepIndex - 1)}>
                <ArrowLeft size={14} strokeWidth={1.8} aria-hidden="true" />
                Back
              </button>
            )}
            <button
              type="button"
              className="onboarding-primary"
              onClick={() => {
                if (stepIndex === onboardingSteps.length - 1) void finish();
                else goToStep(stepIndex + 1);
              }}
            >
              {stepIndex === onboardingSteps.length - 1 ? "Open Koi" : "Next"}
              {stepIndex === onboardingSteps.length - 1
                ? <Check size={14} strokeWidth={1.8} aria-hidden="true" />
                : <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />}
            </button>
          </div>
        </footer>
      </section>
    </main>
  );
}
