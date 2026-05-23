ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS medailles text[] DEFAULT '{}'::text[];
ALTER TABLE public.wines ADD COLUMN IF NOT EXISTS comme_racheter boolean NOT NULL DEFAULT false;