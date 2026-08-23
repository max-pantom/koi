import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app/App";

const LocalAgentation = import.meta.env.DEV
  ? lazy(() => import("./components/LocalAgentation").then((module) => ({ default: module.LocalAgentation })))
  : undefined;

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    {LocalAgentation && (
      <Suspense fallback={null}>
        <LocalAgentation />
      </Suspense>
    )}
  </React.StrictMode>,
);
