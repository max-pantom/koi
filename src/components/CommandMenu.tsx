import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type Command = {
  id: string;
  label: string;
  shortcut?: string;
  keywords?: string;
  run: () => void;
};

export function CommandMenu({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const listId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const filteredCommands = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return commands;
    return commands.filter((command) => `${command.label} ${command.keywords ?? ""}`.toLocaleLowerCase().includes(needle));
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const runCommand = (command?: Command) => {
    if (!command) return;
    command.run();
    onClose();
  };

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(filteredCommands.length - 1, 0)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter") {
      event.preventDefault();
      runCommand(filteredCommands[activeIndex]);
    }
  };

  const keepFocusInside = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;
    const focusable = Array.from(menuRef.current?.querySelectorAll<HTMLElement>("input, button") ?? []);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return (
    <div className="modal-layer command-layer" role="dialog" aria-modal="true" aria-label="Commands" onPointerDown={onClose}>
      <div ref={menuRef} className="command-menu" onPointerDown={(event) => event.stopPropagation()} onKeyDown={keepFocusInside}>
        <label className="sr-only" htmlFor={`${listId}-search`}>Search commands</label>
        <div className="command-search">
          <Search size={16} strokeWidth={1.7} aria-hidden="true" />
          <input
            id={`${listId}-search`}
            type="search"
            value={query}
            autoFocus
            autoComplete="off"
            spellCheck="false"
            placeholder="Type a command…"
            role="combobox"
            aria-controls={listId}
            aria-autocomplete="list"
            aria-expanded="true"
            aria-activedescendant={filteredCommands[activeIndex] ? `${listId}-${filteredCommands[activeIndex].id}` : undefined}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <kbd aria-hidden="true">Esc</kbd>
        </div>
        <div className="command-list" id={listId} role="listbox" aria-label="Available commands" tabIndex={-1}>
          {filteredCommands.map((command, index) => (
            <button
              key={command.id}
              id={`${listId}-${command.id}`}
              className={index === activeIndex ? "is-active" : ""}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onPointerMove={() => setActiveIndex(index)}
              onClick={() => runCommand(command)}
            >
              <span>{command.label}</span>
              {command.shortcut && <kbd>{command.shortcut}</kbd>}
            </button>
          ))}
          {!filteredCommands.length && (
            <p className="command-empty">No commands match “{query}”.</p>
          )}
        </div>
      </div>
    </div>
  );
}
