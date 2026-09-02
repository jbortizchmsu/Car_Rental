-- JD Car Rental - Supabase Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Extends Auth.Users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone_number TEXT,
    address TEXT,
    role TEXT CHECK (role IN ('customer', 'admin')) DEFAULT 'customer',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Vehicles Table
CREATE TABLE public.vehicles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    model TEXT NOT NULL,
    brand TEXT NOT NULL,
    category TEXT NOT NULL, -- e.g., Sedan, SUV, Luxury
    year INTEGER,
    license_plate TEXT UNIQUE NOT NULL,
    transmission TEXT CHECK (transmission IN ('Manual', 'Automatic')),
    fuel_type TEXT,
    seats INTEGER,
    daily_rate DECIMAL(10, 2) NOT NULL,
    status TEXT CHECK (status IN ('AVAILABLE', 'RESERVED', 'RENTED', 'UNDER_MAINTENANCE', 'RETIRED')) DEFAULT 'AVAILABLE',
    image_url TEXT,
    description TEXT,
    features TEXT[], -- Array of features
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bookings Table
CREATE TABLE public.bookings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    customer_id UUID REFERENCES public.profiles(id) NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    status TEXT CHECK (status IN (
        'PENDING_REVIEW', 'APPROVED_FOR_PAYMENT', 'REJECTED', 
        'FULL_PAYMENT_SUBMITTED', 'DOWNPAYMENT_SUBMITTED', 
        'PAYMENT_VERIFIED', 'RESERVED', 'READY_FOR_PICKUP', 
        'ACTIVE', 'RETURNED', 'COMPLETED', 'CANCELLED'
    )) DEFAULT 'PENDING_REVIEW',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Booking Documents (ID, License)
CREATE TABLE public.booking_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    document_type TEXT NOT NULL, -- e.g., 'valid_id', 'drivers_license'
    file_url TEXT NOT NULL,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Payments Table
CREATE TABLE public.payments (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    payment_type TEXT CHECK (payment_type IN ('FULL_GCASH', 'DOWNPAYMENT_GCASH', 'REMAINING_CASH')) NOT NULL,
    status TEXT CHECK (status IN ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'PAID_IN_PERSON')) DEFAULT 'PENDING',
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Payment Proofs
CREATE TABLE public.payment_proofs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    payment_id UUID REFERENCES public.payments(id) ON DELETE CASCADE NOT NULL,
    proof_url TEXT NOT NULL, -- GCash Receipt Image
    reference_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tracking Sessions (Active Rentals)
CREATE TABLE public.tracking_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE UNIQUE NOT NULL,
    start_time TIMESTAMPTZ DEFAULT NOW(),
    end_time TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Vehicle Locations (Real-time)
CREATE TABLE public.vehicle_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Geofence Zones
CREATE TABLE public.geofence_zones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    polygon_coords JSONB, -- Array of coordinates
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Geofence Alerts
CREATE TABLE public.geofence_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    zone_id UUID REFERENCES public.geofence_zones(id) NOT NULL,
    alert_type TEXT, -- 'enter', 'exit'
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Maintenance Logs
CREATE TABLE public.maintenance_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    cost DECIMAL(10, 2),
    maintenance_date DATE NOT NULL,
    next_due_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Damage Reports
CREATE TABLE public.damage_reports (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    image_urls TEXT[],
    estimated_cost DECIMAL(10, 2),
    reported_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Notifications
CREATE TABLE public.notifications (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --- ROW LEVEL SECURITY (RLS) ---

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tracking_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geofence_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can view their own, Admins view all
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Vehicles: Everyone can view, Admins can manage
CREATE POLICY "Anyone can view vehicles" ON public.vehicles FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage vehicles" ON public.vehicles ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Bookings: Customers can view/create own, Admins manage all
CREATE POLICY "Customers can view own bookings" ON public.bookings FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Customers can create bookings" ON public.bookings FOR INSERT WITH CHECK (auth.uid() = customer_id);
CREATE POLICY "Admins can manage all bookings" ON public.bookings ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Tracking: Customers view own active rental, Admins view all
CREATE POLICY "Customers view own location" ON public.vehicle_locations FOR SELECT USING (EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND customer_id = auth.uid()));
CREATE POLICY "Admins view all locations" ON public.vehicle_locations FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
