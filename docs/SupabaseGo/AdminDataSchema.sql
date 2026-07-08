-- Supabase Admin Tables Schema
-- 执行前请确认已使用 service role 权限

create table if not exists admin_plans (
  id uuid primary key,
  name text not null,
  display_name text not null,
  price numeric not null default 0,
  currency text not null default 'USD',
  interval text not null default 'month',
  tokens integer not null default 0,
  features jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  popular boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_token_stats (
  id text primary key,
  total_balance numeric not null default 0,
  total_consumed numeric not null default 0,
  avg_balance_per_user numeric not null default 0,
  active_users integer,
  median_balance numeric,
  top_users jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists admin_token_rules (
  id uuid primary key,
  service_name text not null,
  action_type text not null,
  cost_per_unit integer not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_token_balances (
  user_id text primary key,
  email text,
  balance numeric not null default 0,
  consumed numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists admin_api_keys (
  id uuid primary key,
  name text not null,
  token text,
  scopes jsonb not null default '[]'::jsonb,
  rpm integer not null default 60,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists admin_configs (
  key text primary key,
  value jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists admin_config_history (
  id uuid primary key,
  key text not null,
  old_value jsonb,
  new_value jsonb not null,
  changed_by text,
  changed_at timestamptz not null default now(),
  operation text not null
);

create table if not exists admin_impersonation_events (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null,
  admin_email text,
  target_user_id uuid not null,
  target_email text,
  redirect_to text,
  issued_at timestamptz not null default now()
);

-- 建议的索引
create index if not exists idx_admin_token_rules_service_action
  on admin_token_rules (service_name, action_type);

create index if not exists idx_admin_config_history_key
  on admin_config_history (key, changed_at desc);

create index if not exists idx_admin_token_balances_updated
  on admin_token_balances (updated_at desc);

create index if not exists idx_admin_impersonation_events_issued_at
  on admin_impersonation_events (issued_at desc);

-- Row Level Security 可按需开启
