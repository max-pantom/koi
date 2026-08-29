import { Copy, Eye, EyeOff, RefreshCw, X } from "lucide-react";
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

type McpClient = "codex" | "claude-code" | "claude-desktop" | "other";

const CLIENT_LABELS: Record<McpClient, string> = {
  codex: "Codex and ChatGPT",
  "claude-code": "Claude Code",
  "claude-desktop": "Claude Desktop",
  other: "Other MCP client",
};

export function McpDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<McpStatus>();
  const [client, setClient] = useState<McpClient>("codex");
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
      dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not([disabled]), select:not([disabled]), summary, input:not([disabled])",
      ) ?? [],
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
  const setup = getClientSetup(client, endpoint, sidecarPath, token);
  const previewSetup = getClientSetup(client, endpoint, sidecarPath, showToken ? token : hiddenToken);
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
          <span id="mcp-title">Connect Koi</span>
          <button type="button" onClick={onClose} aria-label="Close MCP setup" title="Close">
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <p className="mcp-intro">
          Let any compatible AI client search, read, and tag your local Koi library.
        </p>

        <div className="mcp-status-row" role="status" aria-live="polite">
          <span className={`mcp-dot${isOn ? " is-on" : status?.enabled ? " is-warn" : ""}`} aria-hidden="true" />
          <span className="mcp-status-label">
            {!status ? "Checking local server…" : status.enabled
              ? status.running ? "Local server is running" : "The local port is already in use"
              : "Local server is off"}
          </span>
          <button type="button" disabled={busy || !status} onClick={() => void setEnabled(!status?.enabled)}>
            {status?.enabled ? "Turn off" : "Turn on"}
          </button>
        </div>

        <label className="mcp-client-field">
          <span>Connect with</span>
          <select value={client} onChange={(event) => setClient(event.target.value as McpClient)}>
            {Object.entries(CLIENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <div className="mcp-setup-card">
          <div className="mcp-setup-head">
            <div>
              <strong>{CLIENT_LABELS[client]}</strong>
              <span>{previewSetup.hint}</span>
            </div>
            <button type="button" onClick={() => void copy(setup.value, setup.copyLabel)} disabled={!token}>
              <Copy size={13} strokeWidth={1.8} aria-hidden="true" />
              Copy setup
            </button>
          </div>
          <pre className="mcp-snippet">{previewSetup.value}</pre>
        </div>

        <details className="mcp-details">
          <summary>Connection details</summary>
          <div className="mcp-detail-row">
            <span>Access token</span>
            <code>{!token ? "—" : showToken ? token : `${token.slice(0, 6)}••••••••••••`}</code>
            <button type="button" onClick={() => setShowToken((current) => !current)} aria-label={showToken ? "Hide access token" : "Show access token"}>
              {showToken ? <EyeOff size={13} aria-hidden="true" /> : <Eye size={13} aria-hidden="true" />}
            </button>
            <button type="button" onClick={() => void copy(token, "Token")} disabled={!token} aria-label="Copy access token">
              <Copy size={13} aria-hidden="true" />
            </button>
          </div>
          <div className="mcp-detail-row">
            <span>Address</span>
            <code>{endpoint}</code>
            <button type="button" onClick={() => void copy(endpoint, "Address")} aria-label="Copy MCP address">
              <Copy size={13} aria-hidden="true" />
            </button>
          </div>
          <button className="mcp-regenerate" type="button" disabled={busy} onClick={() => void regenerateToken()}>
            <RefreshCw size={13} strokeWidth={1.8} aria-hidden="true" />
            Replace access token
          </button>
        </details>

        <p className="mcp-note">
          Koi listens only on this Mac. Connected clients may send requested library content to their AI provider.
        </p>
      </section>
    </div>
  );
}

function getClientSetup(
  client: McpClient,
  endpoint: string,
  sidecarPath: string,
  token: string,
): { value: string; hint: string; copyLabel: string } {
  if (client === "codex") {
    return {
      value: `codex mcp add koi --env KOI_MCP_TOKEN=${token} -- "${sidecarPath}"`,
      hint: "Run once in Terminal. Codex CLI, the IDE extension, and ChatGPT share this setup.",
      copyLabel: "Codex command",
    };
  }
  if (client === "claude-code") {
    return {
      value: `claude mcp add --transport http koi ${endpoint} --header "Authorization: Bearer ${token}"`,
      hint: "Run once in Terminal.",
      copyLabel: "Claude Code command",
    };
  }
  if (client === "claude-desktop") {
    return {
      value: JSON.stringify({ mcpServers: { koi: { command: sidecarPath, env: { KOI_MCP_TOKEN: token } } } }, null, 2),
      hint: "Add this server to your desktop configuration.",
      copyLabel: "Claude Desktop configuration",
    };
  }
  return {
    value: `URL: ${endpoint}\nAuthorization: Bearer ${token}`,
    hint: "Use Streamable HTTP and send the bearer token with each request.",
    copyLabel: "Connection details",
  };
}
