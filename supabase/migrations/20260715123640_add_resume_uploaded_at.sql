alter table public.resumes
  add column if not exists uploaded_at timestamptz;

update public.resumes
set uploaded_at = created_at
where uploaded_at is null;

alter table public.resumes
  alter column uploaded_at set default now(),
  alter column uploaded_at set not null;

create index if not exists resumes_uploaded_at_desc_idx
  on public.resumes (uploaded_at desc);
