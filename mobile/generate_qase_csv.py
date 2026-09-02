import csv

suites = [
    (1, 'User Management and Authentication Module'),
    (2, 'Booking and Reservation Module'),
    (3, 'Dynamic Pricing Module'),
    (4, 'Secure Payment Module'),
    (5, 'Real-Time Tracking and Monitoring Module'),
    (6, 'Geomapping and Security Module'),
    (7, 'Asset and Maintenance Management Module'),
    (8, 'Analytics and Reporting Dashboard Module'),
    (9, 'System Settings and Notifications Module')
]

test_cases = [
    # SUITE 1: User Management and Authentication Module
    {
        'id': 1, 'title': 'UC-01: Customer Registration - Successful Account Creation',
        'suite_id': 1, 'suite': 'User Management and Authentication Module',
        'description': 'Verify that a new Customer can register and create a personal account in the car rental management system with valid credentials and document upload.',
        'preconditions': 'The customer is on the registration page (/register) and has valid identity documents ready.',
        'postconditions': 'A new customer account is saved in the database, role assigned as customer, and account is ready for login.',
        'tags': 'auth,registration,customer', 'priority': 'high', 'severity': 'critical', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open the Car Rental application registration page.\n2. Enter full name, email address, phone number, and password.\n3. Upload valid Driver\'s License / ID image (<5MB).\n4. Click the Create Account button.',
        'steps_result': '1. Registration form is displayed with all input fields.\n2. Input fields accept valid formatted data.\n3. Image preview is displayed successfully.\n4. Registration succeeds, toast notification displays success, and user is redirected to Login page.',
        'steps_data': '1. URL: /register\n2. Name: John Doe, Email: john@example.com, Phone: 09171234567, Pass: Customer123!\n3. File: driver_license.png\n4. Button: Submit'
    },
    {
        'id': 2, 'title': 'UC-01-NEG: Customer Registration - Duplicate Email / Invalid Input',
        'suite_id': 1, 'suite': 'User Management and Authentication Module',
        'description': 'Verify that registration fails gracefully when duplicate email or invalid phone/password format is provided.',
        'preconditions': 'The customer is on the registration page and email customer@example.com already exists in the system.',
        'postconditions': 'No duplicate user is created in DB and clear error message is shown to user.',
        'tags': 'auth,registration,negative', 'priority': 'medium', 'severity': 'major', 'type': 'functional', 'behavior': 'negative', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Navigate to registration page.\n2. Enter existing email customer@example.com.\n3. Fill in password and click Create Account.',
        'steps_result': '1. Registration page is active.\n2. Form accepts input.\n3. System rejects request with error message: Email already registered.',
        'steps_data': '1. URL: /register\n2. Existing Email: customer@example.com\n3. Action: Submit'
    },
    {
        'id': 3, 'title': 'UC-02: User Login - Customer and Admin Authentication',
        'suite_id': 1, 'suite': 'User Management and Authentication Module',
        'description': 'Verify that registered Customers and Owners/Admins can securely log in using valid credentials and receive appropriate role-based JWT session tokens.',
        'preconditions': 'User account exists in system (Admin or Customer).',
        'postconditions': 'Valid JWT token stored, role-based dashboard displayed (Customer home or Admin overview).',
        'tags': 'auth,login,rbac', 'priority': 'high', 'severity': 'blocker', 'type': 'smoke', 'behavior': 'positive', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Access the Login page (/login).\n2. Input registered email and password.\n3. Click the Log In button.',
        'steps_result': '1. Login interface loads.\n2. Credentials validated against password hash.\n3. User authenticated, session token generated, redirected to role landing page.',
        'steps_data': '1. URL: /login\n2. Admin: admin@jdcarrental.com / Admin123! | Customer: customer@jdcarrental.com / Customer123!\n3. Action: Submit Login'
    },
    {
        'id': 4, 'title': 'UC-02-NEG: User Login - Incorrect Credentials Failure',
        'suite_id': 1, 'suite': 'User Management and Authentication Module',
        'description': 'Verify system behavior when user enters invalid email or incorrect password.',
        'preconditions': 'Login page is loaded.',
        'postconditions': 'Session is not created, user stays on login page with error toast message.',
        'tags': 'auth,login,negative', 'priority': 'medium', 'severity': 'normal', 'type': 'security', 'behavior': 'negative', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Login page.\n2. Enter unregistered email or wrong password.\n3. Click Log In.',
        'steps_result': '1. Login page displayed.\n2. Authentication fails.\n3. Error toast: Invalid credentials.',
        'steps_data': '1. URL: /login\n2. Email: user@wrong.com, Pass: wrongpass\n3. Action: Click Login'
    },
    {
        'id': 5, 'title': 'UC-03: User Log Out - Terminate Session',
        'suite_id': 1, 'suite': 'User Management and Authentication Module',
        'description': 'Verify that a logged-in Customer or Owner can log out, clearing local storage session tokens and returning to public home page.',
        'preconditions': 'User is actively logged into the system.',
        'postconditions': 'Session token cleared, protected routes locked, user redirected to homepage.',
        'tags': 'auth,logout,session', 'priority': 'medium', 'severity': 'normal', 'type': 'functional', 'behavior': 'positive', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Click on User Profile / Avatar menu.\n2. Select Log Out option.\n3. Attempt to navigate back to protected route via URL bar.',
        'steps_result': '1. Profile dropdown displays Logout button.\n2. Session terminated, local storage cleared, redirected to home page.\n3. Protected page access redirected back to Login.',
        'steps_data': '1. Menu: Profile Dropdown\n2. Action: Click Logout\n3. Test URL: /admin/vehicles'
    },
    {
        'id': 6, 'title': 'UC-04: Manage User Accounts & Roles',
        'suite_id': 1, 'suite': 'User Management and Authentication Module',
        'description': 'Verify that Customer can update personal profile info and Owner can manage user accounts and roles.',
        'preconditions': 'User is logged in (Customer on Profile page or Admin on User Roles page).',
        'postconditions': 'Updated account info or role assignments saved in User DB.',
        'tags': 'auth,profile,admin', 'priority': 'medium', 'severity': 'normal', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Navigate to Customer Profile / Admin User Roles page.\n2. Modify profile details (phone, name) or update role.\n3. Click Save Changes.',
        'steps_result': '1. Page displays editable user details.\n2. Form validates input changes.\n3. Data updated successfully in database.',
        'steps_data': '1. Route: /profile or /admin/users\n2. New Phone: 09189876543\n3. Action: Click Save'
    },

    # SUITE 2: Booking and Reservation Module
    {
        'id': 7, 'title': 'UC-05: Browse & Filter Available Vehicles',
        'suite_id': 2, 'suite': 'Booking and Reservation Module',
        'description': 'Verify that Customer can explore fleet listing, filter by vehicle category (Sedan, SUV, Luxury, Van), transmission, and search by brand/model.',
        'preconditions': 'Customer is on Vehicles catalog page.',
        'postconditions': 'Filtered list of active available vehicles displayed.',
        'tags': 'booking,vehicles,catalog', 'priority': 'high', 'severity': 'major', 'type': 'functional', 'behavior': 'positive', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'gui', 'steps_type': 'classic',
        'steps_actions': '1. Open Vehicles catalog page (/vehicles).\n2. Select Category filter (e.g. SUV).\n3. Type search keyword (e.g. Toyota).\n4. Click on a vehicle card.',
        'steps_result': '1. Vehicle list loads with images and daily rates.\n2. Category filter updates displayed vehicles.\n3. Search filters results dynamically.\n4. Opens detailed vehicle preview modal/page.',
        'steps_data': '1. URL: /vehicles\n2. Category: SUV\n3. Query: Toyota\n4. Action: Click Vehicle Card'
    },
    {
        'id': 8, 'title': 'UC-06: Submit Rental Booking Request',
        'suite_id': 2, 'suite': 'Booking and Reservation Module',
        'description': 'Verify that Customer can select pickup/return dates, time, destination, self-drive option, and submit a new booking request.',
        'preconditions': 'Customer is logged in and selects an Available vehicle.',
        'postconditions': 'Booking record created in DB with status PENDING, estimated total price calculated.',
        'tags': 'booking,reservation,customer', 'priority': 'high', 'severity': 'critical', 'type': 'smoke', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Click Book Now on selected vehicle.\n2. Select Pickup Date/Time and Return Date/Time.\n3. Enter pickup location / destination details.\n4. Click Submit Booking Request.',
        'steps_result': '1. Booking modal/form opens.\n2. System computes duration and total rental price.\n3. Form validates required fields.\n4. Booking saved as PENDING, confirmation toast shown, listed under My Bookings.',
        'steps_data': '1. Vehicle: Toyota Camry\n2. Pickup: Tomorrow 09:00 AM, Return: +3 Days 09:00 AM\n3. Destination: Dumaguete City\n4. Action: Submit Booking'
    },
    {
        'id': 9, 'title': 'UC-06-NEG: Book Vehicle with Overlapping Dates',
        'suite_id': 2, 'suite': 'Booking and Reservation Module',
        'description': 'Verify system prevents booking a vehicle for dates where it is already reserved or rented.',
        'preconditions': 'Vehicle is already booked for date range Oct 10 - Oct 15.',
        'postconditions': 'System rejects request, preventing double booking.',
        'tags': 'booking,validation,negative', 'priority': 'high', 'severity': 'critical', 'type': 'functional', 'behavior': 'negative', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'api', 'steps_type': 'classic',
        'steps_actions': '1. Select vehicle already reserved from Oct 10 to Oct 15.\n2. Choose pickup date Oct 12 and return Oct 14.\n3. Attempt to submit booking.',
        'steps_result': '1. Form displayed.\n2. System checks calendar availability.\n3. Validation error: Vehicle is unavailable for selected dates.',
        'steps_data': '1. Pickup: Oct 12, Return: Oct 14\n2. Action: Submit'
    },
    {
        'id': 10, 'title': 'UC-07: Approve Rental Booking Request',
        'suite_id': 2, 'suite': 'Booking and Reservation Module',
        'description': 'Verify that Owner/Admin can review pending booking requests and approve them.',
        'preconditions': 'Admin logged in, pending booking exists in Booking Requests dashboard.',
        'postconditions': 'Booking status updated to APPROVED, customer notified to proceed with payment.',
        'tags': 'booking,approval,admin', 'priority': 'high', 'severity': 'critical', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Admin Booking Requests page (/admin/bookings).\n2. Review pending booking details and customer ID document.\n3. Click Approve button.',
        'steps_result': '1. Pending booking list displayed.\n2. Document preview loads correctly.\n3. Status updates to APPROVED, real-time notification sent to customer.',
        'steps_data': '1. Route: /admin/bookings\n2. Booking ID: #1001\n3. Action: Click Approve'
    },
    {
        'id': 11, 'title': 'UC-08: Reject Rental Booking Request with Reason',
        'suite_id': 2, 'suite': 'Booking and Reservation Module',
        'description': 'Verify that Owner/Admin can reject a booking request and specify a reason for rejection.',
        'preconditions': 'Pending booking request exists.',
        'postconditions': 'Booking status updated to REJECTED, rejection reason recorded, customer notified.',
        'tags': 'booking,rejection,admin', 'priority': 'medium', 'severity': 'major', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Navigate to Admin Booking Requests page.\n2. Click Reject button on pending booking.\n3. Enter rejection reason in popup modal and confirm.',
        'steps_result': '1. Booking list loaded.\n2. Rejection modal opens prompting for reason.\n3. Booking status changed to REJECTED with reason stored, notification sent.',
        'steps_data': '1. Booking ID: #1002\n2. Reason: Invalid identification document\n3. Action: Confirm Rejection'
    },
    {
        'id': 12, 'title': 'UC-09: Cancel Pending Booking Request',
        'suite_id': 2, 'suite': 'Booking and Reservation Module',
        'description': 'Verify that Customer can cancel their own PENDING booking request before admin approval/payment.',
        'preconditions': 'Customer logged in with a PENDING booking under My Bookings.',
        'postconditions': 'Booking status updated to CANCELLED, vehicle availability released.',
        'tags': 'booking,cancel,customer', 'priority': 'medium', 'severity': 'normal', 'type': 'functional', 'behavior': 'positive', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open My Bookings page (/my-bookings).\n2. Locate PENDING booking.\n3. Click Cancel Booking button and confirm.',
        'steps_result': '1. Active bookings listed.\n2. Confirmation modal appears.\n3. Booking status updated to CANCELLED, toast notification displayed.',
        'steps_data': '1. Route: /my-bookings\n2. Booking ID: #1003\n3. Action: Confirm Cancel'
    },
    {
        'id': 13, 'title': 'UC-10: Release Vehicle to Customer',
        'suite_id': 2, 'suite': 'Booking and Reservation Module',
        'description': 'Verify that Owner can release the vehicle to customer upon pickup after verifying payment, recording initial odometer reading.',
        'preconditions': 'Booking status is PAYMENT_VERIFIED / CONFIRMED.',
        'postconditions': 'Booking status updated to RENTED / ACTIVE, vehicle status updated to RENTED, tracking session started.',
        'tags': 'booking,release,rented', 'priority': 'high', 'severity': 'critical', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Admin Active Rentals page.\n2. Click Release Vehicle button for approved booking.\n3. Input initial odometer reading (km) and handover notes.\n4. Confirm release.',
        'steps_result': '1. Active rental queue displayed.\n2. Release modal opens with odometer input.\n3. Booking transitions to RENTED, vehicle marked as RENTED in fleet.',
        'steps_data': '1. Booking ID: #1004\n2. Initial Odometer: 15420 km\n3. Action: Confirm Release'
    },
    {
        'id': 14, 'title': 'UC-11: Close Rental & Process Vehicle Return',
        'suite_id': 2, 'suite': 'Booking and Reservation Module',
        'description': 'Verify that Owner can finalize rental closure when vehicle is returned, recording ending odometer, fuel level, damage reports, and extra fees.',
        'preconditions': 'Rental status is RENTED / ACTIVE.',
        'postconditions': 'Booking status updated to COMPLETED / CLOSED, vehicle status restored to AVAILABLE, odometer updated.',
        'tags': 'booking,return,close', 'priority': 'high', 'severity': 'critical', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Navigate to Active Rentals / Close Rental page.\n2. Click Return Vehicle button.\n3. Input return odometer reading, inspect vehicle for damages.\n4. Calculate final charges and click Close Rental.',
        'steps_result': '1. Rental closure interface displayed.\n2. Odometer difference computed automatically.\n3. Rental marked COMPLETED, vehicle status restored to AVAILABLE.',
        'steps_data': '1. Rental ID: #1004\n2. Return Odometer: 15750 km (330 km driven)\n3. Action: Finalize Closure'
    },

    # SUITE 3: Dynamic Pricing Module
    {
        'id': 15, 'title': 'UC-12: Compute Dynamic Rental Price',
        'suite_id': 3, 'suite': 'Dynamic Pricing Module',
        'description': 'Verify that system automatically calculates total rental price based on base rate, duration discounts, peak season surcharges, and demand multipliers.',
        'preconditions': 'Pricing rules exist in system database.',
        'postconditions': 'Calculated rental rate accurately reflects base rate plus active rule modifiers.',
        'tags': 'pricing,dynamic,calculation', 'priority': 'high', 'severity': 'major', 'type': 'functional', 'behavior': 'positive', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'api', 'steps_type': 'classic',
        'steps_actions': '1. Select a vehicle with base rate ₱2,500/day.\n2. Select booking duration of 7 days (triggers >5 day duration discount rule).\n3. Check breakdown in price summary.',
        'steps_result': '1. Vehicle selected.\n2. Duration computed as 7 days.\n3. Base total ₱17,500 modified by 10% duration discount = ₱15,750 final total.',
        'steps_data': '1. Base Rate: ₱2500\n2. Duration: 7 Days\n3. Expected Discount: 10%'
    },
    {
        'id': 16, 'title': 'UC-13: Create Dynamic Pricing Rule',
        'suite_id': 3, 'suite': 'Dynamic Pricing Module',
        'description': 'Verify that Owner/Admin can create a new pricing rule (e.g. Weekend Surcharge, Holiday Rate, Long-term Discount).',
        'preconditions': 'Admin logged in on Dynamic Pricing page (/admin/pricing).',
        'postconditions': 'New pricing rule saved in Pricing Rules DB table.',
        'tags': 'pricing,rules,admin', 'priority': 'medium', 'severity': 'normal', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Admin Dynamic Pricing page.\n2. Click Add Pricing Rule button.\n3. Enter Rule Name, Type (Multiplier/Discount), Adjustment Percentage/Amount, Start/End dates.\n4. Click Save Rule.',
        'steps_result': '1. Pricing rules management dashboard displayed.\n2. Add rule modal opens.\n3. Rule validated and saved successfully, listed in active rules table.',
        'steps_data': '1. Rule: Peak Season Surcharge\n2. Type: Surcharge +15%\n3. Dates: Dec 20 - Jan 05\n4. Action: Save Rule'
    },
    {
        'id': 17, 'title': 'UC-14: Manage & Toggle Dynamic Pricing Rules',
        'suite_id': 3, 'suite': 'Dynamic Pricing Module',
        'description': 'Verify that Owner can enable, disable, edit, or delete existing pricing rules.',
        'preconditions': 'Pricing rules exist in system.',
        'postconditions': 'Rule status updated (active/inactive) or rule deleted, affecting subsequent price computations.',
        'tags': 'pricing,management,toggle', 'priority': 'medium', 'severity': 'normal', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Locate existing pricing rule on Dynamic Pricing page.\n2. Toggle switch to disable rule.\n3. Edit rule multiplier value and click update.',
        'steps_result': '1. Rules list loaded.\n2. Rule status changes to Inactive.\n3. Updated multiplier saved in DB.',
        'steps_data': '1. Rule ID: PR-01\n2. Toggle: Inactive\n3. Action: Save'
    },

    # SUITE 4: Secure Payment Module
    {
        'id': 18, 'title': 'UC-15: Process GCash Online Payment Proof Submission',
        'suite_id': 4, 'suite': 'Secure Payment Module',
        'description': 'Verify that Customer can upload GCash payment receipt screenshot and enter reference number for approved booking.',
        'preconditions': 'Booking is in APPROVED state awaiting payment.',
        'postconditions': 'Payment record and proof document saved in DB with status PAYMENT_SUBMITTED.',
        'tags': 'payment,gcash,proof', 'priority': 'high', 'severity': 'critical', 'type': 'smoke', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Navigate to Payment Submission page (/payment/:bookingId).\n2. View GCash QR Code and total amount due.\n3. Enter GCash Reference Number (13 digits).\n4. Upload receipt screenshot image.\n5. Click Submit Payment Proof.',
        'steps_result': '1. Payment page displays booking summary & GCash details.\n2. Form validates 13-digit reference number format.\n3. File upload preview displays image.\n4. Submission succeeds, status changes to PAYMENT_SUBMITTED.',
        'steps_data': '1. Booking ID: #1001\n2. GCash Ref: 1002938475612\n3. Proof File: gcash_receipt.jpg\n4. Action: Submit Proof'
    },
    {
        'id': 19, 'title': 'UC-15-VERIFY: Admin Payment Verification & Approval',
        'suite_id': 4, 'suite': 'Secure Payment Module',
        'description': 'Verify that Owner/Admin can inspect submitted GCash receipt proof and reference number, then verify payment.',
        'preconditions': 'Booking has submitted payment proof pending admin review.',
        'postconditions': 'Payment status updated to VERIFIED, booking status changed to CONFIRMED.',
        'tags': 'payment,verification,admin', 'priority': 'high', 'severity': 'critical', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Admin Payment Verification page (/admin/payments).\n2. Click View Proof modal for submitted payment.\n3. Verify GCash reference number against transaction log.\n4. Click Approve Payment button.',
        'steps_result': '1. Payment verification table lists pending proofs.\n2. Proof modal displays high-resolution image modal.\n3. Payment marked as VERIFIED, booking confirmed, receipt notification sent.',
        'steps_data': '1. Payment ID: PAY-501\n2. Action: Approve Payment'
    },
    {
        'id': 20, 'title': 'UC-15-CASH: Record In-Person Cash Payment',
        'suite_id': 4, 'suite': 'Secure Payment Module',
        'description': 'Verify that Owner/Admin can manually record an in-person cash payment or remaining balance collection at vehicle pickup.',
        'preconditions': 'Active booking or pickup in progress.',
        'postconditions': 'Cash transaction recorded in Payment DB, balance updated.',
        'tags': 'payment,cash,admin', 'priority': 'medium', 'severity': 'major', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Admin Payments page.\n2. Click Record Cash Payment button.\n3. Select booking, enter amount received, and notes.\n4. Submit cash payment entry.',
        'steps_result': '1. Payment modal opens.\n2. Amount validated against remaining balance.\n3. Cash payment saved, receipt generated.',
        'steps_data': '1. Booking ID: #1004\n2. Cash Amount: ₱5,000\n3. Action: Record Cash'
    },

    # SUITE 5: Real-Time Tracking and Monitoring Module
    {
        'id': 21, 'title': 'UC-16: Automated Vehicle GPS Telemetry Tracking',
        'suite_id': 5, 'suite': 'Real-Time Tracking and Monitoring Module',
        'description': 'Verify that system receives automated GPS location updates from active rental vehicles and logs latitude, longitude, speed, timestamp, and heading.',
        'preconditions': 'Vehicle rental is ACTIVE / RENTED and mobile GPS tracking is active.',
        'postconditions': 'GPS coordinate points saved in Vehicle_Locations table with valid timestamp.',
        'tags': 'gps,tracking,telemetry', 'priority': 'high', 'severity': 'critical', 'type': 'functional', 'behavior': 'positive', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'api', 'steps_type': 'classic',
        'steps_actions': '1. Mobile app / GPS device sends HTTP/Socket payload with coords (Lat: 10.3156, Lng: 123.8854).\n2. Backend validates payload parameters.\n3. System stores record in database location log.',
        'steps_result': '1. API endpoint /api/gps/telemetry receives request.\n2. Coordinates validated within Negros Island operating area.\n3. Entry written to DB, broadcasted to Admin Live Map via Socket.io.',
        'steps_data': '1. Payload: { vehicleId: "v-101", lat: 10.3156, lng: 123.8854, speed: 45 }\n2. Expected Response: 200 OK { success: true }'
    },
    {
        'id': 22, 'title': 'UC-17: Detect & Handle Geofence Boundary Violation',
        'suite_id': 5, 'suite': 'Real-Time Tracking and Monitoring Module',
        'description': 'Verify that system automatically detects when a vehicle moves outside its assigned geofence boundary, logs a violation, computes penalty fee, and sends real-time alerts.',
        'preconditions': 'Active geofence zone defined for rented vehicle. Vehicle transmits GPS coordinates outside defined polygon.',
        'postconditions': 'Violation alert record created, real-time alert sent to Admin & Customer, violation fee attached to booking.',
        'tags': 'gps,geofence,violation,alert', 'priority': 'high', 'severity': 'critical', 'type': 'functional', 'behavior': 'positive', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Transmit GPS coordinate packet outside allowed geofence boundary.\n2. System position check algorithm evaluates coordinates against boundary polygon.\n3. Violation engine triggers alert generation.',
        'steps_result': '1. Telemetry ingested.\n2. Position check returns OUT_OF_BOUNDS.\n3. Geofence_Alert record logged, high-priority notification toast & sound alert triggered on Admin Map dashboard.',
        'steps_data': '1. Vehicle: Toyota Vios\n2. Geofence Zone: Dumaguete City Limits\n3. Test Coords: Lat 10.5000, Lng 123.5000 (Outside)'
    },
    {
        'id': 23, 'title': 'UC-18: View Live Vehicle Map & Telemetry Dashboard',
        'suite_id': 5, 'suite': 'Real-Time Tracking and Monitoring Module',
        'description': 'Verify that Owner/Admin can view real-time locations of all active fleet vehicles on an interactive Leaflet/Mapbox hybrid map.',
        'preconditions': 'Admin logged in on Live Map page (/admin/map or /admin/gps).',
        'postconditions': 'Interactive map renders vehicle marker icons, active alerts sidebar, telemetry replay line.',
        'tags': 'gps,map,live-monitoring', 'priority': 'high', 'severity': 'major', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'gui', 'steps_type': 'classic',
        'steps_actions': '1. Navigate to Admin Live Map page (/admin/map).\n2. View map centered on active fleet in Negros Island.\n3. Click on a vehicle marker pin to inspect live telemetry (speed, fuel, driver, location).\n4. Select historical telemetry replay date filter.',
        'steps_result': '1. Map interface loads with hybrid satellite/labels mode.\n2. Live pins update position without full page refresh.\n3. Popup info card displays live vehicle stats.\n4. Route polyline rendered for route replay.',
        'steps_data': '1. URL: /admin/map\n2. Filter: Active Rentals Only\n3. Action: Click Marker Pin'
    },

    # SUITE 6: Geomapping and Security Module
    {
        'id': 24, 'title': 'UC-19: Configure & Set Geofence Allowed Zone',
        'suite_id': 6, 'suite': 'Geomapping and Security Module',
        'description': 'Verify that Owner/Admin can draw or set a geofence polygon boundary for a specific vehicle or fleet zone.',
        'preconditions': 'Admin logged in on Geofence Management page (/admin/geofence).',
        'postconditions': 'Geofence boundary coordinates stored in Geofences table and assigned to target vehicle.',
        'tags': 'geomapping,geofence,setup', 'priority': 'high', 'severity': 'major', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Geofence Management page (/admin/geofence).\n2. Select target vehicle from fleet dropdown.\n3. Draw boundary polygon or enter radius center on map interface.\n4. Click Save Geofence Zone.',
        'steps_result': '1. Geofence editor interface opens with map controls.\n2. Polygon vertices captured dynamically.\n3. Boundary validated, saved, polygon rendered on map as active zone.',
        'steps_data': '1. Zone Name: Negros Oriental Safe Zone\n2. Vertices: [(10.30, 123.00), (10.35, 123.10), ...]\n3. Action: Click Save Zone'
    },
    {
        'id': 25, 'title': 'UC-20: Remove or Deactivate Geofence Zone',
        'suite_id': 6, 'suite': 'Geomapping and Security Module',
        'description': 'Verify that Owner/Admin can deactivate and remove an existing geofence zone assigned to a vehicle.',
        'preconditions': 'Active geofence zone exists.',
        'postconditions': 'Geofence status set to inactive/deleted, boundary shape removed from map view.',
        'tags': 'geomapping,geofence,remove', 'priority': 'medium', 'severity': 'normal', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Geofence Management page.\n2. Select existing geofence zone from active list.\n3. Click Deactivate / Delete Zone button and confirm.',
        'steps_result': '1. Active geofences list loaded.\n2. Confirmation dialog displayed.\n3. Zone deactivated, map boundary overlay cleared, success toast shown.',
        'steps_data': '1. Zone ID: GEO-102\n2. Action: Confirm Delete'
    },

    # SUITE 7: Asset and Maintenance Management Module
    {
        'id': 26, 'title': 'UC-21: Add New Vehicle to the Fleet',
        'suite_id': 7, 'suite': 'Asset and Maintenance Management Module',
        'description': 'Verify that Owner/Admin can register a new vehicle with brand, model, year, license plate, category, daily rate, seats, and photo.',
        'preconditions': 'Admin logged in on Fleet Management page (/admin/fleet or /admin/vehicles).',
        'postconditions': 'New vehicle record added to DB with status AVAILABLE.',
        'tags': 'asset,fleet,vehicle-add', 'priority': 'high', 'severity': 'critical', 'type': 'smoke', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Fleet Management page.\n2. Click Add New Vehicle button.\n3. Fill in Brand (Toyota), Model (Fortuner), Year (2024), License Plate (ABC 1234), Daily Rate (₱3,500), Capacity (7).\n4. Upload vehicle image file.\n5. Click Save Vehicle.',
        'steps_result': '1. Fleet table displays current vehicles.\n2. Modal form validates plate format and required fields.\n3. Image saved to storage.\n4. Vehicle record saved, status set to AVAILABLE, displayed in fleet catalog.',
        'steps_data': '1. Brand: Toyota, Model: Fortuner, Plate: ABC 1234\n2. Daily Rate: 3500, Seats: 7\n3. Action: Submit Form'
    },
    {
        'id': 27, 'title': 'UC-22: Send Vehicle to Maintenance Shop',
        'suite_id': 7, 'suite': 'Asset and Maintenance Management Module',
        'description': 'Verify that Owner can send a vehicle to shop, changing status to UNDER_MAINTENANCE and hiding it from public rental search.',
        'preconditions': 'Vehicle is registered and currently in AVAILABLE status.',
        'postconditions': 'Vehicle status changed to UNDER_MAINTENANCE, excluded from customer search results.',
        'tags': 'asset,maintenance,status', 'priority': 'high', 'severity': 'major', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Admin Maintenance page (/admin/maintenance).\n2. Select vehicle with service due indicator.\n3. Click Send to Shop button and confirm.',
        'steps_result': '1. Maintenance dashboard lists fleet service indicators.\n2. Confirmation modal appears.\n3. Vehicle status updated to UNDER_MAINTENANCE, removed from available rentals catalog.',
        'steps_data': '1. Vehicle: Nissan Navara (Odometer > Service Due Interval)\n2. Action: Send to Shop'
    },
    {
        'id': 28, 'title': 'UC-23: Log Maintenance Entry & Service History',
        'suite_id': 7, 'suite': 'Asset and Maintenance Management Module',
        'description': 'Verify that Owner can log detailed maintenance work (Oil Change, Tire Replacement, Engine Repair, Service Cost, Service Odometer).',
        'preconditions': 'Vehicle is marked UNDER_MAINTENANCE.',
        'postconditions': 'Maintenance record created in Maintenance_Logs table, last oil change odometer updated.',
        'tags': 'asset,maintenance,log', 'priority': 'medium', 'severity': 'normal', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Maintenance page.\n2. Click Log Maintenance Entry button for vehicle in shop.\n3. Select Service Type (Oil Change), enter Cost (₱4,500), Service Odometer (25,000 km), and Work Description.\n4. Click Save Log.',
        'steps_result': '1. Maintenance entry modal displays.\n2. Form validates numeric inputs for cost and odometer.\n3. Maintenance record saved, vehicle service history updated.',
        'steps_data': '1. Service: Synthetic Oil Change & Filter\n2. Cost: 4500, ODO: 25000\n3. Action: Save Entry'
    },
    {
        'id': 29, 'title': 'UC-24: Mark Vehicle as Available After Maintenance',
        'suite_id': 7, 'suite': 'Asset and Maintenance Management Module',
        'description': 'Verify that Owner can restore vehicle status from UNDER_MAINTENANCE back to AVAILABLE after service completion.',
        'preconditions': 'Vehicle is currently in UNDER_MAINTENANCE status with logged service entry.',
        'postconditions': 'Vehicle status updated to AVAILABLE, restored to public rental listing.',
        'tags': 'asset,maintenance,restore', 'priority': 'high', 'severity': 'major', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Maintenance page.\n2. Click Mark as Available button on completed service entry.\n3. Confirm action in modal.',
        'steps_result': '1. Vehicle maintenance card displays Mark Available button.\n2. Modal confirmation verified.\n3. Vehicle status set back to AVAILABLE, relisted in public booking catalog.',
        'steps_data': '1. Vehicle ID: V-103\n2. Action: Confirm Restore'
    },

    # SUITE 8: Analytics and Reporting Dashboard Module
    {
        'id': 30, 'title': 'UC-25: View Executive Analytics Dashboard',
        'suite_id': 8, 'suite': 'Analytics and Reporting Dashboard Module',
        'description': 'Verify that Owner can view high-level business intelligence dashboard with total revenue, active rentals, fleet utilization rate, and pending tasks.',
        'preconditions': 'Admin logged in on Reports & Analytics page (/admin/reports or /admin/dashboard).',
        'postconditions': 'Dashboard renders summary KPI cards, revenue charts, and operational summary.',
        'tags': 'analytics,dashboard,kpi', 'priority': 'high', 'severity': 'major', 'type': 'functional', 'behavior': 'positive', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'gui', 'steps_type': 'classic',
        'steps_actions': '1. Open Admin Dashboard / Analytics page (/admin/reports).\n2. View summary KPI cards (Total Fleet, Active Rentals, Total Revenue, Maintenance Alerts).\n3. Change date range filter (This Month, Last 30 Days, Year to Date).',
        'steps_result': '1. Page loads aggregated metrics from DB tables.\n2. Charts (Revenue trend line, Vehicle Utilization bar chart) render properly.\n3. Date range filter updates metrics dynamically.',
        'steps_data': '1. URL: /admin/reports\n2. Date Filter: Last 30 Days\n3. Action: Select Filter'
    },
    {
        'id': 31, 'title': 'UC-26: View Detailed Operational & Financial Reports',
        'suite_id': 8, 'suite': 'Analytics and Reporting Dashboard Module',
        'description': 'Verify that Owner can view structured reports for Bookings, Revenue Breakdown, Geofence Violations, and Maintenance Expenses.',
        'preconditions': 'Admin logged in on Reports page.',
        'postconditions': 'Structured data table of selected report type rendered with pagination and search.',
        'tags': 'analytics,reports,data-table', 'priority': 'medium', 'severity': 'normal', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'gui', 'steps_type': 'classic',
        'steps_actions': '1. Open Reports page.\n2. Select Report Type tab (e.g. Revenue Ledger or Violation Logs).\n3. Search or filter by date / vehicle.',
        'steps_result': '1. Tab switches report table view.\n2. Data populated accurately from backend aggregated endpoint.\n3. Search filters table rows instantly.',
        'steps_data': '1. Tab: Revenue Ledger\n2. Search: GCash\n3. Action: Filter'
    },
    {
        'id': 32, 'title': 'UC-27: Export Reports to CSV / PDF File',
        'suite_id': 8, 'suite': 'Analytics and Reporting Dashboard Module',
        'description': 'Verify that Owner can export generated report data as downloadable CSV or PDF file.',
        'preconditions': 'Report data is displayed on page.',
        'postconditions': 'Report file generated and downloaded to user\'s device.',
        'tags': 'analytics,export,csv,pdf', 'priority': 'medium', 'severity': 'normal', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Select desired date range and report dataset.\n2. Click Export Report button.\n3. Select export format (CSV or PDF).\n4. Confirm download.',
        'steps_result': '1. Export menu opens.\n2. File generation process triggered.\n3. Browser initiates file download (e.g. revenue_report_2026.csv).',
        'steps_data': '1. Format: CSV\n2. Date Range: 2026-08-01 to 2026-08-31\n3. Action: Click Download'
    },

    # SUITE 9: System Settings and Notifications Module
    {
        'id': 33, 'title': 'UC-28: Configure System Settings & Operating Parameters',
        'suite_id': 9, 'suite': 'System Settings and Notifications Module',
        'description': 'Verify that Admin can configure core system parameters, business profile, GCash payment account numbers, default map center, and geofence defaults.',
        'preconditions': 'Admin logged in on Admin Settings page (/admin/settings).',
        'postconditions': 'System settings stored in SYSTEM_SETTINGS table and applied globally.',
        'tags': 'settings,admin,config', 'priority': 'medium', 'severity': 'major', 'type': 'functional', 'behavior': 'positive', 'automation': 'to-be-automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Open Admin Settings page (/admin/settings).\n2. Update GCash Merchant Number, Operating Hours, and Base Map Coordinates (Negros Island: 10.3000, 123.0000).\n3. Click Save System Settings.',
        'steps_result': '1. Settings form loaded with current config values.\n2. Form validates input formats.\n3. Settings saved in DB, success toast displayed.',
        'steps_data': '1. GCash No: 09171234567\n2. Map Center: 10.3000, 123.0000\n3. Action: Save Settings'
    },
    {
        'id': 34, 'title': 'UC-29: Real-Time In-App & Push Notifications',
        'suite_id': 9, 'suite': 'System Settings and Notifications Module',
        'description': 'Verify that Customer and Admin receive real-time Socket.io and stored in-app notifications for booking status changes, payment updates, and geofence alerts.',
        'preconditions': 'User is active in app with notification drawer.',
        'postconditions': 'Notification badge count updates, notification item added to user notification drawer.',
        'tags': 'notifications,realtime,socket', 'priority': 'medium', 'severity': 'normal', 'type': 'functional', 'behavior': 'positive', 'automation': 'automated', 'status': 'actual', 'is_flaky': 'no', 'layer': 'e2e', 'steps_type': 'classic',
        'steps_actions': '1. Trigger system event (e.g. Booking Approved or Geofence Violation).\n2. Observe recipient top navigation bar.\n3. Click Bell icon to open notification drawer.',
        'steps_result': '1. Event triggers Socket.io notification payload.\n2. Unread notification badge count increments in real time.\n3. Drawer displays alert title, timestamp, and action link.',
        'steps_data': '1. Event: Booking #1001 Approved\n2. Recipient: customer@jdcarrental.com\n3. Action: Open Drawer'
    }
]

