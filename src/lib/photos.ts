import imageCompression from 'browser-image-compression'
import { supabase } from './supabase'

/**
 * Shrink a photo so 300+ photos stay fast and inside the free storage tier.
 * Target: longest side 1200px, under ~250 KB, saved as JPEG.
 */
export async function compressPhoto(file: File): Promise<File> {
  const out = await imageCompression(file, {
    maxSizeMB: 0.25,
    maxWidthOrHeight: 1200,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.82,
  })
  return new File([out], 'photo.jpg', { type: 'image/jpeg' })
}

/** Upload one (already compressed) photo and return its storage path. */
export async function uploadPhoto(designId: string, file: File): Promise<string> {
  const path = `${designId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('photos').upload(path, file, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function deletePhotoFile(storagePath: string): Promise<void> {
  const { error } = await supabase.storage.from('photos').remove([storagePath])
  if (error) throw error
}
