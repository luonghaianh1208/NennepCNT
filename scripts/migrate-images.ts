/**
 * Migrate violation images from Google Drive to Supabase Storage
 * Images are compressed to WebP 85%, resized to max 1920px
 *
 * Run: npx ts-node scripts/migrate-images.ts
 *
 * Requires:
 * - VITE_SUPABASE_URL in .env
 * - SUPABASE_SERVICE_ROLE_KEY in .env
 * - GOOGLE_SERVICE_ACCOUNT_TOKEN (for Drive access) - optional, if migrating from Drive
 */
import { createClient } from '@supabase/supabase-js';
import { createCanvas, loadImage } from 'canvas';
import { Buffer } from 'buffer';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Image compression (Node.js) ─────────────────────────────
async function compressImage(inputBuffer: Buffer): Promise<Buffer> {
  // Write buffer to temp file for canvas processing
  const tempFile = `/tmp/image_${Date.now()}.png`;
  const fs = await import('fs');
  fs.writeFileSync(tempFile, inputBuffer);

  const img = await loadImage(tempFile);
  const MAX_WIDTH = 1920;

  let { width, height } = { width: img.width, height: img.height };
  if (width > MAX_WIDTH) {
    height = Math.round((height * MAX_WIDTH) / width);
    width = MAX_WIDTH;
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  // Clean up temp file
  fs.unlinkSync(tempFile);

  return canvas.toBuffer('image/webp', { quality: 0.85 });
}

// ── Parse Google Drive URL ──────────────────────────────────
function parseDriveUrl(url: string): string | null {
  // Format: https://drive.google.com/uc?export=view&id=FILE_ID
  const match = url.match(/id=([^&]+)/);
  return match ? match[1] : null;
}

// ── Download from Google Drive ──────────────────────────────
async function downloadFromDrive(fileId: string): Promise<Buffer | null> {
  const token = process.env.GOOGLE_SERVICE_ACCOUNT_TOKEN;
  if (!token) {
    console.log('  (GOOGLE_SERVICE_ACCOUNT_TOKEN not set, skipping Drive download)');
    return null;
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

// ── Upload to Supabase Storage ──────────────────────────────
async function uploadToSupabase(
  buffer: Buffer,
  fileName: string
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('violation-images')
    .upload(fileName, buffer, {
      contentType: 'image/webp',
      upsert: false,
    });

  if (error) {
    console.error('  Upload error:', error.message);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('violation-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ── Process a single violation's images ────────────────────
async function processViolationImages(
  violationId: string,
  oldImages: string[]
): Promise<string[]> {
  const newImages: string[] = [];

  for (let i = 0; i < oldImages.length; i++) {
    const oldUrl = oldImages[i];

    // Try Google Drive
    const fileId = parseDriveUrl(oldUrl);
    let imageBuffer: Buffer | null = null;

    if (fileId) {
      imageBuffer = await downloadFromDrive(fileId);
    }

    // If not from Drive, try direct URL
    if (!imageBuffer) {
      try {
        const response = await fetch(oldUrl);
        if (response.ok) {
          const arrayBuffer = await response.arrayBuffer();
          imageBuffer = Buffer.from(arrayBuffer);
        }
      } catch {
        // Skip this image
      }
    }

    if (!imageBuffer) {
      console.log(`  Warning: Could not download ${oldUrl}`);
      newImages.push(oldUrl); // Keep original if can't migrate
      continue;
    }

    // Compress
    const compressed = await compressImage(imageBuffer);

    // Upload
    const fileName = `violations/${violationId}/${Date.now()}_${i}.webp`;
    const newUrl = await uploadToSupabase(compressed, fileName);

    if (newUrl) {
      newImages.push(newUrl);
      console.log(`    Image ${i + 1}: ${newUrl.substring(0, 60)}...`);
    } else {
      newImages.push(oldUrl); // Keep original
    }
  }

  return newImages;
}

// ── Main migration loop ─────────────────────────────────────
async function main() {
  console.log('Starting image migration...\n');

  // Get all violations with images
  const { data: violations } = await supabase
    .from('violations')
    .select('id, images')
    .not('images', 'eq', '{}');

  if (!violations || violations.length === 0) {
    console.log('No violations with images to migrate.');
    return;
  }

  console.log(`Found ${violations.length} violations with images.\n`);

  let successCount = 0;

  for (const v of violations) {
    if (!v.images || v.images.length === 0) continue;

    console.log(`Processing violation ${v.id}...`);

    const newImages = await processViolationImages(v.id, v.images);

    // Update violation with new image URLs
    const { error } = await supabase
      .from('violations')
      .update({ images: newImages })
      .eq('id', v.id);

    if (error) {
      console.log(`  Error updating violation: ${error.message}`);
    } else {
      successCount++;
      console.log(`  ✓ Updated with ${newImages.length} images`);
    }
  }

  console.log(`\n✅ Image migration complete! (${successCount}/${violations.length} violations processed)`);
}

main().catch(console.error);
