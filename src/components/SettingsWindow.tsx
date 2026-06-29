import { Moon, Volume2, X } from "lucide-react";

export function SettingsWindow({
  isDark,
  soundsEnabled,
  onToggleDark,
  onToggleSounds,
  onClose,
}: {
  isDark: boolean;
  soundsEnabled: boolean;
  onToggleDark: () => void;
  onToggleSounds: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-layer" role="dialog" aria-modal="true" onPointerDown={onClose}>
      <section className="settings-window" onPointerDown={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <span>Settings</span>
          <button type="button" onClick={onClose} title="Close">
            <X size={15} />
          </button>
        </div>
        <button type="button" onClick={onToggleDark}>
          <Moon size={15} />
          <span>Dark mode</span>
          <kbd>{isDark ? "On" : "Off"}</kbd>
        </button>
        <button type="button" onClick={onToggleSounds}>
          <Volume2 size={15} />
          <span>Sounds</span>
          <kbd>{soundsEnabled ? "On" : "Off"}</kbd>
        </button>
      </section>
    </div>
  );
}
