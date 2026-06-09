// Service de communication avec dyper-ai — seule couche autorisée à appeler le moteur d'inférence.
// Construit le payload ProcessRequest, gère l'authentification interne, les timeouts et les erreurs.
import axios, { type AxiosError, type AxiosInstance } from 'axios';
import type { AnalyzeType, ProcessAiResponse, ProcessOptions } from '../../types';
import { AiProcessingError, AiServiceUnavailableError, AiTimeoutError } from '../../utils/errors';
import { fileToBase64 } from '../../utils/fileToBase64';
import { env } from '../env.service';
import logger from '../logger.service';

class AiService {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: env.AI_SERVICE_URL,
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': env.AI_INTERNAL_KEY,
      },
      timeout: env.AI_REQUEST_TIMEOUT_MS,
      // Une vidéo (jusqu'à 100 Mo) encodée en base64 dépasse les limites de corps par défaut.
      maxBodyLength: Number.POSITIVE_INFINITY,
      maxContentLength: Number.POSITIVE_INFINITY,
    });
  }

  /**
   * Envoie une requête de traitement à dyper-ai et retourne la réponse structurée.
   * @throws {AiTimeoutError} Si dyper-ai ne répond pas dans les délais.
   * @throws {AiServiceUnavailableError} Si dyper-ai est injoignable.
   * @throws {AiProcessingError} Si dyper-ai retourne une erreur de traitement.
   */
  async process(opts: ProcessOptions): Promise<ProcessAiResponse> {
    const { requestId, fileBuffer, mimetype, imageUrl, prompt, lang } = opts;

    const payload: Record<string, unknown> = {
      requestId,
      prompt: prompt ?? null,
      lang: lang ?? 'fr',
    };

    // Mode fichier : le buffer est encodé en base64 ; vidéo si MIME "video/*", image sinon.
    let type: AnalyzeType;
    if (fileBuffer) {
      const isVideo = typeof mimetype === 'string' && mimetype.startsWith('video/');
      type = isVideo ? 'video' : 'image';
      if (isVideo) {
        payload.videoBase64 = fileToBase64(fileBuffer);
      } else {
        payload.imageBase64 = fileToBase64(fileBuffer);
      }
    } else if (imageUrl) {
      type = 'image';
      payload.imageUrl = imageUrl;
    } else {
      type = 'prompt';
    }
    payload.type = type;

    logger.info('Appel vers dyper-ai en cours.', { requestId, type });

    // La vidéo nécessite un timeout plus long (analyse de nombreuses images par YOLO).
    const timeout = type === 'video' ? env.AI_VIDEO_TIMEOUT_MS : env.AI_REQUEST_TIMEOUT_MS;

    try {
      const response = await this.client.post<ProcessAiResponse>('/process', payload, { timeout });
      logger.info('Réponse reçue de dyper-ai.', { requestId });
      return response.data;
    } catch (e) {
      const err = e as AxiosError<{ detail?: string; message?: string }>;

      // Timeout : dyper-ai n'a pas répondu dans les délais impartis.
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        logger.error("Timeout lors de l'appel à dyper-ai.", { requestId, error: err.message });
        throw new AiTimeoutError({ requestId });
      }

      // Erreur réseau : dyper-ai est injoignable (ECONNREFUSED, ENOTFOUND, etc.).
      if (!err.response) {
        logger.error('Service dyper-ai injoignable.', { requestId, error: err.message });
        throw new AiServiceUnavailableError({ requestId, reason: err.message });
      }

      // Erreur applicative retournée par dyper-ai (4xx ou 5xx).
      const aiMessage =
        err.response.data?.detail ?? err.response.data?.message ?? 'Erreur de traitement IA.';
      logger.error('Erreur de traitement retournée par dyper-ai.', {
        requestId,
        status: err.response.status,
        aiMessage,
      });
      throw new AiProcessingError(aiMessage, { requestId, aiStatus: err.response.status });
    }
  }

  /** Vérifie la disponibilité de dyper-ai (utilisé par /health). Ne propage jamais d'erreur. */
  async isHealthy(): Promise<boolean> {
    try {
      await this.client.get('/health', { timeout: 5000 });
      return true;
    } catch (e) {
      logger.warn('dyper-ai injoignable lors du health check.', {
        error: e instanceof Error ? e.message : String(e),
      });
      return false;
    }
  }
}

export default new AiService();
