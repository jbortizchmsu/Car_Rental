import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin, AuthRequest } from '../middleware/auth';
import { createNotification, createAdminNotification } from '../lib/notifications';
import { checkVehicleOilChangeDue } from '../lib/maintenance-alerts';
import { checkVehicleAvailability } from '../lib/booking-availability';
import { calculateBookingPrice } from '../lib/pricing';
import { computeGeofence, generateCirclePolygon } from '../lib/negros-coords';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

import { upload } from '../middleware/upload';

// Customer: Request Booking
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { 
    vehicleId, startDate, endDate, pickupLocation,
    destinationName, destinationAddress, destinationNotes,
    fullName, contactNumber, address,
    licenseNumber, licenseExpiry,
    emergencyContact, emergencyPhone 
  } = req.body;
  
  try {
    // Basic validation
    if (!vehicleId || !startDate || !endDate || !pickupLocation || !fullName || !contactNumber || !address || !licenseNumber || !licenseExpiry || !emergencyContact || !emergencyPhone) {
      return res.status(400).json({ error: 'All booking fields are required.' });
    }

    if (!destinationName) {
      return res.status(400).json({ error: 'Please provide your intended travel area or destination.' });
    }

    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return res.status(404).json({ error: 'Vehicle not found' });
    if (vehicle.status !== 'AVAILABLE') return res.status(400).json({ error: 'Vehicle is not available' });

    // Calculate total amount
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Double Booking Protection
    const availability = await checkVehicleAvailability(vehicleId, start, end);
    if (!availability.available) {
      return res.status(409).json({ error: availability.message });
    }

    // Calculate total amount using pricing service
    const pricing = await calculateBookingPrice(vehicleId, start, end);
    const totalAmount = pricing.totalPrice;

    const booking = await prisma.booking.create({
      data: {
        customerId: req.user!.id,
        vehicleId,
        startDate: start,
        endDate: end,
        baseDailyRate: pricing.baseDailyRate,
        pricingMultiplier: pricing.multiplier,
        pricingRuleName: pricing.appliedRuleName,
        pricingRuleId: pricing.pricingRuleId,
        totalAmount,
        pickupLocation,
        destinationName,
        destinationAddress,
        destinationNotes,
        status: 'PENDING_REVIEW',
        fullName,
        contactNumber,
        address,
        licenseNumber,
        licenseExpiry,
        emergencyContact,
        emergencyPhone
      },
      include: { vehicle: true }
    });

    // Notify Admin
    await createAdminNotification(
      'New Rental Request',
      `${req.user!.fullName} requested to rent ${vehicle.brand} ${vehicle.model} for travel to ${destinationName}`
    );

    res.status(201).json(booking);
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ error: 'Booking request failed' });
  }
});

// Customer: Upload Documents
router.post('/:id/documents', authenticate, upload.single('file'), async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { type } = req.body; // 'valid_id' or 'drivers_license'

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const booking = await prisma.booking.findUnique({ where: { id } });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    
    // Ownership check
    if (booking.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized to upload for this booking' });
    }

    // Status check - allow upload if pending or rejected (to fix issues)
    if (booking.status !== 'PENDING_REVIEW' && booking.status !== 'REJECTED') {
      return res.status(400).json({ error: 'Cannot upload documents for booking in current status' });
    }

    console.log(`📂 Uploading ${type} for Booking ${id}. File: ${req.file.filename}`);

    const doc = await prisma.bookingDocument.create({
      data: {
        bookingId: id,
        documentType: type,
        fileUrl: req.file.path.replace(/\\/g, '/') // Standardize path
      }
    });

    console.log(`✅ Document saved: ${doc.id}`);
    res.json(doc);
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({ error: 'Failed to save document info' });
  }
});

