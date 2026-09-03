import clsx from "clsx";

export function Avatar({ src, name, size = 44, online = false, className }: { src: string | null; name: string; size?: number; online?: boolean; className?: string }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <span className={clsx("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt="" width={size} height={size} loading="lazy" className="h-full w-full rounded-full bg-surface-2 object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted">{initials}</span>
      )}
      {online && <span className="live-dot absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-surface bg-danger text-danger" />}
    </span>
  );
}
