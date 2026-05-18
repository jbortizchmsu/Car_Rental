-- JD Car Rental - Schema Update for Phase 6 (GPS & Geofencing)

-- 1. Refine Vehicle Locations Table
-- Ensure it has tracking_session_id and customer_id for RLS
CREATE TABLE IF NOT EXISTS public.vehicle_locations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tracking_session_id UUID REFERENCES public.tracking_sessions(id) ON DELETE CASCADE NOT NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    customer_id UUID REFERENCES public.profiles(id) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    battery_level INTEGER,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Geofence Zones Table
CREATE TABLE IF NOT EXISTS public.geofence_zones (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE SET NULL,
    polygon_coordinates JSONB NOT NULL, -- Array of {lat, lng}
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Geofence Alerts Table
CREATE TABLE IF NOT EXISTS public.geofence_alerts (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    booking_id UUID REFERENCES public.bookings(id) ON DELETE CASCADE NOT NULL,
    vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE CASCADE NOT NULL,
    tracking_session_id UUID REFERENCES public.tracking_sessions(id) ON DELETE CASCADE NOT NULL,
    geofence_zone_id UUID REFERENCES public.geofence_zones(id) ON DELETE SET NULL,
    alert_type TEXT CHECK (alert_type IN ('OUT_OF_ZONE', 'SPEED_LIMIT', 'BATTERY_LOW')) DEFAULT 'OUT_OF_ZONE',
    severity TEXT CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')) DEFAULT 'WARNING',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    message TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id)
);

-- 4. Enable Realtime for locations and alerts
ALTER publication supabase_realtime ADD TABLE public.vehicle_locations;
ALTER publication supabase_realtime ADD TABLE public.geofence_alerts;

-- 5. RLS Policies

-- Vehicle Locations
ALTER TABLE public.vehicle_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can insert their own locations"
ON public.vehicle_locations FOR INSERT
WITH CHECK (
    auth.uid() = customer_id AND 
    EXISTS (
        SELECT 1 FROM public.tracking_sessions 
        WHERE id = tracking_session_id AND customer_id = auth.uid() AND status = 'ACTIVE'
    )
);

CREATE POLICY "Customers can view their own locations"
ON public.vehicle_locations FOR SELECT
USING (auth.uid() = customer_id);

CREATE POLICY "Admins can view all locations"
ON public.vehicle_locations FOR SELECT
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Geofence Zones
ALTER TABLE public.geofence_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage geofence zones"
ON public.geofence_zones ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Customers can view zones assigned to their bookings"
ON public.geofence_zones FOR SELECT
USING (
    EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND customer_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.bookings WHERE vehicle_id = public.geofence_zones.vehicle_id AND customer_id = auth.uid() AND status = 'ACTIVE')
);

-- Geofence Alerts
ALTER TABLE public.geofence_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage alerts"
ON public.geofence_alerts ALL
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Customers can view their own alerts"
ON public.geofence_alerts FOR SELECT
USING (EXISTS (SELECT 1 FROM public.bookings WHERE id = booking_id AND customer_id = auth.uid()));

-- 6. Geofence Breach Detection Logic (Point-in-Polygon)

-- Function to check if a point is inside a polygon
-- Polygon is JSONB array of {lat, lng}
CREATE OR REPLACE FUNCTION public.is_point_in_polygon(lat DOUBLE PRECISION, lng DOUBLE PRECISION, polygon JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    i INTEGER;
    j INTEGER;
    poly_len INTEGER;
    intersect_count INTEGER := 0;
    p1_lat DOUBLE PRECISION;
    p1_lng DOUBLE PRECISION;
    p2_lat DOUBLE PRECISION;
    p2_lng DOUBLE PRECISION;
BEGIN
    poly_len := jsonb_array_length(polygon);
    j := poly_len - 1;

    FOR i IN 0..poly_len - 1 LOOP
        p1_lat := (polygon->i->>'lat')::DOUBLE PRECISION;
        p1_lng := (polygon->i->>'lng')::DOUBLE PRECISION;
        p2_lat := (polygon->j->>'lat')::DOUBLE PRECISION;
        p2_lng := (polygon->j->>'lng')::DOUBLE PRECISION;

        IF ((p1_lng > lng) != (p2_lng > lng)) AND
           (lat < (p2_lat - p1_lat) * (lng - p1_lng) / (p2_lng - p1_lng) + p1_lat) THEN
            intersect_count := intersect_count + 1;
        END IF;
        j := i;
    END LOOP;

    RETURN (intersect_count % 2) = 1;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger Function to check geofence on location update
CREATE OR REPLACE FUNCTION public.check_geofence_breach()
RETURNS TRIGGER AS $$
DECLARE
    zone_record RECORD;
    is_inside BOOLEAN;
    existing_alert_id UUID;
BEGIN
    -- Find active geofence zones for this vehicle or booking
    FOR zone_record IN 
        SELECT * FROM public.geofence_zones 
        WHERE is_active = TRUE 
        AND (vehicle_id = NEW.vehicle_id OR booking_id = NEW.booking_id)
    LOOP
        is_inside := public.is_point_in_polygon(NEW.latitude, NEW.longitude, zone_record.polygon_coordinates);

        IF NOT is_inside THEN
            -- Check if an unresolved OUT_OF_ZONE alert already exists for this booking/zone
            SELECT id INTO existing_alert_id 
            FROM public.geofence_alerts 
            WHERE booking_id = NEW.booking_id 
            AND geofence_zone_id = zone_record.id
            AND alert_type = 'OUT_OF_ZONE'
            AND resolved = FALSE
            LIMIT 1;

            IF existing_alert_id IS NULL THEN
                INSERT INTO public.geofence_alerts (
                    booking_id, 
                    vehicle_id, 
                    tracking_session_id, 
                    geofence_zone_id, 
                    alert_type, 
                    severity, 
                    latitude, 
                    longitude, 
                    message
                ) VALUES (
                    NEW.booking_id, 
                    NEW.vehicle_id, 
                    NEW.tracking_session_id, 
                    zone_record.id, 
                    'OUT_OF_ZONE', 
                    'CRITICAL', 
                    NEW.latitude, 
                    NEW.longitude, 
                    'Vehicle moved outside the allowed zone: ' || zone_record.name
                );
            END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS tr_check_geofence_on_location ON public.vehicle_locations;
CREATE TRIGGER tr_check_geofence_on_location
AFTER INSERT ON public.vehicle_locations
FOR EACH ROW EXECUTE PROCEDURE public.check_geofence_breach();
