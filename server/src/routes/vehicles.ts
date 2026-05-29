import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { vehicleImageUpload } from '../middleware/upload';
import path from 'path';
import fs from 'fs';

const router = Router();

// Get all vehicles
router.get('/', async (req, res) => {
  try {
    const vehicles = await prisma.vehicle.findMany({
      orderBy: { brand: 'asc' }
    });
    res.json(vehicles);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch vehicles' });
  }
});

// GET /api/vehicles/:id/image - Publicly serve vehicle image
router.get('/:id/image', async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id }
    });

    if (!vehicle || !vehicle.imageUrl) {
      return res.status(404).send('No image found for this vehicle.');
    }

    // Check if it's an external URL or internal path
    if (vehicle.imageUrl.startsWith('http')) {
      return res.redirect(vehicle.imageUrl);
    }

    const filePath = path.resolve(vehicle.imageUrl);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Image file not found on server.');
    }

    res.sendFile(filePath);
  } catch (error) {
    res.status(500).send('Error serving image.');
  }
});

// Get available vehicles with optional date filtering
router.get('/available', async (req, res) => {
  const { pickupDate, returnDate } = req.query;
  
  try {
    const where: any = { status: 'AVAILABLE' };

    if (pickupDate && returnDate) {
      const start = new Date(pickupDate as string);
      const end = new Date(returnDate as string);

      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        where.bookings = {
          none: {
            status: { notIn: ['REJECTED', 'CANCELLED', 'COMPLETED'] },
            AND: [
              { startDate: { lt: end } },
              { endDate: { gt: start } }
            ]
          }
        };
      }
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { dailyRate: 'asc' }
    });
    res.json(vehicles);
  } catch (error) {
    console.error('Error fetching available vehicles:', error);
    res.status(500).json({ error: 'Failed to fetch available vehicles' });
  }
});

router.post('/', authenticate, authorizeAdmin, vehicleImageUpload.single('vehicleImage'), async (req, res) => {
  const { 
    model, brand, category, year, licensePlate, dailyRate, description, imageUrl,
    currentOdometerKm, lastOilChangeOdometerKm, oilChangeIntervalKm, status
  } = req.body;

  // Validation
  const allowedInitialStatuses = ['AVAILABLE', 'UNDER_MAINTENANCE'];
  const finalStatus = status || 'AVAILABLE';

  if (!allowedInitialStatuses.includes(finalStatus)) {
    return res.status(400).json({ 
      error: 'New vehicles can only be added as Available or Under Maintenance.' 
    });
  }

  try {
    // If a file was uploaded, use its path as imageUrl
    let finalImageUrl = imageUrl;
    if (req.file) {
      finalImageUrl = req.file.path; // Store relative path like ".uploads/vehicle-images/..."
    }

    const vehicle = await prisma.vehicle.create({
      data: { 
        model, brand, category, year: Number(year), licensePlate, dailyRate: Number(dailyRate), description, imageUrl: finalImageUrl, 
        status: finalStatus,
        currentOdometerKm: Number(currentOdometerKm) || 0,
        lastOilChangeOdometerKm: Number(lastOilChangeOdometerKm) || 0,
        oilChangeIntervalKm: Number(oilChangeIntervalKm) || 5000
      }
    });
    res.status(201).json(vehicle);
  } catch (error) {
    console.error('Vehicle creation error:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
});

// Admin: Update vehicle
router.put('/:id', authenticate, authorizeAdmin, vehicleImageUpload.single('vehicleImage'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.year) data.year = Number(data.year);
    if (data.dailyRate) data.dailyRate = Number(data.dailyRate);
    if (data.currentOdometerKm) data.currentOdometerKm = Number(data.currentOdometerKm);
    if (data.lastOilChangeOdometerKm) data.lastOilChangeOdometerKm = Number(data.lastOilChangeOdometerKm);
    if (data.oilChangeIntervalKm) data.oilChangeIntervalKm = Number(data.oilChangeIntervalKm);

    // Prevent manual setting of RESERVED, RENTED or RETIRED
    if (data.status && ['RESERVED', 'RENTED', 'RETIRED'].includes(data.status)) {
      return res.status(400).json({ 
        error: 'Reserved, Rented, and Retired statuses are managed by system actions.' 
      });
    }

    // If a new image file was uploaded
    if (req.file) {
      data.imageUrl = req.file.path;
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data
    });
    res.json(vehicle);
  } catch (error: any) {
    console.error('Vehicle Update Error (Backend):', error);
    
    if (error.code === 'P2002') {
      return res.status(409).json({ 
        success: false,
        error: 'A vehicle with this license plate already exists.' 
      });
    }

    res.status(400).json({ 
      success: false,
      error: error.message || 'Failed to update vehicle due to an internal error.' 
    });
  }
});

// Admin: Retire vehicle (Archive)
router.post('/:id/retire', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { status: 'RETIRED' }
    });
    res.json(vehicle);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retire vehicle' });
  }
});

export default router;
