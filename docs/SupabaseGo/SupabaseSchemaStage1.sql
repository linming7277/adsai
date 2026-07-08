-- Supabase 多用户 SaaS 基础表结构（Stage 1）
-- 执行前请确认已启用 postgres 17 / auth schema。

-- 依赖扩展
create extension if not exists "uuid-ossp";

-- =====================================
-- 1. 用户资料（与 auth.users 1:1）
-- =====================================

create table if not exists public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (email <> ''),
  full_name text,
  avatar_url text,
  locale text default 'zh-CN',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "profiles_select_own" on public.user_profiles
  for select using (auth.uid() = user_id);

create policy "profiles_update_own" on public.user_profiles
  for update using (auth.uid() = user_id);

create index if not exists idx_user_profiles_email on public.user_profiles(email);

-- =====================================
-- 2. Offers（每个用户拥有的 Offer 列表）
-- =====================================

create table if not exists public.offers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  status text not null default 'draft', -- draft / active / paused / archived
  brand_name text,
  landing_page_url text,
  ai_score numeric(5,2),
  ai_score_updated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.offers enable row level security;

create policy "offers_select_own" on public.offers
  for select using (auth.uid() = user_id);

create policy "offers_modify_own" on public.offers
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_offers_user_id on public.offers(user_id);
create index if not exists idx_offers_status on public.offers(user_id, status);

-- =====================================
-- 3. Tasks（运行中的任务 / Job 队列）
-- =====================================

create table if not exists public.tasks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  status text not null default 'pending', -- pending / running / succeeded / failed
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.tasks enable row level security;

create policy "tasks_select_own" on public.tasks
  for select using (auth.uid() = user_id);

create policy "tasks_insert_own" on public.tasks
  for insert with check (auth.uid() = user_id);

create index if not exists idx_tasks_user_status on public.tasks(user_id, status);

-- =====================================
-- 4. Ads 账户连接
-- =====================================

create table if not exists public.ads_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'google',
  account_id text not null,
  account_name text,
  refresh_token text,
  access_token text,
  token_scope text[],
  status text not null default 'active',
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.ads_connections enable row level security;

create policy "ads_connections_select_own" on public.ads_connections
  for select using (auth.uid() = user_id);

create policy "ads_connections_modify_own" on public.ads_connections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_ads_connections_user on public.ads_connections(user_id, provider);

-- =====================================
-- 5. Token 账户与流水
-- =====================================

create table if not exists public.token_wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.token_wallets enable row level security;

create policy "wallet_select_own" on public.token_wallets
  for select using (auth.uid() = user_id);

create policy "wallet_update_own" on public.token_wallets
  for update using (auth.uid() = user_id);

create table if not exists public.token_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null,
  balance_after integer not null,
  reason text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.token_transactions enable row level security;

create policy "token_tx_select_own" on public.token_transactions
  for select using (auth.uid() = user_id);

create index if not exists idx_token_tx_user_created on public.token_transactions(user_id, created_at desc);

-- =====================================
-- 6. Dashboard 风险提醒（替代 Firestore 实现）
-- =====================================

create table if not exists public.dashboard_risk_alerts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  alert_type text not null,
  title text not null,
  message text not null,
  severity text not null default 'info', -- info / warn / critical
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.dashboard_risk_alerts enable row level security;

create policy "alerts_select_own" on public.dashboard_risk_alerts
  for select using (auth.uid() = user_id);

create policy "alerts_modify_own" on public.dashboard_risk_alerts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_dashboard_alerts_user on public.dashboard_risk_alerts(user_id, is_read);

-- =====================================
-- 7. 审计：管理员代登录（已存在表补充索引）
-- =====================================

create table if not exists public.admin_impersonation_events (
  id uuid primary key default uuid_generate_v4(),
  admin_id uuid not null,
  admin_email text,
  target_user_id uuid not null,
  target_email text,
  redirect_to text,
  issued_at timestamptz not null default now()
);

create index if not exists idx_impersonation_events_target on public.admin_impersonation_events(target_user_id, issued_at desc);
create index if not exists idx_impersonation_events_admin on public.admin_impersonation_events(admin_id, issued_at desc);

-- 管理员审计表不启用 RLS，由后台服务统一访问。

-- =====================================
-- 8. 通用触发器（更新时间戳）
-- =====================================

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_offers_updated_at on public.offers;
create trigger trg_offers_updated_at
before update on public.offers
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_user_profiles_updated_at on public.user_profiles;
create trigger trg_user_profiles_updated_at
before update on public.user_profiles
for each row
execute procedure public.set_updated_at();

drop trigger if exists trg_token_wallets_updated_at on public.token_wallets;
create trigger trg_token_wallets_updated_at
before update on public.token_wallets
for each row
execute procedure public.set_updated_at();

-- =====================================
-- 9. 默认 RLS 设置（防御性限制）
-- =====================================

alter table public.offers force row level security;
alter table public.tasks force row level security;
alter table public.ads_connections force row level security;
alter table public.token_wallets force row level security;
alter table public.token_transactions force row level security;
alter table public.user_profiles force row level security;
alter table public.dashboard_risk_alerts force row level security;

-- 完成
