CREATE POLICY "project members read pdfs" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = auth.uid()
      AND pm.project_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "project members upload pdfs" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = auth.uid()
      AND pm.project_id::text = (storage.foldername(name))[1]
      AND pm.role IN ('admin','author','remediator')
  )
);

CREATE POLICY "project members update pdfs" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = auth.uid()
      AND pm.project_id::text = (storage.foldername(name))[1]
      AND pm.role IN ('admin','author','remediator')
  )
);

CREATE POLICY "project members delete pdfs" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'documents'
  AND EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = auth.uid()
      AND pm.project_id::text = (storage.foldername(name))[1]
      AND pm.role IN ('admin','author','remediator')
  )
);