// Get Booking Documents (Shared)
router.get('/:id/documents', authenticate, async (req: AuthRequest, res) => {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: { documents: true }
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    
    // Permission: Admin OR Owner
    if (req.user!.role !== 'admin' && booking.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(booking.documents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Customer: Get My Bookings (Alias for /)
router.get('/my', authenticate, async (req: AuthRequest, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { customerId: req.user!.id },
      include: { 
        vehicle: true,
        payments: true,
        documents: true,
        damageReports: true,
        pricingRule: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Customer: Get My Bookings (Base route)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { customerId: req.user!.id },
      include: { 
        vehicle: true,
        payments: true,
        documents: true,
        damageReports: true,
        pricingRule: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Admin: Get Pending Bookings
router.get('/pending', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { status: 'PENDING_REVIEW' },
      include: { 
        vehicle: true, 
        customer: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
        documents: true,
        pricingRule: true
      },
      orderBy: { createdAt: 'asc' }
    });
    res.json(bookings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending bookings' });
  }
});

// Admin: Get Active/Ready/Returned Bookings
router.get('/active-list', authenticate, authorizeAdmin, async (req, res) => {
  const { status } = req.query;
  try {
    const statusArray = Array.isArray(status) ? status : (status ? [status as string] : []);
    
    const where: any = {};
    if (statusArray.length > 0) {
      where.status = { in: statusArray };
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: { 
        vehicle: true, 
        customer: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
        payments: {
          include: { proofs: true }
        },
        documents: true,
        pricingRule: true
      },
      orderBy: { startDate: 'asc' }
    });
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings list:', error);
    res.status(500).json({ error: 'Failed to fetch bookings list' });
  }
});

// Customer/Admin: Get Single Booking Details
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { 
        vehicle: true,
        documents: true,
        payments: {
          include: { proofs: true }
        },
        damageReports: true,
        pricingRule: true,
        customer: {
          select: { id: true, fullName: true, email: true, phoneNumber: true, address: true }
        }
      }
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Ownership/Permission Check
    if (req.user!.role !== 'admin' && booking.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized to view this booking' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

// Admin: Approve for Payment
router.post('/:id/approve', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const bookingId = req.params.id;
    
    const existingBooking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!existingBooking) return res.status(404).json({ error: 'Booking not found' });

    // Re-check availability before approval (exclude current booking)
    const availability = await checkVehicleAvailability(
      existingBooking.vehicleId, 
      existingBooking.startDate, 
      existingBooking.endDate, 
      bookingId
    );

    if (!availability.available) {
      return res.status(409).json({ error: `Conflict detected: ${availability.message}` });
    }

    // Check for documents before approval
    const docs = await prisma.bookingDocument.findMany({
      where: { bookingId }
    });

    if (docs.length === 0) {
      return res.status(400).json({ error: 'Cannot approve booking without documents.' });
    }

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'APPROVED_FOR_PAYMENT' }
    });

    // Notify Customer
    await createNotification(
      booking.customerId,
      'Booking Approved',
      'Your booking has been approved. Please proceed with payment.'
    );

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Approval failed' });
  }
});

// Admin: Reject Booking
router.post('/:id/reject', authenticate, authorizeAdmin, async (req, res) => {
  const { reason } = req.body;
  try {
    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data: { 
        status: 'REJECTED',
        rejectionReason: reason
      }
    });

    // Notify Customer
    await createNotification(
      booking.customerId,
      'Booking Rejected',
      `Your booking was rejected. Reason: ${reason || 'Documents incomplete or invalid.'}`
    );

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Rejection failed' });
  }
});

// Admin: Sign Rental Agreement
router.post('/:id/sign-agreement', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { signerName } = req.body;
  try {
    const booking = await prisma.booking.update({
      where: { id },
      data: {
        agreementSignedAt: new Date(),
        agreementSignedBy: signerName || 'Customer'
      }
    });
    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Failed to record agreement signature' });
  }
});

