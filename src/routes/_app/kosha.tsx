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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtInr } from "@/lib/format";
import { toast } from "sonner";
import { Leaf, RefreshCw, Plus, FileDown, Mail } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import jsPDF from "jspdf";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

export const Route = createFileRoute("/_app/kosha")({
  component: KoshaPage,
});

const KOSHAS = [
  { key: "cost_score", name: "Annamaya Kosha", sanskrit: "Cost", desc: "The physical layer · raw spend efficiency" },
  { key: "performance_score", name: "Pranamaya Kosha", sanskrit: "Performance", desc: "The energy layer · responsiveness & throughput" },
  { key: "security_score", name: "Manomaya Kosha", sanskrit: "Security", desc: "The mental layer · access control posture" },
  { key: "compliance_score", name: "Vijnanamaya Kosha", sanskrit: "Compliance", desc: "The wisdom layer · policy adherence" },
  { key: "carbon_score", name: "Anandamaya Kosha", sanskrit: "Carbon", desc: "The bliss layer · sustainability footprint" },
];

const REGIONS = [
  { region: "eu-north-1", provider: "AWS", intensity: 24 },
  { region: "us-west-2", provider: "AWS", intensity: 142 },
  { region: "us-east-1", provider: "AWS", intensity: 389 },
  { region: "ap-south-1", provider: "AWS", intensity: 712 },
  { region: "ap-southeast-1", provider: "GCP", intensity: 405 },
];

const SERVICE_CATEGORIES = ["Compute", "Storage", "Network", "ML Training", "Database", "Serverless"];

const jobSchema = z.object({
  job_name: z.string().min(2),
  workload_size: z.string().min(2),
  delay_tolerance_hrs: z.coerce.number<unknown>().min(1).max(8),
  source_region: z.string().optional(),
});

