create table if not exists fide_api_keys (
  id text primary key,
  name text not null,
  token_hash text not null unique,
  truncated_key text not null,
  scopes text[] not null default array['graph:read']::text[],
  is_active boolean not null default true,
  expires_at timestamptz null,
  last_used_at timestamptz null,
  created_at timestamptz not null default now()
);

create index if not exists idx_fide_api_keys_active on fide_api_keys (is_active);
create index if not exists idx_fide_api_keys_expires_at on fide_api_keys (expires_at);
