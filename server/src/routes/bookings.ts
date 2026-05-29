import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin, AuthRequest } from '../middleware/auth';
import { createNotification, createAdminNotification } from '../lib/notifications';
import { checkVehicleOilChangeDue } from '../lib/maintenance-alerts';
import { checkVehicleAvailability } from '../lib/booking-availability';
import { calculateBookingPrice } from '../lib/pricing';
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
        damageReports: true
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
        damageReports: true
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
        documents: true
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
        documents: true
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

    await prisma.vehicle.update({
      where: { id: booking.vehicleId },
      data: { status: maintenance ? 'UNDER_MAINTENANCE' : 'AVAILABLE' }
    });

    res.json(booking);
  } catch (error) {
    res.status(500).json({ error: 'Completion failed' });
  }
});

export default router;
