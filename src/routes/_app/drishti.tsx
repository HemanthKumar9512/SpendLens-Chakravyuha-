import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtInr, riskColor } from "@/lib/format";
import { toast } from "sonner";
import { RefreshCw, Send, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/drishti")({
  component: DrishtiPage,
});

function DrishtiPage() {
  const { tenant } = useAuth();
  const [providers, setProviders] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [billing, setBilling] = useState<any[]>([]);
  const [threshold, setThreshold] = useState(2.5);
  const [syncing, setSyncing] = useState<string | null>(null);

  const refresh = async (id: string) => {
    const [p, a, l, b] = await Promise.all([
      supabase.from("cloud_providers").select("*").eq("tenant_id", id),
      supabase.from("anomalies").select("*").eq("tenant_id", id).order("detected_at", { ascending: false }),
      supabase.from("alert_log").select("*").eq("tenant_id", id).order("sent_at", { ascending: false }).limit(10),
      supabase.from("billing_events").select("amount_inr").eq("tenant_id", id),
    ]);
    setProviders(p.data ?? []);
    setAnomalies(a.data ?? []);
    setAlerts(l.data ?? []);
    setBilling(b.data ?? []);
  };

  useEffect(() => { if (tenant) refresh(tenant.id); }, [tenant?.id]);

  const sync = async (p: any) => {
    setSyncing(p.id);
    await supabase.from("cloud_providers").update({ last_synced_at: new Date().toISOString() }).eq("id", p.id);
    setSyncing(null);
    toast.success(`${p.provider.toUpperCase()} synced successfully`);
    refresh(tenant!.id);
  };

  const resolve = async (a: any, status: string) => {
    await supabase.from("anomalies").update({ status }).eq("id", a.id);
    toast.success(`Anomaly ${status}`);
    refresh(tenant!.id);
  };

  const sendTest = async () => {
    await supabase.from("alert_log").insert({
      tenant_id: tenant!.id,
      alert_type: "TEST",
      message: "Test alert from Drishti pipeline",
      severity: "INFO",
      channel: "slack",
    });
    toast.success("Alert dispatched to Slack");
    refresh(tenant!.id);
  };

  const filtered = useMemo(
    () => anomalies.filter((a) => Number(a.z_score) >= threshold),
    [anomalies, threshold]
  );
  const ranked = useMemo(
    () => [...anomalies].sort((a, b) => Number(b.arthashastra_score) - Number(a.arthashastra_score)),
    [anomalies]
  );

  const mtd = billing.reduce((s, b) => s + Number(b.amount_inr), 0);
  const budget = tenant?.monthly_budget_inr ? Number(tenant.monthly_budget_inr) : 1500000;
  const pct = (mtd / budget) * 100;
  const budgetColor = pct < 80 ? "bg-[color:var(--success)]" : pct < 90 ? "bg-[color:var(--amber-brand)]" : "bg-destructive";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Drishti-Chanakya</h1>
        <p className="text-sm text-muted-foreground">Cloud connector status · anomaly detection · alert pipeline</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Cloud Connector Status</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead><TableHead>Status</TableHead><TableHead>Region</TableHead>
                <TableHead>Last synced</TableHead><TableHead className="text-right">Monthly spend</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium uppercase">{p.provider}</TableCell>
                  <TableCell><Badge className="bg-[color:var(--success)] text-white">{p.status}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{p.region}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.last_synced_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">{fmtInr(Number(p.monthly_spend_inr))}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => sync(p)} disabled={syncing === p.id}>
                      <RefreshCw className={`w-3 h-3 mr-1.5 ${syncing === p.id ? "animate-spin" : ""}`} />
                      Sync Now
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Anomaly Detection Engine</CardTitle>
          <CardDescription>Z-score threshold: <span className="font-mono">{threshold.toFixed(1)}σ</span> · showing {filtered.length} of {anomalies.length}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={1.5} max={4.5} step={0.1} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead><TableHead>Provider</TableHead><TableHead>Type</TableHead>
                <TableHead className="text-right">Impact</TableHead><TableHead>Risk</TableHead>
                <TableHead className="text-right">Z</TableHead><TableHead className="text-right">Score</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.service}</TableCell>
                  <TableCell className="uppercase text-xs">{a.provider}</TableCell>
                  <TableCell>{a.anomaly_type}</TableCell>
                  <TableCell className="text-right">{fmtInr(Number(a.impact_inr))}</TableCell>
                  <TableCell><Badge variant="outline" className={riskColor(a.risk_level)}>{a.risk_level}</Badge></TableCell>
                  <TableCell className="text-right tabular-nums">{Number(a.z_score).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Math.round(Number(a.arthashastra_score))}</TableCell>
                  <TableCell className="text-right">
                    {a.status === "open" ? (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="ghost" onClick={() => resolve(a, "resolved")}><CheckCircle2 className="w-3.5 h-3.5 text-[color:var(--success)]" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => resolve(a, "dismissed")}><XCircle className="w-3.5 h-3.5 text-muted-foreground" /></Button>
                      </div>
                    ) : <Badge variant="secondary" className="text-[10px] uppercase">{a.status}</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Arthashastra Waste Ranking</CardTitle>
          <CardDescription>Score = (Impact × Reversibility) ÷ Risk Level</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead><TableHead>Service</TableHead><TableHead>Provider</TableHead>
                <TableHead className="text-right">Impact</TableHead><TableHead className="text-right">Reversibility</TableHead>
                <TableHead>Risk</TableHead><TableHead className="text-right">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ranked.map((a, i) => {
                const medal = i === 0 ? "border-l-4 border-l-[color:var(--amber-brand)]"
                  : i === 1 ? "border-l-4 border-l-slate-400"
                  : i === 2 ? "border-l-4 border-l-amber-700"
                  : "";
                return (
                  <TableRow key={a.id} className={medal}>
                    <TableCell className="font-bold tabular-nums">{i + 1}</TableCell>
                    <TableCell className="font-medium">{a.service}</TableCell>
                    <TableCell className="uppercase text-xs">{a.provider}</TableCell>
                    <TableCell className="text-right">{fmtInr(Number(a.impact_inr))}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(a.reversibility).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className={riskColor(a.risk_level)}>{a.risk_level}</Badge></TableCell>
                    <TableCell className="text-right font-bold tabular-nums">{Math.round(Number(a.arthashastra_score))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Alert Pipeline</CardTitle>
              <CardDescription>Recent dispatches</CardDescription>
            </div>
            <Button size="sm" onClick={sendTest}><Send className="w-3.5 h-3.5 mr-1.5" />Send Test</Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Time</TableHead><TableHead>Type</TableHead><TableHead>Message</TableHead><TableHead>Sev</TableHead><TableHead>Channel</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {alerts.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{new Date(a.sent_at).toLocaleTimeString()}</TableCell>
                    <TableCell className="text-xs"><Badge variant="outline">{a.alert_type}</Badge></TableCell>
                    <TableCell className="text-sm">{a.message}</TableCell>
                    <TableCell><Badge variant="outline" className={a.severity === "HIGH" ? "text-destructive border-destructive/40" : ""}>{a.severity}</Badge></TableCell>
                    <TableCell className="text-xs uppercase">{a.channel}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Budget Tracker</CardTitle>
            <CardDescription>MTD vs monthly budget</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold">{pct.toFixed(1)}%</span>
              <span className="text-sm text-muted-foreground">{fmtInr(mtd)} / {fmtInr(budget)}</span>
            </div>
            <div className="h-3 rounded-full bg-muted overflow-hidden">
              <div className={`h-full ${budgetColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
            {pct >= 100 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> CRITICAL: Budget exceeded
              </div>
            )}
            {pct >= 90 && pct < 100 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-[color:var(--amber-brand)]/10 text-[color:var(--amber-brand)] text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Warning: Above 90% of budget
              </div>
            )}
            {pct >= 80 && pct < 90 && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-[color:var(--amber-brand)]/10 text-[color:var(--amber-brand)] text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> Above 80% threshold reached
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
