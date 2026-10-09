import type { Media } from '@plataforma/core';
import * as ImagePicker from 'expo-image-picker';
import { ref, uploadBytes } from 'firebase/storage';
import { storage } from './firebase';

const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

/**
 * Elige fotos o videos de la galería y los sube a la carpeta de la tienda.
 * Devuelve los archivos subidos; los que no se pudieron subir vienen en `errors`.
 */
export async function pickAndUpload(storeId: string, opts: { multiple: boolean; allowVideo: boolean }) {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { media: [] as Media[], errors: ['Necesitamos permiso para ver tus fotos.'] };
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: opts.allowVideo ? ['images', 'videos'] : ['images'],
    allowsMultipleSelection: opts.multiple,
    quality: 0.85,
    videoMaxDuration: 60,
  });
  if (res.canceled) return { media: [] as Media[], errors: [] as string[] };

  const media: Media[] = [];
  const errors: string[] = [];
  for (const a of res.assets) {
    const isVideo = a.type === 'video';
    const type = a.mimeType || (isVideo ? 'video/mp4' : 'image/jpeg');
    if (isVideo && !/^video\/(mp4|webm)$/.test(type)) {
      errors.push('Ese video no está en MP4. Exportalo como MP4 y subilo de nuevo.');
      continue;
    }
    if (!isVideo && !/^image\/(jpeg|png|webp)$/.test(type)) {
      errors.push('Usá fotos JPG, PNG o WEBP (las HEIC del iPhone se convierten al compartirlas como JPG).');
      continue;
    }
    if (isVideo && a.fileSize && a.fileSize > MAX_VIDEO_BYTES) {
      errors.push('El video pesa más de 50 MB. Acortalo o comprimilo.');
      continue;
    }
    try {
      const blob = await (await fetch(a.uri)).blob();
      const ext = type.split('/')[1]!.replace('jpeg', 'jpg');
      const path = `stores/${storeId}/media/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      await uploadBytes(ref(storage, path), blob, { contentType: type, cacheControl: 'public,max-age=31536000' });
      media.push({ path, type: isVideo ? 'video' : 'image', ...(a.width ? { width: a.width } : {}), ...(a.height ? { height: a.height } : {}) });
    } catch {
      errors.push('No se pudo subir un archivo. Revisá la conexión y probá de nuevo.');
    }
  }
  return { media, errors };
}
