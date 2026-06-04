import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Middleware to ensure admin-only access
const requireAdmin = async (req: AuthRequest, res: any, next: any) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id }
    });
    if (user?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Authorization failed' });
  }
};

// GET all settings (grouped by prefix)
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const settings = await prisma.systemSettings.findMany();

    // Group settings by prefix (e.g., general.*, notifications.*, security.*)
    const grouped = settings.reduce((acc: Record<string, any>, setting) => {
      const [prefix, key] = setting.key.split('.');
      if (!acc[prefix]) {
        acc[prefix] = {};
      }
      // Try to parse JSON values, otherwise treat as string
      let value: any = setting.value;
      try {
        value = JSON.parse(setting.value);
      } catch (e) {
        // Keep as string if not valid JSON
      }
      acc[prefix][key] = value;
      return acc;
    }, {});

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// GET single setting by key
router.get('/:key', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const setting = await prisma.systemSettings.findUnique({
      where: { key: req.params.key }
    });

    if (!setting) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    // Try to parse JSON value
    let value: any = setting.value;
    try {
      value = JSON.parse(setting.value);
    } catch (e) {
      // Keep as string if not valid JSON
    }

    res.json({ key: setting.key, value });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ error: 'Failed to fetch setting' });
  }
});

// PUT bulk upsert settings
router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { settings } = req.body;

    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'Settings must be an array' });
    }

    // Validate settings format
    for (const setting of settings) {
      if (!setting.key || setting.value === undefined) {
        return res.status(400).json({
          error: 'Each setting must have "key" and "value" properties'
        });
      }
    }

    // Upsert each setting
    const results = await Promise.all(
      settings.map((setting) =>
        prisma.systemSettings.upsert({
          where: { key: setting.key },
          create: {
            key: setting.key,
            value: typeof setting.value === 'string'
              ? setting.value
              : JSON.stringify(setting.value)
          },
          update: {
            value: typeof setting.value === 'string'
              ? setting.value
              : JSON.stringify(setting.value)
          }
        })
      )
    );

    res.json({
      success: true,
      message: `${results.length} settings updated`,
      settings: results
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
