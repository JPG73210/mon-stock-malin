CREATE TABLE public.print_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  format text NOT NULL,
  label_data jsonb NOT NULL,
  pdf_base64 text,
  printer_name text,
  status text NOT NULL DEFAULT 'pending',
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  printed_at timestamptz
);

ALTER TABLE public.print_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own print jobs" ON public.print_jobs
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_print_jobs_user_status ON public.print_jobs(user_id, status, created_at DESC);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS template_id uuid;
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS template_id uuid;