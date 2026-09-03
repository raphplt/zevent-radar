import { HeartHandshake, X } from "lucide-react";
import { Link } from "react-router";
import { createLocalStore } from "@/lib/store";

const dismissed = createLocalStore<boolean>("zr:assos-banner-dismissed", false, (raw) => raw === true);

export function AssociationsBanner() {
  const hidden = dismissed.use();
  if (hidden) return null;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-accent-border bg-accent-dim px-3 py-2 text-sm">
      <HeartHandshake size={18} className="shrink-0 text-accent-strong" />
      <Link to="/associations" className="min-w-0 flex-1 hover:underline">
        <span className="font-semibold">Pour qui on donne</span> <span className="text-muted">· les associations bénéficiaires du ZEVENT et l'usage des dons</span>
      </Link>
      <Link to="/associations" className="shrink-0 text-xs font-semibold text-accent-strong">Voir</Link>
      <button type="button" onClick={() => dismissed.set(true)} className="shrink-0 rounded-full p-1 text-muted hover:text-fg" aria-label="Masquer ce message"><X size={14} /></button>
    </div>
  );
}
