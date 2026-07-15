-- Each HRBP account can access only its own candidate records.
-- Existing projects with data should backfill owner_id before making it NOT NULL.
ALTER TABLE public.resumes
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

ALTER TABLE public.resumes
  ALTER COLUMN owner_id SET DEFAULT auth.uid();

DROP POLICY IF EXISTS "authenticated_select_resumes" ON public.resumes;
DROP POLICY IF EXISTS "authenticated_insert_resumes" ON public.resumes;
DROP POLICY IF EXISTS "authenticated_update_resumes" ON public.resumes;
DROP POLICY IF EXISTS "authenticated_delete_resumes" ON public.resumes;
DROP POLICY IF EXISTS "owners_select_resumes" ON public.resumes;
DROP POLICY IF EXISTS "owners_insert_resumes" ON public.resumes;
DROP POLICY IF EXISTS "owners_update_resumes" ON public.resumes;
DROP POLICY IF EXISTS "owners_delete_resumes" ON public.resumes;

CREATE POLICY "owners_select_resumes"
ON public.resumes FOR SELECT TO authenticated
USING ((SELECT auth.uid()) = owner_id);

CREATE POLICY "owners_insert_resumes"
ON public.resumes FOR INSERT TO authenticated
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "owners_update_resumes"
ON public.resumes FOR UPDATE TO authenticated
USING ((SELECT auth.uid()) = owner_id)
WITH CHECK ((SELECT auth.uid()) = owner_id);

CREATE POLICY "owners_delete_resumes"
ON public.resumes FOR DELETE TO authenticated
USING ((SELECT auth.uid()) = owner_id);

DROP POLICY IF EXISTS "authenticated_select_resume_files" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_insert_resume_files" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_update_resume_files" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete_resume_files" ON storage.objects;
DROP POLICY IF EXISTS "owners_select_resume_files" ON storage.objects;
DROP POLICY IF EXISTS "owners_insert_resume_files" ON storage.objects;
DROP POLICY IF EXISTS "owners_update_resume_files" ON storage.objects;
DROP POLICY IF EXISTS "owners_delete_resume_files" ON storage.objects;

CREATE POLICY "owners_select_resume_files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'resumes'
  AND owner_id = (SELECT auth.uid()::text)
);

CREATE POLICY "owners_insert_resume_files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "owners_update_resume_files"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'resumes'
  AND owner_id = (SELECT auth.uid()::text)
)
WITH CHECK (bucket_id = 'resumes');

CREATE POLICY "owners_delete_resume_files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'resumes'
  AND owner_id = (SELECT auth.uid()::text)
);
