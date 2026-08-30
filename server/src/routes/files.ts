import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import path from 'path';
import fs from 'fs';

const router = Router();

// Uploads boundary — all served files must reside inside this directory
const UPLOADS_ROOT = path.resolve(__dirname, '..', '..', '.uploads');

const CONTENT_TYPES: Record<string, string> = {
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.pdf':  'application/pdf',
};

// GET /api/files/:fileId — securely serve files based on permissions
router.get('/:fileId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { fileId } = req.params;

    // --- BookingDocument ---
    const doc = await prisma.bookingDocument.findUnique({
      where: { id: fileId },
      include: { booking: true }
    });

    if (doc) {
      if (req.user!.role !== 'admin' && doc.booking.customerId !== req.user!.id) {
        return res.status(403).json({ error: 'Unauthorized to view this document' });
      }
      const filePath = path.resolve(__dirname, '..', '..', doc.fileUrl);
      if (!filePath.startsWith(UPLOADS_ROOT + path.sep)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
      return res.sendFile(filePath);
    }

    // --- PaymentProof ---
    const proof = await prisma.paymentProof.findUnique({
      where: { id: fileId },
      include: { payment: { include: { booking: true } } }
    });

    if (proof) {
      if (req.user!.role !== 'admin' && proof.payment.booking.customerId !== req.user!.id) {
        return res.status(403).json({ error: 'Unauthorized to view this proof' });
      }

      let url = proof.proofUrl;
      if (url.startsWith('/uploads/.uploads/')) url = url.replace('/uploads/.uploads/', '.uploads/');
      else if (url.startsWith('/uploads/')) url = url.replace('/uploads/', '.uploads/');

      const filePath = path.resolve(__dirname, '..', '..', url);
      if (!filePath.startsWith(UPLOADS_ROOT + path.sep)) {
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
      return res.sendFile(filePath);
    }

    res.status(404).json({ error: 'Document record not found' });
  } catch (error) {
    console.error('File serving error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;