// Admin: Release Vehicle
router.post('/:id/release', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { odometer, notes, checklistConfirmed } = req.body;
  try {
    const existingBooking = await prisma.booking.findUnique({ 
      where: { id },
      include: { vehicle: true }
    });
    if (!existingBooking) return res.status(404).json({ error: 'Booking not found' });

    // ENFORCEMENT
    if (existingBooking.status !== 'READY_FOR_PICKUP') {
      return res.status(400).json({ error: 'Booking must be READY_FOR_PICKUP before release.' });
    }

    // Date guard: cannot release before the scheduled pickup date
    if (!existingBooking.startDate) {
      return res.status(400).json({ error: 'Booking start date is missing. Cannot release vehicle.' });
    }
    const now = new Date();
    if (now < existingBooking.startDate) {
      const formattedDate = existingBooking.startDate.toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila'
      });
      return res.status(400).json({
        error: `Vehicle cannot be released before the scheduled pickup date. Pickup is scheduled for ${formattedDate}.`
      });
    }

    if (!existingBooking.agreementSignedAt) {
      return res.status(400).json({ error: 'Rental agreement must be signed before release.' });
    }

    if (!checklistConfirmed) {
      return res.status(400).json({ error: 'Release checklist must be confirmed.' });
    }

    if (!odometer) {
      return res.status(400).json({ error: 'Release odometer is required.' });
    }

    // Final conflict check before release
    const availability = await checkVehicleAvailability(
      existingBooking.vehicleId,
      existingBooking.startDate,
      existingBooking.endDate,
      id
    );

    if (!availability.available) {
      return res.status(409).json({ error: `Cannot release vehicle: ${availability.message}` });
    }

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        releasedAt: new Date(),
        releaseOdometerKm: parseFloat(odometer),
        releaseChecklistConfirmed: true,
        pickupNotes: notes,
        geofenceActivatedAt: new Date(),
        trackingSession: {
          create: {
            startTime: new Date(),
            isActive: true
          }
        }
      }
    });

    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { status: 'RENTED' }
    });

    // Create geofence zone if destination is set
    if (existingBooking.destinationName) {
      try {
        const geo = computeGeofence(existingBooking.destinationName);
        if (geo) {
          await prisma.geofenceZone.updateMany({
            where: { vehicleId: existingBooking.vehicleId, isActive: true },
            data: { isActive: false },
          });

          const circlePolygon = generateCirclePolygon(geo.centerLat, geo.centerLng, geo.radiusKm);

          const geofenceZone = await prisma.geofenceZone.create({
            data: {
              bookingId: booking.id,
              vehicleId: booking.vehicleId,
              name: existingBooking.destinationName,
              polygonCoordinates: JSON.stringify(circlePolygon),
              centerLatitude: geo.centerLat,
              centerLongitude: geo.centerLng,
              radiusKm: geo.radiusKm,
              isActive: true,
              activatedAt: new Date(),
            },
          });

          await prisma.booking.update({
            where: { id: booking.id },
            data: {
              approvedGeofenceZoneId: geofenceZone.id,
            },
          });
        }
      } catch (geofenceErr) {
        console.error('[Geofence] Failed to create geofence zone on release:', geofenceErr);
      }
    }

    // Notify Customer
    await createNotification(
      booking.customerId,
      'Rental Active',
      `Your rental for ${existingBooking.vehicle.brand} ${existingBooking.vehicle.model} is now ACTIVE. GPS tracking has started. Drive safely!`
    );

    res.json(booking);
  } catch (error) {
    console.error('Release error:', error);
    res.status(500).json({ error: 'Release failed' });
  }
});

