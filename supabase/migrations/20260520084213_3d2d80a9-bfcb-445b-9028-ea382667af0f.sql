
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Lock down SECURITY DEFINER functions (callable only from triggers / server)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_product_code(UUID, DATE, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
-- authenticated may call generate_product_code to mint their own codes
GRANT EXECUTE ON FUNCTION public.generate_product_code(UUID, DATE, TEXT, TEXT, TEXT) TO authenticated;

-- Restrict wine-photos listing to owner's folder (replace broad SELECT)
DROP POLICY IF EXISTS "wine photos public read" ON storage.objects;
CREATE POLICY "wine photos owner read" ON storage.objects FOR SELECT
  USING (bucket_id = 'wine-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
-- Make bucket private so getPublicUrl works only via signed URLs
UPDATE storage.buckets SET public = false WHERE id = 'wine-photos';
