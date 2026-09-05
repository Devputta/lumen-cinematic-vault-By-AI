CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS is_secret boolean NOT NULL DEFAULT false;

-- PIN hashes live in their own table with NO policies: unreachable from the Data API.
CREATE TABLE public.collection_locks (
  collection_id uuid PRIMARY KEY REFERENCES public.collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin_hash text NOT NULL,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.collection_locks TO service_role;
ALTER TABLE public.collection_locks ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_collection_locks_updated_at
BEFORE UPDATE ON public.collection_locks
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Short lived unlock grants.
CREATE TABLE public.collection_unlocks (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, user_id)
);

GRANT SELECT ON public.collection_unlocks TO authenticated;
GRANT ALL ON public.collection_unlocks TO service_role;
ALTER TABLE public.collection_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own unlock grants"
ON public.collection_unlocks FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.owns_collection(_collection_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.collections c
    WHERE c.id = _collection_id AND c.user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.collection_lock_status(_collection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  l public.collection_locks;
  unlocked boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.owns_collection(_collection_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not found.');
  END IF;

  SELECT * INTO l FROM public.collection_locks WHERE collection_id = _collection_id;
  SELECT EXISTS (
    SELECT 1 FROM public.collection_unlocks u
    WHERE u.collection_id = _collection_id AND u.user_id = auth.uid() AND u.expires_at > now()
  ) INTO unlocked;

  RETURN jsonb_build_object(
    'ok', true,
    'has_pin', l.collection_id IS NOT NULL,
    'is_unlocked', COALESCE(unlocked, false),
    'locked_until', l.locked_until,
    'attempts_remaining', GREATEST(0, 5 - COALESCE(l.failed_attempts, 0))
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_collection_pin(_collection_id uuid, _pin text, _current_pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  l public.collection_locks;
BEGIN
  IF auth.uid() IS NULL OR NOT public.owns_collection(_collection_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not found.');
  END IF;
  IF _pin IS NULL OR _pin !~ '^[0-9]{4,8}$' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'PIN must be 4 to 8 digits.');
  END IF;

  SELECT * INTO l FROM public.collection_locks WHERE collection_id = _collection_id;

  IF l.collection_id IS NOT NULL THEN
    IF _current_pin IS NULL OR crypt(_current_pin, l.pin_hash) <> l.pin_hash THEN
      RETURN jsonb_build_object('ok', false, 'message', 'Incorrect PIN.');
    END IF;
    UPDATE public.collection_locks
       SET pin_hash = crypt(_pin, gen_salt('bf', 10)), failed_attempts = 0, locked_until = NULL
     WHERE collection_id = _collection_id;
  ELSE
    INSERT INTO public.collection_locks (collection_id, user_id, pin_hash)
    VALUES (_collection_id, auth.uid(), crypt(_pin, gen_salt('bf', 10)));
  END IF;

  UPDATE public.collections SET is_locked = true WHERE id = _collection_id;
  DELETE FROM public.collection_unlocks WHERE collection_id = _collection_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_collection_pin(_collection_id uuid, _pin text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  l public.collection_locks;
BEGIN
  IF auth.uid() IS NULL OR NOT public.owns_collection(_collection_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not found.');
  END IF;

  SELECT * INTO l FROM public.collection_locks WHERE collection_id = _collection_id;
  IF l.collection_id IS NULL THEN
    UPDATE public.collections SET is_locked = false WHERE id = _collection_id;
    RETURN jsonb_build_object('ok', true);
  END IF;
  IF l.locked_until IS NOT NULL AND l.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Too many attempts. Try again later.', 'locked_until', l.locked_until);
  END IF;
  IF _pin IS NULL OR crypt(_pin, l.pin_hash) <> l.pin_hash THEN
    UPDATE public.collection_locks SET failed_attempts = failed_attempts + 1 WHERE collection_id = _collection_id;
    RETURN jsonb_build_object('ok', false, 'message', 'Incorrect PIN.');
  END IF;

  DELETE FROM public.collection_locks WHERE collection_id = _collection_id;
  DELETE FROM public.collection_unlocks WHERE collection_id = _collection_id;
  UPDATE public.collections SET is_locked = false WHERE id = _collection_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_collection_pin(_collection_id uuid, _pin text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  l public.collection_locks;
  attempts integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.owns_collection(_collection_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not found.');
  END IF;

  SELECT * INTO l FROM public.collection_locks WHERE collection_id = _collection_id;
  IF l.collection_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'has_pin', false);
  END IF;

  IF l.locked_until IS NOT NULL AND l.locked_until > now() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Too many attempts. Try again later.', 'locked_until', l.locked_until);
  END IF;

  IF _pin IS NULL OR crypt(_pin, l.pin_hash) <> l.pin_hash THEN
    attempts := l.failed_attempts + 1;
    IF attempts >= 5 THEN
      UPDATE public.collection_locks
         SET failed_attempts = 0, locked_until = now() + interval '5 minutes'
       WHERE collection_id = _collection_id;
      RETURN jsonb_build_object('ok', false, 'message', 'Too many attempts. Try again later.', 'locked_until', now() + interval '5 minutes');
    END IF;
    UPDATE public.collection_locks SET failed_attempts = attempts, locked_until = NULL
     WHERE collection_id = _collection_id;
    RETURN jsonb_build_object('ok', false, 'message', 'Incorrect PIN.', 'attempts_remaining', 5 - attempts);
  END IF;

  UPDATE public.collection_locks SET failed_attempts = 0, locked_until = NULL
   WHERE collection_id = _collection_id;

  INSERT INTO public.collection_unlocks (collection_id, user_id, expires_at)
  VALUES (_collection_id, auth.uid(), now() + interval '15 minutes')
  ON CONFLICT (collection_id, user_id) DO UPDATE SET expires_at = now() + interval '15 minutes';

  RETURN jsonb_build_object('ok', true, 'has_pin', true, 'expires_at', now() + interval '15 minutes');
END;
$$;

CREATE OR REPLACE FUNCTION public.relock_collection(_collection_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.owns_collection(_collection_id) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Not found.');
  END IF;
  DELETE FROM public.collection_unlocks WHERE collection_id = _collection_id AND user_id = auth.uid();
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.set_collection_pin(uuid, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.remove_collection_pin(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.verify_collection_pin(uuid, text) FROM anon;
REVOKE ALL ON FUNCTION public.collection_lock_status(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.relock_collection(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.owns_collection(uuid) FROM anon;

GRANT EXECUTE ON FUNCTION public.set_collection_pin(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_collection_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_collection_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collection_lock_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relock_collection(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS collections_secret_idx ON public.collections(user_id, is_secret);