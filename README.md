# ZEvent Radar

Second écran communautaire du ZEvent : les prochains donation goals à portée, les lives à suivre et des alertes personnalisées, dans une PWA mobile-first.

## Structure

```text
apps/
  web/        PWA React 19 + Vite + Tailwind 4 + TanStack Query
  worker/     Cloudflare Worker (Hono) : collector cron, API, notifications, assets statiques
packages/
  contracts/  Types et schémas Zod partagés (API ZEvent, InGDoc, état public, formulaires)
  radar-engine/ Moteur pur : vitesse médiane, ETA, confiance, score, détection de paliers
data/
  initial-goals.json  Export InGDoc au format canonique d'import
scripts/
  import-goals.ts     Récupère les goals depuis l'API InGDoc → data/initial-goals.json
  import-editions.ts  Compile les courbes des éditions passées → apps/web/src/data/editions.json
  seed-goals.ts       Pousse un fichier d'import vers l'API admin
  generate-vapid.ts   Génère une paire de clés VAPID
```

Un seul Worker porte les trois rôles décrits dans `stack.md` (collector, API, notifications) via ses handlers `scheduled`, `fetch` et `queue`.

## Sources de données

| Donnée | Source | Fréquence |
| --- | --- | --- |
| Cagnotte globale | `api.zevent.fr/donation/current-amount` | collector 1 min, navigateur 10 s |
| Streamers, cagnottes, lives | `zevent.fr/api/app` (ETag) | 1 min |
| Donation goals | API InGDoc `api.ppr.evenmorestats.fr` (celle qu'utilise zevent.gdoc.fr) | sync 15 min + import initial |
| Moments, corrections | Communauté (Turnstile, confirmations, modération) | temps réel |

Les montants InGDoc sont en centimes, ceux de ZEvent en euros : tout est normalisé en centimes entiers.

## Chemin de lecture

```text
Navigateur → /data/latest.json (R2, cache 15 s) → PWA
```

Le collector publie chaque minute dans R2 : `latest.json`, `goals.json`, `status.json`, `event-total.json` (cagnotte globale sur toute l'édition, un point toutes les 5 min), `snapshots/{ts}.json`, et un historique interne compact (24 h, résolution fine sur 6 h puis un point toutes les 5 min) pour les ETA et les courbes. D1 ne reçoit que les événements significatifs (paliers, lives, signalements, abonnements).

Si `event-total.json` est créé après le début de l'édition, `POST /api/admin/history/backfill` le reconstruit depuis les snapshots (300 snapshots par appel, rappeler avec `?after=<nextAfter>` jusqu'à `null`) :

```bash
curl -X POST -H "authorization: Bearer $ADMIN_TOKEN" "https://zgoals.xyz/api/admin/history/backfill"
```

## Démarrage local

```bash
pnpm install
pnpm db:migrate:local
cp apps/worker/.dev.vars.example apps/worker/.dev.vars   # ADMIN_TOKEN=dev-token
pnpm --filter @zevent-radar/web build                     # le worker sert apps/web/dist
pnpm dev:worker                                            # http://localhost:8787
```

Dans un second terminal :

```bash
curl -X POST -H "authorization: Bearer dev-token" http://localhost:8787/api/admin/collect
ADMIN_TOKEN=dev-token pnpm goals:seed                      # importe data/initial-goals.json
curl -X POST -H "authorization: Bearer dev-token" http://localhost:8787/api/admin/goals/sync
pnpm dev                                                   # Vite sur http://localhost:5173 (proxy /api et /data)
```

Le cron minute peut aussi être déclenché avec `curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"`.

## Scripts

```bash
pnpm test              # radar-engine + web
pnpm typecheck
pnpm goals:import      # régénère data/initial-goals.json depuis InGDoc
pnpm editions:import   # régénère apps/web/src/data/editions.json (courbes 2018-2025, source ZEvenTracker)
pnpm vapid:generate
pnpm deploy            # build web + wrangler deploy
```

## Déploiement Cloudflare

1. `wrangler d1 create zevent-radar` puis reporter `database_id` dans `apps/worker/wrangler.jsonc`.
2. `wrangler r2 bucket create zevent-radar-data` et une règle de cycle de vie sur `snapshots/` (7 jours) :
   `wrangler r2 bucket lifecycle add zevent-radar-data --prefix snapshots/ --expire-days 7`.
3. `wrangler queues create zevent-radar-notifications`.
4. Secrets : `wrangler secret put VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `TURNSTILE_SECRET_KEY`, `ADMIN_TOKEN`.
5. Variables : `APP_URL`, `VAPID_SUBJECT`, et pour Cloudflare Access `ACCESS_TEAM_DOMAIN` (`equipe.cloudflareaccess.com`) + `ACCESS_AUD` sur `/api/admin/*` et `/admin`.
6. `pnpm db:migrate` puis `pnpm deploy`.
7. Optionnel : exposer le bucket sur `data.tondomaine.fr` et builder le front avec `VITE_DATA_BASE_URL=https://data.tondomaine.fr` pour que les lectures ne passent plus par le Worker.
8. Front : `VITE_TURNSTILE_SITE_KEY` pour activer Turnstile sur le formulaire de signalement.

## API

| Route | Rôle |
| --- | --- |
| `GET /data/latest.json`, `goals.json`, `status.json`, `event-total.json`, `history/:id`, `snapshots/:ts` | Données publiques (R2 + cache) |
| `GET /api/health` | Santé rapide |
| `GET /api/community`, `POST /api/reports`, `POST /api/reports/:id/confirm` | Communauté |
| `GET /api/push/vapid-public-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`, `GET/PUT /api/push/preferences`, `POST /api/push/test` | Web Push |
| `POST /api/admin/collect`, `POST /api/admin/goals/sync`, `POST /api/admin/goals/import?dryRun=1&mode=merge|sync`, `POST /api/admin/history/backfill?after=&limit=` | Ingestion |
| `GET/POST /api/admin/goals`, `PATCH /api/admin/goals/:id`, `GET /api/admin/goals/duplicates` | Catalogue |
| `GET /api/admin/reports`, `POST /api/admin/reports/:id/decision`, `GET /api/admin/audit`, `GET /api/admin/events`, `GET /api/admin/status` | Modération |

Format d'import des goals (euros) :

```json
{
  "source": { "name": "InGDoc", "url": "https://zevent.gdoc.fr/donation_goals" },
  "streamers": [
    { "twitchLogin": "anariake", "goals": [{ "amount": 1500, "label": "…", "category": "donation", "sourceUrl": "https://…" }] }
  ]
}
```

## Écrans notables

- `/` radar : goals imminents en tête avec compte à rebours, puis goals à portée, fil des événements et signalements.
- `/streamers/:login/watch` : mode « en direct » plein écran sur le prochain goal d'un streamer (montant animé, reste, ETA, delta 5 min).
- `/streamers?live=live&max=100000` : les filtres d'Explorer vivent dans l'URL et se partagent.
- `/cagnotte` : la cagnotte 2026 face aux éditions 2018-2025 (courbes calées sur le vendredi 18 h ou sur l'ouverture des dons, écart au même stade, course aux millions).

## Moteur du radar

- vitesse = médiane des hausses par minute sur 5 minutes (≥ 3 échantillons) ;
- ETA = reste / vitesse, masquée si données > 2 min, ETA > 1 h ou volatilité trop forte ;
- confiance haute / moyenne / faible selon échantillons, volatilité et fraîcheur ;
- score = proximité × momentum × bonus live × confiance × fraîcheur ;
- catégories : Imminent (ETA < 5 min), Très proche (< 10 % ou 2 000 €), En accélération, À surveiller.

Les paliers sont détectés sur `ancien < goal ≤ nouveau`, avec confirmation sur deux collectes pour toute baisse importante de cagnotte. Un goal importé sous le montant courant est marqué `reached` sans notification.
