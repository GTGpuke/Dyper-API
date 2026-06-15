// Allocation de capacité de la passerelle (backend unique, sans multi-instance).
//
// Objectif : garantir à chaque traitement une part de calcul stable même sous forte charge. On
// borne le nombre d'analyses dyper-ai exécutées EN PARALLÈLE (sémaphore) ; au-delà, les requêtes
// patientent dans une file d'attente PRIORITAIRE — les forfaits payants (priorité plus élevée)
// sont servis avant les autres, en FIFO à priorité égale. Un GPU non sur-sollicité = des temps
// de traitement prévisibles pour tous, plutôt qu'un effondrement global quand tout le monde arrive.
//
// Important : cela ne modifie en RIEN la qualité d'analyse (toutes les offres ont la même
// puissance) ; seul l'ORDRE de passage en file dépend du forfait.
import { env } from '../env.service';
import logger from '../logger.service';

/** Fonction à appeler pour libérer le créneau de calcul une fois le traitement terminé. */
export type ReleaseSlot = () => void;

interface Waiter {
  priority: number;
  seq: number;
  resolve: (release: ReleaseSlot) => void;
  reject: (err: Error) => void;
}

let active = 0;
let seqCounter = 0;
const queue: Waiter[] = [];

function maxConcurrent(): number {
  return Math.max(1, env.MAX_CONCURRENT_ANALYSES);
}

// Construit une libération idempotente : décrémente le compteur actif et réveille la file.
function makeRelease(): ReleaseSlot {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    active -= 1;
    drain();
  };
}

// Réveille autant d'attendants que de créneaux libres, par priorité décroissante puis FIFO.
function drain(): void {
  while (active < maxConcurrent() && queue.length > 0) {
    queue.sort((a, b) => b.priority - a.priority || a.seq - b.seq);
    const next = queue.shift();
    if (!next) break;
    active += 1;
    next.resolve(makeRelease());
  }
}

/**
 * Réserve un créneau de calcul. Résout immédiatement si la capacité est disponible, sinon attend
 * son tour dans la file prioritaire. Si `signal` est avorté pendant l'attente (client déconnecté),
 * la promesse est rejetée avec une AbortError et la place en file est libérée.
 *
 * @param priority Priorité de file (plus élevé = servi avant) — typiquement issue du forfait.
 * @param signal   Signal d'annulation optionnel (déconnexion client).
 */
export function acquireSlot(priority: number, signal?: AbortSignal): Promise<ReleaseSlot> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('Acquisition annulée.', 'AbortError'));
  }

  // Capacité disponible : passage immédiat.
  if (active < maxConcurrent() && queue.length === 0) {
    active += 1;
    return Promise.resolve(makeRelease());
  }

  // Sinon, mise en file d'attente.
  return new Promise<ReleaseSlot>((resolve, reject) => {
    const waiter: Waiter = { priority, seq: seqCounter++, resolve, reject };
    queue.push(waiter);
    logger.info('Analyse mise en file (capacité saturée).', {
      priority,
      queued: queue.length,
      active,
    });

    if (signal) {
      signal.addEventListener(
        'abort',
        () => {
          const index = queue.indexOf(waiter);
          if (index >= 0) {
            queue.splice(index, 1);
            reject(new DOMException('Acquisition annulée.', 'AbortError'));
          }
        },
        { once: true }
      );
    }
  });
}

/** Position dans la file (1 = prochain servi) pour une priorité donnée, sans réserver de créneau. */
export function queuePositionFor(priority: number): number {
  return queue.filter((w) => w.priority >= priority).length + 1;
}

/** Instantané de la charge courante (exposé à l'interface pour informer l'utilisateur). */
export function capacityStatus(): {
  maxConcurrent: number;
  active: number;
  queued: number;
  busy: boolean;
  avgAnalysisSeconds: number;
} {
  return {
    maxConcurrent: maxConcurrent(),
    active,
    queued: queue.length,
    busy: active >= maxConcurrent(),
    avgAnalysisSeconds: env.AVG_ANALYSIS_SECONDS,
  };
}
