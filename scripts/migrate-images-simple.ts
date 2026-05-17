/**
 * Simple image migration - compress and upload local images
 *
 * Run: npx ts-node scripts/migrate-images-simple.ts
 *
 * Usage: Place images in ./images-to-migrate/ named as {violationId}_{index}.{ext}
 * Results logged to ./migration-log.json
 *
 * Requires:
 * - VITE_SUPABASE_URL in .env
 * - SUPABASE_SERVICE_ROLE_KEY in .env
 */
import { createClient } from '@supabase/supabase-js';
import { createCanvas, loadImage } from 'canvas';
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Image compression (Node.js) ─────────────────────────────
async function compressImage(filePath: string): Promise<Buffer> {
  const img = await loadImage(filePath);
  const MAX_WIDTH = 1920;

  let { width, height } = { width: img.width, height: img.height };
  if (width > MAX_WIDTH) {
    height = Math.round((height * MAX_WIDTH) / width);
    width = MAX_WIDTH;
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toBuffer('image/webp', { quality: 0.85 });
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
    console.error(`  Upload error: ${error.message}`);
    return null;
  }

  const { data: urlData } = supabase.storage
    .from('violation-images')
    .getPublicUrl(fileName);

  return urlData.publicUrl;
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  const imagesDir = './images-to-migrate';
  const logPath = './migration-log.json';

  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true });
    console.log(`Created ${imagesDir}/ directory. Place images named {violationId}_{index}.{ext} inside.`);
    return;
  }

  const files = readdirSync(imagesDir).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));

  if (files.length === 0) {
    console.log('No images found in ./images-to-migrate/');
    return;
  }

  console.log(`Found ${files.length} images to process.\n`);

  const results: { file: string; violationId: string; success: boolean; url?: string; error?: string }[] = [];

  for (const file of files) {
    const [violationId, indexStr] = file.split('_');
    const index = indexStr?.replace(/\.[^.]+$/, '') || '0';

    console.log(`Processing ${file}...`);

    try {
      const filePath = path.join(imagesDir, file);
      const buffer = readFileSync(filePath);
      const compressed = await compressImage(buffer);

      const fileName = `violations/${violationId}/${Date.now()}_${index}.webp`;
      const url = await uploadToSupabase(compressed, fileName);

      if (url) {
        console.log(`  ✓ ${url.substring(0, 60)}...`);

        // Update violation record
        const { data: violation } = await supabase
          .from('violations')
          .select('id, images')
          .eq('id', violationId)
          .single();

        if (violation) {
          const currentImages = violation.images || [];
          currentImages.push(url);
          await supabase
            .from('violations')
            .update({ images: currentImages })
            .eq('id', violationId);
        }

        results.push({ file, violationId, success: true, url });
      } else {
        results.push({ file, violationId, success: false, error: 'Upload failed' });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Unknown error';
      console.log(`  ✗ ${error}`);
      results.push({ file, violationId, success: false, error });
    }
  }

  writeFileSync(logPath, JSON.stringify(results, null, 2));

  const successCount = results.filter(r => r.success).length;
  console.log(`\n✅ Migration complete! (${successCount}/${files.length} succeeded)`);
  console.log(`Log saved to ${logPath}`);
}

main().catch(console.error);