headers = [
    'id','title','description','preconditions','postconditions','tags','priority','severity',
    'type','behavior','automation','status','is_flaky','layer','steps_type','steps_actions',
    'steps_result','steps_data','milestone_id','milestone','suite_id','suite_parent_id','suite',
    'suite_without_cases','parameters','is_muted'
]

output_filename = 'c:/laragon/www/Car_Rental/LMS_CFM_Qase_Test_Cases.csv'

with open(output_filename, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(headers)
    
    # Write Suite rows first
    for s_id, s_name in suites:
        row = [''] * len(headers)
        row[20] = s_id # suite_id
        row[22] = s_name # suite
        row[23] = '1' # suite_without_cases
        writer.writerow(row)
        
    # Write Test Case rows
    for tc in test_cases:
        row = [
            tc['id'],
            tc['title'],
            tc['description'],
            tc['preconditions'],
            tc['postconditions'],
            tc['tags'],
            tc['priority'],
            tc['severity'],
            tc['type'],
            tc['behavior'],
            tc['automation'],
            tc['status'],
            tc['is_flaky'],
            tc['layer'],
            tc['steps_type'],
            tc['steps_actions'],
            tc['steps_result'],
            tc['steps_data'],
            '', # milestone_id
            'Release 1.0', # milestone
            tc['suite_id'],
            '', # suite_parent_id
            tc['suite'],
            '', # suite_without_cases
            '', # parameters
            'no' # is_muted
        ]
        writer.writerow(row)

print(f'Successfully generated {len(test_cases)} test cases across {len(suites)} suites into {output_filename}')
