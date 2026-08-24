/**
 * Tải ảnh minh chứng từ Google Drive về máy và nén lại trước khi đưa lên Storage.
 *
 * Mức nén: cạnh dài tối đa 1920px, WebP chất lượng 82 — vẫn đọc rõ chi tiết để
 * đối chiếu lỗi, nhưng nhẹ hơn ảnh gốc (1-2MB) khoảng 5-8 lần.
 *
 * Chạy: pnpm tsx scripts/demo/fetch-images.ts
 * Kết quả: scripts/demo/out/images/<violationId>_<index>.webp + images-map.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import sharp from 'sharp';

const OUT_DIR = join(process.cwd(), 'scripts', 'demo', 'out');
const IMG_DIR = join(OUT_DIR, 'images');
const MAX_EDGE = 1920;
const QUALITY = 82;
const CONCURRENCY = 6;

type ManifestItem = { violationId: string; index: number; driveId: string; url: string };

const download = async (driveId: string): Promise<Buffer> => {
  const res = await fetch(`https://drive.google.com/uc?export=download&id=${driveId}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) throw new Error(`không phải ảnh (${type})`);
  return Buffer.from(await res.arrayBuffer());
};

async function main() {
  const manifest: ManifestItem[] = JSON.parse(
    readFileSync(join(OUT_DIR, 'images-manifest.json'), 'utf8'),
  );
  mkdirSync(IMG_DIR, { recursive: true });

  const map: Record<string, string[]> = {};
  const failed: { item: ManifestItem; reason: string }[] = [];
  let done = 0;
  let bytesIn = 0;
  let bytesOut = 0;

  const queue = [...manifest];
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift()!;
      const fileName = `${item.violationId}_${item.index}.webp`;
      const filePath = join(IMG_DIR, fileName);
      try {
        if (existsSync(filePath)) {
          bytesOut += statSync(filePath).size;
        } else {
          const raw = await download(item.driveId);
          bytesIn += raw.length;
          const out = await sharp(raw)
            .rotate()
            .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
            .webp({ quality: QUALITY })
            .toBuffer();
          writeFileSync(filePath, out);
          bytesOut += out.length;
        }
        (map[item.violationId] ??= [])[item.index] = fileName;
      } catch (e: any) {
        failed.push({ item, reason: e?.message ?? String(e) });
      }
      if (++done % 25 === 0) console.log(`   ${done}/${manifest.length}`);
    }
  };

  console.log(`→ Tải & nén ${manifest.length} ảnh...`);
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  writeFileSync(join(OUT_DIR, 'images-map.json'), JSON.stringify(map, null, 2), 'utf8');
  if (failed.length) {
    writeFileSync(join(OUT_DIR, 'images-failed.json'), JSON.stringify(failed, null, 2), 'utf8');
  }

  const mb = (n: number) => (n / 1048576).toFixed(1);
  console.log('\n✔ Xong');
  console.log(`   Thành công ${manifest.length - failed.length}/${manifest.length}, lỗi ${failed.length}`);
  console.log(`   Dung lượng: ${mb(bytesIn)}MB → ${mb(bytesOut)}MB`);
  if (failed.length) console.log(`   Danh sách lỗi: ${join(OUT_DIR, 'images-failed.json')}`);
}

main().catch((e) => {
  console.error('✘ Lỗi:', e);
  process.exit(1);
});
