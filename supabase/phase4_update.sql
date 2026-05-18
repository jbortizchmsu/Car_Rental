-- JD Car Rental - Schema Update for Phase 4

-- 1. Update Payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS admin_remarks TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'GCASH'; -- GCASH or CASH

-- Add unique constraint to reference_number to prevent duplicates
-- We only apply this where reference_number is not null
CREATE UNIQUE INDEX IF NOT EXISTS unique_payment_reference ON public.payments (reference_number) WHERE reference_number IS NOT NULL;

-- 2. Storage Setup for Payment Proofs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies for Payment Proofs
CREATE POLICY "Customers can upload their own payment proofs"
ON storage.objects FOR INSERT 
WITH CHECK (
    bucket_id = 'payment-proofs' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Customers can view their own payment proofs"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'payment-proofs' AND 
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can view all payment proofs"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'payment-proofs' AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 3. RLS for Payments table
-- Allow customers to see their own payments
CREATE POLICY "Customers can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
-- Allow customers to insert their own payments
CREATE POLICY "Customers can create own payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
-- Admins can do everything
CREATE POLICY "Admins can manage all payments" ON public.payments ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4. RLS for Payment Proofs table
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers can view own proofs" ON public.payment_proofs FOR SELECT USING (EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id AND user_id = auth.uid()));
CREATE POLICY "Customers can create own proofs" ON public.payment_proofs FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.payments WHERE id = payment_id AND user_id = auth.uid()));
CREATE POLICY "Admins can view all proofs" ON public.payment_proofs FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
