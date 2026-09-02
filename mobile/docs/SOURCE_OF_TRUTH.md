# JD Car Rental - Local Development Source of Truth

This document serves as the final source of truth for the JD Car Rental local-dev architecture.

## Tech Stack
- **Web**: React (Vite) + TypeScript + Lucide React
- **Mobile**: React Native (Expo) + TypeScript + Lucide React Native
- **Backend**: Express + TypeScript + Prisma
- **Database**: SQLite (local dev.db)
- **Real-time**: Socket.io
- **Storage**: Local filesystem (`/server/.uploads`)

## Operating Area & Map Defaults
- **Base of Operations**: Negros Island, Philippines.
- **Default Map Center**: Latitude 10.3000, Longitude 123.0000 (Negros Island).
- **Map Centering Priority**: 
  1. Selected vehicle with active GPS.
  2. First active vehicle with GPS signal.
  3. Negros Island default center (fallback).
- **Satellite Mode**: Uses Hybrid view (Imagery + Labels) for better administrative context.
- **Roles**: `customer` and `admin` only.
- **Service Model**: Self-drive only.
- **GPS Tracking**: Mobile app reports GPS coordinates during ACTIVE rentals.
- **Geofencing**: Admin can define zones; system triggers alerts on breach (mocked at 0,0).
- **Notifications**: Real-time via Socket.io and polling fallback on mobile.
- **Security**: JWT-based authentication with role-based access control (RBAC).

## Key Features
1. **Document Verification**: Customers upload ID/License via mobile; Admin verifies on web.
2. **Secure Payments**: GCash integration with proof upload and admin verification.
3. **Cash Payments**: Admins can record in-person cash payments for balances.
4. **Live Map**: Real-time tracking of all active rentals.
5. **Reports**: Comprehensive revenue, booking, and fleet utilization dashboards.

## Admin Modules
The following modules are available in the Admin Panel and will be improved one by one:
1. **Overview**: High-level fleet and revenue summary.
2. **Fleet Management**: Vehicle inventory, rates, and status management.
3. **Bookings**: Review and approval of rental requests.
4. **Maintenance**: Vehicle health tracking and service logs.
5. **Dynamic Pricing**: Demand-based and seasonal pricing rule configuration.
6. **GPS Tracking**: Historical telemetry logs, detailed session history, and movement replays.
7. **Map Dashboard**: Real-time live monitoring dashboard with fleet status, active alerts, and instant tracking.
8. **Payments**: GCash verification and financial records.
9. **Reports & Analytics**: Deep business intelligence and fleet data.
10. **User Roles**: Managed access control (Admin/Customer roles only).
11. **Settings**: Application configuration and company profile.

*Note: Roles remain strictly Customer and Admin. No other roles will be added.*

## Credentials (Demo)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@jdcarrental.com | Admin123! |
| Customer | customer@jdcarrental.com | Customer123! |

## File Structure (Core)
- `/server`: Express API & Prisma logic.
- `/web`: React dashboard and customer interface.
- `/mobile`: Expo mobile application.
- `/server/.uploads`: Local file storage for documents and proofs.
