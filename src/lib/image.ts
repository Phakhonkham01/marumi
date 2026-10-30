/**
 * Shrinks a photo in the browser before upload (phone photos are 3–8 MB).
 * Produces WebP where supported, JPEG otherwise (older Safari can't encode WebP).
 */
export async function compressImage(file: File, maxSize = 1200): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const toBlob = (type: string, quality: number) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))

  const webp = await toBlob('image/webp', 0.82)
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await toBlob('image/jpeg', 0.85)
  if (!jpeg) throw new Error('compress_failed')
  return jpeg
}

export function extensionFor(blob: Blob) {
  return blob.type === 'image/webp' ? 'webp' : 'jpg'
}
