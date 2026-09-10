import { Router } from 'express';
import { Webhook } from 'svix';
import { prisma } from '../lib/prisma';

const router = Router();

const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;
if (!RESEND_WEBHOOK_SECRET) {
  console.warn('⚠️ RESEND_WEBHOOK_SECRET is not set — /api/webhooks/resend will reject all events.');
}

interface ResendWebhookEvent {
  type: string;
  data: {
    to?: string[];
    [key: string]: unknown;
  };
}

const STATUS_BY_EVENT: Record<string, 'delivered' | 'bounced' | 'complained'> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

// POST /api/webhooks/resend
// Mounted BEFORE the app's global express.json() (see index.ts) so req.body here is
// the raw Buffer svix needs to verify the signature — never JSON-parsed first.
router.post('/resend', async (req, res) => {
  if (!RESEND_WEBHOOK_SECRET) {
    console.error('[Resend Webhook] Rejected: RESEND_WEBHOOK_SECRET not configured.');
    return res.status(401).json({ error: 'Webhook not configured' });
  }

  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : undefined;
  if (!rawBody) {
    console.error('[Resend Webhook] Rejected: request body was not raw (check middleware order in index.ts).');
    return res.status(400).json({ error: 'Invalid request body' });
  }

  let event: ResendWebhookEvent;
  try {
    const wh = new Webhook(RESEND_WEBHOOK_SECRET);
    event = wh.verify(rawBody, {
      'svix-id': req.header('svix-id') || '',
      'svix-timestamp': req.header('svix-timestamp') || '',
      'svix-signature': req.header('svix-signature') || '',
    }) as unknown as ResendWebhookEvent;
  } catch (err) {
    console.error('[Resend Webhook] Signature verification failed:', err);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Signature verified from here on — safe to process.
  try {
    const newStatus = STATUS_BY_EVENT[event.type];
    if (!newStatus) {
      // Event type we don't track (e.g. email.sent, email.opened) — acknowledge, no-op.
      return res.status(200).json({ received: true });
    }

    const recipientEmail = event.data?.to?.[0];
    if (!recipientEmail) {
      console.error('[Resend Webhook] Event missing recipient email, cannot attribute:', event.type);
      return res.status(200).json({ received: true });
    }

    // Attribute by email from the payload (never by send order/assumption) — and always
    // apply whatever event arrives, so a later event (e.g. a bounce on a resend after an
    // earlier delivery) always overwrites the earlier status.
    await prisma.user.updateMany({
      where: { email: recipientEmail },
      data: {
        emailDeliveryStatus: newStatus,
        emailBouncedAt: newStatus === 'bounced' ? new Date() : undefined,
      },
    });

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Resend Webhook] Failed to process verified event:', err);
    res.status(500).json({ error: 'Failed to process event' });
  }
});

export default router;
