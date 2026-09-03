# Déployer ZEvent Radar sur Cloudflare

Guide de A à Z. Compte environ une heure la première fois, dont une bonne partie à attendre des propagations DNS. Tout se passe sur le plan gratuit de Cloudflare, avec une réserve sur la capacité expliquée à l'étape 9.

Ce que tu obtiens à la fin :

- `https://zgoals.xyz` : la PWA, servie en statique par Cloudflare.
- `https://data.zgoals.xyz/latest.json` : les données publiques servies depuis R2 avec cache CDN.
- Un Worker qui collecte chaque minute, synchronise l'InGDoc tous les quarts d'heure et envoie les notifications.
- Une page `/admin` protégée par Cloudflare Access.

## 0. Prérequis

- Un compte Cloudflare (gratuit) : https://dash.cloudflare.com
- Le projet qui build en local : `pnpm install && pnpm build`.
- Connexion de wrangler à ton compte :

```bash
cd apps/worker
pnpm exec wrangler login
pnpm exec wrangler whoami
```

## 1. Le domaine : zgoals.xyz, acheté chez Namecheap

Le domaine est chez Namecheap ; sa résolution DNS doit passer chez Cloudflare (obligatoire pour brancher le Worker et le bucket R2, et pour le HTTPS automatique). Le domaine est neuf, il ne porte aucun service : aucun risque.

1. Cloudflare → Add a domain → `zgoals.xyz` → plan Free → Continue. Cloudflare affiche deux serveurs de noms du type `xxx.ns.cloudflare.com`.
2. Namecheap → Domain List → Manage → Nameservers → **Custom DNS** → colle les deux serveurs Cloudflare → ✓.
3. Retour dans Cloudflare → « Check nameservers ». Propagation : souvent moins d'une heure, jusqu'à 24 h.
4. Note le **Zone ID** (page Overview du domaine, colonne de droite) : il sert au script pour attacher `data.zgoals.xyz` au bucket.

Les sections ci-dessous sont conservées pour référence si tu changes de domaine un jour.

### Rappel des options

La règle qui décide tout : **le domaine doit avoir sa zone DNS chez Cloudflare** (serveurs de noms Cloudflare). C'est obligatoire pour brancher un domaine personnalisé sur le Worker et sur le bucket R2. HTTPS est fourni automatiquement, ce qui est indispensable pour la PWA et les notifications push.

#### Option A : un sous-domaine d'un domaine que tu as déjà

C'est le choix recommandé, à une condition : ses DNS sont déjà chez Cloudflare, ou tu acceptes de les y migrer.

- **Déjà chez Cloudflare** : rien à faire, passe à l'étape 2. Tu utiliseras `zgoals.xyz` et `data.zgoals.xyz`.
- **Chez un autre registrar (OVH, Gandi, Ionos…)** : ajoute le domaine dans Cloudflare (« Add a domain », plan Free). Cloudflare importe tes enregistrements existants ; vérifie surtout les MX (mails) et les enregistrements de tes autres services avant de valider. Puis remplace les serveurs de noms chez ton registrar par les deux que Cloudflare t'indique. Propagation : de quelques minutes à 24 h. Le domaine reste chez ton registrar, seule la résolution DNS change.

Migrer les DNS d'un domaine qui porte déjà des services (site, mails) demande de la rigueur mais reste réversible. Si ça t'inquiète, prends l'option B.

#### Option B : acheter un domaine

Cloudflare Registrar vend à prix coûtant, sans majoration : un `.com` ou `.net` autour de 10 à 12 $/an, un `.fr` autour de 8 à 10 €/an quand l'extension est proposée. Domain Registration → Register Domains. Le domaine arrive directement avec ses DNS chez Cloudflare, sans aucune manipulation. Si l'extension que tu veux n'est pas proposée, achète-la ailleurs et pointe ses serveurs de noms vers Cloudflare comme en option A.

#### Option C : pas de domaine du tout

Le Worker est joignable sur `zevent-radar.<ton-sous-domaine>.workers.dev`, en HTTPS, gratuitement. La PWA et les notifications fonctionnent. Tu perds seulement le domaine dédié aux données (étape 9), ce qui limite fortement le trafic supportable. Acceptable pour tester, pas pour l'événement.

**Mon avis** : si ton domaine existant est déjà chez Cloudflare, sous-domaine sans hésiter. Sinon, un domaine neuf à 10 € évite de toucher aux DNS d'un domaine qui te sert déjà.

## 2. Créer les ressources Cloudflare

Tout ce chapitre, plus les secrets, les migrations, le déploiement et l'initialisation, est automatisé par `scripts/cf-setup.sh`. Il lit `.deploy-secrets.env` à la racine (déjà généré, ignoré par git) et s'exécute après `wrangler login` :

```bash
ZONE_ID=<zone id de zgoals.xyz> ./scripts/cf-setup.sh
```

Le détail manuel, pour comprendre ce qu'il fait. Depuis `apps/worker` :

```bash
pnpm exec wrangler d1 create zevent-radar
```

