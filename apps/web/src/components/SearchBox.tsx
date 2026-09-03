import type { PublicStreamer } from "@zevent-radar/contracts";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { euros } from "@/lib/format";
import { Avatar } from "./Avatar";
import { Input } from "./ui";

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function filterStreamers(streamers: PublicStreamer[], query: string): PublicStreamer[] {
  const q = normalize(query.trim());
  if (!q) return streamers;
  return streamers.filter((s) => normalize(s.displayName).includes(q) || s.login.includes(q) || (s.game ? normalize(s.game).includes(q) : false));
}

export function SearchBox({ streamers, placeholder = "Rechercher un streamer" }: { streamers: PublicStreamer[]; placeholder?: string }) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => (query.trim() ? filterStreamers(streamers, query).slice(0, 8) : []), [streamers, query]);
  return (
    <div className="relative">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={placeholder} className="pl-9" aria-label="Rechercher" />
        {query && (
          <button type="button" onClick={() => setQuery("")} className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted" aria-label="Effacer">
            <X size={14} />
          </button>
        )}
      </div>
      {results.length > 0 && (
        <ul className="absolute top-full right-0 left-0 z-20 mt-1 max-h-80 overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
          {results.map((s) => (
            <li key={s.id}>
              <Link to={`/streamers/${s.login}`} onClick={() => setQuery("")} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-surface-2">
                <Avatar src={s.avatarUrl} name={s.displayName} size={32} online={s.online} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.displayName}</span>
                <span className="text-xs text-muted tabular-nums">{euros(s.amountCents)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
