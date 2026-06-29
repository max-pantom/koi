import { useEffect, useRef } from "react";

type KeyboardActions = {
  addFolder: () => void;
  openSearch: () => void;
  closeLayer: () => void;
  openSelected: () => void;
  moveSelection: (delta: number) => void;
};

export function useKeyboard(actions: KeyboardActions) {
  const lastKey = useRef("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      const key = event.key.toLowerCase();

      if (event.metaKey && key === "o") return run(event, actions.addFolder);
      if (event.metaKey && key === "f") return run(event, actions.openSearch);

      if (isTyping && key !== "escape") return;

      if (key === "escape") return run(event, actions.closeLayer);
      if (key === "enter") return run(event, actions.openSelected);
      if (key === "arrowright" || key === "l" || key === "j") return run(event, () => actions.moveSelection(1));
      if (key === "arrowleft" || key === "h" || key === "k") return run(event, () => actions.moveSelection(-1));
      if (key === "arrowdown") return run(event, () => actions.moveSelection(6));
      if (key === "arrowup") return run(event, () => actions.moveSelection(-6));

      lastKey.current = key;
      window.setTimeout(() => {
        lastKey.current = "";
      }, 500);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [actions]);
}

function run(event: KeyboardEvent, action: () => void) {
  event.preventDefault();
  action();
}