Copie le `database_id` affiché dans `apps/worker/wrangler.jsonc` à la place des zéros.

```bash
pnpm exec wrangler r2 bucket create zevent-radar-data
pnpm exec wrangler r2 bucket lifecycle add zevent-radar-data --prefix snapshots/ --expire-days 7
pnpm exec wrangler queues create zevent-radar-notifications
```

Si la création de la queue est refusée sur le plan gratuit, active Workers Paid (5 $/mois, résiliable). C'est de toute façon la marge de sécurité conseillée pendant l'événement, voir l'étape 9.

## 3. Turnstile (anti-spam du formulaire)

Dashboard → Turnstile → Add widget.

- Hostname : `zgoals.xyz` (ajoute aussi `localhost` pour tester).
- Mode : Managed.

Note la **site key** (publique, ira dans le front) et la **secret key** (ira dans les secrets du Worker).

## 4. Les secrets du Worker

Génère les clés de notification à la racine du projet :

```bash
pnpm vapid:generate
```

Puis, depuis `apps/worker`, chaque commande demande la valeur au clavier :

```bash
pnpm exec wrangler secret put VAPID_PUBLIC_KEY
pnpm exec wrangler secret put VAPID_PRIVATE_KEY
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm exec wrangler secret put ADMIN_TOKEN
```

Pour `ADMIN_TOKEN`, une valeur longue et aléatoire : `openssl rand -hex 32`. Garde-la, elle sert à piloter le Worker en ligne de commande.

## 5. Configuration du Worker

Dans `apps/worker/wrangler.jsonc` :

- `vars.APP_URL` → `https://zgoals.xyz`
- `vars.VAPID_SUBJECT` → `mailto:ton@mail.fr` (obligatoire pour les push, les services de notification peuvent te contacter par ce biais)
- Ajoute la route sur ton domaine :

```jsonc
"routes": [{ "pattern": "zgoals.xyz", "custom_domain": true }]
```

Avec `custom_domain: true`, Cloudflare crée lui-même l'enregistrement DNS et le certificat. Ne crée pas d'enregistrement `radar` à la main.

## 6. Configuration du front

Crée `apps/web/.env.production` :

```bash
VITE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
VITE_LEGAL_EDITOR=TonPseudo
VITE_LEGAL_CONTACT=contact@zgoals.xyz
```

Laisse `VITE_DATA_BASE_URL` vide pour l'instant, il sera renseigné à l'étape 9.

## 7. Migrations et premier déploiement

À la racine :

```bash
pnpm db:migrate
pnpm deploy
```

Le premier `deploy` peut demander de choisir un sous-domaine `workers.dev`. À la fin, wrangler affiche l'URL du Worker et confirme les deux crons. Ouvre `https://zgoals.xyz` : la page se charge avec « données indisponibles », c'est normal, rien n'a encore été collecté.

## 8. Initialiser les données

```bash
export API=https://zgoals.xyz
export TOKEN=<ton ADMIN_TOKEN>

curl -X POST -H "authorization: Bearer $TOKEN" $API/api/admin/collect
curl -X POST -H "authorization: Bearer $TOKEN" $API/api/admin/goals/sync
curl -X POST -H "authorization: Bearer $TOKEN" $API/api/admin/collect
```

Le premier appel enregistre les streamers, le second importe les goals depuis l'InGDoc, le troisième recalcule le radar avec les goals. Vérifie :

```bash
curl $API/api/health
curl $API/data/status.json
```

À partir de là, le cron prend le relais chaque minute. Rien d'autre à lancer.

## 9. Capacité : servir les données depuis R2

C'est l'étape qui compte pour tenir le trafic. Le plan gratuit Workers autorise **100 000 requêtes par jour** vers le Worker. Chaque visiteur interroge `latest.json` toutes les 20 secondes, soit 4 320 requêtes par jour et par onglet ouvert. Vingt personnes qui laissent l'app ouverte suffisent à épuiser le quota. Les fichiers statiques de l'app ne comptent pas, mais `/data/*` passe par le Worker.

La solution prévue par l'architecture : servir les JSON directement depuis R2 derrière le cache Cloudflare, sans passer par le Worker.

1. R2 → bucket `zevent-radar-data` → Settings → **Custom Domains** → Connect domain → `data.zgoals.xyz`. Cloudflare crée le DNS et le certificat.
2. Dans le même écran, **CORS Policy** :

```json
[{ "AllowedOrigins": ["https://zgoals.xyz"], "AllowedMethods": ["GET", "HEAD"], "AllowedHeaders": ["*"], "MaxAgeSeconds": 3600 }]
```

3. Caching → Cache Rules → Create rule : Hostname equals `data.zgoals.xyz` → Eligible for cache, Edge TTL « Respect origin ». Le collector écrit déjà `Cache-Control: max-age=15` sur `latest.json`, les snapshots sont immuables.
4. Dans `apps/web/.env.production` :

```bash
VITE_DATA_BASE_URL=https://data.zgoals.xyz
```

