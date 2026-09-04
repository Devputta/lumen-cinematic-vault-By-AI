import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  Lock,
  Maximize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { unlockMedia } from "@/lib/vault.functions";

export type ViewerItem = {
  id: string;
  title: string;
  filename: string;
  media_type: "photo" | "video";
  thumbnail_url: string;
  media_url?: string | null;
  duration_seconds?: number | null;
  is_favorite?: boolean;
  is_locked?: boolean;
};

type Props = {
  items: ViewerItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onToggleFavorite?: (item: ViewerItem) => void;
};

export function MediaViewer({ items, index, onIndexChange, onClose, onToggleFavorite }: Props) {
  const item = items[index];
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [unlocked, setUnlocked] = useState<Record<string, string | null>>({});

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1);
  }, [index, onIndexChange]);
  const goNext = useCallback(() => {
    if (index < items.length - 1) onIndexChange(index + 1);
  }, [index, items.length, onIndexChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [goNext, goPrev, onClose]);

  const requestFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen?.();
  };

  if (!item) return null;

  const isLocked = Boolean(item.is_locked) && !(item.id in unlocked);
  const source = item.id in unlocked ? unlocked[item.id] : (item.media_url ?? null);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black/98 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={item.title || item.filename}
    >
      {/* Top bar */}
      <header className="flex items-center justify-between gap-3 px-4 py-3 text-cream sm:px-6">
        <div className="min-w-0">
          <p className="truncate text-sm">{item.title || item.filename}</p>
          <p className="text-[0.7rem] uppercase tracking-[0.25em] text-cream-muted">
            {index + 1} / {items.length}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {onToggleFavorite && (
            <IconButton
              label={item.is_favorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => onToggleFavorite(item)}
            >
              <Heart className={`size-5 ${item.is_favorite ? "fill-amber text-amber" : ""}`} />
            </IconButton>
          )}
          {item.media_type === "photo" && !isLocked && source && (
            <a
              href={source}
              download={item.filename}
              target="_blank"
              rel="noreferrer"
              aria-label="Download"
              className="rounded-full p-2.5 text-cream/80 transition-colors hover:bg-white/10 hover:text-cream"
            >
              <Download className="size-5" />
            </a>
          )}
          <IconButton label="Toggle fullscreen" onClick={requestFullscreen}>
            <Maximize2 className="size-5" />
          </IconButton>
          <IconButton label="Close viewer" onClick={onClose}>
            <X className="size-5" />
          </IconButton>
        </div>
      </header>

      {/* Stage */}
      <div className="relative flex-1 overflow-hidden">
        {isLocked ? (
          <LockedCurtain
            mediaId={item.id}
            onUnlocked={(url) => setUnlocked((p) => ({ ...p, [item.id]: url }))}
          />
        ) : item.media_type === "video" ? (
          <VideoStage key={item.id} src={source ?? item.thumbnail_url} poster={item.thumbnail_url} />
        ) : (
          <PhotoStage
            key={item.id}
            src={source ?? item.thumbnail_url}
            alt={item.title || item.filename}
            onSwipeLeft={goNext}
            onSwipeRight={goPrev}
          />
        )}

        {index > 0 && (
          <NavArrow side="left" onClick={goPrev} />
        )}
        {index < items.length - 1 && <NavArrow side="right" onClick={goNext} />}
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-full p-2.5 text-cream/80 transition-colors hover:bg-white/10 hover:text-cream"
    >
      {children}
    </button>
  );
}

function NavArrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === "left" ? "Previous" : "Next"}
      className={`absolute top-1/2 hidden -translate-y-1/2 rounded-full bg-white/5 p-3 text-cream/70 backdrop-blur transition-all hover:bg-white/15 hover:text-cream sm:block ${
        side === "left" ? "left-4" : "right-4"
      }`}
    >
      {side === "left" ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
    </button>
  );
}

/* ------------------------------- Photo stage ------------------------------ */

