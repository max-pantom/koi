import { AlignJustify, ChevronDown, Download, MessageSquareText, MonitorDown, Moon, Palette, RefreshCw, Sparkles, Volume2, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { getVersion } from "@tauri-apps/api/app";
import type { GridLayout } from "../lib/types";
import type { ColorFormat } from "../lib/colors";
import packageInfo from "../../package.json";

export function SettingsWindow({
  isDark,
  soundsEnabled,
  soundVolume,
  gridLayout,
  showImageTooltips,
  colorFormat,
  updateStatus,
  onToggleDark,
  onToggleSounds,
  onSoundVolumeChange,
  onGridLayoutChange,
  onToggleImageTooltips,
  onColorFormatChange,
  onDownloadExtension,
  onCheckForUpdates,
  onPreviewInstaller,
  onPreviewOnboarding,
  onClose,
}: {
  isDark: boolean;
  soundsEnabled: boolean;
  soundVolume: number;
  gridLayout: GridLayout;
  showImageTooltips: boolean;
  colorFormat: ColorFormat;
  updateStatus: string;
  onToggleDark: () => void;
  onToggleSounds: () => void;
  onSoundVolumeChange: (volume: number) => void;
  onGridLayoutChange: (layout: GridLayout) => void;
  onToggleImageTooltips: () => void;
  onColorFormatChange: (format: ColorFormat) => void;
  onDownloadExtension: () => void;
  onCheckForUpdates: () => void;
  onPreviewInstaller: () => void;
  onPreviewOnboarding: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [appVersion, setAppVersion] = useState(packageInfo.version);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    let isActive = true;
    const refreshVersion = () => {
      void getVersion().then((version) => {
        if (isActive) setAppVersion(version);
      }).catch(() => undefined);
    };
    const onVisibilityChange = () => {
      if (!document.hidden) refreshVersion();
    };
    refreshVersion();
    window.addEventListener("focus", refreshVersion);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      isActive = false;
      window.removeEventListener("focus", refreshVersion);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const keepFocusInside = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button, input, select") ?? []);
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
    <div className="settings-layer" role="presentation" onPointerDown={onClose}>
      <section ref={dialogRef} className="settings-window" role="dialog" aria-modal="true" aria-label="Settings" onKeyDown={keepFocusInside} onPointerDown={(event) => event.stopPropagation()}>
        <div className="panel-head">
          <span>Settings</span>
          <button type="button" onClick={onClose} aria-label="Close settings" title="Close">
            <X size={15} aria-hidden="true" />
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
        <button type="button" onClick={onToggleImageTooltips}>
          <MessageSquareText size={15} aria-hidden="true" />
          <span>Image name tips</span>
          <kbd>{showImageTooltips ? "On" : "Off"}</kbd>
        </button>
        <label className="setting-select">
          <Palette size={15} aria-hidden="true" />
          <span>Copied color format</span>
          <span className="setting-select-control">
            <select aria-label="Copied color format" value={colorFormat} onChange={(event) => onColorFormatChange(event.target.value as ColorFormat)}>
              <option value="hex">HEX</option>
              <option value="rgb">RGB</option>
              <option value="hsl">HSL</option>
            </select>
            <ChevronDown size={12} strokeWidth={1.8} aria-hidden="true" />
          </span>
        </label>
        <button type="button" onClick={onDownloadExtension}>
          <Download size={15} aria-hidden="true" />
          <span>Download extension</span>
          <kbd aria-hidden="true">↗</kbd>
        </button>
        <button type="button" onClick={onPreviewInstaller}>
          <MonitorDown size={15} aria-hidden="true" />
          <span>Preview installer</span>
          <kbd aria-hidden="true">↗</kbd>
        </button>
        <button type="button" onClick={onPreviewOnboarding}>
          <Sparkles size={15} aria-hidden="true" />
          <span>Preview onboarding</span>
          <kbd aria-hidden="true">↗</kbd>
        </button>
        <button type="button" onClick={onCheckForUpdates} disabled={updateStatus === "Checking…" || updateStatus === "Downloading…" || updateStatus === "Installing…"}>
          <RefreshCw className={updateStatus === "Checking…" ? "is-spinning" : undefined} size={15} aria-hidden="true" />
          <span>Check for updates</span>
          <kbd>{updateStatus}</kbd>
        </button>
        <p className="settings-version">Koi {appVersion}</p>
      </section>
    </div>
  );
}
