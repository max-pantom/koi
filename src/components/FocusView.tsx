import { ArrowLeft, ArrowRight, ExternalLink, X } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type WheelEvent } from "react";
import { mediaSrc } from "../lib/media";
import type { MediaItem } from "../lib/types";
import { formatColor, type ColorFormat } from "../lib/colors";
import { ArticleReader } from "./ArticleReader";

export function FocusView({
  item,
  mode,
  isClosing,
  showPalette,
  colorFormat,
  onCopyColor,
  onCopyImage,
  onClose,
  onPrevious,
  onNext,
  onOpenSource,
}: {
  item: MediaItem;
  mode: "quick" | "focus";
  isClosing: boolean;
  showPalette: boolean;
  colorFormat: ColorFormat;
  onCopyColor: (hex: string) => void;
  onCopyImage: () => void;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenSource: () => void;
}) {
  const lastWheelAt = useRef(0);
  const [videoError, setVideoError] = useState(false);
  const sourceUrl = item.sourceLinkUrl
    || item.sourcePageUrl
    || item.sourceCanonicalUrl
    || item.sourceFinalUrl
    || item.sourceUrl;
  const sourceHost = sourceHostname(sourceUrl) || item.sourceSiteName || "Open source";
  const imageRatio = item.width && item.height ? item.width / item.height : 1;
  const isArticle = item.captureType === "article" && !!item.sourceContentMarkdown;
  const isVideo = item.kind === "video";

  useEffect(() => setVideoError(false), [item.id]);

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".article-reader-wrap")) return;
    event.preventDefault();
    const now = performance.now();
    if (now - lastWheelAt.current < 240 || Math.abs(event.deltaY) < 12) return;
    lastWheelAt.current = now;
    if (event.deltaY > 0) onNext();
    else onPrevious();
  };

  return (
    <div
      className={`preview-layer preview-${mode}${isClosing ? " is-closing" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Image preview"
      onPointerDown={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onCopyImage();
      }}
      onWheel={onWheel}
    >
      {!isArticle && !isVideo && <img className="preview-blur" src={mediaSrc(item)} alt="" draggable={false} />}
      <button
        className="preview-close"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onClose}
        aria-label="Close preview"
        title="Close"
      >
        <X size={17} aria-hidden="true" />
      </button>
      <button
        className="preview-nav left"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onPrevious}
        aria-label="Previous image"
        title="Previous"
      >
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <div className="preview-media">
        {isArticle ? (
          <div className="article-reader-wrap" onPointerDown={(event) => event.stopPropagation()}>
            <ArticleReader item={item} />
          </div>
        ) : isVideo && !videoError ? (
          <video
            className="preview-video"
            src={mediaSrc(item)}
            autoPlay
            loop={item.captureType === "gif"}
            playsInline
            controls
            preload="metadata"
            onError={() => setVideoError(true)}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.stopPropagation()}
          />
        ) : isVideo ? (
          <div className="preview-video-error" role="status" onPointerDown={(event) => event.stopPropagation()}>
            <strong>This video codec can’t play inside Koi.</strong>
            <span>The file is still saved. Use the source or Finder action to open it in another player.</span>
          </div>
        ) : (
          <div
            className="preview-image-frame"
            style={{ "--image-ratio": imageRatio } as CSSProperties}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.stopPropagation()}
          >
            <img src={mediaSrc(item)} alt={item.sourceTitle || "Selected image"} draggable={false} />
          </div>
        )}
      </div>
      {showPalette && item.dominantColors.length > 0 && (
        <div className="focus-palette" role="group" aria-label="Copy an image color" onPointerDown={(event) => event.stopPropagation()}>
          {item.dominantColors.slice(0, 5).map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onCopyColor(hex)}
              aria-label={`Copy ${formatColor(hex, colorFormat)}`}
              title={`Copy ${formatColor(hex, colorFormat)}`}
            >
              <span className="focus-palette-swatch" style={{ background: hex }} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
      <button
        className="preview-nav right"
        type="button"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={onNext}
        aria-label="Next image"
        title="Next"
      >
        <ArrowRight size={18} aria-hidden="true" />
      </button>
      {(item.sourceTitle || sourceUrl) && <div className="preview-caption">
        {item.captureType === "link" && <span className="preview-kind">Saved page</span>}
        {item.captureType === "article" && <span className="preview-kind">Article</span>}
        {item.captureType === "gif" && <span className="preview-kind">GIF</span>}
        {item.sourceTitle && <span>{item.sourceTitle}</span>}
        {sourceUrl && (
          <button
            className="preview-source"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onOpenSource}
            aria-label={`Open source${item.sourceSiteName ? ` on ${item.sourceSiteName}` : ""}`}
            title={sourceUrl}
          >
            <ExternalLink size={12} aria-hidden="true" />
            {sourceHost}
          </button>
        )}
      </div>}
    </div>
  );
}

function sourceHostname(value?: string) {
  if (!value) return "";
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