function PhotoStage({
  src,
  alt,
  onSwipeLeft,
  onSwipeRight,
}: {
  src: string;
  alt: string;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const swipe = useRef<{ x: number; y: number; t: number } | null>(null);
  const lastTap = useRef(0);

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => reset(), [src]);

  const toggleZoom = () => {
    if (scale > 1) reset();
    else setScale(2.5);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale((s) => clamp(s * (e.deltaY > 0 ? 0.9 : 1.1), 1, 6));
  };

  const dist = (t: React.TouchList) =>
    Math.hypot(t[0]!.clientX - t[1]!.clientX, t[0]!.clientY - t[1]!.clientY);

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinch.current = { dist: dist(e.touches), scale };
      swipe.current = null;
      return;
    }
    const t = e.touches[0]!;
    if (scale > 1) {
      drag.current = { x: t.clientX, y: t.clientY, ox: offset.x, oy: offset.y };
    } else {
      swipe.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinch.current) {
      const next = clamp((dist(e.touches) / pinch.current.dist) * pinch.current.scale, 1, 6);
      setScale(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return;
    }
    if (drag.current) {
      const t = e.touches[0]!;
      setOffset({
        x: drag.current.ox + (t.clientX - drag.current.x),
        y: drag.current.oy + (t.clientY - drag.current.y),
      });
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    pinch.current = null;
    drag.current = null;
    const start = swipe.current;
    swipe.current = null;
    const t = e.changedTouches[0];
    if (!t) return;

    // double tap zoom
    const now = Date.now();
    if (start && Math.abs(t.clientX - start.x) < 12 && Math.abs(t.clientY - start.y) < 12) {
      if (now - lastTap.current < 300) {
        toggleZoom();
        lastTap.current = 0;
        return;
      }
      lastTap.current = now;
    }

    if (!start || scale > 1) return;
    const dx = t.clientX - start.x;
    if (Math.abs(dx) > 60 && Math.abs(t.clientY - start.y) < 80) {
      if (dx < 0) onSwipeLeft();
      else onSwipeRight();
    }
  };

  return (
    <div
      className="flex size-full touch-none items-center justify-center overflow-hidden"
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onDoubleClick={toggleZoom}
      onMouseDown={(e) => {
        if (scale <= 1) return;
        drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
      }}
      onMouseMove={(e) => {
        if (!drag.current) return;
        setOffset({
          x: drag.current.ox + (e.clientX - drag.current.x),
          y: drag.current.oy + (e.clientY - drag.current.y),
        });
      }}
      onMouseUp={() => (drag.current = null)}
      onMouseLeave={() => (drag.current = null)}
      style={{ cursor: scale > 1 ? "grab" : "zoom-in" }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="max-h-full max-w-full select-none object-contain transition-transform duration-200 ease-out"
        style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
      />
    </div>
  );
}

/* ------------------------------- Video stage ------------------------------ */

function VideoStage({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  };

  return (
    <div className="flex size-full flex-col items-center justify-center">
      <video
        ref={ref}
        src={src}
        poster={poster}
        playsInline
        onClick={toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
        className="max-h-full max-w-full"
      />

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black via-black/70 to-transparent px-4 pb-5 pt-12 text-cream sm:px-8">
        <IconButton label={playing ? "Pause" : "Play"} onClick={toggle}>
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </IconButton>
        <span className="w-11 text-right text-xs tabular-nums text-cream-muted">
          {fmt(time)}
        </span>
        <input
          type="range"
          aria-label="Seek"
          min={0}
          max={duration || 0}
          step={0.1}
          value={time}
          onChange={(e) => {
            const v = ref.current;
            if (v) v.currentTime = Number(e.target.value);
          }}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-amber"
        />
        <span className="w-11 text-xs tabular-nums text-cream-muted">{fmt(duration)}</span>
        <IconButton
          label={muted ? "Unmute" : "Mute"}
          onClick={() => {
            const v = ref.current;
            if (!v) return;
            v.muted = !v.muted;
            setMuted(v.muted);
          }}
        >
          {muted || volume === 0 ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
        </IconButton>
        <input
          type="range"
          aria-label="Volume"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => {
            const next = Number(e.target.value);
            setVolume(next);
            setMuted(next === 0);
            const v = ref.current;
            if (v) {
              v.volume = next;
              v.muted = next === 0;
            }
          }}
          className="hidden h-1 w-20 cursor-pointer appearance-none rounded-full bg-white/20 accent-amber sm:block"
        />
      </div>
    </div>
  );
}

/* ------------------------------ Locked curtain ---------------------------- */

function LockedCurtain({
  mediaId,
  onUnlocked,
}: {
  mediaId: string;
  onUnlocked: (url: string | null) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await unlockMedia({ data: { mediaId, password: password || null } });
      if (result.ok) onUnlocked(result.mediaUrl ?? result.thumbnailUrl);
      else setError(result.message);
    } catch {
      setError("We couldn't verify you. Please try again.");
    } finally {
      setBusy(false);
      setPassword("");
    }
  };

  return (
    <div className="flex size-full items-center justify-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-line bg-panel/80 p-8 text-center backdrop-blur"
      >
        <Lock className="mx-auto size-6 text-amber" />
        <p className="mt-4 font-serif text-2xl text-cream">Locked memory</p>
        <p className="mt-2 text-sm text-cream-muted">
          Confirm it's you to reveal this from the vault.
        </p>
        <input
          type="password"
          value={password}
          autoComplete="current-password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Account password"
          className="mt-5 w-full rounded-full border border-line bg-ink-2 px-4 py-2.5 text-sm text-cream placeholder:text-cream-muted focus:border-amber/60 focus:outline-none"
        />
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-full bg-amber px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-[#e0b47e] disabled:opacity-60"
        >
          {busy ? "Verifying…" : "Reveal"}
        </button>
      </form>
    </div>
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function useViewer(items: ViewerItem[]) {
  const [openId, setOpenId] = useState<string | null>(null);
  const index = useMemo(() => items.findIndex((i) => i.id === openId), [items, openId]);
  return {
    openId,
    index,
    open: (id: string) => setOpenId(id),
    close: () => setOpenId(null),
    setIndex: (next: number) => setOpenId(items[next]?.id ?? null),
    isOpen: index >= 0,
  };
}
