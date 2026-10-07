import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";
import { OnboardingWindow } from "./components/OnboardingWindow";

const LocalAgentation = import.meta.env.DEV
  ? lazy(() => import("./components/LocalAgentation").then((module) => ({ default: module.LocalAgentation })))
  : undefined;

const isOnboarding = new URLSearchParams(window.location.search).get("surface") === "onboarding";
const isMacOS = navigator.userAgent.includes("Macintosh") || navigator.platform.startsWith("Mac");
document.documentElement.classList.toggle("is-macos", isMacOS && !isOnboarding);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {isOnboarding ? <OnboardingWindow /> : <App />}
    {LocalAgentation && (
      <Suspense fallback={null}>
        <LocalAgentation />
      </Suspense>
    )}
  </React.StrictMode>,
);