5. `pnpm deploy` à nouveau.

Vérifie avec `curl -I https://data.zgoals.xyz/latest.json` : tu dois voir `cf-cache-status: HIT` au second appel. À partir de là, le Worker ne reçoit plus que les écritures (signalements, abonnements), la page streamer pour l'historique, et l'admin.

Si tu préfères ne pas configurer ce sous-domaine, Workers Paid (5 $/mois) porte le quota à 10 millions de requêtes par mois, largement suffisant même en passant tout par le Worker.

## 10. Protéger l'administration avec Cloudflare Access

Optionnel : sans Access, `/admin` et `/api/admin/*` restent protégés par `ADMIN_TOKEN`. Access ajoute une connexion par e-mail devant, ce qui est plus confortable sur téléphone.

1. Zero Trust (https://one.dash.cloudflare.com) → si c'est la première fois, choisis un nom d'équipe : ce sera `<equipe>.cloudflareaccess.com`. Le plan Free couvre 50 utilisateurs ; Cloudflare peut demander un moyen de paiement à l'activation, sans facturation.
2. Access → Applications → Add an application → Self-hosted.
   - Application domain : `zgoals.xyz`, path `admin`. Add domain : `zgoals.xyz`, path `api/admin`.
   - Identity providers : One-time PIN suffit.
3. Policy : Allow → Include → Emails → ton adresse.
4. Une fois créée, ouvre l'application et copie l'**Application Audience (AUD) Tag**.
5. Dans `wrangler.jsonc` : `ACCESS_TEAM_DOMAIN` = `<equipe>.cloudflareaccess.com`, `ACCESS_AUD` = le tag. Puis `pnpm deploy`.

Le Worker vérifie la signature du jeton Access sur chaque appel admin ; `ADMIN_TOKEN` continue de fonctionner en parallèle pour les scripts.

## 11. Vérifier avant l'événement

- **Crons** : Workers & Pages → zevent-radar → Settings → Triggers : deux crons listés. Logs en direct : `pnpm exec wrangler tail` depuis `apps/worker`.
- **Fraîcheur** : `https://zgoals.xyz/status` doit afficher une collecte de moins d'une minute et les deux sources en OK.
- **Notifications** : sur ton téléphone, installe la PWA (menu → Ajouter à l'écran d'accueil ; sur iOS c'est obligatoire pour recevoir des push), ajoute un favori, active les notifications dans Réglages, puis « Tester ».
- **Formulaire** : envoie un signalement depuis `/contribute`, le widget Turnstile doit apparaître et le signalement arriver dans `/admin`.
- **Mentions légales** : `/legal` sans crochets.

## 12. Pendant l'événement

- Le radar tourne seul. Si `/status` passe en « données figées » plus de trois minutes, regarde `wrangler tail` : le plus probable est un changement de format de l'API ZEvent, le collector garde alors le dernier état valide.
- Forcer une collecte ou une synchronisation : les deux boutons de `/admin`, ou les `curl` de l'étape 8.
- Modération : `/admin` liste les signalements en attente ; approuver rend visible immédiatement.
- Corriger un goal : `/admin`, cherche le login, change le statut. Pour ajouter ou modifier des montants, l'API `PATCH /api/admin/goals/:id` ou une resynchronisation InGDoc.

## 13. Après l'événement

```bash
cd apps/worker
pnpm exec wrangler d1 execute zevent-radar --remote --command "DELETE FROM notification_preferences; DELETE FROM push_subscriptions; DELETE FROM notification_deliveries;"
```

Puis retire les deux entrées de `triggers.crons` dans `wrangler.jsonc` et redéploie pour arrêter les collectes. L'app reste consultable avec le dernier état. Supprimer entièrement : `wrangler delete`, puis le bucket, la base et la queue depuis le dashboard.

## Récapitulatif des coûts

| Poste | Plan | Limite utile | Usage attendu |
| --- | --- | --- | --- |
| Domaine | Registrar | — | 0 € (existant) ou ~10 €/an |
| Workers | Free | 100 000 req/jour, crons inclus | Écritures + admin seulement si l'étape 9 est faite |
| Workers Paid | 5 $/mois | 10 M req/mois | Recommandé comme marge pendant l'événement |
| D1 | Free | 5 M lectures, 100 000 écritures/jour | Quelques milliers d'écritures/jour |
| R2 | Free | 10 Go, 1 M écritures/mois | ~220 000 écritures/mois, quelques centaines de Mo |
| Queues | Free ou Paid | — | Quelques centaines de messages/jour |
| Turnstile, Access, cache | Free | 50 utilisateurs Access | — |

## Aide-mémoire

```bash
pnpm deploy                                   # build + déploiement
pnpm db:migrate                               # migrations D1 en prod
cd apps/worker && pnpm exec wrangler tail     # logs en direct
pnpm exec wrangler secret list                # secrets présents
pnpm exec wrangler d1 execute zevent-radar --remote --command "SELECT COUNT(*) FROM goals"
```
