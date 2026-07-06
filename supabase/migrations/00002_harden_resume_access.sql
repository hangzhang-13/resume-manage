-- Harden access for existing deployments where the initial migration may
-- already have created anonymous policies and a public resumes bucket.

DROP POLICY IF EXISTS "anon_select_resumes" ON public.resumes;
DROP POLICY IF EXISTS "anon_insert_resumes" ON public.resumes;
DROP POLICY IF EXISTS "anon_update_resumes" ON public.resumes;
DROP POLICY IF EXISTS "anon_delete_resumes" ON public.resumes;

DROP POLICY IF EXISTS "authenticated_select_resumes" ON public.resumes;
DROP POLICY IF EXISTS "authenticated_insert_resumes" ON public.resumes;
DROP POLICY IF EXISTS "authenticated_update_resumes" ON public.resumes;
DROP POLICY IF EXISTS "authenticated_delete_resumes" ON public.resumes;

CREATE POLICY "authenticated_select_resumes" ON public.resumes FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated_insert_resumes" ON public.resumes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated_update_resumes" ON public.resumes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "authenticated_delete_resumes" ON public.resumes FOR DELETE TO authenticated USING (true);

UPDATE storage.buckets
SET public = false
WHERE id = 'resumes';

DROP POLICY IF EXISTS "anon_upload_resumes" ON storage.objects;
DROP POLICY IF EXISTS "anon_select_resumes_storage" ON storage.objects;
DROP POLICY IF EXISTS "anon_delete_resumes_storage" ON storage.objects;

DROP POLICY IF EXISTS "authenticated_upload_resumes" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_select_resumes_storage" ON storage.objects;

CREATE POLICY "authenticated_upload_resumes" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'resumes');
CREATE POLICY "authenticated_select_resumes_storage" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'resumes');
