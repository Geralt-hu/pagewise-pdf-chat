-- Run this whole file in Supabase Dashboard -> SQL Editor.
create extension if not exists vector;

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  storage_path text not null,
  status text not null default 'processing' check (status in ('processing','ready','failed')),
  page_count int,
  error text,
  created_at timestamptz not null default now()
);

create table chunks (
  id bigserial primary key,
  document_id uuid not null references documents(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  page int not null,
  content text not null,
  embedding vector(768) not null
);

create index chunks_embedding_idx on chunks using hnsw (embedding vector_cosine_ops);
create index chunks_document_idx on chunks (document_id);

-- Row-level security: users only see their own rows
alter table documents enable row level security;
alter table chunks enable row level security;

create policy "own documents" on documents for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own chunks" on chunks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Similarity search (runs as the caller, so RLS applies)
create or replace function match_chunks(
  query_embedding vector(768),
  match_count int,
  doc_id uuid
)
returns table (id bigint, page int, content text, similarity float)
language sql stable
as $$
  select c.id, c.page, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from chunks c
  where c.document_id = doc_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- Private storage bucket; each user can only touch files in their own folder
insert into storage.buckets (id, name, public) values ('pdfs', 'pdfs', false)
on conflict (id) do nothing;

create policy "read own pdfs" on storage.objects for select
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "upload own pdfs" on storage.objects for insert
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own pdfs" on storage.objects for delete
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = auth.uid()::text);
