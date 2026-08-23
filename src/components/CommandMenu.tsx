import { Command as CommandPrimitive } from "cmdk";
import {
  ClipboardPaste,
  Copy,
  FolderOpen,
  FolderPlus,
  Image,
  Maximize2,
  PanelLeft,
  Palette,
  RefreshCw,
  Search,
  Settings2,
  SunMoon,
  Tags,
  Trash2,
} from "lucide-react";

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
  const runCommand = (command: Command) => {
    command.run();
    onClose();
  };
  const groups = commandGroups(commands);

  return (
    <CommandPrimitive.Dialog
      open
      loop
      label="Commands"
      className="command-menu"
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <div className="command-search">
        <Search size={16} strokeWidth={1.7} aria-hidden="true" />
        <CommandPrimitive.Input autoFocus placeholder="Type a command…" aria-label="Search commands" />
        <kbd aria-hidden="true">Esc</kbd>
      </div>
      <CommandPrimitive.List className="command-list" aria-label="Available commands">
        <CommandPrimitive.Empty className="command-empty">No matching commands.</CommandPrimitive.Empty>
        {groups.map((group) => (
          <CommandPrimitive.Group key={group.name} heading={group.name}>
            {group.commands.map((command) => (
              <CommandPrimitive.Item
                key={command.id}
                value={command.label}
                keywords={command.keywords?.split(/\s+/).filter(Boolean)}
                onSelect={() => runCommand(command)}
              >
                <span className="command-item-label">
                  {commandIcon(command.id)}
                  <span>{command.label}</span>
                </span>
                {command.shortcut && <kbd>{command.shortcut}</kbd>}
              </CommandPrimitive.Item>
            ))}
          </CommandPrimitive.Group>
        ))}
      </CommandPrimitive.List>
    </CommandPrimitive.Dialog>
  );
}

function commandGroups(commands: Command[]) {
  const groups = [
    { name: "Library", ids: new Set(["add-folder", "search", "paste", "toggle-sidebar", "rescan", "open-inbox"]) },
    { name: "Selection", ids: new Set(["copy-image", "reveal", "palette", "edit-tags", "delete"]) },
    { name: "Koi", ids: new Set(["toggle-dark", "check-update", "settings"]) },
  ];
  return groups
    .map((group) => ({ ...group, commands: commands.filter((command) => group.ids.has(command.id)) }))
    .filter((group) => group.commands.length);
}

function commandIcon(id: string) {
  const props = { size: 15, strokeWidth: 1.7, "aria-hidden": true } as const;
  if (id === "add-folder") return <FolderPlus {...props} />;
  if (id === "search") return <Search {...props} />;
  if (id === "paste") return <ClipboardPaste {...props} />;
  if (id === "toggle-sidebar") return <PanelLeft {...props} />;
  if (id === "rescan") return <RefreshCw {...props} />;
  if (id === "open-inbox") return <FolderOpen {...props} />;
  if (id === "copy-image") return <Copy {...props} />;
  if (id === "reveal") return <Image {...props} />;
  if (id === "palette") return <Palette {...props} />;
  if (id === "edit-tags") return <Tags {...props} />;
  if (id === "delete") return <Trash2 {...props} />;
  if (id === "toggle-dark") return <SunMoon {...props} />;
  if (id === "check-update") return <RefreshCw {...props} />;
  if (id === "settings") return <Settings2 {...props} />;
  return <Maximize2 {...props} />;
}
