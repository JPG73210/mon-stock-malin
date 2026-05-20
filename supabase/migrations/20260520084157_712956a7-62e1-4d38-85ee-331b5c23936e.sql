
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Counter for unique product IDs (per user per year per prefix)
CREATE TABLE public.product_counters (
  user_id UUID NOT NULL,
  year_prefix TEXT NOT NULL,
  letters TEXT NOT NULL,
  last_num INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, year_prefix, letters)
);
ALTER TABLE public.product_counters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own counters" ON public.product_counters FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Generate unique code: YY-XX-NNN
CREATE OR REPLACE FUNCTION public.generate_product_code(
  _user_id UUID, _date DATE, _produit TEXT, _animal TEXT, _fruit TEXT
) RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  yy TEXT := to_char(_date, 'YY');
  l1 TEXT := upper(left(coalesce(nullif(_produit,''),'X'),1));
  l2 TEXT := upper(left(coalesce(nullif(_animal,''), nullif(_fruit,''), 'X'),1));
  letters TEXT;
  n INT;
BEGIN
  letters := l1 || l2;
  INSERT INTO public.product_counters(user_id, year_prefix, letters, last_num)
    VALUES (_user_id, yy, letters, 1)
    ON CONFLICT (user_id, year_prefix, letters)
    DO UPDATE SET last_num = public.product_counters.last_num + 1
    RETURNING last_num INTO n;
  RETURN yy || '-' || letters || '-' || lpad(n::text, 3, '0');
END; $$;

-- Products (viande, légumes, etc.)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  emplacement TEXT NOT NULL,
  date_creation DATE NOT NULL DEFAULT current_date,
  version TEXT,
  bague TEXT,
  produit TEXT NOT NULL,
  animal TEXT,
  fruit TEXT,
  quantite INT NOT NULL DEFAULT 1,
  poids NUMERIC,
  unite_poids TEXT,
  etiquette_format TEXT NOT NULL DEFAULT 'Pas d''étiquettes',
  needs_label BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, code)
);
CREATE INDEX ON public.products(user_id, deleted_at);
CREATE INDEX ON public.products(code);
CREATE TRIGGER products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own products" ON public.products FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Wines
CREATE TABLE public.wines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  photo_url TEXT,
  type_vin TEXT,
  chateau TEXT,
  millesime INT,
  couleur TEXT,
  code_barre TEXT,
  emplacement TEXT,
  quantite INT NOT NULL DEFAULT 1,
  favori BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.wines(user_id, deleted_at);
CREATE INDEX ON public.wines(code_barre);
CREATE TRIGGER wines_updated BEFORE UPDATE ON public.wines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public.wines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wines" ON public.wines FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Label templates storage
CREATE TABLE public.label_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  file_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.label_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own templates" ON public.label_templates FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('wine-photos', 'wine-photos', true)
  ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('label-templates', 'label-templates', false)
  ON CONFLICT DO NOTHING;

CREATE POLICY "wine photos public read" ON storage.objects FOR SELECT USING (bucket_id = 'wine-photos');
CREATE POLICY "wine photos user upload" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'wine-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "wine photos user update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'wine-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "wine photos user delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'wine-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "tpl read own" ON storage.objects FOR SELECT
  USING (bucket_id = 'label-templates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tpl insert own" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'label-templates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tpl update own" ON storage.objects FOR UPDATE
  USING (bucket_id = 'label-templates' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "tpl delete own" ON storage.objects FOR DELETE
  USING (bucket_id = 'label-templates' AND auth.uid()::text = (storage.foldername(name))[1]);
