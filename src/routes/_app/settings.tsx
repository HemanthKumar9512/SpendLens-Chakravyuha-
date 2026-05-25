import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-store";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtInr } from "@/lib/format";
import { toast } from "sonner";
import { format, addMonths, startOfMonth } from "date-fns";
import { Settings as SettingsIcon, Plug, BellRing, Users, CreditCard } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

const ALL_PROVIDERS = ["aws", "azure", "gcp", "oci"] as const;
const ALERT_DESTS = [
  { id: "slack", name: "Slack webhook", connected: true },
  { id: "pagerduty", name: "PagerDuty", connected: true },
  { id: "email", name: "Email SMTP", connected: true },
  { id: "jira", name: "Jira", connected: false },
];

function SettingsPage() {
  const { tenant, profile, loadProfile } = useAuth();
  const [providers, setProviders] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [budget, setBudget] = useState(0);
  const [thresholds, setThresholds] = useState({ t80: true, t90: true, t100: true });
  const [ociOpen, setOciOpen] = useState(false);
  const [jiraOpen, setJiraOpen] = useState(false);
  const [editRole, setEditRole] = useState<string | null>(null);

  const refresh = async (id: string) => {
    const [p, pr, a] = await Promise.all([
      supabase.from("cloud_providers").select("*").eq("tenant_id", id),
      supabase.from("profiles").select("*").eq("tenant_id", id),
      supabase.from("remediation_actions").select("saving_inr,status").eq("tenant_id", id).eq("status", "executed"),
    ]);
    setProviders(p.data ?? []);
    setProfiles(pr.data ?? []);
    setActions(a.data ?? []);
  };

  useEffect(() => {
    if (!tenant) return;
    setBudget(Number(tenant.monthly_budget_inr));
    refresh(tenant.id);
  }, [tenant?.id]);

  const ociConnected = providers.some((p) => p.provider === "oci");

  const connectOci = async (region: string) => {
    await supabase.from("cloud_providers").insert({
      tenant_id: tenant!.id, provider: "oci", region, monthly_spend_inr: 0, status: "connected",
    });
    toast.success("OCI connected successfully");
    setOciOpen(false); refresh(tenant!.id);
  };

  const testDest = async (id: string) => {
    await supabase.from("alert_log").insert({
      tenant_id: tenant!.id, alert_type: "TEST", message: `Test alert via ${id}`,
      severity: "INFO", channel: id,
    });
    toast.success("Test alert sent");
  };

  const updateRole = async (userId: string, role: string) => {
    await supabase.from("profiles").update({ role }).eq("id", userId);
    toast.success("Role updated");
    setEditRole(null);
    refresh(tenant!.id);
    if (userId === profile?.id) loadProfile();
  };

  const saveBudget = async () => {
    await supabase.from("tenants").update({ monthly_budget_inr: budget }).eq("id", tenant!.id);
    toast.success("Budget updated");
  };

  const savings = actions.reduce((s, a) => s + Number(a.saving_inr), 0);
  const planCost = 40000;
  const roi = (savings / planCost).toFixed(1);
  const nextInvoice = format(startOfMonth(addMonths(new Date(), 1)), "do MMM yyyy");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Connectors · alerts · access · billing · budget</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plug className="w-4 h-4" />Cloud Provider Onboarding</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Provider</TableHead><TableHead>Status</TableHead><TableHead>Region</TableHead><TableHead>Last sync</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {ALL_PROVIDERS.map((p) => {
                const conn = providers.find((x) => x.provider === p);
                return (
                  <TableRow key={p}>
                    <TableCell className="uppercase font-medium">{p}</TableCell>
                    <TableCell>{conn
                      ? <Badge className="bg-[color:var(--success)] text-white">Connected</Badge>
                      : <Badge variant="outline">Not connected</Badge>}</TableCell>
                    <TableCell className="font-mono text-xs">{conn?.region ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{conn ? new Date(conn.last_synced_at).toLocaleString() : "—"}</TableCell>
                    <TableCell className="text-right">
                      {conn ? (
                        <Button size="sm" variant="outline" onClick={() => { supabase.from("cloud_providers").update({ last_synced_at: new Date().toISOString() }).eq("id", conn.id).then(() => { toast.success("Re-synced"); refresh(tenant!.id); }); }}>Re-sync</Button>
                      ) : p === "oci" ? (
                        <Dialog open={ociOpen} onOpenChange={setOciOpen}>
                          <DialogTrigger asChild><Button size="sm">Connect</Button></DialogTrigger>
                          <OciDialog onSubmit={connectOci} />
                        </Dialog>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BellRing className="w-4 h-4" />Alert Destinations</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Destination</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {ALERT_DESTS.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell>{d.connected
                    ? <Badge className="bg-[color:var(--success)] text-white">Connected</Badge>
                    : <Badge variant="outline">Not connected</Badge>}</TableCell>
                  <TableCell className="text-right">
                    {d.connected ? (
                      <Button size="sm" variant="outline" onClick={() => testDest(d.id)}>Test</Button>
                    ) : (
                      <Dialog open={jiraOpen} onOpenChange={setJiraOpen}>
                        <DialogTrigger asChild><Button size="sm">Connect Jira</Button></DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>Connect Jira</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <div><Label>Workspace URL</Label><Input placeholder="https://your-org.atlassian.net" /></div>
                          </div>
                          <DialogFooter><Button onClick={() => { toast.success("Jira connected"); setJiraOpen(false); }}>Connect</Button></DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" />Role-Based Access</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead></TableHead><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Access</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {profiles.map((u) => {
                const initials = (u.full_name || "U").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                return (
                  <TableRow key={u.id}>
                    <TableCell><div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold">{initials}</div></TableCell>
                    <TableCell>{u.full_name || "—"}</TableCell>
                    <TableCell>
                      {editRole === u.id ? (
                        <Select defaultValue={u.role} onValueChange={(v) => updateRole(u.id, v)}>
                          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="finops">FinOps</SelectItem>
                            <SelectItem value="engineering">Engineering</SelectItem>
                            <SelectItem value="cto">CTO</SelectItem>
                            <SelectItem value="csuite">C-Suite</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : <Badge variant="outline" className="uppercase text-[10px]">{u.role}</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{accessDesc(u.role)}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => setEditRole(editRole === u.id ? null : u.id)}>Edit Role</Button></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="w-4 h-4" />Billing & Plan</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Plan" value={`${tenant?.plan ?? "Growth"} · ₹40K/mo`} />
              <Stat label="Seats" value={`${profiles.length} / 20`} />
              <Stat label="Next invoice" value={nextInvoice} />
              <Stat label="Savings ROI" value={`${roi}×`} />
            </div>
            <Button className="w-full" variant="outline" onClick={() => toast.success("Our team will contact you within 24 hours")}>Upgrade to Enterprise</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><SettingsIcon className="w-4 h-4" />Budget Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Monthly budget (INR)</Label>
              <Input type="number" value={budget} onChange={(e) => setBudget(Number(e.target.value))} />
              <div className="text-xs text-muted-foreground mt-1">{fmtInr(budget)}</div>
            </div>
            <div className="space-y-2">
              <Label>Alert thresholds</Label>
              {(["t80", "t90", "t100"] as const).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <Checkbox checked={thresholds[k]} onCheckedChange={(v) => setThresholds((t) => ({ ...t, [k]: !!v }))} id={k} />
                  <label htmlFor={k} className="text-sm">{k.slice(1)}% of budget</label>
                </div>
              ))}
            </div>
            <Button onClick={saveBudget} className="w-full">Save Budget</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OciDialog({ onSubmit }: { onSubmit: (region: string) => void }) {
  const [region, setRegion] = useState("ap-mumbai-1");
  const [credType, setCredType] = useState("api-key");
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Connect Oracle Cloud</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Credential type</Label>
          <Select value={credType} onValueChange={setCredType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="api-key">API key</SelectItem>
              <SelectItem value="instance-principal">Instance principal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Region</Label>
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ap-mumbai-1">ap-mumbai-1</SelectItem>
              <SelectItem value="us-ashburn-1">us-ashburn-1</SelectItem>
              <SelectItem value="eu-frankfurt-1">eu-frankfurt-1</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(region)}>Connect</Button></DialogFooter>
    </DialogContent>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="p-3 rounded-lg border bg-card"><div className="text-xs text-muted-foreground uppercase">{label}</div><div className="text-sm font-semibold mt-0.5">{value}</div></div>;
}

function accessDesc(role: string) {
  return ({
    finops: "View spend, approve Ring 2 actions",
    engineering: "View dashboards, manage workloads",
    cto: "Approve Ring 3 actions, full control",
    csuite: "Read-only across all modules",
  } as any)[role] || "Standard access";
}
