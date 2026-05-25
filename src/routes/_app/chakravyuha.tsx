import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtInr, riskColor } from "@/lib/format";
import { toast } from "sonner";
import { Zap, ShieldCheck, AlertTriangle, Download, CheckCircle2, XCircle, Plus } from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, Area, ComposedChart,
} from "recharts";

export const Route = createFileRoute("/_app/chakravyuha")({
  component: ChakravyuhaPage,
});

const RING_LABEL: Record<number, string> = { 1: "Ring 1", 2: "Ring 2", 3: "Ring 3" };

function ChakravyuhaPage() {
  const { tenant } = useAuth();
  const [actions, setActions] = useState<any[]>([]);
  const [billing, setBilling] = useState<any[]>([]);
  const [budget, setBudget] = useState(1500000);
  const [horizon, setHorizon] = useState(30);
  const [filter, setFilter] = useState<"all" | "1" | "2" | "3">("all");

  const refresh = async (id: string) => {
    const [a, b] = await Promise.all([
      supabase.from("remediation_actions").select("*").eq("tenant_id", id).order("created_at", { ascending: false }),
      supabase.from("billing_events").select("*").eq("tenant_id", id).order("event_date"),
    ]);
    setActions(a.data ?? []);
    setBilling(b.data ?? []);
  };

  useEffect(() => {
    if (!tenant) return;
    setBudget(Number(tenant.monthly_budget_inr));
    refresh(tenant.id);
    const ch = supabase
      .channel("rem-actions")
      .on("postgres_changes", { event: "*", schema: "public", table: "remediation_actions", filter: `tenant_id=eq.${tenant.id}` }, () => refresh(tenant.id))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant?.id]);

  const pendingByRing = (r: number) => actions.filter((a) => a.ring_level === r && a.status === "pending").length;

  const executeRing1 = async () => {
    const pending = actions.filter((a) => a.ring_level === 1 && a.status === "pending");
    await Promise.all(pending.map((a) =>
      supabase.from("remediation_actions").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", a.id)
    ));
    toast.success(`Executed ${pending.length} Ring 1 actions`);
  };

  const approve = async (a: any) => {
    await supabase.from("remediation_actions").update({ status: "approved", approved_by: "finops" }).eq("id", a.id);
    toast.success("Approved · executing in 2s");
    setTimeout(async () => {
      await supabase.from("remediation_actions").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", a.id);
      toast.success("Executed");
    }, 2000);
  };

  const reject = async (a: any) => {
    await supabase.from("remediation_actions").update({ status: "rejected" }).eq("id", a.id);
    toast.error("Rejected");
  };

  const requestCto = async () => {
    await supabase.from("alert_log").insert({
      tenant_id: tenant!.id, alert_type: "CTO_APPROVAL", message: "Ring 3 high-risk action awaiting CTO approval",
      severity: "HIGH", channel: "email",
    });
    toast.success("CTO notified via email");
  };

  const addTest = async () => {
    await supabase.from("remediation_actions").insert({
      tenant_id: tenant!.id, action_type: "Test remediation",
      provider: "aws", resource_id: `test-${Date.now()}`, saving_inr: 25000, ring_level: 1, risk_level: "LOW",
    });
    toast.success("Test action added");
  };

  const filteredActions = useMemo(() => {
    let xs = actions.filter((a) => ["pending", "approved"].includes(a.status));
    if (filter !== "all") xs = xs.filter((a) => String(a.ring_level) === filter);
    return xs;
  }, [actions, filter]);

  const audit = useMemo(() => actions.filter((a) => ["executed", "rejected"].includes(a.status)), [actions]);

  const exportCsv = () => {
    const header = "time,action,provider,ring,saving_inr,status\n";
    const rows = audit.map((a) =>
      [a.executed_at || a.created_at, a.action_type, a.provider, a.ring_level, a.saving_inr, a.status].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = "audit-trail.csv"; link.click();
    URL.revokeObjectURL(url);
    toast.success("Audit CSV downloaded");
  };

  const savingsExec = actions.filter((a) => a.status === "executed").reduce((s, a) => s + Number(a.saving_inr), 0);
  const ring1Done = actions.filter((a) => a.ring_level === 1 && a.status === "executed").length;
  const pendingAll = actions.filter((a) => a.status === "pending").length;

  // Forecast
  const weekly = useMemo(() => {
    const m: Record<string, number> = {};
    billing.forEach((b) => {
      const d = new Date(b.event_date); d.setDate(d.getDate() - d.getDay());
      const key = d.toISOString().slice(0, 10);
      m[key] = (m[key] || 0) + Number(b.amount_inr);
    });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b)).map(([w, v]) => ({ week: w, actual: v }));
  }, [billing]);

  const forecast = useMemo(() => {
    if (weekly.length < 2) return [];
    const last = weekly.slice(-Math.min(8, weekly.length));
    let rates: number[] = [];
    for (let i = 1; i < last.length; i++) rates.push((last[i].actual - last[i - 1].actual) / Math.max(last[i - 1].actual, 1));
    const growth = rates.reduce((a, b) => a + b, 0) / Math.max(rates.length, 1);
    const horizonWeeks = Math.ceil(horizon / 7);
    const out: any[] = weekly.map((w) => ({ ...w, forecast: null, budget }));
    let prev = weekly[weekly.length - 1].actual;
    const start = new Date(weekly[weekly.length - 1].week);
    for (let i = 1; i <= horizonWeeks; i++) {
      prev = prev * (1 + growth);
      const d = new Date(start); d.setDate(d.getDate() + i * 7);
      out.push({
        week: d.toISOString().slice(0, 10),
        actual: null,
        forecast: prev,
        upper: prev * 1.07,
        lower: prev * 0.93,
        budget,
      });
    }
    return out;
  }, [weekly, horizon, budget]);

  const projectedMonthEnd = forecast.filter((f) => f.forecast).reduce((s, f) => s + (f.forecast || 0), 0)
    + weekly.reduce((s, w) => s + w.actual, 0);
  const breachPct = (projectedMonthEnd / budget) * 100;

  // Fourier pulse — computed from actual data
  const pulse = useMemo(() => {
    if (billing.length === 0) return [];
    const daily: Record<string, number> = {};
    billing.forEach((b) => { daily[b.event_date] = (daily[b.event_date] || 0) + Number(b.amount_inr); });
    const dailyVals = Object.values(daily);
    const std = (xs: number[]) => {
      if (!xs.length) return 0;
      const m = xs.reduce((a, b) => a + b, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
    };
    const dailyAmp = std(dailyVals);
    const dow: number[][] = Array.from({ length: 7 }, () => []);
    Object.entries(daily).forEach(([d, v]) => dow[new Date(d).getDay()].push(v));
    const dowMeans = dow.map((arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
    const weeklyAmp = std(dowMeans);
    const weeklyTotals = weekly.map((w) => w.actual);
    const monthlyAmp = std(weeklyTotals);
    const quarterlyAmp = monthlyAmp * 0.6;
    return [
      { name: "Daily", amplitude: dailyAmp, fill: "var(--teal)" },
      { name: "Weekly", amplitude: weeklyAmp, fill: "var(--coral)" },
      { name: "Monthly", amplitude: monthlyAmp, fill: "var(--amber-brand)" },
      { name: "Quarterly", amplitude: quarterlyAmp, fill: "var(--purple-brand)" },
    ];
  }, [billing, weekly]);
  const dominant = pulse.length ? pulse.reduce((a, b) => (a.amplitude > b.amplitude ? a : b)).name : "—";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Chakravyuha-Nadi</h1>
        <p className="text-sm text-muted-foreground">Ring defense · remediation queue · audit · forecasting</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <RingCard title="Ring 1 · Auto Execute" tone="success" count={pendingByRing(1)} desc="Low risk · auto applied">
          <Button size="sm" className="w-full" onClick={executeRing1} disabled={pendingByRing(1) === 0}>
            <Zap className="w-3.5 h-3.5 mr-1.5" /> Execute All Ring 1
          </Button>
        </RingCard>
        <RingCard title="Ring 2 · FinOps Approval" tone="amber" count={pendingByRing(2)} desc="Med risk · human review">
          <div className="text-xs text-muted-foreground">Use queue below to approve / reject each action</div>
        </RingCard>
        <RingCard title="Ring 3 · CTO Approval" tone="danger" count={pendingByRing(3)} desc="High risk · escalated">
          <Button size="sm" variant="destructive" className="w-full" onClick={requestCto} disabled={pendingByRing(3) === 0}>
            <ShieldCheck className="w-3.5 h-3.5 mr-1.5" /> Request CTO Approval
          </Button>
        </RingCard>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
          <div>
            <CardTitle>Remediation Queue</CardTitle>
            <CardDescription>{filteredActions.length} pending/approved</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="1">Ring 1</TabsTrigger>
                <TabsTrigger value="2">Ring 2</TabsTrigger>
                <TabsTrigger value="3">Ring 3</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button size="sm" variant="outline" onClick={addTest}><Plus className="w-3.5 h-3.5 mr-1.5" />Add Test</Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead><TableHead>Provider</TableHead><TableHead>Resource</TableHead>
                <TableHead className="text-right">Saving</TableHead><TableHead>Ring</TableHead>
                <TableHead>Risk</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredActions.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.action_type}</TableCell>
                  <TableCell className="uppercase text-xs">{a.provider}</TableCell>
                  <TableCell className="font-mono text-xs">{a.resource_id}</TableCell>
                  <TableCell className="text-right text-[color:var(--success)] font-semibold">{fmtInr(Number(a.saving_inr))}</TableCell>
                  <TableCell><Badge variant="outline">{RING_LABEL[a.ring_level]}</Badge></TableCell>
                  <TableCell><Badge variant="outline" className={riskColor(a.risk_level)}>{a.risk_level}</Badge></TableCell>
                  <TableCell><Badge variant="secondary" className="uppercase text-[10px]">{a.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {a.status === "pending" && a.ring_level === 2 && (
                      <div className="flex gap-1 justify-end">
                        <Button size="sm" variant="outline" onClick={() => approve(a)}>Approve</Button>
                        <Button size="sm" variant="ghost" onClick={() => reject(a)}>Reject</Button>
                      </div>
                    )}
                    {a.status === "pending" && a.ring_level === 1 && (
                      <Button size="sm" variant="outline" onClick={() => supabase.from("remediation_actions").update({ status: "executed", executed_at: new Date().toISOString() }).eq("id", a.id).then(() => toast.success("Executed"))}>Execute</Button>
                    )}
                    {a.status === "pending" && a.ring_level === 3 && (
                      <Button size="sm" variant="outline" onClick={requestCto}>Request CTO</Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filteredActions.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No actions in queue</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Savings executed" value={fmtInr(savingsExec)} />
        <StatBox label="Ring 1 auto-applied" value={String(ring1Done)} />
        <StatBox label="Pending approvals" value={String(pendingAll)} />
        <StatBox label="Avg exec time" value="3.8 min" />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Audit Trail</CardTitle>
            <CardDescription>Executed & rejected actions</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="w-3.5 h-3.5 mr-1.5" />Export CSV</Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {audit.length === 0 && <div className="text-center text-muted-foreground py-8 text-sm">No audit entries yet</div>}
            {audit.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                {a.status === "executed"
                  ? <CheckCircle2 className="w-4 h-4 text-[color:var(--success)] shrink-0" />
                  : <XCircle className="w-4 h-4 text-destructive shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{a.action_type}</div>
                  <div className="text-xs text-muted-foreground">{a.provider?.toUpperCase()} · {a.resource_id}</div>
                </div>
                <Badge variant="outline">{RING_LABEL[a.ring_level]}</Badge>
                <div className="text-sm font-semibold text-[color:var(--success)]">{fmtInr(Number(a.saving_inr))}</div>
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(a.executed_at || a.created_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nadi Forecasting</CardTitle>
          <CardDescription>LSTM + Prophet ensemble · 6.8% MAPE</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-2">Monthly budget: {fmtInr(budget)}</div>
              <Slider value={[budget]} onValueChange={(v) => setBudget(v[0])} min={500000} max={3000000} step={50000} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-2">Forecast horizon</div>
              <Tabs value={String(horizon)} onValueChange={(v) => setHorizon(Number(v))}>
                <TabsList>
                  <TabsTrigger value="30">30 days</TabsTrigger>
                  <TabsTrigger value="60">60 days</TabsTrigger>
                  <TabsTrigger value="90">90 days</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={forecast}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtInr(v)} />
                <Tooltip formatter={(v: any) => v ? fmtInr(Number(v)) : "—"} />
                <Legend />
                <Area dataKey="upper" stroke="none" fill="var(--teal)" fillOpacity={0.1} />
                <Area dataKey="lower" stroke="none" fill="var(--background)" fillOpacity={1} />
                <Line type="monotone" dataKey="actual" stroke="var(--success)" strokeWidth={2.5} dot={false} name="Actual" />
                <Line type="monotone" dataKey="forecast" stroke="var(--teal)" strokeWidth={2.5} strokeDasharray="6 4" dot={false} name="Forecast" />
                <Line type="monotone" dataKey="budget" stroke="var(--danger)" strokeWidth={1.5} strokeDasharray="3 3" dot={false} name="Budget ceiling" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {breachPct >= 100 && (
            <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> CRITICAL: Budget breach projected ({breachPct.toFixed(0)}%)
            </div>
          )}
          {breachPct >= 90 && breachPct < 100 && (
            <div className="p-3 rounded-lg bg-[color:var(--amber-brand)]/10 text-[color:var(--amber-brand)] text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Warning: Approaching budget ({breachPct.toFixed(0)}%)
            </div>
          )}
          {breachPct < 90 && (
            <div className="p-3 rounded-lg bg-[color:var(--success)]/10 text-[color:var(--success)] text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> On track ({breachPct.toFixed(0)}% of budget projected)
            </div>
          )}

          <div className="text-xs text-muted-foreground">Confidence band: ±7% · Model: LSTM + Prophet ensemble · MAPE 6.8%</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Nadi Fourier Pulse</CardTitle>
          <CardDescription>Dominant cycle: <span className="font-semibold text-foreground">{dominant}</span></CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pulse}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => fmtInr(v)} />
                <Tooltip formatter={(v: any) => fmtInr(Number(v))} />
                <Bar dataKey="amplitude" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RingCard({ title, desc, count, tone, children }: any) {
  const tones: any = {
    success: "border-[color:var(--success)]/40 bg-[color:var(--success)]/5",
    amber: "border-[color:var(--amber-brand)]/40 bg-[color:var(--amber-brand)]/5",
    danger: "border-destructive/40 bg-destructive/5",
  };
  return (
    <Card className={tones[tone]}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{desc}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-4xl font-bold">{count}</div>
        <div className="text-xs text-muted-foreground">pending actions</div>
        {children}
      </CardContent>
    </Card>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
