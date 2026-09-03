import { REPORT_KINDS, REPORT_KIND_LABELS, type ReportKind } from "@zevent-radar/contracts";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Button, Card, Input, SectionTitle, Select, Textarea } from "@/components/ui";
import { useLatest } from "@/hooks/useData";
import { api, ApiError } from "@/lib/api";
import { TURNSTILE_SITE_KEY } from "@/lib/config";
import { getInstallationId } from "@/lib/installation";

declare global {
  interface Window {
    turnstile?: { render: (el: HTMLElement, options: { sitekey: string; callback: (token: string) => void; theme?: string }) => string; reset: (id: string) => void };
  }
}

export function ContributePage() {
  const latest = useLatest();
  const [params] = useSearchParams();
  const [streamerId, setStreamerId] = useState(params.get("streamer") ?? "");
  const [kind, setKind] = useState<ReportKind>((params.get("kind") as ReportKind | null) ?? "interesting_moment");
  const [message, setMessage] = useState(() => (params.get("goal") ? `Goal accompli : ${params.get("goal")}` : ""));
  const [sourceUrl, setSourceUrl] = useState("");
  const [token, setToken] = useState<string | undefined>();
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !widget.current) return;
    const render = () => {
      if (!window.turnstile || !widget.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(widget.current, { sitekey: TURNSTILE_SITE_KEY, callback: setToken, theme: "auto" });
    };
    if (window.turnstile) render();
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.onload = render;
      document.head.appendChild(script);
    }
  }, []);

  const submit = useMutation({
    mutationFn: () => api<{ id: string }>("/api/reports", { method: "POST", body: JSON.stringify({ streamerId, kind, message: message.trim(), sourceUrl: sourceUrl.trim() || null, installationId: getInstallationId(), turnstileToken: token }) }),
    onSuccess: () => {
      setMessage("");
      setSourceUrl("");
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
      setToken(undefined);
    }
  });

  const streamers = [...(latest.data?.streamers ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName, "fr"));
  const canSubmit = streamerId && message.trim().length >= 3 && (!TURNSTILE_SITE_KEY || token) && !submit.isPending;

  return (
    <div className="space-y-4 lg:max-w-2xl">
      <SectionTitle>Signaler à la communauté</SectionTitle>
      <p className="text-sm text-muted">Un goal manquant, un défi en cours, une annonce importante ou une erreur de données : tout passe par ici. Les propositions sont invisibles jusqu'à validation ou confirmation par d'autres installations.</p>
      <Card className="space-y-3 p-4">
        <label className="block text-sm font-medium">
          Streamer
          <Select value={streamerId} onChange={(e) => setStreamerId(e.target.value)} className="mt-1" required>
            <option value="">Choisir un streamer</option>
            {streamers.map((s) => (
              <option key={s.id} value={s.id}>{s.displayName}</option>
            ))}
          </Select>
        </label>
        <label className="block text-sm font-medium">
          Catégorie
          <Select value={kind} onChange={(e) => setKind(e.target.value as ReportKind)} className="mt-1">
            {REPORT_KINDS.map((k) => (
              <option key={k} value={k}>{REPORT_KIND_LABELS[k]}</option>
            ))}
          </Select>
        </label>
        <label className="block text-sm font-medium">
          Description courte
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={280} className="mt-1" placeholder={kind === "goal_added" ? "Ex : 5 000 € — il fait un stream cuisine" : "Ce qui se passe, en une phrase"} />
          <span className="text-xs text-muted">{message.length}/280</span>
        </label>
        <label className="block text-sm font-medium">
          URL source (clip, tweet, InGDoc…)
          <Input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} className="mt-1" placeholder="https://" />
        </label>
        {TURNSTILE_SITE_KEY && <div ref={widget} />}
        <Button disabled={!canSubmit} onClick={() => submit.mutate()} className="w-full">{submit.isPending ? "Envoi…" : "Envoyer"}</Button>
        {submit.isSuccess && <p className="text-sm text-success">Merci ! Ton signalement est en attente de confirmation. <Link to="/community" className="underline">Voir la communauté</Link></p>}
        {submit.isError && <p className="text-sm text-danger">{submit.error instanceof ApiError ? errorMessage(submit.error) : "Envoi impossible."}</p>}
      </Card>
    </div>
  );
}

function errorMessage(error: ApiError): string {
  switch (error.status) {
    case 429:
      return "Trop de signalements récents, réessaie plus tard.";
    case 403:
      return "Vérification anti-spam échouée.";
    case 404:
      return "Streamer inconnu.";
    default:
      return error.message;
  }
}
