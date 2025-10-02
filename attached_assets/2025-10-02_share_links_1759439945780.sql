alter table if exists galleries
  add column if not exists slug text;
create unique index if not exists galleries_slug_uq on galleries(slug);

create table if not exists share_links (
  id uuid primary key default gen_random_uuid(),
  gallery_id uuid not null references galleries(id) on delete cascade,
  album_id uuid references albums(id) on delete cascade,
  slug text not null,
  token text not null,
  pin_hash text,
  expires_at timestamptz,
  allow_download boolean default false,
  show_watermark boolean default true,
  one_time boolean default false,
  max_uses int,
  use_count int default 0,
  is_revoked boolean default false,
  created_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists share_links_slug_token_idx on share_links(slug, token);
create index if not exists share_links_gallery_idx on share_links(gallery_id);
create index if not exists share_links_album_idx on share_links(album_id);

create table if not exists share_link_access (
  id bigserial primary key,
  share_link_id uuid references share_links(id) on delete cascade,
  at timestamptz default now(),
  ip inet,
  user_agent text
);
