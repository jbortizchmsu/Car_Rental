-- JD Car Rental - Seed Data

-- Insert Sample Vehicles
INSERT INTO public.vehicles (brand, model, year, license_plate, category, status, daily_rate, seats, transmission, fuel_type, image_url)
VALUES 
('Toyota', 'Camry', 2024, 'ABC 1234', 'Sedan', 'AVAILABLE', 3500.00, 5, 'Automatic', 'Hybrid', 'https://images.unsplash.com/photo-1621007947382-bb3c3994e3fb?q=80&w=800'),
('Ford', 'Everest', 2023, 'XYZ 5678', 'SUV', 'AVAILABLE', 4500.00, 7, 'Automatic', 'Diesel', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=800'),
('BMW', '3 Series', 2024, 'LUX 888', 'Luxury', 'RESERVED', 7500.00, 5, 'Automatic', 'Gasoline', 'https://images.unsplash.com/photo-1555215695-3004980ad54e?q=80&w=800'),
('Honda', 'Civic', 2022, 'GHI 9012', 'Sedan', 'RENTED', 2800.00, 5, 'Automatic', 'Gasoline', 'https://images.unsplash.com/photo-1594070319944-7c0c63146b73?q=80&w=800'),
('Mitsubishi', 'Montero', 2021, 'PQR 3456', 'SUV', 'UNDER_MAINTENANCE', 4000.00, 7, 'Automatic', 'Diesel', 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?q=80&w=800')
ON CONFLICT (license_plate) DO NOTHING;

-- Note: Admin user must be created via Supabase Auth Dashboard or SQL.
-- Example of elevating a user to admin (replace UUID):
-- UPDATE public.profiles SET role = 'admin' WHERE id = 'YOUR_USER_ID';
