import { useEffect, useRef } from "react";

type KeyboardActions = {
  addFolder: () => void;
  openCommandMenu: () => void;
  openSearch: () => void;
  closeLayer: () => void;
  openSelected: () => void;
  quickLook: () => void;
  toggleSimilar: () => void;
  moveSelection: (delta: number) => void;
  revealInFinder: () => void;
  copyImage: () => void;
  copyPath: () => void;
  copyName: () => void;
  largerThumbnails: () => void;
  smallerThumbnails: () => void;
  resetThumbnails: () => void;
  openInbox: () => void;
};

export function useKeyboard(actions: KeyboardActions) {
  const lastKey = useRef("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      const key = event.key.toLowerCase();

      if (event.metaKey && key === "o") return run(event, actions.addFolder);
      if (event.metaKey && key === "k") return run(event, actions.openCommandMenu);
      if (event.metaKey && key === "f") return run(event, actions.openSearch);
      if (event.metaKey && event.shiftKey && key === "r") return run(event, actions.revealInFinder);
      if (event.metaKey && event.shiftKey && key === "c") return run(event, actions.copyPath);
      if (event.metaKey && event.altKey && key === "c") return run(event, actions.copyName);
      if (event.metaKey && event.shiftKey && key === "i") return run(event, actions.openInbox);
      if (event.metaKey && (key === "=" || key === "+")) return run(event, actions.largerThumbnails);
      if (event.metaKey && key === "-") return run(event, actions.smallerThumbnails);
      if (event.metaKey && key === "0") return run(event, actions.resetThumbnails);
      if (event.metaKey && key === "c") return run(event, actions.copyImage);

      if (isTyping && key !== "escape") return;

      if (key === "escape") return run(event, actions.closeLayer);
      if (key === "enter") return run(event, actions.openSelected);
      if (key === " ") return run(event, actions.quickLook);
      if (key === "s") return run(event, actions.toggleSimilar);
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