// Admin: Mark Returned
router.post('/:id/return', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { odometer, notes, damageFound, damageDetails } = req.body;
  try {
    const existingBooking = await prisma.booking.findUnique({ 
      where: { id },
      include: { vehicle: true }
    });
    if (!existingBooking) return res.status(404).json({ error: 'Booking not found' });

    const returnKm = odometer ? parseFloat(odometer) : 0;
    const releaseKm = Number(existingBooking.releaseOdometerKm) || Number(existingBooking.vehicle.currentOdometerKm) || 0;
    const tripDistance = Math.max(0, returnKm - releaseKm);

    const booking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'RETURNED',
        returnedAt: new Date(),
        returnOdometerKm: returnKm,
        tripDistanceKm: tripDistance,
        geofenceEndedAt: new Date(),
        trackingSession: {
          update: {
            where: { bookingId: id },
            data: {
              endTime: new Date(),
              isActive: false
            }
          }
        }
      }
    });

    // Deactivate active geofence zone for this booking/vehicle on return
    await prisma.geofenceZone.updateMany({
      where: {
        OR: [
          { bookingId: id },
          { vehicleId: existingBooking.vehicleId }
        ],
        isActive: true
      },
      data: { isActive: false }
    });

    // Update vehicle current odometer
    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { currentOdometerKm: returnKm }
    });

    // Check for maintenance alerts
    await checkVehicleOilChangeDue(booking.vehicleId);

    if (damageFound && damageDetails) {
      await prisma.damageReport.create({
        data: {
          bookingId: id,
          damageType: damageDetails.type || 'GENERAL',
          severity: damageDetails.severity || 'LOW',
          description: damageDetails.desc || 'No description provided',
          estimatedCost: parseFloat(damageDetails.cost) || 0,
          status: 'PENDING'
        }
      });

      // Notify customer about the damage report filed for their booking
      const vehicleName = existingBooking.vehicle
        ? `${existingBooking.vehicle.brand} ${existingBooking.vehicle.model}`
        : 'vehicle';
      const costAmount = parseFloat(damageDetails.cost);
      const costText = !isNaN(costAmount) && costAmount > 0
        ? ` Estimated repair cost: ₱${costAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
        : '';
      const damageTypeStr = damageDetails.type || 'General';
      const descriptionText = damageDetails.desc ? ` Description: ${damageDetails.desc}.` : '';

      await createNotification(
        existingBooking.customerId,
        'Damage Report Filed',
        `A damage report (${damageTypeStr}) was filed for your rental of ${vehicleName} (Booking #${id.slice(0, 8).toUpperCase()}).${descriptionText}${costText} Please check your booking details for more information.`
      );
    }

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Return marking failed' });
  }
});

// Admin: Complete Rental
router.post('/:id/complete', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { maintenance } = req.body;
  try {
    const booking = await prisma.booking.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        geofenceEndedAt: new Date()
      }
    });

    // Deactivate active geofence zone for this booking/vehicle on completion
    await prisma.geofenceZone.updateMany({
      where: {
        OR: [
          { bookingId: id },
          { vehicleId: booking.vehicleId }
        ],
        isActive: true
      },
      data: { isActive: false }
    });

    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { status: maintenance ? 'UNDER_MAINTENANCE' : 'AVAILABLE' }
    });

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Completion failed' });
  }
});

// Customer: Get Booked Date Ranges for a Vehicle
router.get('/vehicle/:vehicleId/booked-dates', authenticate, async (req: AuthRequest, res) => {
  const { vehicleId } = req.params;
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        vehicleId,
        status: { notIn: ['REJECTED', 'CANCELLED', 'COMPLETED'] }
      },
      select: { startDate: true, endDate: true }
    });
    res.json(bookings.map(b => ({
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString()
    })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch booked dates' });
  }
});

