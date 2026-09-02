ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS media_items_collection_id_idx ON public.media_items (collection_id);
CREATE INDEX IF NOT EXISTS collections_user_id_idx ON public.collections (user_id);