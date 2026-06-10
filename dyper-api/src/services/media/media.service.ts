// Service de stockage des miniatures d'analyses sur disque (servies par /api/media).
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

/** Supprime des miniatures (best-effort : ENOENT ignoré, autres erreurs journalisées). */
export async function deleteThumbnails(paths: Array<string | null>): Promise<void> {
  const results = await Promise.allSettled(
    paths
      .filter((p): p is string => Boolean(p))
      .map((p) => fs.promises.unlink(path.join(mediaRoot(), p)))
  );
  for (const r of results) {
    if (r.status === 'rejected' && (r.reason as { code?: string })?.code !== 'ENOENT') {
      logger.warn("Échec de la suppression d'une miniature.", { error: r.reason });
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
