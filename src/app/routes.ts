import type { ViewMode } from "../lib/types";

export type AppRoute = {
  view: ViewMode;
};

export const initialRoute: AppRoute = {
  view: "grid",
};
