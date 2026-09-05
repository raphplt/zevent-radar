import clsx from "clsx";
import { ExternalLink, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import { Counter } from "@/components/Counter";
import { EditionsChart, editionColor, type ChartSeries } from "@/components/EditionsChart";
import { Badge, Card, Chips, EmptyState, SectionTitle, Skeleton } from "@/components/ui";
import { useEventTotal, useEventTotalHistory, useLatest } from "@/hooks/useData";
import { useNow } from "@/hooks/useNow";
import {
  alignOffset,
  alignPoints,
  axisLabel,
  compareAtStage,
  CURRENT_MARATHON_START,
  CURRENT_YEAR,
  currentEdition,
  EDITIONS_SOURCE,
  elapsedLabel,
  MILESTONES_CENTS,
  offsetForAmount,
  openingOffset,
  PAST_EDITIONS,
  rankAtStage,
  toOffsetMinutes,
  weekdayLabel,
  type Alignment,
  type Edition
} from "@/lib/editions";
import { euros, percent, relativeTime } from "@/lib/format";

type Range = "now" | "full";

const RANGE_MARGIN_MINUTES = 90;
const DEFAULT_HIDDEN = new Set(PAST_EDITIONS.filter((e) => e.approximate).map((e) => e.year));

export function EditionsPage() {
  const latest = useLatest();
  const history = useEventTotalHistory();
  const total = useEventTotal(latest.data?.event.totalAmountCents);
  const now = useNow(30_000);
  const [alignment, setAlignment] = useState<Alignment>("marathon");
  const [range, setRange] = useState<Range>("now");
  const [hidden, setHidden] = useState<Set<number>>(DEFAULT_HIDDEN);

  const current = useMemo(() => currentEdition(history.points ?? [], total.cents ?? 0), [history.points, total.cents]);
  const lastPoint = current.points[current.points.length - 1];
  const stageOffset = lastPoint ? Math.max(lastPoint[0], Math.min(toOffsetMinutes(now, CURRENT_MARATHON_START), lastPoint[0] + 10)) : null;
  const currentCents = total.cents ?? lastPoint?.[1] ?? null;
  const stage = stageOffset !== null && currentCents !== null ? { offset: stageOffset, cents: currentCents } : null;

  const comparisons = useMemo(() => (stage ? compareAtStage(PAST_EDITIONS, stage, alignment) : []), [stage?.offset, stage?.cents, alignment]);
  const rank = stage ? rankAtStage(comparisons) : null;
  const record = PAST_EDITIONS.reduce((best, e) => (e.finalCents > best.finalCents ? e : best), PAST_EDITIONS[0]!);
  const recent = PAST_EDITIONS.slice(0, 2);

  const series = useMemo<ChartSeries[]>(() => {
    const past = PAST_EDITIONS.filter((e) => !hidden.has(e.year)).map((e) => ({ edition: e, points: alignPoints(e, alignment), current: false }));
    const cur: ChartSeries[] = current.points.length > 0 ? [{ edition: current, points: alignPoints(current, alignment), current: true }] : [];
    return [...past, ...cur];
  }, [hidden, alignment, current]);

  const xMax = useMemo(() => {
    const ends = series.map((s) => s.points[s.points.length - 1]?.[0] ?? 0);
    const full = Math.max(...ends, 0);
    if (range === "full" || !stage) return full;
    return Math.min(full, alignOffset(current, stage.offset, alignment) + RANGE_MARGIN_MINUTES);
  }, [series, range, stage, alignment, current]);

  function toggle(year: number) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(year)) next.delete(year);
      else next.add(year);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-bold tracking-tight">La cagnotte face aux éditions précédentes</h2>
        <Chips
          value={alignment}
          onChange={setAlignment}
          options={[
            ["marathon", "Heure du week-end"],
            ["opening", "Depuis l'ouverture"]
          ]}
        />
      </div>
      <p className="text-sm text-muted">
        {alignment === "marathon"
          ? "Chaque édition est calée sur le lancement du marathon, le vendredi à 18 h. Le jeudi soir correspond au concert d'ouverture, quand les dons sont déjà ouverts certaines années."
          : "Chaque édition démarre à l'ouverture de ses dons : on compare ce qui a été récolté après le même nombre d'heures."}
      </p>

      {history.isPending && latest.isPending ? (
        <Skeleton className="h-36" />
      ) : stage && currentCents !== null ? (
        <Card className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:p-5">
          <div>
            <p className="text-[11px] font-semibold text-muted uppercase">
              ZEVENT {CURRENT_YEAR} · {weekdayLabel(stage.offset, true)} · {elapsedLabel(stage.offset - openingOffset(current), true)} depuis l'ouverture
            </p>
            <p className="text-gold-gradient text-4xl font-extrabold tabular-nums lg:text-5xl">
              <Counter value={currentCents} format={(v) => euros(v)} />
            </p>
            <p className="mt-1 text-sm text-muted">
              {rank === 1 ? `La plus généreuse des ${comparisons.length + 1} éditions à ce stade` : `${rank}ᵉ des ${comparisons.length + 1} éditions à ce stade`} · record à battre : {euros(record.finalCents)} ({record.year})
              {history.partial && <span className="text-warning"> · historique limité aux dernières 24 h</span>}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 lg:w-[420px]">
            {recent.map((edition) => {
              const c = comparisons.find((x) => x.edition.year === edition.year);
              return <GapStat key={edition.year} edition={edition} gapCents={c?.gapCents ?? null} ended={c?.reading?.ended ?? false} />;
            })}
            <div className="rounded-xl border border-border bg-bg px-3 py-2">
              <p className="text-[11px] text-muted uppercase">Du record {record.year}</p>
              <p className="text-lg font-bold tabular-nums">{percent(currentCents / record.finalCents)}</p>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="progress-fill-gold h-full rounded-full" style={{ width: `${Math.min(100, (currentCents / record.finalCents) * 100)}%` }} />
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <EmptyState title="Pas encore de relevé pour cette édition" description="La courbe 2026 apparaîtra dès que le collecteur aura publié ses premiers points. Les éditions précédentes restent consultables." icon={<TrendingUp size={28} />} />
      )}

      <Card className="p-3 lg:p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <ul className="flex flex-1 flex-wrap gap-1.5" aria-label="Éditions affichées">
            {[current, ...PAST_EDITIONS].map((edition) => {
              const isCurrent = edition.year === CURRENT_YEAR;
              const off = !isCurrent && hidden.has(edition.year);
              return (
                <li key={edition.year}>
                  <button
                    type="button"
                    onClick={() => !isCurrent && toggle(edition.year)}
                    aria-pressed={!off}
                    disabled={isCurrent}
                    className={clsx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition", off ? "border-border text-muted opacity-60" : "border-border bg-surface-2 text-fg", isCurrent && "font-bold")}
                  >
                    <span className={clsx("inline-block h-2.5 w-2.5 rounded-sm", edition.approximate && "border border-dashed")} style={{ background: off ? "transparent" : editionColor(edition.year), borderColor: editionColor(edition.year) }} />
                    {edition.year}
                    {edition.approximate && <span className="text-[10px] text-muted">≈</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          <Chips
            value={range}
            onChange={setRange}
            options={[
              ["now", "Jusqu'ici"],
              ["full", "Édition complète"]
            ]}
          />
        </div>
        <EditionsChart series={series} alignment={alignment} xMax={xMax} height={320} />
        <p className="mt-2 text-[11px] text-muted">Trait épais : {CURRENT_YEAR}. Survole ou touche la courbe pour lire chaque édition au même instant. Pointillés : courbe approximative.</p>
      </Card>

      {stage && currentCents !== null && (
        <section>
          <SectionTitle action={<span className="text-xs text-muted">{alignment === "marathon" ? weekdayLabel(stage.offset, true) : `${elapsedLabel(stage.offset - openingOffset(current), true)} après l'ouverture`}</span>}>Au même stade</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-[11px] text-muted uppercase">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left font-semibold">Édition</th>
                  <th className="px-3 py-2 text-right font-semibold">Cagnotte à ce stade</th>
                  <th className="px-3 py-2 text-right font-semibold">Écart avec {CURRENT_YEAR}</th>
                  <th className="px-3 py-2 text-right font-semibold">A atteint {euros(currentCents)}</th>
                  <th className="px-3 py-2 text-right font-semibold">Total final</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border bg-accent-dim/40 font-semibold">
                  <td className="px-3 py-2"><YearCell edition={current} /></td>
                  <td className="px-3 py-2 text-right tabular-nums">{euros(currentCents)}</td>
                  <td className="px-3 py-2 text-right text-muted">—</td>
                  <td className="px-3 py-2 text-right text-muted">maintenant</td>
                  <td className="px-3 py-2 text-right text-muted">en cours</td>
                </tr>
                {comparisons.map((c) => (
                  <tr key={c.edition.year} className="border-b border-border last:border-0">
                    <td className="px-3 py-2"><YearCell edition={c.edition} muted={hidden.has(c.edition.year)} /></td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {c.reading ? euros(c.reading.cents) : <span className="text-muted">dons pas encore ouverts</span>}
                      {c.reading?.ended && <span className="ml-1 text-[10px] text-muted uppercase">fin</span>}
                    </td>
                    <td className={clsx("px-3 py-2 text-right font-semibold tabular-nums", c.gapCents === null ? "text-muted" : c.gapCents >= 0 ? "text-accent-strong" : "text-red-700 dark:text-danger")}>
                      {c.gapCents === null ? "—" : `${c.gapCents >= 0 ? "+" : "−"}${euros(Math.abs(c.gapCents))}`}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{c.reachedCurrentAt === null ? <span className="text-muted">jamais</span> : axisLabel(alignOffset(c.edition, c.reachedCurrentAt, alignment), alignment, true)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{euros(c.edition.finalCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}

      <section>
        <SectionTitle action={<span className="text-xs text-muted">{alignment === "marathon" ? "heure du week-end" : "temps depuis l'ouverture"}</span>}>La course aux millions</SectionTitle>
        <Card className="overflow-x-auto">
          <MilestonesTable editions={[current, ...PAST_EDITIONS]} alignment={alignment} currentEnded={false} />
        </Card>
      </section>

      <p className="text-xs text-muted">
        Courbes des éditions 2018 à 2025 compilées par <a href={EDITIONS_SOURCE.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 underline">{EDITIONS_SOURCE.name}<ExternalLink size={10} /></a> à partir des compteurs publics du ZEVENT, tronquées au total officiel annoncé à la clôture ; la courbe 2018 est approximative. La courbe {CURRENT_YEAR} vient du collecteur de ZEvent Radar (un relevé par minute, un point conservé toutes les cinq minutes){history.updatedAt ? `, mise à jour ${relativeTime(history.updatedAt, now)}` : ""}. Les éditions 2016 et 2017 ({euros(170_770_00)} et {euros(451_851_00)}) n'ont pas de courbe connue.
      </p>
    </div>
  );
}

function YearCell({ edition, muted = false }: { edition: Edition; muted?: boolean }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", muted && "opacity-60")}>
      <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: editionColor(edition.year) }} />
      {edition.year}
      {edition.approximate && <Badge>approx.</Badge>}
    </span>
  );
}

function GapStat({ edition, gapCents, ended }: { edition: Edition; gapCents: number | null; ended: boolean }) {
  const tone = gapCents === null ? "text-muted" : gapCents >= 0 ? "text-accent-strong" : "text-red-700 dark:text-danger";
  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] text-muted uppercase">
        <span className="inline-block h-2 w-2 rounded-sm" style={{ background: editionColor(edition.year) }} />
        vs {edition.year}
      </p>
      <p className={clsx("text-lg font-bold tabular-nums", tone)}>{gapCents === null ? "—" : `${gapCents >= 0 ? "+" : "−"}${euros(Math.abs(gapCents))}`}</p>
      <p className="text-[11px] text-muted">{gapCents === null ? "dons pas encore ouverts" : ended ? "face au total final" : gapCents >= 0 ? "d'avance au même stade" : "de retard au même stade"}</p>
    </div>
  );
}

function MilestonesTable({ editions, alignment, currentEnded }: { editions: Edition[]; alignment: Alignment; currentEnded: boolean }) {
  return (
    <table className="w-full min-w-[640px] text-sm">
      <thead className="text-[11px] text-muted uppercase">
        <tr className="border-b border-border">
          <th className="px-3 py-2 text-left font-semibold">Palier</th>
          {editions.map((e) => (
            <th key={e.year} className={clsx("px-3 py-2 text-right font-semibold", e.year === CURRENT_YEAR && "text-fg")}>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-sm" style={{ background: editionColor(e.year) }} />
                {e.year}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {MILESTONES_CENTS.filter((m) => editions.some((e) => e.finalCents >= m || e.year === CURRENT_YEAR)).map((milestone) => {
          const offsets = editions.map((e) => {
            const at = offsetForAmount(e.points, milestone);
            return at === null ? null : alignOffset(e, at, alignment);
          });
          const best = offsets.reduce<number | null>((acc, o) => (o !== null && (acc === null || o < acc) ? o : acc), null);
          return (
            <tr key={milestone} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-semibold tabular-nums">{euros(milestone)}</td>
              {editions.map((e, i) => {
                const o = offsets[i] ?? null;
                const pending = e.year === CURRENT_YEAR && o === null && !currentEnded;
                return (
                  <td key={e.year} className={clsx("px-3 py-2 text-right tabular-nums", o !== null && o === best ? "font-bold text-accent-strong" : o === null ? "text-muted" : "")}>
                    {o === null ? (pending ? "…" : "—") : axisLabel(o, alignment, true)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
