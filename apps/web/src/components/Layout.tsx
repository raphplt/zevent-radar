import clsx from "clsx";
import { Activity, BookOpen, Compass, ExternalLink, Github, HeartHandshake, Info, Linkedin, ListChecks, Radar, Radio, Scale, Settings, Star, Users, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import { deltaOver } from "@zevent-radar/radar-engine";
import { useEventHistory, useEventTotal, useLatest } from "@/hooks/useData";
import { useNow } from "@/hooks/useNow";
import { count, euros, relativeTime } from "@/lib/format";
import { Celebration, useMilestoneCelebration } from "./Celebration";
import { Counter } from "./Counter";

const TABS = [
  { to: "/", label: "Radar", icon: Radar },
  { to: "/live", label: "En direct", icon: Radio },
  { to: "/favorites", label: "Favoris", icon: Star },
  { to: "/streamers", label: "Explorer", icon: Compass },
  { to: "/community", label: "Communauté", icon: Users }
];

const SECONDARY = [
  { to: "/goals", label: "Tous les goals", icon: ListChecks },
  { to: "/associations", label: "Les associations", icon: HeartHandshake },
  { to: "/settings", label: "Réglages", icon: Settings },
  { to: "/status", label: "État du service", icon: Activity },
  { to: "/about", label: "À propos", icon: Info },
  { to: "/legal", label: "Mentions légales", icon: Scale }
];

export function Layout() {
  const latest = useLatest();
  const total = useEventTotal(latest.data?.event.totalAmountCents);
  const eventHistory = useEventHistory();
  const delta = eventHistory.data ? deltaOver(eventHistory.data.points, Date.parse(eventHistory.data.updatedAt), 5 * 60_000) : null;
  const now = useNow(5_000);
  const location = useLocation();
  const celebration = useMilestoneCelebration(total.cents);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const stale = latest.data?.stale || (latest.data ? now - Date.parse(latest.data.generatedAt) > 3 * 60_000 : false);
  const freshness = offline ? (
    <span className="inline-flex items-center gap-1 text-warning"><WifiOff size={11} />hors ligne</span>
  ) : stale ? (
    <span className="text-warning">données figées</span>
  ) : latest.data ? (
    <span>maj {relativeTime(latest.data.generatedAt, now)}</span>
  ) : (
    <span>chargement…</span>
  );
  const totalNode = total.cents !== null ? <Counter value={total.cents} format={(v) => euros(v)} /> : "—";

  return (
    <div className="min-h-dvh lg:flex">
      {celebration.milestone !== null && <Celebration milestone={celebration.milestone} onDismiss={celebration.dismiss} />}
      <aside className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-64 lg:shrink-0 lg:flex-col lg:border-r lg:border-border lg:bg-surface dark:lg:bg-[#080808] xl:w-72">
        <NavLink to="/" className="flex items-center gap-3 px-5 py-5">
          <img src="/favicon.svg" alt="" width={36} height={36} className="rounded-xl" />
          <span className="text-lg font-extrabold tracking-tight">ZEvent Radar</span>
        </NavLink>
        <div className="mx-4 rounded-xl border border-border bg-bg px-4 py-3">
          <p className="text-[11px] font-semibold text-muted uppercase">Cagnotte globale</p>
          <p className="text-gold-gradient text-2xl font-extrabold tabular-nums">{totalNode}</p>
          <p className="text-xs text-muted">{delta !== null && delta > 0 && <span className="font-semibold text-accent-strong">+{euros(delta)} / 5 min · </span>}{freshness}</p>
          {latest.data && (
            <p className="mt-1 text-xs text-muted">
              {count(latest.data.event.onlineCount)} en live · {count(latest.data.event.viewerCount)} viewers
            </p>
          )}
        </div>
        <nav className="mt-4 flex-1 px-3" aria-label="Navigation principale">
          <ul className="space-y-1">
            {TABS.map((tab) => (
              <li key={tab.to}>
                <SideLink to={tab.to} label={tab.label} icon={tab.icon} end={tab.to === "/"} />
              </li>
            ))}
          </ul>
          <p className="mt-6 mb-1 px-3 text-[11px] font-semibold text-muted uppercase">Plus</p>
          <ul className="space-y-1">
            {SECONDARY.map((tab) => (
              <li key={tab.to}>
                <SideLink to={tab.to} label={tab.label} icon={tab.icon} />
              </li>
            ))}
          </ul>
        </nav>
        <div className="px-3 pb-2">
          <a href="https://zevent.gdoc.fr/" target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface-2 hover:text-fg">
            <BookOpen size={18} />InGDoc<ExternalLink size={12} className="ml-auto" />
          </a>
        </div>
        <p className="px-5 pb-1 text-[11px] text-muted">Projet communautaire non officiel. Dons sur zevent.fr.</p>
        <p className="flex items-center gap-3 px-5 pb-4 text-[11px] text-muted">
          <a href="https://github.com/raphplt/zevent-radar" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg"><Github size={12} />Code source</a>
          <a href="https://www.linkedin.com/in/rapha%C3%ABl-plassart/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-fg"><Linkedin size={12} />raph</a>
        </p>
      </aside>

      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-2">
            <NavLink to="/" className="flex items-center gap-2">
              <img src="/favicon.svg" alt="" width={28} height={28} className="rounded-lg" />
              <span className="text-sm font-bold tracking-tight">ZEvent Radar</span>
            </NavLink>
            <div className="text-right">
              <p className="text-gold-gradient text-lg leading-tight font-extrabold tabular-nums">{totalNode}</p>
              <p className="flex items-center justify-end gap-1 text-[11px] text-muted">{delta !== null && delta > 0 && <span className="font-semibold text-accent-strong">+{euros(delta)}/5 min ·</span>}{freshness}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 lg:px-8 lg:pt-8 lg:pb-12">
          <Outlet />
        </main>
      </div>

      <nav className="safe-bottom fixed right-0 bottom-0 left-0 z-30 border-t border-border bg-surface/95 backdrop-blur lg:hidden" aria-label="Navigation principale">
        <ul className="mx-auto flex max-w-2xl justify-around">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <li key={tab.to} className="flex-1">
                <NavLink to={tab.to} end={tab.to === "/"} className={({ isActive }) => clsx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", isActive ? "text-accent-strong" : "text-muted")}>
                  <Icon size={20} />
                  {tab.label}
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function SideLink({ to, label, icon: Icon, end = false }: { to: string; label: string; icon: typeof Radar; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition", isActive ? "border border-accent-border bg-accent-dim text-accent-strong" : "border border-transparent text-muted hover:bg-surface-2 hover:text-fg")}>
      <Icon size={18} />
      {label}
    </NavLink>
  );
}
