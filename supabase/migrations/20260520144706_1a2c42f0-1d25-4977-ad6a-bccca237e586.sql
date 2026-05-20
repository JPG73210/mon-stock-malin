
CREATE TABLE public.user_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  field TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, field, value)
);

CREATE INDEX idx_user_options_user_field ON public.user_options(user_id, field);

ALTER TABLE public.user_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own options" ON public.user_options
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Unique product code per user (allow legacy codes import without collision across users)
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_user_code
  ON public.products(user_id, code) WHERE deleted_at IS NULL;
