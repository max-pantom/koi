import { Search, X } from "lucide-react";
import { shortcuts } from "../lib/shortcuts";

type Command = {
  id: string;
  label: string;
  shortcut: string;
  run: () => void;
};

export function CommandMenu({
  commands,
  onClose,
}: {
  commands: Command[];
  onClose: () => void;
}) {
  return (
    <div className="modal-layer command-layer" role="dialog" aria-modal="true" onMouseDown={onClose}>
      <div className="command-menu" onMouseDown={(event) => event.stopPropagation()}>
        <div className="command-head">
          <Search size={15} />
          <span>Command menu</span>
          <button type="button" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>
        <div className="command-list">
          {commands.map((command) => (
            <button
              key={command.id}
              type="button"
              onClick={() => {
                command.run();
                onClose();
              }}
            >
              <span>{command.label}</span>
              <kbd>{command.shortcut}</kbd>
            </button>
          ))}
        </div>
        <div className="shortcut-list">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.keys}>
              <kbd>{shortcut.keys}</kbd>
              <span>{shortcut.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
