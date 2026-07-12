
DROP POLICY IF EXISTS "fuel_insert_auth" ON public.fuel_logs;
CREATE POLICY "fuel_insert_auth" ON public.fuel_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND created_by = auth.uid());

DROP POLICY IF EXISTS "notif_insert_auth" ON public.notifications;
CREATE POLICY "notif_insert_auth" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_primary_role(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_trip_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_trip_dispatch() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sync_maintenance_vehicle() FROM PUBLIC, anon;
