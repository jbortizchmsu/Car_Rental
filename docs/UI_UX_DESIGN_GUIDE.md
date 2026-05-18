# JD Car Rental - UI/UX Design Guide

## Brand Identity
JD Car Rental is a premium, luxury-focused self-drive car rental service. The design should feel minimal, spacious, and sophisticated.

## Brand Palette
- **Primary Background**: `#FDFDFD` (Clean, bright, airy)
- **Soft Beige**: `#D3C6BE` (Subtle backgrounds, secondary panels)
- **Warm Taupe**: `#AD9B8D` (Primary accent: Buttons, active states, highlights)
- **Muted Mauve Gray**: `#958786` (Muted text, borders, disabled states)
- **Black**: `#000000` (Headers, strong contrast, sidebars)

## Typography
- **Primary Font**: Inter or Geist (Clean Sans-Serif)
- **Headings**: Large, bold, and readable.
- **Display**: Elegant display styling for Hero sections and branding.

## Layout Rules
- **Spacing**: Use generous white space to maintain a premium feel.
- **Corners**: Rounded corners for cards, buttons, and inputs (typically 8px to 12px).
- **Shadows**: Soft, subtle shadows for depth (Avoid harsh borders).
- **Transitions**: Smooth micro-animations for hover states and page transitions.

## Public Homepage Rules
- **Accessibility**: Must be accessible without login.
- **Hero**: High-impact imagery of premium vehicles with a clear CTA.
- **Flow**: Clearly explain the 5-step rental process.
- **Navigation**: Clean navbar with Home, Vehicles, How It Works, Login, and Register.

## Dashboard Design (Admin & Customer)
- **Consistency**: Use a sidebar-based layout for dashboards.
- **Clarity**: Use business-specific labels (e.g., "Approve for Payment" instead of "Update Status").
- **Feedback**: Clear success/error notifications using the brand palette.

## Reusable Components
- **VehicleCard**: Image, specs (seats, transmission), rate per day, and availability badge.
- **BookingStatusTimeline**: Visual tracker for the booking lifecycle.
- **PaymentStatusCard**: Details of GCash submission and verification status.
- **DocumentChecklist**: Interactive list for ID and License verification.
- **AdminReviewPanel**: Split view for document viewing and approval actions.
- **StatusBadge**: Color-coded badges for various statuses (using the brand palette).

## State Management
- **Empty States**: Use custom illustrations or icons with helpful text (e.g., "No active rentals yet").
- **Loading States**: Shimmer/Skeleton effects matching the card layouts.
- **Error States**: Non-intrusive alerts with clear recovery actions.
