type SoundEvent =
  | "folder_added"
  | "focus_open"
  | "focus_close"
  | "select"
  | "search_open"
  | "command_open"
  | "copy"
  | "error";

const DEFAULT_VOLUME = 0.28;
let audioContext: AudioContext | null = null;
let lastSelectAt = 0;

export function playSound(event: SoundEvent) {
  const enabled = localStorage.getItem("koi.soundEnabled") ?? "true";
  if (enabled !== "true") return;

  if (event === "select") {
    const now = performance.now();
    if (now - lastSelectAt < 90) return;
    lastSelectAt = now;
  }

  try {
    audioContext ??= new AudioContext();
    const volume = Number(localStorage.getItem("koi.soundVolume") ?? DEFAULT_VOLUME);
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const oscillator = audioContext.createOscillator();
    const [frequency, duration] = soundShape(event);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.78, now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.08), now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  } catch {
    // Audio should never block interaction.
  }
}

export function areSoundsEnabled() {
  return (localStorage.getItem("koi.soundEnabled") ?? "true") === "true";
}

export function setSoundsEnabled(enabled: boolean) {
  localStorage.setItem("koi.soundEnabled", enabled ? "true" : "false");
  if (enabled) playSound("command_open");
}

function soundShape(event: SoundEvent): [number, number] {
  if (event === "focus_open") return [680, 0.12];
  if (event === "focus_close") return [420, 0.1];
  if (event === "folder_added") return [520, 0.14];
  if (event === "search_open") return [760, 0.08];
  if (event === "command_open") return [620, 0.08];
  if (event === "copy") return [880, 0.07];
  if (event === "error") return [180, 0.16];
  return [540, 0.045];
}
