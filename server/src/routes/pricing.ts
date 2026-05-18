import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, authorizeAdmin } from '../middleware/auth';
import { calculateBookingPrice } from '../lib/pricing';

const router = Router();

// --- PUBLIC / CUSTOMER ROUTES ---

// POST /api/pricing/quote
// Get a price quote for a potential booking
router.post('/quote', async (req, res) => {
  const { vehicleId, startDate, endDate } = req.body;

  if (!vehicleId || !startDate || !endDate) {
    return res.status(400).json({ error: 'Vehicle ID, start date, and end date are required.' });
  }

  try {
    const quote = await calculateBookingPrice(
      vehicleId,
      new Date(startDate),
      new Date(endDate)
    );
    res.json(quote);
  } catch (error: any) {
    console.error('Pricing quote error:', error);
    res.status(500).json({ error: error.message || 'Failed to calculate price quote' });
  }
});

// --- ADMIN ROUTES ---

// GET /api/admin/pricing/rules
router.get('/admin/rules', authenticate, authorizeAdmin, async (req, res) => {
  try {
    const rules = await prisma.pricingRule.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pricing rules' });
  }
});

// POST /api/admin/pricing/rules
router.post('/admin/rules', authenticate, authorizeAdmin, async (req, res) => {
  const { 
    name, type, multiplier, startDate, endDate, 
    vehicleCategory, utilizationThreshold, description, isActive 
  } = req.body;

  if (!name || !type || multiplier === undefined) {
    return res.status(400).json({ error: 'Name, type, and multiplier are required.' });
  }

  try {
    const rule = await prisma.pricingRule.create({
      data: {
        name,
        type,
        multiplier: parseFloat(multiplier),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        vehicleCategory,
        utilizationThreshold: utilizationThreshold ? parseFloat(utilizationThreshold) : null,
        description,
        isActive: isActive !== undefined ? isActive : true
      }
    });
    res.status(201).json(rule);
  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({ error: 'Failed to create pricing rule' });
  }
});

// PUT /api/admin/pricing/rules/:id
router.put('/admin/rules/:id', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  const { 
    name, type, multiplier, startDate, endDate, 
    vehicleCategory, utilizationThreshold, description, isActive 
  } = req.body;

  try {
    const rule = await prisma.pricingRule.update({
      where: { id },
      data: {
        name,
        type,
        multiplier: multiplier !== undefined ? parseFloat(multiplier) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        vehicleCategory,
        utilizationThreshold: utilizationThreshold ? parseFloat(utilizationThreshold) : undefined,
        description,
        isActive
      }
    });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update pricing rule' });
  }
});

// DELETE /api/admin/pricing/rules/:id
router.delete('/admin/rules/:id', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.pricingRule.delete({ where: { id } });
    res.json({ message: 'Pricing rule deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete pricing rule' });
  }
});

// PATCH /api/admin/pricing/rules/:id/toggle
router.patch('/admin/rules/:id/toggle', authenticate, authorizeAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const current = await prisma.pricingRule.findUnique({ where: { id } });
    if (!current) return res.status(404).json({ error: 'Rule not found' });

    const rule = await prisma.pricingRule.update({
      where: { id },
      data: { isActive: !current.isActive }
    });
    res.json(rule);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle pricing rule' });
  }
});

export default router;
