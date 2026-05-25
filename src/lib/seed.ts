// Idempotent seed: inserts sample data the first time a tenant signs in.
import { supabase } from "@/integrations/supabase/client";

const SERVICES = ["EC2", "S3", "Lambda", "RDS", "CloudFront", "SageMaker"];
const PROVIDERS = ["aws", "azure", "gcp"] as const;

export async function ensureSeed(tenantId: string) {
  const { count } = await supabase
    .from("billing_events")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  if ((count ?? 0) > 0) return;

  // Cloud providers
  await supabase.from("cloud_providers").insert([
    { tenant_id: tenantId, provider: "aws", region: "ap-south-1", monthly_spend_inr: 810000 },
    { tenant_id: tenantId, provider: "azure", region: "eastus", monthly_spend_inr: 420000 },
    { tenant_id: tenantId, provider: "gcp", region: "us-central1", monthly_spend_inr: 270000 },
  ]);

  // Billing events: 90 rows, 5 weeks back, with one spike week
  const billing: any[] = [];
  const today = new Date();
  for (let w = 0; w < 5; w++) {
    for (const p of PROVIDERS) {
      for (const s of SERVICES) {
        const base = 20000 + Math.random() * 180000;
        const isSpike = w === 2 && p === "aws" && s === "EC2";
        const amount = isSpike ? base * 4 : base * (0.85 + Math.random() * 0.3);
        const d = new Date(today);
        d.setDate(d.getDate() - (w * 7 + Math.floor(Math.random() * 7)));
        billing.push({
          tenant_id: tenantId,
          provider: p,
          service: s,
          resource_id: `${p}-${s.toLowerCase()}-${w}`,
          amount_inr: Math.round(amount),
          usage_unit: "hr",
          event_date: d.toISOString().slice(0, 10),
        });
      }
    }
  }
  await supabase.from("billing_events").insert(billing);

  // Anomalies
  const anomalies = [
    { service: "EC2", provider: "aws", anomaly_type: "Spike +340%", impact_inr: 240000, risk_level: "HIGH", z_score: 4.1, reversibility: 0.9 },
    { service: "RDS", provider: "aws", anomaly_type: "Idle 96h", impact_inr: 92000, risk_level: "MED", z_score: 2.8, reversibility: 1.0 },
    { service: "Lambda", provider: "gcp", anomaly_type: "Off-hours usage", impact_inr: 48000, risk_level: "LOW", z_score: 2.2, reversibility: 0.8 },
    { service: "SageMaker", provider: "aws", anomaly_type: "Class mismatch", impact_inr: 156000, risk_level: "HIGH", z_score: 3.6, reversibility: 0.6 },
    { service: "VM", provider: "azure", anomaly_type: "Oversized SKU", impact_inr: 78000, risk_level: "MED", z_score: 3.0, reversibility: 0.85 },
    { service: "S3", provider: "aws", anomaly_type: "Spike +180%", impact_inr: 54000, risk_level: "MED", z_score: 2.5, reversibility: 0.95 },
    { service: "GKE", provider: "gcp", anomaly_type: "Orphaned resource", impact_inr: 33000, risk_level: "LOW", z_score: 2.3, reversibility: 1.0 },
  ].map((a) => ({
    ...a,
    tenant_id: tenantId,
    arthashastra_score: Math.round((a.impact_inr * a.reversibility) / (a.risk_level === "HIGH" ? 3 : a.risk_level === "MED" ? 2 : 1)),
  }));
  const { data: insertedAnomalies } = await supabase.from("anomalies").insert(anomalies).select();

  // Remediation actions
  const ids = (insertedAnomalies ?? []).map((a: any) => a.id);
  await supabase.from("remediation_actions").insert([
    { tenant_id: tenantId, anomaly_id: ids[2], action_type: "Stop idle instance", provider: "gcp", resource_id: "lambda-fn-1", saving_inr: 48000, ring_level: 1, risk_level: "LOW" },
    { tenant_id: tenantId, anomaly_id: ids[6], action_type: "Delete orphan disk", provider: "gcp", resource_id: "disk-orph-3", saving_inr: 33000, ring_level: 1, risk_level: "LOW" },
    { tenant_id: tenantId, anomaly_id: ids[1], action_type: "Right-size DB", provider: "aws", resource_id: "rds-prod-1", saving_inr: 92000, ring_level: 1, risk_level: "LOW" },
    { tenant_id: tenantId, anomaly_id: ids[4], action_type: "Downsize VM SKU", provider: "azure", resource_id: "vm-ml-2", saving_inr: 78000, ring_level: 2, risk_level: "MED" },
    { tenant_id: tenantId, anomaly_id: ids[5], action_type: "Tier-cold S3 bucket", provider: "aws", resource_id: "s3-logs", saving_inr: 54000, ring_level: 2, risk_level: "MED" },
    { tenant_id: tenantId, anomaly_id: ids[0], action_type: "Terminate runaway cluster", provider: "aws", resource_id: "ec2-prod-cl", saving_inr: 240000, ring_level: 3, risk_level: "HIGH" },
  ]);

  // Kosha
  await supabase.from("kosha_scores").insert({
    tenant_id: tenantId,
    cost_score: 74, performance_score: 81, security_score: 88, compliance_score: 92, carbon_score: 68, esg_grade: "A-",
  });

  // Carbon jobs
  await supabase.from("carbon_jobs").insert([
    { tenant_id: tenantId, job_name: "Nightly ML retrain", workload_size: "12 GPU hrs", delay_tolerance_hrs: 6, source_region: "ap-south-1", target_region: "eu-north-1", source_intensity: 712, target_intensity: 24, co2_saved_kg: 84, status: "scheduled", scheduled_at: new Date().toISOString() },
    { tenant_id: tenantId, job_name: "Data pipeline ETL", workload_size: "4 vCPU hrs", delay_tolerance_hrs: 3, source_region: "us-east-1", target_region: "us-west-2", source_intensity: 389, target_intensity: 142, co2_saved_kg: 19, status: "scheduled", scheduled_at: new Date().toISOString() },
    { tenant_id: tenantId, job_name: "Batch report build", workload_size: "2 vCPU hrs", delay_tolerance_hrs: 4, source_region: "ap-southeast-1", target_region: "eu-north-1", source_intensity: 405, target_intensity: 24, co2_saved_kg: 11 },
    { tenant_id: tenantId, job_name: "Image processing", workload_size: "8 GPU hrs", delay_tolerance_hrs: 2, source_region: "ap-south-1", target_region: "us-west-2", source_intensity: 712, target_intensity: 142, co2_saved_kg: 41 },
  ]);

  // Forecast row
  await supabase.from("forecast_runs").insert({
    tenant_id: tenantId, horizon_days: 30, mape: 6.8,
    fourier_pulse: { daily: 8000, weekly: 42000, monthly: 31000, quarterly: 19000 },
  });

  // Alerts
  await supabase.from("alert_log").insert([
    { tenant_id: tenantId, alert_type: "BUDGET", message: "MTD spend at 62% of budget", severity: "INFO", channel: "slack" },
    { tenant_id: tenantId, alert_type: "ANOMALY", message: "Spike detected: AWS EC2 +340%", severity: "HIGH", channel: "slack" },
    { tenant_id: tenantId, alert_type: "REMEDIATION", message: "Ring 1 auto-executed: 3 actions", severity: "INFO", channel: "email" },
  ]);
}
