import clsx from "clsx";
import type { ComponentProps, ReactNode } from "react";

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={clsx("rounded-xl border border-border bg-surface shadow-sm", className)} {...props} />;
}

export function Badge({ tone = "neutral", className, children }: { tone?: "neutral" | "accent" | "success" | "warning" | "danger" | "gold"; className?: string; children: ReactNode }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    accent: "bg-accent-dim text-accent-strong",
    success: "bg-accent-dim text-accent-strong",
    warning: "bg-warning/20 text-amber-700 dark:text-warning",
    danger: "bg-danger/15 text-red-700 dark:text-danger",
    gold: "bg-gold/20 text-yellow-800 dark:text-gold-light"
  };
  return <span className={clsx("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone], className)}>{children}</span>;
}

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const variants = {
    primary: "bevel-primary bg-accent text-black",
    secondary: "bevel-neutral bg-surface-2 text-fg hover:bg-border",
    ghost: "bg-transparent text-fg hover:bg-surface-2",
    danger: "bevel-neutral bg-danger/15 text-red-700 hover:bg-danger/25 dark:text-danger"
  };
  return <button className={clsx("inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50", variants[variant], className)} {...props} />;
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={clsx("min-h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg outline-none placeholder:text-muted focus:border-accent", className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={clsx("min-h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg outline-none focus:border-accent", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={clsx("w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-fg outline-none placeholder:text-muted focus:border-accent", className)} {...props} />;
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (next: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={clsx("relative h-6 w-11 shrink-0 rounded-full transition", checked ? "bg-accent" : "bg-border")}>
        <span className={clsx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition", checked ? "left-[22px]" : "left-0.5")} />
      </button>
    </label>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="shrink-0 text-base font-bold tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-8 text-center">
      {icon && <div className="text-muted">{icon}</div>}
      <p className="text-sm font-semibold">{title}</p>
      {description && <p className="text-xs text-muted">{description}</p>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-5 w-5 animate-spin rounded-full border-2 border-border border-t-accent", className)} aria-label="Chargement" />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-xl bg-surface-2", className)} />;
}
