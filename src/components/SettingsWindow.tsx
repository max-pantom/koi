import { AlignJustify, Moon, Volume2, X } from "lucide-react";
import type { GridLayout } from "../lib/types";

export function SettingsWindow({
  isDark,
  soundsEnabled,
  soundVolume,
  gridLayout,
  onToggleDark,
  onToggleSounds,
  onSoundVolumeChange,
  onGridLayoutChange,
  onClose,
}: {
  isDark: boolean;
  soundsEnabled: boolean;
  soundVolume: number;
  gridLayout: GridLayout;
  onToggleDark: () => void;
  onToggleSounds: () => void;
  onSoundVolumeChange: (volume: number) => void;
  onGridLayoutChange: (layout: GridLayout) => void;
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
        <label className="setting-slider">
          <Volume2 size={15} />
          <span>Sound scale</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={soundVolume}
            onChange={(event) => onSoundVolumeChange(Number(event.target.value))}
          />
        </label>
        <button
          type="button"
          onClick={() => onGridLayoutChange(gridLayout === "packed" ? "aligned" : "packed")}
        >
          <AlignJustify size={15} />
          <span>Aligned grid</span>
          <kbd>{gridLayout === "aligned" ? "On" : "Off"}</kbd>
        </button>
      </section>
    </div>
  );
}
