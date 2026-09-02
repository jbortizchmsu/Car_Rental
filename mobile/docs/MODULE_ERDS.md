# Module ERD Diagrams (System Aligned)

This document contains specialized Entity Relationship Diagrams (ERDs) for each core module of the JD Car Rental system. These diagrams are synchronized with the **actual system schema** in [Prisma Schema](../server/prisma/schema.prisma).

## 1. User & Authentication Module
Manages user roles, telemetry settings, and notifications.

```mermaid
erDiagram
    USER {
        string id PK
        string email UK
        string passwordHash
        string fullName
        string phoneNumber
        string address
        string role "customer | admin"
        string avatarUrl
        boolean isActive
        datetime lastLoginAt
        datetime createdAt
    }
    NOTIFICATION {
        string id PK
        string userId FK
        string type "BOOKING | PAYMENT | GEOFENCE | etc"
        string title
        string message
        boolean isRead
        string targetRole "admin | customer | all"
        string referenceId
        string referenceType
        datetime createdAt
    }
    SYSTEM_SETTINGS {
        string id PK
        string key UK
        string value
        datetime updatedAt
    }

    USER ||--o{ NOTIFICATION : "receives"
```

## 2. Vehicle Fleet Management
Inventory of vehicles including technical specifications and basic maintenance stats.

```mermaid
erDiagram
    VEHICLE {
        string id PK
        string licensePlate UK
        string brand
        string model
        string category "Sedan | SUV | etc"
        int year
        string transmission "Manual | Auto"
        string fuelType
        int seats
        decimal dailyRate
        string status "AVAILABLE | RESERVED | RENTED | MAINTENANCE | RETIRED"
        float currentOdometerKm
        float lastOilChangeOdometerKm
        float oilChangeIntervalKm
        datetime nextServiceDate
    }
```

## 3. Booking Lifecycle & Rental Process
Core rental logic including pickups, returns, and digital documentation.

```mermaid
erDiagram
    BOOKING {
        string id PK
        string customerId FK
        string vehicleId FK
        datetime startDate
        datetime endDate
        string status "PENDING | APPROVED | ACTIVE | COMPLETED | CANCELLED"
        decimal totalAmount
        string rejectionReason
        float releaseOdometerKm
        float returnOdometerKm
        datetime releasedAt
        datetime returnedAt
        string destinationName
        string approvedGeofenceZoneId
    }
    BOOKING_DOCUMENT {
        string id PK
        string bookingId FK
        string documentType "valid_id | drivers_license"
        string fileUrl
        datetime verifiedAt
        string verifiedById FK
    }

    BOOKING ||--o{ BOOKING_DOCUMENT : "requires"
    BOOKING }|--|| VEHICLE : "assigned"
    BOOKING }|--|| USER : "rented_by"
```

## 4. Secure Payments
Payment processing, GCash verification, and transaction history.

```mermaid
erDiagram
    PAYMENT {
        string id PK
        string bookingId FK
        decimal amount
        string paymentType "FULL_GCASH | DOWNPAYMENT_GCASH | REMAINING_CASH"
        string status "PENDING | SUBMITTED | VERIFIED | REJECTED"
        datetime verifiedAt
        string verifiedById FK
    }
    PAYMENT_PROOF {
        string id PK
        string paymentId FK
        string proofUrl
        string referenceNumber
    }

    PAYMENT ||--o{ PAYMENT_PROOF : "has"
    BOOKING ||--o{ PAYMENT : "collects"
```

## 5. Tracking & Telemetry
Active GPS session management and location history.

```mermaid
erDiagram
    TRACKING_SESSION {
        string id PK
        string bookingId FK
        datetime startTime
        datetime endTime
        boolean isActive
    }
    VEHICLE_LOCATION {
        string id PK
        string trackingSessionId FK
        float latitude
        float longitude
        float speed
        float heading
        datetime recordedAt
    }

    TRACKING_SESSION ||--o{ VEHICLE_LOCATION : "records"
    BOOKING ||--|| TRACKING_SESSION : "launches"
```

## 6. Geofencing & Security Alerts
Boundary management and real-time breach notifications.

```mermaid
erDiagram
    GEOFENCE_ZONE {
        string id PK
        string name
        string vehicleId FK
        string bookingId FK
        string polygonCoordinates "JSON"
        boolean isActive
    }
    GEOFENCE_ALERT {
        string id PK
        string bookingId FK
        string vehicleId FK
        string trackingSessionId FK
        string geofenceZoneId FK
        string alertType "OUT_OF_ZONE"
        string severity "WARNING | CRITICAL"
        boolean resolved
        string resolvedById FK
    }

    GEOFENCE_ZONE ||--o{ GEOFENCE_ALERT : "triggers"
    TRACKING_SESSION ||--o{ GEOFENCE_ALERT : "monitors"
```

## 7. Maintenance & Repairs
Vehicle health logs and damage reporting.

```mermaid
erDiagram
    MAINTENANCE_LOG {
        string id PK
        string vehicleId FK
        string serviceType "OIL | TIRES | REPAIR"
        string description
        decimal cost
        datetime serviceDate
        float odometerKm
        string status "COMPLETED | SCHEDULED"
    }
    DAMAGE_REPORT {
        string id PK
        string bookingId FK
        string damageType
        string severity
        string description
        string imageUrls "JSON"
        decimal estimatedCost
        string status
    }

    VEHICLE ||--o{ MAINTENANCE_LOG : "has_history"
    BOOKING ||--o{ DAMAGE_REPORT : "results_in"
```

## 8. Dynamic Pricing
Market-based pricing rules and multipliers.

```mermaid
erDiagram
    PRICING_RULE {
        string id PK
        string name
        string type "SEASONAL | WEEKEND | DEMAND"
        float multiplier
        datetime startDate
        datetime endDate
        string vehicleCategory
        float utilizationThreshold
        boolean isActive
    }

    PRICING_RULE ||--o{ BOOKING : "affects"
```
