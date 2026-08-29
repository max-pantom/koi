import { Bug, Copy, Lightbulb, MessageSquareHeart, Send, X } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";

const GITHUB_NEW_ISSUE_URL = "https://github.com/max-pantom/koi/issues/new";

type FeedbackKind = "bug" | "idea" | "praise";

const KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "Something broke",
  idea: "Feature idea",
  praise: "Just appreciating Koi",
};

export function FeedbackDialog({
  diagnostics,
  onClose,
  onCopied,
}: {
  diagnostics: string;
  onClose: () => void;
  onCopied: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
    return () => previous?.focus();
  }, []);

  const report = buildReport(kind, message, contact, includeDiagnostics ? diagnostics : "");

  const submit = () => {
    setSubmitted(true);
    if (!message.trim()) {
      dialogRef.current?.querySelector<HTMLTextAreaElement>("textarea")?.focus();
      return;
    }
    const title = `[${KIND_LABELS[kind]}] ${firstLine(message)}`;
    const url = `${GITHUB_NEW_ISSUE_URL}?labels=feedback&title=${encodeURIComponent(title)}&body=${encodeURIComponent(report)}`;
    void openUrl(url);
    onClose();
  };

  const copyReport = async () => {
    await navigator.clipboard.writeText(report);
    onCopied();
  };

  const keepFocusInside = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled]), input:not([disabled]), textarea:not([disabled])") ?? [],
    );
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
      <section
        ref={dialogRef}
        className="feedback-window"
        role="dialog"
        aria-modal="true"
        aria-label="Send feedback"
        onKeyDown={keepFocusInside}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="panel-head">
          <span>Send feedback</span>
          <button type="button" onClick={onClose} aria-label="Close feedback" title="Close">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="feedback-kinds" role="group" aria-label="Feedback type">
          {(["bug", "idea", "praise"] as FeedbackKind[]).map((option) => (
            <button
              key={option}
              className={kind === option ? "is-active" : ""}
              type="button"
              aria-pressed={kind === option}
              onClick={() => setKind(option)}
            >
              {option === "praise"
                ? <MessageSquareHeart size={13} aria-hidden="true" />
                : option === "idea"
                  ? <Lightbulb size={13} aria-hidden="true" />
                  : <Bug size={13} aria-hidden="true" />}
              <span>{KIND_LABELS[option]}</span>
            </button>
          ))}
        </div>

        <label className="feedback-field">
          <span>Your feedback</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What happened, or what would make Koi better?"
            rows={6}
            maxLength={2000}
            aria-invalid={submitted && !message.trim()}
            aria-describedby={submitted && !message.trim() ? "feedback-message-error" : undefined}
          />
        </label>
        {submitted && !message.trim() && <p id="feedback-message-error" className="feedback-error">Add a short message before continuing.</p>}

        <label className="feedback-field">
          <span>Contact <small>Optional</small></span>
          <input
            className="feedback-contact"
            type="text"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="Email or GitHub handle"
            maxLength={120}
            spellCheck="false"
            autoComplete="off"
          />
        </label>

        <label className="feedback-diagnostics">
          <input
            type="checkbox"
            checked={includeDiagnostics}
            onChange={(event) => setIncludeDiagnostics(event.target.checked)}
          />
          <span>Include version info</span>
        </label>

        <div className="feedback-actions">
          <button type="button" onClick={() => void copyReport()}>
            <Copy size={14} aria-hidden="true" />
            <span>Copy report</span>
          </button>
          <button
            type="button"
            className="is-primary"
            onClick={submit}
          >
            <Send size={14} aria-hidden="true" />
            <span>Continue to GitHub</span>
            <kbd aria-hidden="true">↗</kbd>
          </button>
        </div>

        <p className="feedback-note">Opens a public, prefilled GitHub issue. Contact details you include will also be public.</p>
      </section>
    </div>
  );
}

function buildReport(kind: FeedbackKind, message: string, contact: string, diagnostics: string) {
  const sections = [
    `**${KIND_LABELS[kind]}**`,
    "",
    message.trim(),
  ];
  if (contact.trim()) sections.push("", `Contact: ${contact.trim()}`);
  if (diagnostics) sections.push("", "---", "", "```", diagnostics, "```");
  return sections.join("\n");
}

function firstLine(message: string) {
  const line = message.trim().split("\n")[0] || "Feedback";
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}
