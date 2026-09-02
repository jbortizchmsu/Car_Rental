import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';
import { createSignedUrlInSupabaseStorage, BUCKETS } from '../lib/supabase';
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
    console.log(`[FILES_API_DEBUG] Incoming request for fileId: "${fileId}", user: "${req.user?.id}", json: "${req.query.json}"`);

    // --- BookingDocument ---
    const doc = await prisma.bookingDocument.findUnique({
      where: { id: fileId },
      include: { booking: true }
    });

    if (doc) {
      console.log(`[FILES_API_DEBUG] Found BookingDocument "${doc.id}", fileUrl: "${doc.fileUrl}", documentType: "${doc.documentType}"`);
      if (req.user!.role !== 'admin' && doc.booking.customerId !== req.user!.id) {
        console.log(`[FILES_API_DEBUG] 403 Forbidden for user "${req.user?.id}" on booking customerId "${doc.booking.customerId}"`);
        return res.status(403).json({ error: 'Unauthorized to view this document' });
      }

      if (doc.fileUrl.startsWith('http://') || doc.fileUrl.startsWith('https://')) {
        console.log(`[FILES_API_DEBUG] Supabase URL detected. Creating signed URL...`);
        const signedUrl = await createSignedUrlInSupabaseStorage(
          BUCKETS.BOOKING_DOCUMENTS,
          doc.fileUrl,
          60
        );

        if (!signedUrl) {
          console.log(`[FILES_API_DEBUG] createSignedUrlInSupabaseStorage returned NULL for path "${doc.fileUrl}"`);
          return res.status(404).json({ error: 'Document file not found' });
        }

        console.log(`[FILES_API_DEBUG] Signed URL generated successfully: "${signedUrl}"`);
        if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
          return res.json({ url: signedUrl });
        }

        return res.redirect(signedUrl);
      }

      console.log(`[FILES_API_DEBUG] Local disk fileUrl detected: "${doc.fileUrl}"`);
      const filePath = path.resolve(__dirname, '..', '..', doc.fileUrl);
      if (!filePath.startsWith(UPLOADS_ROOT + path.sep)) {
        console.log(`[FILES_API_DEBUG] 403 Access Denied: path "${filePath}" outside UPLOADS_ROOT`);
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!fs.existsSync(filePath)) {
        console.log(`[FILES_API_DEBUG] 404 File Not Found on disk: "${filePath}"`);
        return res.status(404).json({ error: 'File not found on disk' });
      }

      if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
        const host = req.get('host') || 'localhost:4000';
        const protocol = req.protocol || 'http';
        const fallbackUrl = `${protocol}://${host}/api/files/${fileId}`;
        console.log(`[FILES_API_DEBUG] Returning local disk JSON fallback URL: "${fallbackUrl}"`);
        return res.json({ url: fallbackUrl });
      }

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
      console.log(`[FILES_API_DEBUG] Found PaymentProof "${proof.id}", proofUrl: "${proof.proofUrl}"`);
      if (req.user!.role !== 'admin' && proof.payment.booking.customerId !== req.user!.id) {
        console.log(`[FILES_API_DEBUG] 403 Forbidden for proof "${proof.id}"`);
        return res.status(403).json({ error: 'Unauthorized to view this proof' });
      }

      let url = proof.proofUrl;
      if (url.startsWith('http://') || url.startsWith('https://')) {
        console.log(`[FILES_API_DEBUG] PaymentProof Supabase URL detected: "${url}"`);
        const signedUrl = await createSignedUrlInSupabaseStorage(
          BUCKETS.PAYMENT_PROOFS,
          url,
          60
        );

        if (!signedUrl) {
          console.log(`[FILES_API_DEBUG] createSignedUrlInSupabaseStorage returned NULL for PaymentProof "${url}"`);
          return res.status(404).json({ error: 'Payment proof file not found' });
        }

        console.log(`[FILES_API_DEBUG] PaymentProof Signed URL generated successfully: "${signedUrl}"`);
        if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
          return res.json({ url: signedUrl });
        }

        return res.redirect(signedUrl);
      }

      if (url.startsWith('/uploads/.uploads/')) url = url.replace('/uploads/.uploads/', '.uploads/');
      else if (url.startsWith('/uploads/')) url = url.replace('/uploads/', '.uploads/');

      const filePath = path.resolve(__dirname, '..', '..', url);
      if (!filePath.startsWith(UPLOADS_ROOT + path.sep)) {
        console.log(`[FILES_API_DEBUG] 403 Access Denied for PaymentProof path "${filePath}"`);
        return res.status(403).json({ error: 'Access denied' });
      }
      if (!fs.existsSync(filePath)) {
        console.log(`[FILES_API_DEBUG] 404 File Not Found on disk for PaymentProof: "${filePath}"`);
        return res.status(404).json({ error: 'File not found on disk' });
      }

      if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
        const host = req.get('host') || 'localhost:4000';
        const protocol = req.protocol || 'http';
        const fallbackUrl = `${protocol}://${host}/api/files/${fileId}`;
        console.log(`[FILES_API_DEBUG] Returning PaymentProof local disk JSON fallback URL: "${fallbackUrl}"`);
        return res.json({ url: fallbackUrl });
      }
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader('Content-Type', CONTENT_TYPES[ext] || 'application/octet-stream');
      return res.sendFile(filePath);
    }

    console.log(`[FILES_API_DEBUG] 404 Document record not found in DB for fileId: "${fileId}"`);
    res.status(404).json({ error: 'Document record not found' });
  } catch (error) {
    console.error('[FILES_API_DEBUG] File serving error:', error);
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

export default router;
