import { Tag, X } from "lucide-react";
import { useState, type RefObject } from "react";
import type { MediaItem } from "../lib/types";

export function TagEditor({
  item,
  inputRef,
  onSave,
  onClose,
}: {
  item: MediaItem;
  inputRef: RefObject<HTMLInputElement>;
  onSave: (tags: string[]) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(item.tags.join(", "));

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="tag-editor-title" onPointerDown={onClose}>
      <form
        className="tagger"
        onPointerDown={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(normalizeTags(value));
        }}
      >
        <div>
          <h2 id="tag-editor-title">Edit tags</h2>
          <button type="button" onClick={onClose} aria-label="Close tag editor" title="Close">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
        <label htmlFor="image-tags">Tags</label>
        <input
          id="image-tags"
          ref={inputRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="portrait, editorial, blue"
          autoComplete="off"
        />
        <button type="submit">
          <Tag size={14} aria-hidden="true" />
          <span>Save tags</span>
        </button>
      </form>
    </div>
  );
}

function normalizeTags(value: string) {
  return Array.from(
    new Set(value.split(",").map((tag) => tag.trim().replace(/^#/, "").toLowerCase()).filter(Boolean)),
  );
}
