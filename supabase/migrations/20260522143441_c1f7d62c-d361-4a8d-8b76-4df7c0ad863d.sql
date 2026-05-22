CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('product','wine')),
  item_id UUID NOT NULL,
  label TEXT,
  code TEXT,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('in','out','inventory','adjust','delete')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own movements" ON public.stock_movements
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_stock_movements_user_created ON public.stock_movements (user_id, created_at DESC);
CREATE INDEX idx_stock_movements_item ON public.stock_movements (item_id);