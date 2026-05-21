ALTER TABLE public.products ADD COLUMN IF NOT EXISTS ancien_code text;
CREATE INDEX IF NOT EXISTS idx_products_ancien_code ON public.products (user_id, ancien_code) WHERE ancien_code IS NOT NULL;