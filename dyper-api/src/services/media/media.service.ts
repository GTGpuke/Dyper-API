// Service de stockage des médias d'analyses sur disque (miniatures et vidéos originales,
// servies par /api/media).
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../env.service';
import logger from '../logger.service';

// Dossier racine résolu une seule fois (créé paresseusement au premier write).
const mediaRoot = (): string => path.resolve(env.MEDIA_DIR);

let dirReady = false;

async function ensureDir(): Promise<void> {
  if (dirReady) return;
  await fs.promises.mkdir(mediaRoot(), { recursive: true });
  dirReady = true;
}

/**
 * Écrit la miniature JPEG (base64) d'une analyse et retourne son nom de fichier relatif.
 * Ne lève jamais : un échec d'écriture est journalisé et retourne null (la persistance
 * de l'analyse ne doit pas échouer à cause d'un problème de disque).
 */
export async function saveThumbnail(requestId: string, base64: string): Promise<string | null> {
  try {
    await ensureDir();
    const filename = `${requestId}.jpg`;
    await fs.promises.writeFile(path.join(mediaRoot(), filename), Buffer.from(base64, 'base64'));
    return filename;
  } catch (e) {
    logger.error("Échec de l'écriture de la miniature.", { requestId, error: e });
    return null;
  }
}

/**
 * Écrit la vidéo originale d'une analyse et retourne son nom de fichier relatif.
 * Ne lève jamais : un échec d'écriture est journalisé et retourne null.
 */
export async function saveVideo(requestId: string, buffer: Buffer): Promise<string | null> {
  try {
    await ensureDir();
    const filename = `${requestId}.mp4`;
    await fs.promises.writeFile(path.join(mediaRoot(), filename), buffer);
    return filename;
  } catch (e) {
    logger.error("Échec de l'écriture de la vidéo.", { requestId, error: e });
    return null;
  }
}

/** Supprime des fichiers médias (best-effort : ENOENT ignoré, autres erreurs journalisées). */
export async function deleteMediaFiles(paths: Array<string | null>): Promise<void> {
  const results = await Promise.allSettled(
    paths
      .filter((p): p is string => Boolean(p))
      .map((p) => fs.promises.unlink(path.join(mediaRoot(), p)))
  );
  for (const r of results) {
    if (r.status === 'rejected' && (r.reason as { code?: string })?.code !== 'ENOENT') {
      logger.warn("Échec de la suppression d'un fichier média.", { error: r.reason });
    }
  }
}

/**
 * Résout le chemin absolu d'une miniature en garantissant qu'il reste dans le dossier média
 * (défense en profondeur contre un thumbnail_path corrompu). Retourne null si hors périmètre.
 */
export function resolveThumbnailPath(relative: string): string | null {
  const abs = path.resolve(mediaRoot(), relative);
  if (!abs.startsWith(mediaRoot() + path.sep)) return null;
  return abs;
}

/**
 * Retourne la taille (octets) et le chemin absolu d'un média, ou null s'il est absent
 * ou hors périmètre (utilisé par le streaming HTTP Range des vidéos).
 */
export async function statMediaFile(
  relative: string
): Promise<{ absolute: string; size: number } | null> {
  const absolute = resolveThumbnailPath(relative);
  if (!absolute) return null;
  try {
    const stats = await fs.promises.stat(absolute);
    return { absolute, size: stats.size };
  } catch {
    return null;
  }
}

/**
 * Lit une miniature et la retourne en base64 (pour le chat vision). Best-effort :
 * retourne null si le chemin est absent, hors périmètre ou illisible.
 */
export async function readThumbnailBase64(relative: string | null): Promise<string | null> {
  if (!relative) return null;
  const absolute = resolveThumbnailPath(relative);
  if (!absolute) return null;
  try {
    return (await fs.promises.readFile(absolute)).toString('base64');
  } catch {
    return null;
  }
}
