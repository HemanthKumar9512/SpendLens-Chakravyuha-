
-- Helper: get current user's tenant_id (security definer to avoid recursion)
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  plan text default 'growth',
  monthly_budget_inr numeric default 1500000,
  created_at timestamptz default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  tenant_id uuid references public.tenants on delete cascade,
  full_name text,
  role text default 'finops',
  created_at timestamptz default now()
);

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path = public as $$
  select tenant_id from public.profiles where id = auth.uid()
$$;

create table if not exists public.cloud_providers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants on delete cascade,
  provider text not null,
  region text,
  status text default 'connected',
  monthly_spend_inr numeric default 0,
  last_synced_at timestamptz default now()
);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants on delete cascade,
  provider text,
  service text,
  resource_id text,
  amount_inr numeric,
  usage_unit text,
  event_date date,
  created_at timestamptz default now()
);

create table if not exists public.anomalies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants on delete cascade,
  service text,
  provider text,
  anomaly_type text,
  impact_inr numeric,
  risk_level text,
  z_score numeric,
  arthashastra_score numeric,
  reversibility numeric,
  status text default 'open',
  detected_at timestamptz default now()
);

create table if not exists public.remediation_actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants on delete cascade,
  anomaly_id uuid references public.anomalies on delete set null,
  action_type text,
  provider text,
  resource_id text,
  saving_inr numeric,
  ring_level integer,
  risk_level text,
  status text default 'pending',
  approved_by text,
  executed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.forecast_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants on delete cascade,
  horizon_days integer,
  mape numeric,
  forecast_json jsonb,
  fourier_pulse jsonb,
  created_at timestamptz default now()
);

create table if not exists public.kosha_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants on delete cascade,
  cost_score numeric,
  performance_score numeric,
  security_score numeric,
  compliance_score numeric,
  carbon_score numeric,
  esg_grade text,
  scored_at timestamptz default now()
);

create table if not exists public.carbon_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants on delete cascade,
  job_name text,
  workload_size text,
  delay_tolerance_hrs integer,
  source_region text,
  target_region text,
  source_intensity numeric,
  target_intensity numeric,
  co2_saved_kg numeric,
  status text default 'queued',
  scheduled_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.alert_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants on delete cascade,
  alert_type text,
  message text,
  severity text,
  channel text,
  sent_at timestamptz default now()
);

-- Enable RLS
alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.cloud_providers enable row level security;
alter table public.billing_events enable row level security;
alter table public.anomalies enable row level security;
alter table public.remediation_actions enable row level security;
alter table public.forecast_runs enable row level security;
alter table public.kosha_scores enable row level security;
alter table public.carbon_jobs enable row level security;
alter table public.alert_log enable row level security;

-- Policies: tenant-scoped read/write for the current user's tenant
create policy "tenants_select_own" on public.tenants for select using (id = public.current_tenant_id());
create policy "tenants_update_own" on public.tenants for update using (id = public.current_tenant_id());

create policy "profiles_select_own_tenant" on public.profiles for select using (tenant_id = public.current_tenant_id());
create policy "profiles_update_self" on public.profiles for update using (id = auth.uid());
create policy "profiles_insert_self" on public.profiles for insert with check (id = auth.uid());

-- Generic tenant-scoped policies via DO block
do $$
declare t text;
begin
  for t in select unnest(array['cloud_providers','billing_events','anomalies','remediation_actions','forecast_runs','kosha_scores','carbon_jobs','alert_log']) loop
    execute format('create policy "%1$s_all_tenant" on public.%1$s for all using (tenant_id = public.current_tenant_id()) with check (tenant_id = public.current_tenant_id())', t);
  end loop;
end $$;

-- Auto-create tenant + profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare new_tenant_id uuid;
begin
  insert into public.tenants (name) values (coalesce(new.raw_user_meta_data->>'org_name', 'My Organisation'))
    returning id into new_tenant_id;
  insert into public.profiles (id, tenant_id, full_name, role)
    values (new.id, new_tenant_id, coalesce(new.raw_user_meta_data->>'full_name', new.email), 'finops');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable realtime
alter publication supabase_realtime add table public.anomalies;
alter publication supabase_realtime add table public.remediation_actions;
