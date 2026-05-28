-- ============================================================
-- Ministry Schedule Manager — Full Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- REGIONS (configurable)
-- ============================================================
CREATE TABLE IF NOT EXISTS regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default regions
INSERT INTO regions (name, description) VALUES
  ('Barat', 'Wilayah Barat'),
  ('Timur', 'Wilayah Timur'),
  ('Selatan', 'Wilayah Selatan'),
  ('Pusura', 'Wilayah Pusura')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PROFILES (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'volunteer' CHECK (role IN ('pic_ministry', 'pic_ibadah', 'volunteer')),
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  service_id UUID, -- assigned later via FK to services
  pic_ibadah_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SERVICES (Ibadah — dynamic)
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  region_id UUID REFERENCES regions(id) ON DELETE SET NULL,
  pic_ibadah_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun
  time_of_day TIME,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add FK from profiles to services
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS fk_profiles_service;
ALTER TABLE profiles ADD CONSTRAINT fk_profiles_service
  FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE SET NULL;

-- ============================================================
-- SPECIFICATION CATEGORIES (dynamic: Intonasi, Percaya Diri, etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS specification_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SPECIFICATION LEVELS (dynamic levels per category)
-- ============================================================
CREATE TABLE IF NOT EXISTS specification_levels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id UUID NOT NULL REFERENCES specification_categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, order_index)
);

-- Default spec categories and levels
DO $$
DECLARE
  cat_id UUID;
  cats TEXT[] := ARRAY['Intonasi', 'Penguasaan Materi', 'Percaya Diri', 'Ekspresi'];
  cat TEXT;
BEGIN
  FOREACH cat IN ARRAY cats LOOP
    INSERT INTO specification_categories (name, description)
    VALUES (cat, 'Penilaian ' || cat || ' volunteer')
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO cat_id;

    IF cat_id IS NOT NULL THEN
      INSERT INTO specification_levels (category_id, label, description, order_index) VALUES
        (cat_id, 'Sangat Baik', 'Performa sangat memuaskan dan konsisten', 4),
        (cat_id, 'Baik', 'Performa baik dan dapat diandalkan', 3),
        (cat_id, 'Lumayan', 'Performa cukup, masih perlu pengembangan', 2),
        (cat_id, 'Kurang', 'Perlu bimbingan dan latihan lebih lanjut', 1)
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ============================================================
-- VOLUNTEER SPECIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS volunteer_specifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  volunteer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES specification_categories(id) ON DELETE CASCADE,
  level_id UUID NOT NULL REFERENCES specification_levels(id) ON DELETE CASCADE,
  set_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(volunteer_id, category_id)
);

-- ============================================================
-- SERVICE SLOT TEMPLATES (roles needed per service)
-- ============================================================
CREATE TABLE IF NOT EXISTS service_slot_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  slot_name TEXT NOT NULL,
  required_specifications JSONB DEFAULT '[]'::JSONB,
  count_needed INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SCHEDULES
-- ============================================================
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  slot_template_id UUID REFERENCES service_slot_templates(id) ON DELETE SET NULL,
  volunteer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'swapped', 'cancelled')),
  quarter TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SWAP REQUESTS
-- ============================================================
CREATE TABLE IF NOT EXISTS swap_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_volunteer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  schedule_id UUID NOT NULL REFERENCES schedules(id) ON DELETE CASCADE,
  replacement_schedule_id UUID REFERENCES schedules(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('swap', 'replacement')),
  status TEXT DEFAULT 'pending_pic' CHECK (status IN ('pending_pic', 'pending_volunteer', 'approved', 'rejected')),
  pic_ibadah_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason TEXT,
  pic_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'general',
  ref_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS services_updated_at ON services;
CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS swap_requests_updated_at ON swap_requests;
CREATE TRIGGER swap_requests_updated_at
  BEFORE UPDATE ON swap_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-create profile on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'volunteer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE specification_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE specification_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE volunteer_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_slot_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Profiles: everyone can read, only pic_ministry and self can update
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (
  auth.uid() = id OR get_my_role() = 'pic_ministry'
);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  auth.uid() = id OR get_my_role() = 'pic_ministry'
);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE USING (
  get_my_role() = 'pic_ministry'
);

-- Regions: all can read, only pic_ministry can write
CREATE POLICY "regions_select" ON regions FOR SELECT USING (true);
CREATE POLICY "regions_write" ON regions FOR ALL USING (get_my_role() = 'pic_ministry');

-- Services: all can read, pic_ministry can write
CREATE POLICY "services_select" ON services FOR SELECT USING (true);
CREATE POLICY "services_write" ON services FOR ALL USING (
  get_my_role() = 'pic_ministry'
);

-- Spec categories: pic_ministry and pic_ibadah can read, only pic_ministry can write
CREATE POLICY "spec_cat_select" ON specification_categories FOR SELECT USING (
  get_my_role() IN ('pic_ministry', 'pic_ibadah')
);
CREATE POLICY "spec_cat_write" ON specification_categories FOR ALL USING (
  get_my_role() = 'pic_ministry'
);

-- Spec levels: same as categories
CREATE POLICY "spec_level_select" ON specification_levels FOR SELECT USING (
  get_my_role() IN ('pic_ministry', 'pic_ibadah')
);
CREATE POLICY "spec_level_write" ON specification_levels FOR ALL USING (
  get_my_role() = 'pic_ministry'
);

-- Volunteer specs: pic can read/write, volunteer cannot see own
CREATE POLICY "vol_spec_select" ON volunteer_specifications FOR SELECT USING (
  get_my_role() IN ('pic_ministry', 'pic_ibadah')
);
CREATE POLICY "vol_spec_write" ON volunteer_specifications FOR ALL USING (
  get_my_role() IN ('pic_ministry', 'pic_ibadah')
);

-- Slot templates: all can read (needed for display), pic can write
CREATE POLICY "slot_select" ON service_slot_templates FOR SELECT USING (true);
CREATE POLICY "slot_write" ON service_slot_templates FOR ALL USING (
  get_my_role() IN ('pic_ministry', 'pic_ibadah')
);

-- Schedules: all can read own, pic can read all under them
CREATE POLICY "schedules_select" ON schedules FOR SELECT USING (
  get_my_role() IN ('pic_ministry', 'pic_ibadah')
  OR volunteer_id = auth.uid()
);
CREATE POLICY "schedules_write" ON schedules FOR ALL USING (
  get_my_role() IN ('pic_ministry', 'pic_ibadah')
);

-- Swap requests: requester and target can see, pic can see all
CREATE POLICY "swap_select" ON swap_requests FOR SELECT USING (
  requester_id = auth.uid()
  OR target_volunteer_id = auth.uid()
  OR get_my_role() IN ('pic_ministry', 'pic_ibadah')
);
CREATE POLICY "swap_insert" ON swap_requests FOR INSERT WITH CHECK (
  requester_id = auth.uid() OR get_my_role() IN ('pic_ministry', 'pic_ibadah')
);
CREATE POLICY "swap_update" ON swap_requests FOR UPDATE USING (
  get_my_role() IN ('pic_ministry', 'pic_ibadah')
  OR target_volunteer_id = auth.uid()
);

-- Notifications: only owner can see/update
CREATE POLICY "notif_select" ON notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notif_update" ON notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "notif_insert" ON notifications FOR INSERT WITH CHECK (true);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_service_id ON profiles(service_id);
CREATE INDEX IF NOT EXISTS idx_profiles_pic_ibadah_id ON profiles(pic_ibadah_id);
CREATE INDEX IF NOT EXISTS idx_schedules_volunteer ON schedules(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_schedules_service ON schedules(service_id);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_schedules_quarter ON schedules(quarter);
CREATE INDEX IF NOT EXISTS idx_swap_requester ON swap_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_swap_status ON swap_requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
