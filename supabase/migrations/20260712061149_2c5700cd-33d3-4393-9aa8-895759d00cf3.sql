
-- =========================
-- Enums
-- =========================
CREATE TYPE public.app_role AS ENUM ('fleet_manager','driver','safety_officer','financial_analyst');
CREATE TYPE public.vehicle_status AS ENUM ('available','in_transit','in_shop','retired');
CREATE TYPE public.vehicle_type AS ENUM ('truck','van','trailer','tanker','reefer','pickup');
CREATE TYPE public.driver_status AS ENUM ('available','on_trip','off_duty','suspended');
CREATE TYPE public.trip_status AS ENUM ('draft','dispatched','completed','cancelled');
CREATE TYPE public.maintenance_status AS ENUM ('scheduled','in_progress','completed','cancelled');
CREATE TYPE public.maintenance_priority AS ENUM ('low','medium','high','critical');
CREATE TYPE public.expense_category AS ENUM ('fuel','maintenance','toll','insurance','parking','repair','salary','other');

-- =========================
-- Profiles
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================
-- User roles
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.get_primary_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id
  ORDER BY CASE role
    WHEN 'fleet_manager' THEN 1
    WHEN 'safety_officer' THEN 2
    WHEN 'financial_analyst' THEN 3
    WHEN 'driver' THEN 4
  END LIMIT 1
$$;

-- =========================
-- Auto profile + default role on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  requested_role public.app_role;
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  );

  BEGIN
    requested_role := (NEW.raw_user_meta_data->>'role')::public.app_role;
  EXCEPTION WHEN others THEN
    requested_role := 'fleet_manager';
  END;
  IF requested_role IS NULL THEN requested_role := 'fleet_manager'; END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, requested_role)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- Shared updated_at trigger
-- =========================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =========================
-- Vehicles
-- =========================
CREATE TABLE public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_number TEXT NOT NULL UNIQUE,
  model TEXT NOT NULL,
  type public.vehicle_type NOT NULL DEFAULT 'truck',
  max_load_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  odometer_km NUMERIC(12,2) NOT NULL DEFAULT 0,
  acquisition_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
  insurance_provider TEXT,
  insurance_expiry DATE,
  status public.vehicle_status NOT NULL DEFAULT 'available',
  notes TEXT,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;
GRANT ALL ON public.vehicles TO service_role;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vehicles_select_all" ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "vehicles_manage_fleet_mgr" ON public.vehicles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'fleet_manager'))
  WITH CHECK (public.has_role(auth.uid(),'fleet_manager'));
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.vehicles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- Drivers
-- =========================
CREATE TABLE public.drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  license_number TEXT NOT NULL UNIQUE,
  license_class TEXT,
  license_expiry DATE NOT NULL,
  years_experience INTEGER NOT NULL DEFAULT 0,
  safety_score NUMERIC(4,1) NOT NULL DEFAULT 90.0,
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  status public.driver_status NOT NULL DEFAULT 'available',
  user_id UUID REFERENCES auth.users,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drivers_select_all" ON public.drivers FOR SELECT TO authenticated USING (true);
CREATE POLICY "drivers_manage_fleet_or_safety" ON public.drivers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'fleet_manager') OR public.has_role(auth.uid(),'safety_officer'))
  WITH CHECK (public.has_role(auth.uid(),'fleet_manager') OR public.has_role(auth.uid(),'safety_officer'));
CREATE TRIGGER trg_drivers_updated BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- Trips
-- =========================
CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_code TEXT NOT NULL UNIQUE DEFAULT ('TRP-' || upper(substr(gen_random_uuid()::text,1,8))),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  vehicle_id UUID REFERENCES public.vehicles ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers ON DELETE SET NULL,
  cargo_weight_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
  planned_distance_km NUMERIC(10,2) NOT NULL DEFAULT 0,
  estimated_fuel_l NUMERIC(10,2) NOT NULL DEFAULT 0,
  delivery_notes TEXT,
  status public.trip_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trips_select_all" ON public.trips FOR SELECT TO authenticated USING (true);
CREATE POLICY "trips_manage_fleet_mgr" ON public.trips FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'fleet_manager'))
  WITH CHECK (public.has_role(auth.uid(),'fleet_manager'));
CREATE POLICY "trips_driver_update_own" ON public.trips FOR UPDATE TO authenticated
  USING (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()))
  WITH CHECK (driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid()));
CREATE TRIGGER trg_trips_updated BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trip lifecycle: sync vehicle & driver status
CREATE OR REPLACE FUNCTION public.sync_trip_status()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'dispatched' THEN
      UPDATE public.vehicles SET status='in_transit' WHERE id = NEW.vehicle_id AND status='available';
      UPDATE public.drivers SET status='on_trip' WHERE id = NEW.driver_id AND status='available';
      NEW.dispatched_at := COALESCE(NEW.dispatched_at, now());
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'dispatched' THEN
        UPDATE public.vehicles SET status='in_transit' WHERE id = NEW.vehicle_id AND status='available';
        UPDATE public.drivers SET status='on_trip' WHERE id = NEW.driver_id AND status='available';
        NEW.dispatched_at := COALESCE(NEW.dispatched_at, now());
      ELSIF NEW.status IN ('completed','cancelled') THEN
        UPDATE public.vehicles SET status='available' WHERE id = NEW.vehicle_id AND status='in_transit';
        UPDATE public.drivers SET status='available' WHERE id = NEW.driver_id AND status='on_trip';
        IF NEW.status='completed' THEN NEW.completed_at := COALESCE(NEW.completed_at, now()); END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_trips_sync BEFORE INSERT OR UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.sync_trip_status();

