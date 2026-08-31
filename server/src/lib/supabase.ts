import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ajyniipqfemngmayqodd.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFqeW5paXBxZmVtbmdtYXlxb2RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4Njg2ODMsImV4cCI6MjA4MzQ0NDY4M30.default_placeholder';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
  }
  return supabaseClient;
}

export const BUCKETS = {
  VEHICLE_IMAGES: 'vehicle-images',
  BOOKING_DOCUMENTS: 'booking-documents',
  PAYMENT_PROOFS: 'payment-proofs',
} as const;

/**
 * Ensures all required public storage buckets exist in Supabase.
 */
export async function ensureBucketsExist(): Promise<void> {
  const client = getSupabaseClient();
  const requiredBuckets = Object.values(BUCKETS);

  for (const bucketName of requiredBuckets) {
    try {
      const { data: bucket, error: getError } = await client.storage.getBucket(bucketName);
      if (getError || !bucket) {
        console.log(`[Supabase Storage] Bucket "${bucketName}" not found. Creating public bucket...`);
        const { error: createError } = await client.storage.createBucket(bucketName, {
          public: true,
          fileSizeLimit: 10485760, // 10MB limit
        });
        if (createError) {
          console.warn(`[Supabase Storage] Warning creating bucket "${bucketName}":`, createError.message);
        } else {
          console.log(`[Supabase Storage] Successfully created public bucket "${bucketName}".`);
        }
      }
    } catch (err: any) {
      console.warn(`[Supabase Storage] Error checking bucket "${bucketName}":`, err.message || err);
    }
  }
}

/**
 * Uploads a file buffer directly to a Supabase Storage bucket and returns the permanent public URL.
 */
export async function uploadToSupabaseStorage(
  bucketName: string,
  filePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const client = getSupabaseClient();

  // Normalize path string
  const cleanPath = filePath.replace(/^[/\\]+/, '');

  const { data, error } = await client.storage
    .from(bucketName)
    .upload(cleanPath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error(`[Supabase Storage Upload Error] Bucket "${bucketName}", Path "${cleanPath}":`, error);
    throw new Error(`Failed to upload to Supabase Storage: ${error.message}`);
  }

  const { data: publicUrlData } = client.storage
    .from(bucketName)
    .getPublicUrl(cleanPath);

  return publicUrlData.publicUrl;
}

/**
 * Safely deletes a file from a Supabase Storage bucket.
 * Non-throwing: errors are logged with [ORPHAN_CLEANUP_FAILED] prefix.
 */
export async function deleteFromSupabaseStorage(
  bucketName: string,
  filePath: string
): Promise<void> {
  try {
    const client = getSupabaseClient();
    const cleanPath = filePath.replace(/^[/\\]+/, '');
    const { error } = await client.storage.from(bucketName).remove([cleanPath]);
    if (error) {
      console.error(`[ORPHAN_CLEANUP_FAILED] Bucket "${bucketName}", Path "${cleanPath}":`, error.message || error);
    } else {
      console.log(`[ORPHAN_CLEANUP_SUCCESS] Bucket "${bucketName}", Path "${cleanPath}" deleted successfully.`);
    }
  } catch (err: any) {
    const msg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
    console.error(`[ORPHAN_CLEANUP_FAILED] Bucket "${bucketName}", Path "${filePath}":`, msg);
  }
}

/**
 * Extracts the object key/path inside a Supabase bucket from a full public URL or relative path string.
 */
export function extractSupabaseFilePath(fileUrl: string, bucketName: string): string {
  if (!fileUrl) return '';
  const searchPattern = `/public/${bucketName}/`;
  if (fileUrl.includes(searchPattern)) {
    return fileUrl.split(searchPattern)[1];
  }
  const altPattern = `/${bucketName}/`;
  if (fileUrl.includes(altPattern)) {
    return fileUrl.split(altPattern)[1];
  }
  return fileUrl.replace(/^[/\\]+/, '');
}
