-- JD Car Rental - Schema Update for Phase 5

-- 1. Add Release/Return/Completion fields to Bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS released_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS release_odometer NUMERIC;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS release_notes TEXT;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS returned_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS returned_by UUID REFERENCES public.profiles(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS return_odometer NUMERIC;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS return_notes TEXT;

ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.profiles(id);

-- 2. Create Tracking Sessions Table
CREATE TABLE IF NOT EXISTS public.tracking_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.profiles(id) NOT NULL,
    status TEXT CHECK (status IN ('ACTIVE', 'ENDED')) DEFAULT 'ACTIVE',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    started_by UUID REFERENCES public.profiles(id),
    ended_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Damage Reports Table
CREATE TABLE IF NOT EXISTS public.damage_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    reported_by UUID REFERENCES public.profiles(id) NOT NULL,
    damage_type TEXT NOT NULL, -- e.g., Scratch, Dent, Mechanical, Glass
    severity TEXT CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')) NOT NULL,
    description TEXT NOT NULL,
    estimated_cost DECIMAL(10, 2),
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS Policies

-- Tracking Sessions RLS
ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view their own tracking sessions"
ON public.tracking_sessions FOR SELECT
USING (auth.uid() = customer_id);

CREATE POLICY "Admins can manage tracking sessions"
ON public.tracking_sessions ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Damage Reports RLS
ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can view damage reports for their bookings"
ON public.damage_reports FOR SELECT
USING (EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND customer_id = auth.uid()));

CREATE POLICY "Admins can manage damage reports"
ON public.damage_reports ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 5. Update Vehicle Status constraint to include RENTED
-- (Checking if already exists in schema.sql, usually it does but let's be safe)
-- ALTER TABLE public.vehicles DROP CONSTRAINT IF EXISTS vehicles_status_check;
-- ALTER TABLE public.vehicles ADD CONSTRAINT vehicles_status_check CHECK (status IN ('AVAILABLE', 'RESERVED', 'RENTED', 'UNDER_MAINTENANCE', 'RETIRED'));