function KoshaPage() {
  const { tenant } = useAuth();
  const [scores, setScores] = useState<any>(null);
  const [billing, setBilling] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [threshold, setThreshold] = useState(200);
  const [open, setOpen] = useState(false);

  const refresh = async (id: string) => {
    const [k, b, j] = await Promise.all([
      supabase.from("kosha_scores").select("*").eq("tenant_id", id).order("scored_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("billing_events").select("*").eq("tenant_id", id),
      supabase.from("carbon_jobs").select("*").eq("tenant_id", id).order("created_at", { ascending: false }),
    ]);
    setScores(k.data);
    setBilling(b.data ?? []);
    setJobs(j.data ?? []);
  };

  useEffect(() => { if (tenant) refresh(tenant.id); }, [tenant?.id]);

  const recalcScores = async () => {
    if (!scores) return;
    const jitter = () => Math.max(50, Math.min(99, Number(scores.cost_score) + (Math.random() * 6 - 3)));
    const next = {
      tenant_id: tenant!.id,
      cost_score: Math.round(jitter()),
      performance_score: Math.round(Math.max(50, Math.min(99, Number(scores.performance_score) + (Math.random() * 6 - 3)))),
      security_score: Math.round(Math.max(50, Math.min(99, Number(scores.security_score) + (Math.random() * 6 - 3)))),
      compliance_score: Math.round(Math.max(50, Math.min(99, Number(scores.compliance_score) + (Math.random() * 6 - 3)))),
      carbon_score: Math.round(Math.max(50, Math.min(99, Number(scores.carbon_score) + (Math.random() * 6 - 3)))),
      esg_grade: "A-",
    };
    const avg = (next.cost_score + next.performance_score + next.security_score + next.compliance_score + next.carbon_score) / 5;
    next.esg_grade = grade(avg);
    await supabase.from("kosha_scores").insert(next);
    toast.success("Scores refreshed");
    refresh(tenant!.id);
  };

  const scheduleJob = async (j: any) => {
    await supabase.from("carbon_jobs").update({ status: "scheduled", scheduled_at: new Date().toISOString() }).eq("id", j.id);
    toast.success("Job shifted to green window");
    refresh(tenant!.id);
  };

  const overall = useMemo(() => {
    if (!scores) return 0;
    return Math.round((Number(scores.cost_score) + Number(scores.performance_score) + Number(scores.security_score)
      + Number(scores.compliance_score) + Number(scores.carbon_score)) / 5);
  }, [scores]);

  const scope = useMemo(() => {
    const totals: Record<string, number> = {};
    SERVICE_CATEGORIES.forEach((c) => totals[c] = 0);
    billing.forEach((b) => {
      const cat = mapServiceToCategory(b.service);
      totals[cat] = (totals[cat] || 0) + Number(b.amount_inr) * 0.0003 * 400 / 1000; // kWh × intensity → tCO2
    });
    return SERVICE_CATEGORIES.map((c) => ({
      category: c,
      scope1: 0,
      scope2: Math.round(totals[c] * 100) / 100,
      scope3: Math.round(totals[c] * 1.37 * 100) / 100,
    }));
  }, [billing]);

  const footprintMtd = scope.reduce((s, r) => s + r.scope2 + r.scope3, 0);
  const carbonSaved = jobs.filter((j) => j.status === "scheduled").reduce((s, j) => s + Number(j.co2_saved_kg) / 1000, 0);
  const greenJobs = jobs.filter((j) => j.status === "scheduled").length;

  const downloadPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("SpendLens Chakravyuha — ESG Report", 14, 18);
    doc.setFontSize(10);
    doc.text(`Tenant: ${tenant?.name ?? "—"}`, 14, 28);
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 34);
    doc.setFontSize(12);
    let y = 48;
    const scope2Total = scope.reduce((s, r) => s + r.scope2, 0);
    const scope3Total = scope.reduce((s, r) => s + r.scope3, 0);
    doc.text("Emissions Summary", 14, y); y += 8;
    doc.setFontSize(10);
    doc.text(`Scope 1: 0 tCO2`, 18, y); y += 6;
    doc.text(`Scope 2: ${scope2Total.toFixed(2)} tCO2`, 18, y); y += 6;
    doc.text(`Scope 3: ${scope3Total.toFixed(2)} tCO2`, 18, y); y += 6;
    doc.text(`Total footprint: ${(scope2Total + scope3Total).toFixed(2)} tCO2`, 18, y); y += 6;
    doc.text(`Saved via green scheduling: ${carbonSaved.toFixed(2)} tCO2`, 18, y); y += 6;
    doc.text(`ESG Grade: ${scores?.esg_grade ?? "—"}`, 18, y); y += 12;
    doc.setFontSize(12); doc.text("Top services by emissions", 14, y); y += 8;
    doc.setFontSize(10);
    const top = [...scope].sort((a, b) => (b.scope2 + b.scope3) - (a.scope2 + a.scope3)).slice(0, 5);
    top.forEach((s) => { doc.text(`${s.category}: ${(s.scope2 + s.scope3).toFixed(2)} tCO2`, 18, y); y += 6; });
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text("Generated by SpendLens Chakravyuha", 14, 285);
    doc.save("esg-report.pdf");
    toast.success("ESG report downloaded");
  };

  const emailReport = async () => {
    await supabase.from("alert_log").insert({
      tenant_id: tenant!.id, alert_type: "ESG_REPORT",
      message: "ESG Report sent to compliance team", severity: "INFO", channel: "email",
    });
    toast.success(`ESG report emailed to compliance@${(tenant?.name || "co").toLowerCase().replace(/\s+/g, "")}.com`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pancha Kosha</h1>
        <p className="text-sm text-muted-foreground">Five-layer health matrix · carbon · ESG reporting</p>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div><CardTitle>Five-Layer Health Matrix</CardTitle><CardDescription>Holistic posture across the five sheaths</CardDescription></div>
            <Button size="sm" variant="outline" onClick={recalcScores}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh Scores</Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {KOSHAS.map((k, i) => {
              const v = scores ? Number(scores[k.key]) : 0;
              const g = grade(v);
              return (
                <div key={k.key} style={{ animationDelay: `${i * 100}ms` }} className="animate-in fade-in slide-in-from-left-3 duration-500">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="min-w-0">
                      <div className="font-semibold text-sm">{k.name} <span className="text-muted-foreground font-normal">· {k.sanskrit}</span></div>
                      <div className="text-xs text-muted-foreground truncate">{k.desc}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-lg font-bold tabular-nums">{v}</span>
                      <Badge className={gradeColor(g)}>{g}</Badge>
                    </div>
                  </div>
                  <Progress value={v} className="h-2" />
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader><CardTitle>Overall ESG Grade</CardTitle><CardDescription>Average across five koshas</CardDescription></CardHeader>
          <CardContent className="flex-1 flex flex-col items-center justify-center gap-3">
            <div className="text-7xl font-bold">{grade(overall)}</div>
            <div className="text-3xl font-semibold text-muted-foreground">{overall}/100</div>
            <Badge variant="outline" className="mt-2"><Leaf className="w-3 h-3 mr-1" />Sustainability-aligned</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carbon Intensity by Region</CardTitle>
          <CardDescription>Threshold: <span className="font-mono">{threshold} gCO₂eq/kWh</span> · below is GREEN</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Slider value={[threshold]} onValueChange={(v) => setThreshold(v[0])} min={50} max={450} step={10} />
          <Table>
            <TableHeader>
              <TableRow><TableHead>Region</TableHead><TableHead>Provider</TableHead><TableHead className="text-right">Intensity</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {REGIONS.map((r) => {
                const green = r.intensity < threshold;
                const pct = Math.min(100, (r.intensity / 750) * 100);
                return (
                  <TableRow key={r.region}>
                    <TableCell className="font-mono text-xs">{r.region}</TableCell>
                    <TableCell>{r.provider}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.intensity}</TableCell>
                    <TableCell>
                      <Badge className={green ? "bg-[color:var(--success)] text-white" : "bg-destructive text-destructive-foreground"}>
                        {green ? "GREEN" : "HIGH CO₂"}
                      </Badge>
                    </TableCell>
                    <TableCell className="w-1/3">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full ${green ? "bg-[color:var(--success)]" : "bg-destructive"} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className="grid grid-cols-3 gap-4">
            <StatBox label="Footprint MTD" value={`${footprintMtd.toFixed(1)} tCO₂`} />
            <StatBox label="Saved scheduling" value={`${carbonSaved.toFixed(2)} tCO₂`} />
            <StatBox label="Green jobs shifted" value={String(greenJobs)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Green Workload Scheduler</CardTitle><CardDescription>Shift compute to low-carbon regions</CardDescription></div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="w-3.5 h-3.5 mr-1.5" />Add Job</Button></DialogTrigger>
            <AddJobDialog onClose={() => setOpen(false)} tenantId={tenant!.id} onAdded={() => refresh(tenant!.id)} />
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Job</TableHead><TableHead>Size</TableHead><TableHead>Delay</TableHead><TableHead>Source</TableHead><TableHead>Target</TableHead><TableHead className="text-right">CO₂ saved</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-medium">{j.job_name}</TableCell>
                  <TableCell className="text-xs">{j.workload_size}</TableCell>
                  <TableCell className="text-xs">{j.delay_tolerance_hrs}h</TableCell>
                  <TableCell className="font-mono text-xs">{j.source_region}</TableCell>
                  <TableCell className="font-mono text-xs">{j.target_region || "—"}</TableCell>
                  <TableCell className="text-right text-[color:var(--success)]">{Number(j.co2_saved_kg).toFixed(0)} kg</TableCell>
                  <TableCell><Badge className={j.status === "scheduled" ? "bg-[color:var(--success)] text-white" : ""}>{j.status}</Badge></TableCell>
                  <TableCell className="text-right">
                    {j.status === "queued" && <Button size="sm" variant="outline" onClick={() => scheduleJob(j)}>Schedule</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
          <div><CardTitle>ESG Report</CardTitle><CardDescription>Scope 1 / 2 / 3 emissions by service</CardDescription></div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={downloadPdf}><FileDown className="w-3.5 h-3.5 mr-1.5" />Download PDF</Button>
            <Button size="sm" onClick={emailReport}><Mail className="w-3.5 h-3.5 mr-1.5" />Email Compliance</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={scope}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `${Number(v).toFixed(2)} tCO₂`} />
                <Legend />
                <Bar dataKey="scope1" stackId="a" fill="var(--muted-foreground)" />
                <Bar dataKey="scope2" stackId="a" fill="var(--success)" />
                <Bar dataKey="scope3" stackId="a" fill="var(--purple-brand)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AddJobDialog({ onClose, tenantId, onAdded }: any) {
  const { register, handleSubmit, formState: { errors } } = useForm<z.infer<typeof jobSchema>>({ resolver: zodResolver(jobSchema) });
  const [region, setRegion] = useState("ap-south-1");

  const onSubmit = async (data: any) => {
    const src = REGIONS.find((r) => r.region === region)!;
    const target = REGIONS.find((r) => r.region === "eu-north-1")!;
    const co2 = Math.round((src.intensity - target.intensity) * 0.1);
    await supabase.from("carbon_jobs").insert({
      tenant_id: tenantId, job_name: data.job_name, workload_size: data.workload_size,
      delay_tolerance_hrs: data.delay_tolerance_hrs, source_region: region, target_region: target.region,
      source_intensity: src.intensity, target_intensity: target.intensity, co2_saved_kg: co2,
    });
    toast.success("Job added to queue");
    onAdded(); onClose();
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Add carbon-aware job</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div><Label>Job name</Label><Input {...register("job_name")} />{errors.job_name && <p className="text-xs text-destructive mt-1">{errors.job_name.message}</p>}</div>
        <div><Label>Workload size</Label><Input placeholder="e.g. 12 GPU hrs" {...register("workload_size")} />{errors.workload_size && <p className="text-xs text-destructive mt-1">{errors.workload_size.message}</p>}</div>
        <div><Label>Delay tolerance (hrs)</Label><Input type="number" min={1} max={8} {...register("delay_tolerance_hrs")} />{errors.delay_tolerance_hrs && <p className="text-xs text-destructive mt-1">{errors.delay_tolerance_hrs.message}</p>}</div>
        <div>
          <Label>Source region</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ap-south-1">ap-south-1</SelectItem>
              <SelectItem value="ap-southeast-1">ap-southeast-1</SelectItem>
              <SelectItem value="us-east-1">us-east-1</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter><Button type="submit">Add job</Button></DialogFooter>
      </form>
    </DialogContent>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground uppercase">{label}</div><div className="text-xl font-bold mt-1">{value}</div></CardContent></Card>;
}

function grade(v: number) { return v >= 90 ? "A" : v >= 80 ? "B" : v >= 70 ? "C" : "D"; }
function gradeColor(g: string) {
  return g === "A" ? "bg-[color:var(--success)] text-white"
    : g === "B" ? "bg-primary text-primary-foreground"
    : g === "C" ? "bg-[color:var(--amber-brand)] text-white"
    : "bg-destructive text-destructive-foreground";
}
function mapServiceToCategory(service: string) {
  const m: Record<string, string> = {
    EC2: "Compute", VM: "Compute", S3: "Storage", CloudFront: "Network",
    SageMaker: "ML Training", RDS: "Database", Lambda: "Serverless", GKE: "Compute",
  };
  return m[service] ?? "Compute";
}
