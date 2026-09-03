import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, Download, Moon, Send, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Button, Card, SectionTitle, Select, Toggle } from "@/components/ui";
import { favoritesStore } from "@/lib/favorites";
import { getInstallationId } from "@/lib/installation";
import { getExistingSubscription, pushSupported, sendTestNotification, subscribeToPush, syncPreferences, unsubscribeFromPush } from "@/lib/push";
import { settingsStore, updateSettings } from "@/lib/settings";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

let deferredInstall: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstall = event as BeforeInstallPromptEvent;
  });
}

export function SettingsPage() {
  const settings = settingsStore.use();
  const favorites = favoritesStore.use();
  const queryClient = useQueryClient();
  const [installable, setInstallable] = useState(Boolean(deferredInstall));
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() => (typeof Notification !== "undefined" ? Notification.permission : "unsupported"));

  useEffect(() => {
    const handler = () => setInstallable(true);
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const subscription = useQuery({ queryKey: ["push-subscription"], queryFn: getExistingSubscription, enabled: pushSupported() });
  const subscribe = useMutation({
    mutationFn: async () => {
      await subscribeToPush();
      await syncPreferences(favorites.map((streamerId) => ({ streamerId, ...settings.notifications })));
      setPermission(Notification.permission);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["push-subscription"] })
  });
  const unsubscribe = useMutation({ mutationFn: unsubscribeFromPush, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["push-subscription"] }) });
  const test = useMutation({ mutationFn: sendTestNotification });
  const subscribed = Boolean(subscription.data);

  function setNotification(key: keyof typeof settings.notifications, value: boolean) {
    const notifications = { ...settings.notifications, [key]: value };
    updateSettings({ notifications });
    if (subscribed) syncPreferences(favorites.map((streamerId) => ({ streamerId, ...notifications }))).catch(() => undefined);
  }

  return (
    <div className="space-y-5 lg:max-w-4xl">
      <SectionTitle>Réglages</SectionTitle>
      <div className="grid gap-5 lg:grid-cols-2 lg:items-start">

      <Card className="p-4">
        <h3 className="flex items-center gap-2 font-semibold"><Bell size={16} />Notifications</h3>
        {!pushSupported() ? (
          <p className="mt-2 text-sm text-muted">Ce navigateur ne supporte pas les notifications push. Sur iOS, ajoute d'abord l'app à l'écran d'accueil.</p>
        ) : (
          <>
            <p className="mt-1 text-sm text-muted">Alertes pour tes {favorites.length} favoris. {permission === "denied" && "Les notifications sont bloquées dans le navigateur."}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {subscribed ? (
                <>
                  <Button variant="secondary" onClick={() => test.mutate()} disabled={test.isPending}><Send size={16} />Tester</Button>
                  <Button variant="danger" onClick={() => unsubscribe.mutate()} disabled={unsubscribe.isPending}><BellOff size={16} />Désactiver</Button>
                </>
              ) : (
                <Button onClick={() => subscribe.mutate()} disabled={subscribe.isPending || permission === "denied"}><Bell size={16} />Activer les notifications</Button>
              )}
            </div>
            {subscribe.isError && <p className="mt-2 text-sm text-danger">{(subscribe.error as Error).message}</p>}
            {test.isSuccess && <p className="mt-2 text-sm text-success">Notification de test envoyée.</p>}
            <div className="mt-3 divide-y divide-border">
              <Toggle label="Goal imminent" description="ETA sous 5 minutes" checked={settings.notifications.approaching} onChange={(v) => setNotification("approaching", v)} />
              <Toggle label="Palier atteint" checked={settings.notifications.reached} onChange={(v) => setNotification("reached", v)} />
              <Toggle label="Goal accompli" description="Validé par la modération" checked={settings.notifications.accomplished} onChange={(v) => setNotification("accomplished", v)} />
              <Toggle label="Début de live" checked={settings.notifications.live} onChange={(v) => setNotification("live", v)} />
            </div>
            {favorites.length === 0 && <p className="mt-2 text-xs text-muted">Ajoute des <Link to="/favorites" className="underline">favoris</Link> pour recevoir des alertes.</p>}
          </>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="flex items-center gap-2 font-semibold"><Moon size={16} />Affichage</h3>
        <label className="mt-3 block text-sm font-medium">
          Thème
          <Select value={settings.theme} onChange={(e) => updateSettings({ theme: e.target.value as typeof settings.theme })} className="mt-1">
            <option value="system">Système</option>
            <option value="dark">Nuit</option>
            <option value="light">Jour</option>
          </Select>
        </label>
        <div className="mt-2 divide-y divide-border">
          <Toggle label="Réduire les animations" checked={settings.reduceMotion} onChange={(v) => updateSettings({ reduceMotion: v })} />
          <Toggle label="Économie de données" description="Rafraîchissement moins fréquent" checked={settings.dataSaver} onChange={(v) => updateSettings({ dataSaver: v })} />
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="flex items-center gap-2 font-semibold"><Download size={16} />Installer l'application</h3>
        <p className="mt-1 text-sm text-muted">Ajoute ZEvent Radar à ton écran d'accueil pour un accès rapide et les notifications.</p>
        {installable ? (
          <Button className="mt-3" onClick={() => deferredInstall?.prompt()}>Installer</Button>
        ) : (
          <p className="mt-2 text-xs text-muted">Sur iOS : Partager → « Sur l'écran d'accueil ». Sur Android : menu → « Installer l'application ».</p>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="flex items-center gap-2 font-semibold"><Trash2 size={16} />Données locales</h3>
        <p className="mt-1 text-xs text-muted">Identifiant d'installation : <code className="font-mono">{getInstallationId().slice(0, 8)}…</code></p>
        <Button
          variant="danger"
          className="mt-3"
          onClick={async () => {
            if (subscribed) await unsubscribeFromPush().catch(() => undefined);
            localStorage.clear();
            location.reload();
          }}
        >
          Tout effacer
        </Button>
      </Card>

      </div>
      <p className="text-center text-xs text-muted lg:text-left">
        <Link to="/associations" className="underline">Associations</Link> · <a href="https://zevent.gdoc.fr/" className="underline" target="_blank" rel="noreferrer">InGDoc</a> · <Link to="/status" className="underline">État du service</Link> · <Link to="/about" className="underline">À propos</Link> · <Link to="/legal" className="underline">Mentions légales</Link>
      </p>
    </div>
  );
}
