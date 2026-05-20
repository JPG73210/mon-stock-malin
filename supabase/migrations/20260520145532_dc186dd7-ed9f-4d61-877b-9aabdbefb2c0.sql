CREATE OR REPLACE FUNCTION public.generate_product_code(_user_id uuid, _date date, _produit text, _animal text, _fruit text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_yy TEXT := to_char(_date, 'YY');
  v_l1 TEXT := upper(left(coalesce(nullif(_produit,''),'X'),1));
  v_l2 TEXT := upper(left(coalesce(nullif(_animal,''), nullif(_fruit,''), 'X'),1));
  v_letters TEXT;
  v_n INT;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  v_letters := v_l1 || v_l2;
  INSERT INTO public.product_counters(user_id, year_prefix, letters, last_num)
    VALUES (_user_id, v_yy, v_letters, 1)
    ON CONFLICT (user_id, year_prefix, letters)
    DO UPDATE SET last_num = public.product_counters.last_num + 1
    RETURNING public.product_counters.last_num INTO v_n;
  RETURN v_yy || '-' || v_letters || '-' || lpad(v_n::text, 3, '0');
END; $function$;