/**
 * Compress violation image: resize max 1920px + WebP 85%
 * Returns WebP Blob ready for upload to Supabase Storage
 */
export async function compressImage(file: File | Blob): Promise<Blob> {
  const img = await createImageBitmap(file);
  const originalWidth = img.width;
  const originalHeight = img.height;

  // Resize: max 1920px width
  const MAX_WIDTH = 1920;
  let { width, height } = { width: originalWidth, height: originalHeight };

  if (width > MAX_WIDTH) {
    height = Math.round((height * MAX_WIDTH) / width);
    width = MAX_WIDTH;
  }

  // Draw onto canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  // Export as WebP 85%
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error('Canvas toBlob failed')),
      'image/webp',
      0.85
    );
  });

  return blob;
}

/**
 * Convert File/Blob to base64 (for preview before upload)
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Create thumbnail data URL (for quick preview in UI)
 */
export async function createThumbnail(file: File | Blob, maxSize = 200): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(maxSize / img.width, maxSize / img.height);
  const canvas = document.createElement('canvas');
  canvas.width = img.width * scale;
  canvas.height = img.height * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/webp', 0.8);
}