-- Guard: enforce dispatch business rules
CREATE OR REPLACE FUNCTION public.validate_trip_dispatch()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v RECORD; d RECORD;
BEGIN
  IF NEW.status = 'dispatched' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    IF NEW.vehicle_id IS NULL OR NEW.driver_id IS NULL THEN
      RAISE EXCEPTION 'Vehicle and driver are required to dispatch a trip';
    END IF;
    SELECT * INTO v FROM public.vehicles WHERE id = NEW.vehicle_id;
    IF v.status = 'retired' THEN RAISE EXCEPTION 'Vehicle % is retired', v.registration_number; END IF;
    IF v.status = 'in_shop' THEN RAISE EXCEPTION 'Vehicle % is in maintenance', v.registration_number; END IF;
    IF v.status = 'in_transit' THEN RAISE EXCEPTION 'Vehicle % is already on a trip', v.registration_number; END IF;
    IF NEW.cargo_weight_kg > v.max_load_kg THEN
      RAISE EXCEPTION 'Cargo weight %kg exceeds vehicle capacity %kg', NEW.cargo_weight_kg, v.max_load_kg;
    END IF;

    SELECT * INTO d FROM public.drivers WHERE id = NEW.driver_id;
    IF d.status = 'suspended' THEN RAISE EXCEPTION 'Driver % is suspended', d.full_name; END IF;
    IF d.status = 'on_trip' THEN RAISE EXCEPTION 'Driver % is already on a trip', d.full_name; END IF;
    IF d.license_expiry < CURRENT_DATE THEN RAISE EXCEPTION 'Driver % has an expired license', d.full_name; END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_trips_validate BEFORE INSERT OR UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.validate_trip_dispatch();

-- =========================
-- Maintenance records
-- =========================
CREATE TABLE public.maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles ON DELETE CASCADE,
  issue_description TEXT NOT NULL,
  mechanic_name TEXT,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  priority public.maintenance_priority NOT NULL DEFAULT 'medium',
  status public.maintenance_status NOT NULL DEFAULT 'scheduled',
  expected_completion DATE,
  actual_completion DATE,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.maintenance_records TO authenticated;
GRANT ALL ON public.maintenance_records TO service_role;
ALTER TABLE public.maintenance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "maint_select_all" ON public.maintenance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "maint_manage_fleet_mgr" ON public.maintenance_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'fleet_manager'))
  WITH CHECK (public.has_role(auth.uid(),'fleet_manager'));
CREATE TRIGGER trg_maint_updated BEFORE UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.sync_maintenance_vehicle()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'in_progress' THEN
      UPDATE public.vehicles SET status='in_shop' WHERE id = NEW.vehicle_id AND status <> 'retired';
    ELSIF NEW.status = 'completed' THEN
      UPDATE public.vehicles SET status='available' WHERE id = NEW.vehicle_id AND status='in_shop';
      NEW.actual_completion := COALESCE(NEW.actual_completion, CURRENT_DATE);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_maint_sync BEFORE INSERT OR UPDATE ON public.maintenance_records
  FOR EACH ROW EXECUTE FUNCTION public.sync_maintenance_vehicle();

-- =========================
-- Fuel logs
-- =========================
CREATE TABLE public.fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES public.vehicles ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers ON DELETE SET NULL,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  liters NUMERIC(10,2) NOT NULL,
  cost NUMERIC(12,2) NOT NULL,
  odometer_km NUMERIC(12,2),
  station TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fuel_logs TO authenticated;
GRANT ALL ON public.fuel_logs TO service_role;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fuel_select_all" ON public.fuel_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "fuel_insert_auth" ON public.fuel_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "fuel_manage_fleet_or_analyst" ON public.fuel_logs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'fleet_manager') OR public.has_role(auth.uid(),'financial_analyst') OR created_by = auth.uid());
CREATE POLICY "fuel_delete_fleet_mgr" ON public.fuel_logs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'fleet_manager'));

-- =========================
-- Expenses
-- =========================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category public.expense_category NOT NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  vehicle_id UUID REFERENCES public.vehicles ON DELETE SET NULL,
  trip_id UUID REFERENCES public.trips ON DELETE SET NULL,
  description TEXT,
  incurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_select_all" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "expenses_manage_finance_or_fleet" ON public.expenses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'financial_analyst') OR public.has_role(auth.uid(),'fleet_manager'))
  WITH CHECK (public.has_role(auth.uid(),'financial_analyst') OR public.has_role(auth.uid(),'fleet_manager'));

-- =========================
-- Notifications
-- =========================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_select_own_or_broadcast" ON public.notifications FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_insert_auth" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
