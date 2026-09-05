REVOKE ALL ON FUNCTION public.owns_collection(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.set_collection_pin(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_collection_pin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.verify_collection_pin(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.collection_lock_status(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.relock_collection(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_collection_pin(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_collection_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_collection_pin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.collection_lock_status(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relock_collection(uuid) TO authenticated;