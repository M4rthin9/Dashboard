/** Longest edge an advert needs — the popup is at most ~1000px wide on desktop. */
const MAX_EDGE = 1600;
/** Must stay under the backend's MAX_PROMO_IMAGE_BYTES (3MB). */
export const MAX_PROMO_UPLOAD_BYTES = 3 * 1024 * 1024;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

/**
 * Advert image → data URI ready for `uploadPromoImage`.
 *
 * GIFs go up untouched (re-encoding would drop the animation). Everything else
 * is scaled down to MAX_EDGE and re-encoded as WebP — or JPEG on a browser
 * whose canvas cannot write WebP — so a phone photo does not ship at 8MB.
 */
export async function fileToPromoDataUri(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
    throw new Error('รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF');
  }
  if (file.type === 'image/gif') {
    if (file.size > MAX_PROMO_UPLOAD_BYTES) throw new Error('ไฟล์ GIF ใหญ่เกินไป (สูงสุด 3MB)');
    return readAsDataUrl(file);
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let uri = canvas.toDataURL('image/webp', 0.85);
  if (!uri.startsWith('data:image/webp')) uri = canvas.toDataURL('image/jpeg', 0.85);
  // base64 is 4/3 of the bytes.
  if (uri.length * 0.75 > MAX_PROMO_UPLOAD_BYTES) throw new Error('ไฟล์ใหญ่เกินไปหลังย่อขนาด (สูงสุด 3MB)');
  return uri;
}
