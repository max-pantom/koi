import { Copy, RefreshCw, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";

type McpStatus = {
  enabled: boolean;
  running: boolean;
  port: number;
  token: string;
  sidecarPath: string;
};

export function McpDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<McpStatus>();
  const [showToken, setShowToken] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => previous?.focus();
  }, []);

  useEffect(() => {
    let isActive = true;
    void invoke<McpStatus>("mcp_get_status")
      .then((next) => {
        if (isActive) setStatus(next);
      })
      .catch((error) => toast.error(`Could not check MCP: ${String(error)}`));
    return () => {
      isActive = false;
    };
  }, []);

  const setEnabled = async (enabled: boolean) => {
    setBusy(true);
    try {
      setStatus(await invoke<McpStatus>("mcp_set_enabled", { enabled }));
      toast.success(enabled ? "Koi MCP is running" : "Koi MCP is off");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setBusy(false);
    }
  };

  const regenerateToken = async () => {
    setBusy(true);
    try {
      setStatus(await invoke<McpStatus>("mcp_regenerate_token"));
      setShowToken(true);
      toast.success("New token generated. Reconnect your MCP clients.");
    } catch (error) {
      toast.error(String(error));
    } finally {
      setBusy(false);
    }
  };

  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copied`);
    } catch {
      toast.error(`Could not copy ${label.toLowerCase()}`);
    }
  };

  const keepFocusInside = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? [],
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

  const endpoint = status ? `http://127.0.0.1:${status.port}/mcp` : "http://127.0.0.1:48372/mcp";
  const token = status?.token || "";
  const hiddenToken = "<your Koi access token>";
  const sidecarPath = status?.sidecarPath || "koi-mcp";
  const visibleToken = showToken ? token : hiddenToken;
  const codexCommand = `codex mcp add koi --env KOI_MCP_TOKEN=${token} -- "${sidecarPath}"`;
  const visibleCodexCommand = `codex mcp add koi --env KOI_MCP_TOKEN=${visibleToken} -- "${sidecarPath}"`;
  const claudeCodeCommand = `claude mcp add --transport http koi ${endpoint} --header "Authorization: Bearer ${token}"`;
  const visibleClaudeCodeCommand = `claude mcp add --transport http koi ${endpoint} --header "Authorization: Bearer ${visibleToken}"`;
  const claudeDesktopJson = desktopConfig(sidecarPath, token);
  const visibleClaudeDesktopJson = desktopConfig(sidecarPath, visibleToken);
  const otherClientConfig = `URL: ${endpoint}\nAuthorization: Bearer ${token}`;
  const visibleOtherClientConfig = `URL: ${endpoint}\nAuthorization: Bearer ${visibleToken}`;
  const isOn = !!status?.enabled && !!status?.running;

  return (
    <div className="settings-layer" role="presentation" onPointerDown={onClose}>
      <section
        ref={dialogRef}
        className="mcp-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-title"
        onKeyDown={keepFocusInside}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="panel-head">
          <span id="mcp-title">AI &amp; MCP</span>
          <button type="button" onClick={onClose} aria-label="Close AI and MCP setup" title="Close">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <p className="mcp-intro">
          Run Koi as a local Model Context Protocol server so Codex, ChatGPT, Claude,
          and other compatible clients can search, read, and tag your library.
        </p>

        <div className="mcp-status-row" role="status" aria-live="polite">
          <span className={`mcp-dot${isOn ? " is-on" : status?.enabled ? " is-warn" : ""}`} aria-hidden="true" />
          <span className="mcp-status-label">
            {!status ? "Checking…" : status.enabled
              ? status.running ? `Running · ${endpoint}` : "The local port is already in use"
              : "Local server is off"}
          </span>
          <button type="button" disabled={busy || !status} onClick={() => void setEnabled(!status?.enabled)}>
            {status?.enabled ? "Turn off" : "Turn on"}
          </button>
        </div>

        <div className="mcp-section">
          <div className="mcp-section-head">
            <span>Access token</span>
            <button type="button" disabled={busy} onClick={() => void regenerateToken()} title="Generate a new token">
              <RefreshCw size={12} strokeWidth={1.8} aria-hidden="true" />
              Regenerate
            </button>
          </div>
          <div className="mcp-token-row">
            <code>{!token ? "—" : showToken ? token : `${token.slice(0, 6)}••••••••••••`}</code>
            <button type="button" onClick={() => setShowToken((current) => !current)}>
              {showToken ? "Hide" : "Show"}
            </button>
            <button type="button" onClick={() => void copy(token, "Token")} disabled={!token}>
              <Copy size={12} strokeWidth={1.8} aria-hidden="true" />
              Copy
            </button>
          </div>
        </div>

        <Snippet label="Codex & ChatGPT" hint="Run once in Terminal:" value={visibleCodexCommand} onCopy={() => void copy(codexCommand, "Codex command")} />
        <Snippet label="Claude Code" hint="Run once in Terminal:" value={visibleClaudeCodeCommand} onCopy={() => void copy(claudeCodeCommand, "Claude Code command")} />
        <Snippet label="Claude Desktop" hint="Add to the desktop MCP configuration:" value={visibleClaudeDesktopJson} onCopy={() => void copy(claudeDesktopJson, "Claude Desktop config")} />
        <Snippet label="Any other MCP client" hint="Connect over Streamable HTTP with this header:" value={visibleOtherClientConfig} onCopy={() => void copy(otherClientConfig, "Connection details")} />

        <p className="mcp-note">
          Koi listens only on this Mac. File paths are never returned. Connected clients may
          send requested library content to their configured AI provider, and replacing the token disconnects them.
        </p>
      </section>
    </div>
  );
}

function desktopConfig(sidecarPath: string, token: string) {
  return JSON.stringify({ mcpServers: { koi: { command: sidecarPath, env: { KOI_MCP_TOKEN: token } } } }, null, 2);
}

function Snippet({ label, hint, value, onCopy }: { label: string; hint: string; value: string; onCopy: () => void }) {
  return (
    <div className="mcp-section">
      <div className="mcp-section-head">
        <span>{label}</span>
        <button type="button" onClick={onCopy}>
          <Copy size={12} strokeWidth={1.8} aria-hidden="true" />
          Copy
        </button>
      </div>
      <p className="mcp-hint">{hint}</p>
      <pre className="mcp-snippet">{value}</pre>
    </div>
  );
}
