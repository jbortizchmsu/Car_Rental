-- JD Car Rental - Schema Update for Phase 3

-- 1. Update Bookings table with detailed information fields
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS pickup_location TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_full_name TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS contact_number TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS drivers_license_number TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS drivers_license_expiry DATE;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS emergency_contact_number TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS reviewer_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS admin_remarks TEXT;

-- 2. Storage Setup (Note: storage schema is managed by Supabase, but we can add policies)
-- Create bucket if not exists (This usually needs to be done via dashboard or API, but here is the SQL way if permitted)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('booking-documents', 'booking-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Customers can upload their own documents"
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'booking-documents' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Customers can view their own documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'booking-documents' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all documents"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'booking-documents' AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Update Booking Documents table if needed
ALTER TABLE public.booking_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.booking_documents ADD COLUMN IF NOT EXISTS mime_type TEXT;
ALTER TABLE public.booking_documents ADD COLUMN IF NOT EXISTS file_size INTEGER;
