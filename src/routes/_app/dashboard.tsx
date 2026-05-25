import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtInr, riskColor } from "@/lib/format";
import { Wallet, TrendingUp, PiggyBank, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { tenant } = useAuth();
  const [billing, setBilling] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
  const [spike, setSpike] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant) return;
    Promise.all([
      supabase.from("billing_events").select("*").eq("tenant_id", tenant.id),
      supabase.from("anomalies").select("*").eq("tenant_id", tenant.id).order("detected_at", { ascending: false }),
      supabase.from("cloud_providers").select("*").eq("tenant_id", tenant.id),
    ]).then(([b, a, p]) => {
      setBilling(b.data ?? []);
      setAnomalies(a.data ?? []);
      setProviders(p.data ?? []);
      setLoading(false);
    });

    const ch = supabase
      .channel("dash-anomalies")
      .on("postgres_changes", { event: "*", schema: "public", table: "anomalies", filter: `tenant_id=eq.${tenant.id}` }, () => {
        supabase.from("anomalies").select("*").eq("tenant_id", tenant.id).order("detected_at", { ascending: false })
          .then(({ data }) => setAnomalies(data ?? []));
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenant?.id]);

  const mult = 1 + spike / 100;
  const mtd = useMemo(() => billing.reduce((s, b) => s + Number(b.amount_inr), 0) * mult, [billing, mult]);
  const projected = mtd * 1.08;
  const savings = useMemo(() => anomalies.filter((a) => a.status === "open").reduce((s, a) => s + Number(a.impact_inr), 0), [anomalies]);
  const activeAnomalies = anomalies.filter((a) => a.status === "open").length;

  const byProvider = useMemo(() => {
    const m: Record<string, number> = {};
    billing.forEach((b) => { m[b.provider] = (m[b.provider] || 0) + Number(b.amount_inr); });
    return ["aws", "azure", "gcp"].map((p) => ({ provider: p, total: (m[p] || 0) * mult }));
  }, [billing, mult]);
  const totalSpend = byProvider.reduce((s, p) => s + p.total, 0) || 1;

  const tickerItems = byProvider.map((p) => {
    const perHour = p.total / 30 / 24;
    return { p: p.provider, perHour };
  });

  if (loading) return <SkeletonGrid />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Multi-cloud spend overview · live anomaly feed</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric icon={Wallet} label="Cloud Spend MTD" value={fmtInr(mtd)} color="primary" />
        <Metric icon={TrendingUp} label="Projected Month-End" value={fmtInr(projected)} color="amber" />
        <Metric icon={PiggyBank} label="Savings Identified" value={fmtInr(savings)} color="success" />
        <Metric icon={AlertTriangle} label="Active Anomalies" value={String(activeAnomalies)} color="coral" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Cloud Provider Spend</CardTitle>
            <CardDescription>Share of MTD spend</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {byProvider.map((p) => {
              const pct = (p.total / totalSpend) * 100;
              return (
                <div key={p.provider}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium uppercase">{p.provider}</span>
                    <span className="text-muted-foreground">{fmtInr(p.total)} · {pct.toFixed(1)}%</span>
                  </div>
                  <Progress value={pct} className="h-2.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spend Spike Simulator</CardTitle>
            <CardDescription>Simulate workload growth in real time</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold">+{spike}%</span>
              <span className="text-sm text-muted-foreground">applied across all metrics</span>
            </div>
            <Slider value={[spike]} onValueChange={(v) => setSpike(v[0])} max={100} step={1} />
            <div className="text-xs text-muted-foreground">Move the slider to project the impact of a sudden cost spike.</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent anomalies</CardTitle>
          <CardDescription>Last 5 detected events</CardDescription>
        </CardHeader>
        <CardContent>
          {anomalies.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">No anomalies detected</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Impact</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead className="text-right">Z-Score</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anomalies.slice(0, 5).map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.service}</TableCell>
                      <TableCell className="uppercase text-xs">{a.provider}</TableCell>
                      <TableCell>{a.anomaly_type}</TableCell>
                      <TableCell className="text-right">{fmtInr(Number(a.impact_inr) * mult)}</TableCell>
                      <TableCell><Badge variant="outline" className={riskColor(a.risk_level)}>{a.risk_level}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{Number(a.z_score).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums">{Math.round(Number(a.arthashastra_score))}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="bg-[color:var(--navy)] text-white py-3 overflow-hidden">
            <div className="marquee text-sm">
              {[...tickerItems, ...tickerItems, ...tickerItems].map((t, i) => (
                <span key={i} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[color:var(--success)] animate-pulse" />
                  <span className="uppercase font-semibold">{t.p}</span>
                  <span className="opacity-70">{fmtInr(t.perHour)}/hr</span>
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value, color }: any) {
  const colors: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    amber: "bg-[color:var(--amber-brand)]/10 text-[color:var(--amber-brand)]",
    success: "bg-[color:var(--success)]/10 text-[color:var(--success)]",
    coral: "bg-[color:var(--coral)]/10 text-[color:var(--coral)]",
  };
  return (
    <Card>
      <CardContent className="p-5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
        <div className="text-2xl font-bold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
        ))}
      </div>
      <div className="h-64 rounded-lg bg-muted animate-pulse" />
    </div>
  );
}
