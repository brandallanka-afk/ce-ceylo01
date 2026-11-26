import {getDownloadURL, ref, uploadBytes} from 'firebase/storage';
import {storage} from '../lib/firebaseAdmin';
import type {BrandId} from '../types/commerce';

async function resizeImageToBlob(
  file: File,
  maxWidth: number,
  quality: number,
): Promise<{blob: Blob; ext: string; mime: string}> {
  const imageBitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / imageBitmap.width);
  const width = Math.max(1, Math.round(imageBitmap.width * scale));
  const height = Math.max(1, Math.round(imageBitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for image compression');
  }
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const tryWebp = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/webp', quality),
  );

  if (tryWebp && tryWebp.type === 'image/webp') {
    return {blob: tryWebp, ext: 'webp', mime: 'image/webp'};
  }

  const jpegBlob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality),
  );
  if (!jpegBlob) {
    throw new Error('Failed to encode compressed image');
  }
  return {blob: jpegBlob, ext: 'jpg', mime: 'image/jpeg'};
}

export async function uploadOptimizedProductImage(
  file: File,
  brandId: BrandId,
  productId: string,
): Promise<{mainUrl: string; thumbnailUrl: string}> {
  const safeBrand = brandId.replace(/[^a-zA-Z0-9_-]/g, '');
  const safeProduct = productId.replace(/[^a-zA-Z0-9_-]/g, '');
  const stamp = Date.now();

  const [mainImg, thumbImg] = await Promise.all([
    resizeImageToBlob(file, 1200, 0.84),
    resizeImageToBlob(file, 400, 0.78),
  ]);

  const mainRef = ref(storage, `products/${safeBrand}/${safeProduct}/${stamp}_main.${mainImg.ext}`);
  const thumbRef = ref(
    storage,
    `products/${safeBrand}/${safeProduct}/${stamp}_thumb.${thumbImg.ext}`,
  );

  await Promise.all([
    uploadBytes(mainRef, mainImg.blob, {
      contentType: mainImg.mime,
      cacheControl: 'public,max-age=31536000',
    }),
    uploadBytes(thumbRef, thumbImg.blob, {
      contentType: thumbImg.mime,
      cacheControl: 'public,max-age=31536000',
    }),
  ]);

  const [mainUrl, thumbnailUrl] = await Promise.all([
    getDownloadURL(mainRef),
    getDownloadURL(thumbRef),
  ]);

  return {mainUrl, thumbnailUrl};
}
