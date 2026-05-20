
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
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  letters := l1 || l2;
  INSERT INTO public.product_counters(user_id, year_prefix, letters, last_num)
    VALUES (_user_id, yy, letters, 1)
    ON CONFLICT (user_id, year_prefix, letters)
    DO UPDATE SET last_num = public.product_counters.last_num + 1
    RETURNING last_num INTO n;
  RETURN yy || '-' || letters || '-' || lpad(n::text, 3, '0');
END; $$;
GRANT EXECUTE ON FUNCTION public.generate_product_code(UUID, DATE, TEXT, TEXT, TEXT) TO authenticated;
