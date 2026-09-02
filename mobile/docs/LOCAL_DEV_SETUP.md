# JD Car Rental - Local Development Setup

Follow these steps to run the complete system locally.

## Prerequisites
- Node.js (v18+)
- npm or yarn
- Expo Go app (on mobile device/emulator)

## 1. Backend Setup
```bash
cd server
npm install
# Configure .env with JWT_SECRET and DATABASE_URL
npx prisma generate
npx prisma db push
npm run seed:demo
npm run dev
```

## 2. Web Setup
```bash
cd web
npm install
# Configure .env with:
# VITE_API_BASE_URL="http://localhost:4000/api"
# VITE_GOOGLE_MAPS_API_KEY="your_api_key"
npm run dev
```

### Google Maps Configuration
To enable the Live Map Dashboard:
1. Enable **Google Maps JavaScript API** in the [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **Billing** for your project.
3. Generate an API Key.
4. (Optional) Restrict key to: `http://localhost:5173/*` and `http://127.0.0.1:5173/*`.
5. Add the key to `web/.env` as `VITE_GOOGLE_MAPS_API_KEY`.
6. (Optional) Customize operating area in `web/.env`:
   - `VITE_DEFAULT_MAP_LAT="10.3000"` (Negros Island fallback)
   - `VITE_DEFAULT_MAP_LNG="123.0000"`
   - `VITE_DEFAULT_MAP_ZOOM="9"`
7. Restart the web dev server.

## 3. Mobile Setup
```bash
cd mobile
npm install
# Configure src/services/api.ts with your machine's local IP
npx expo start
```

## Demo Flow
1. Login as **Admin** on the web dashboard to see the fleet and reports.
2. Login as **Customer** on the mobile app to browse vehicles.
3. Request a rental and upload dummy documents.
4. Go back to the **Admin Web** to approve the documents.
5. On the **Mobile App**, upload a payment proof (GCash screenshot).
6. On the **Admin Web**, verify the payment and release the vehicle.
7. The mobile app will start reporting GPS data (ACTIVE rental).
8. Admin can see the vehicle on the **Live Map**.