// Customer: Cancel Booking (includes READY_FOR_PICKUP cancellation request)
router.patch('/:id/cancel', authenticate, async (req: AuthRequest, res) => {
  const { id } = req.params;
  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { vehicle: true }
    });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    // Ownership check — customer can only cancel their own booking
    if (req.user!.role !== 'admin' && booking.customerId !== req.user!.id) {
      return res.status(403).json({ error: 'Unauthorized to cancel this booking' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    // READY_FOR_PICKUP is included: customer has paid and vehicle is ready, admin must handle refund
    const cancellableStatuses = ['PENDING_REVIEW', 'APPROVED_FOR_PAYMENT', 'READY_FOR_PICKUP'];
    if (!cancellableStatuses.includes(booking.status)) {
      const statusMessages: Record<string, string> = {
        'ACTIVE': 'Cannot cancel an active rental',
        'RETURNED': 'Cannot cancel a returned rental',
        'COMPLETED': 'Cannot cancel a completed rental',
        'FULL_PAYMENT_SUBMITTED': 'Cannot cancel after payment has been submitted — please contact us directly',
        'DOWNPAYMENT_SUBMITTED': 'Cannot cancel after payment has been submitted — please contact us directly',
        'RESERVED': 'Cannot cancel a reserved booking — please contact us directly',
        'REJECTED': 'This booking has already been rejected',
      };
      const message = statusMessages[booking.status] || `Cannot cancel a booking with status: ${booking.status}`;
      return res.status(400).json({ error: message });
    }

    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED' }
    });

    // Deactivate any active geofence zone for this booking/vehicle on cancellation
    await prisma.geofenceZone.updateMany({
      where: {
        OR: [
          { bookingId: id },
          { vehicleId: booking.vehicleId }
        ],
        isActive: true
      },
      data: { isActive: false }
    });

    // If cancelling from READY_FOR_PICKUP, revert vehicle to AVAILABLE
    if (booking.status === 'READY_FOR_PICKUP') {
      await prisma.vehicle.update({
        where: { id: booking.vehicleId },
        data: { status: 'AVAILABLE' }
      });
      await createAdminNotification(
        'Cancellation Request — Payment at Risk',
        `Customer ${req.user!.fullName} cancelled booking ${id.split('-')[0].toUpperCase()} which was READY_FOR_PICKUP. Vehicle ${booking.vehicle.brand} ${booking.vehicle.model} reverted to AVAILABLE. Please review refund eligibility.`
      );
    } else {
      await createAdminNotification(
        'Booking Cancelled',
        `Customer ${req.user!.fullName} cancelled booking ${id.split('-')[0].toUpperCase()}.`
      );
    }

    res.json(updated);
  } catch (error) {
    console.error('Cancel booking error:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Admin: Void Booking (READY_FOR_PICKUP only — requires reason, reverts vehicle, notifies customer)
router.patch('/:id/void', authenticate, authorizeAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const { voidReason } = req.body;

  if (!voidReason || voidReason.trim().length < 10) {
    return res.status(400).json({ error: 'Void reason is required and must be at least 10 characters.' });
  }

  try {
    const booking = await prisma.booking.findUnique({
      where: { id },
      include: { vehicle: true }
    });

    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    if (['ACTIVE', 'RETURNED', 'COMPLETED'].includes(booking.status)) {
      return res.status(400).json({ error: 'Cannot void a booking that has already been released.' });
    }

    if (booking.status !== 'READY_FOR_PICKUP') {
      return res.status(400).json({
        error: `Cannot void a booking with status: ${booking.status}. Only READY_FOR_PICKUP bookings can be voided.`
      });
    }

    const reason = voidReason.trim();

    await prisma.booking.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        rejectionReason: `[VOIDED BY ADMIN] ${reason}`
      }
    });

    // Revert vehicle to AVAILABLE
    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { status: 'AVAILABLE' }
    });

    // Notify customer
    await createNotification(
      booking.customerId,
      'Booking Voided',
      `Your booking for ${booking.vehicle.brand} ${booking.vehicle.model} has been voided by the admin. Reason: ${reason}. Please contact us regarding your payment refund.`
    );

    // Notify admin log
    await createAdminNotification(
      'Booking Voided by Admin',
      `Booking ${id.split('-')[0].toUpperCase()} (${booking.vehicle.brand} ${booking.vehicle.model}) voided by ${req.user!.fullName}. Reason: ${reason}`
    );

    return res.status(200).json({ message: 'Booking voided successfully.' });
  } catch (error) {
    console.error('Void booking error:', error);
    res.status(500).json({ error: 'Failed to void booking' });
  }
});

export default router;
