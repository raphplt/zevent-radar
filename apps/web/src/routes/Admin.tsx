import type { GoalRecord, StatusFile } from "@zevent-radar/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Card, Input, SectionTitle, Select, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { euros, relativeTime } from "@/lib/format";
import { useNow } from "@/hooks/useNow";

function useToken() {
  const [token, setTokenState] = useState(() => sessionStorage.getItem("zr:admin-token") ?? "");
  const setToken = (value: string) => {
    sessionStorage.setItem("zr:admin-token", value);
    setTokenState(value);
  };
  return { token, setToken };
}

function adminApi<T>(token: string, path: string, init: RequestInit = {}) {
  return api<T>(path, { ...init, headers: { ...(init.headers as Record<string, string>), ...(token ? { authorization: `Bearer ${token}` } : {}) } });
}

interface AdminStatus {
  moderator: string;
  status: StatusFile | null;
  pendingReports: number;
  subscriptions: number;
  deliveries: Array<{ status: string; n: number }>;
  deliveryErrors: Array<{ event_key: string; status: string; sent_at: string }>;
}

interface AdminReport {
  id: string;
  streamer_id: string;
  twitch_login: string | null;
  display_name: string | null;
  kind: string;
  message: string;
  source_url: string | null;
  confirmations: number;
  created_at: string;
}

export function AdminPage() {
  const { token, setToken } = useToken();
  const [draft, setDraft] = useState(token);
  const queryClient = useQueryClient();
  const now = useNow();
  const status = useQuery({ queryKey: ["admin-status", token], queryFn: () => adminApi<AdminStatus>(token, "/api/admin/status"), retry: 0 });
  const reports = useQuery({ queryKey: ["admin-reports", token], queryFn: () => adminApi<{ reports: AdminReport[] }>(token, "/api/admin/reports?status=pending"), enabled: status.isSuccess });
  const [goalQuery, setGoalQuery] = useState("");
  const goals = useQuery({ queryKey: ["admin-goals", token, goalQuery], queryFn: () => adminApi<{ goals: GoalRecord[] }>(token, `/api/admin/goals?streamerId=${encodeURIComponent(goalQuery)}`), enabled: status.isSuccess && goalQuery.length > 1 });
  const [output, setOutput] = useState<string>("");

  const action = useMutation({
    mutationFn: async ({ path, body }: { path: string; body?: unknown }) => adminApi<unknown>(token, path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    onSuccess: (data) => {
      setOutput(JSON.stringify(data, null, 2));
      queryClient.invalidateQueries({ queryKey: ["admin-status"] });
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
    },
    onError: (error) => setOutput((error as Error).message)
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approved" | "rejected" }) => adminApi(token, `/api/admin/reports/${id}/decision`, { method: "POST", body: JSON.stringify({ status: decision }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-reports"] })
  });

  const patchGoal = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => adminApi(token, `/api/admin/goals/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-goals"] })
  });

  const importFile = useMutation({
    mutationFn: async (file: File) => adminApi<unknown>(token, "/api/admin/goals/import?dryRun=0", { method: "POST", body: await file.text() }),
    onSuccess: (data) => setOutput(JSON.stringify(data, null, 2)),
    onError: (error) => setOutput((error as Error).message)
  });

  if (status.isPending) return <Spinner />;
  if (status.isError) {
    return (
      <div className="space-y-4">
        <SectionTitle>Administration</SectionTitle>
        {token && <p className="text-sm text-danger">Jeton refusé.</p>}
        <Input type="password" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Jeton administrateur" />
        <Button onClick={() => setToken(draft)}>Se connecter</Button>
        <p className="text-xs text-muted">En production, cette page est protégée par Cloudflare Access et s'ouvre sans jeton une fois connecté. Le jeton sert en développement.</p>
      </div>
    );
  }

  const s = status.data;
  return (
    <div className="space-y-5 lg:max-w-5xl">
      <div className="flex items-center justify-between">
        <SectionTitle>Administration</SectionTitle>
        <Button variant="ghost" onClick={() => setToken("")}>Déconnexion</Button>
      </div>
      {s && (
        <Card className="p-4 text-sm">
          <p>Modérateur : <span className="font-mono">{s.moderator}</span></p>
          <p>Dernière collecte : {s.status?.lastRunAt ? relativeTime(s.status.lastRunAt, now) : "jamais"} {s.status?.stale && <span className="text-warning">(figée)</span>}</p>
          <p>Retard goals InGDoc : {s.status?.goalsSyncedAt ? relativeTime(s.status.goalsSyncedAt, now) : "jamais synchronisé"}</p>
          <p>Abonnements push : {s.subscriptions} · livraisons : {s.deliveries.map((d) => `${d.status} ${d.n}`).join(", ") || "aucune"}</p>
          <ul className="mt-2 space-y-1 text-xs">
            {s.status?.sources.map((src) => (
              <li key={src.name} className={src.ok ? "text-success" : "text-danger"}>{src.name} · {src.ok ? "OK" : src.lastError}</li>
            ))}
          </ul>
        </Card>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => action.mutate({ path: "/api/admin/collect" })} disabled={action.isPending}>Collecter maintenant</Button>
        <Button variant="secondary" onClick={() => action.mutate({ path: "/api/admin/goals/sync" })} disabled={action.isPending}>Synchroniser InGDoc</Button>
        <label className="inline-flex min-h-10 cursor-pointer items-center rounded-xl bg-surface-2 px-4 text-sm font-semibold">
          Importer un JSON
          <input type="file" accept="application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importFile.mutate(e.target.files[0])} />
        </label>
      </div>
      {output && <pre className="max-h-64 overflow-auto rounded-xl bg-surface-2 p-3 text-xs">{output}</pre>}

      <div className="lg:grid lg:grid-cols-2 lg:gap-8">
      <section>
        <SectionTitle>Signalements en attente ({reports.data?.reports.length ?? 0})</SectionTitle>
        <ul className="space-y-2">
          {reports.data?.reports.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-surface p-3 text-sm">
              <p><span className="font-semibold">{r.display_name ?? r.streamer_id}</span> · {r.kind} · {r.confirmations} confirmations</p>
              <p className="mt-1">{r.message}</p>
              {r.source_url && <a href={r.source_url} className="text-xs underline" target="_blank" rel="noreferrer">{r.source_url}</a>}
              <div className="mt-2 flex gap-2">
                <Button onClick={() => decide.mutate({ id: r.id, decision: "approved" })}>Approuver</Button>
                <Button variant="danger" onClick={() => decide.mutate({ id: r.id, decision: "rejected" })}>Rejeter</Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>Goals d'un streamer</SectionTitle>
        <Input value={goalQuery} onChange={(e) => setGoalQuery(e.target.value)} placeholder="login twitch" />
        <ul className="mt-2 space-y-1">
          {goals.data?.goals.map((g) => (
            <li key={g.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{g.label}</span>
              <span className="tabular-nums">{euros(g.amountCents)}</span>
              <Select value={g.status} onChange={(e) => patchGoal.mutate({ id: g.id, body: { status: e.target.value } })} className="!w-auto">
                {["pending", "verified", "reached", "accomplished", "rejected", "superseded"].map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </Select>
            </li>
          ))}
        </ul>
      </section>
      </div>
    </div>
  );
}
