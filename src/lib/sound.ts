type SoundEvent =
  | "folder_added"
  | "focus_open"
  | "focus_close"
  | "select"
  | "search_open"
  | "command_open"
  | "copy"
  | "error";

const DEFAULT_VOLUME = 0.46;
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
    void audioContext.resume();
    const volume = getSoundVolume();
    const now = audioContext.currentTime;
    const gain = audioContext.createGain();
    const oscillator = audioContext.createOscillator();
    const bass = audioContext.createOscillator();
    const [frequency, duration] = soundShape(event);

    oscillator.type = "triangle";
    bass.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    bass.frequency.setValueAtTime(Math.max(80, frequency * 0.42), now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.7, now + duration);
    bass.frequency.exponentialRampToValueAtTime(Math.max(70, frequency * 0.34), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, volume * 0.16), now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gain);
    bass.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(now);
    bass.start(now);
    oscillator.stop(now + duration + 0.02);
    bass.stop(now + duration + 0.02);
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

export function getSoundVolume() {
  const volume = Number(localStorage.getItem("koi.soundVolume") ?? DEFAULT_VOLUME);
  return Number.isFinite(volume) ? Math.min(Math.max(volume, 0), 1) : DEFAULT_VOLUME;
}

export function setSoundVolume(volume: number) {
  localStorage.setItem("koi.soundVolume", String(Math.min(Math.max(volume, 0), 1)));
  playSound("select");
}

function soundShape(event: SoundEvent): [number, number] {
  if (event === "focus_open") return [360, 0.16];
  if (event === "focus_close") return [260, 0.14];
  if (event === "folder_added") return [320, 0.16];
  if (event === "search_open") return [440, 0.1];
  if (event === "command_open") return [330, 0.1];
  if (event === "copy") return [520, 0.08];
  if (event === "error") return [140, 0.18];
  return [300, 0.055];
}
