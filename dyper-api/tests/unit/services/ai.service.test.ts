// Mock d'axios : la même instance (post/get) est retournée par axios.create().
const mockPost = jest.fn();
const mockGet = jest.fn();
jest.mock('axios', () => ({
  __esModule: true,
  default: { create: () => ({ post: mockPost, get: mockGet }) },
}));

import aiService from '../../../src/services/ai/ai.service';
import {
  AiProcessingError,
  AiServiceUnavailableError,
  AiTimeoutError,
} from '../../../src/utils/errors';

const fakeResponse = {
  requestId: 'req-1',
  description: 'desc',
  visualization: {
    objects: [],
    scene: { label: 's', confidence: 0.5 },
    colors: [],
    text: [],
    tags: [],
  },
  model: 'yolo26l',
  processingTimeMs: 10,
};

describe('AiService.process', () => {
  it('construit un payload de type "prompt" et retourne la réponse', async () => {
    mockPost.mockResolvedValue({ data: fakeResponse });
    const result = await aiService.process({ requestId: 'req-1', prompt: 'salut', lang: 'fr' });
    expect(result).toEqual(fakeResponse);
    const [url, payload] = mockPost.mock.calls[0];
    expect(url).toBe('/process');
    expect(payload).toMatchObject({
      requestId: 'req-1',
      type: 'prompt',
      prompt: 'salut',
      lang: 'fr',
    });
  });

  it('encode un fichier image en base64 (type "image")', async () => {
    mockPost.mockResolvedValue({ data: fakeResponse });
    await aiService.process({
      requestId: 'r',
      fileBuffer: Buffer.from('img'),
      mimetype: 'image/png',
    });
    expect(mockPost.mock.calls[0][1]).toMatchObject({ type: 'image' });
    expect(mockPost.mock.calls[0][1].imageBase64).toBe(Buffer.from('img').toString('base64'));
  });

  it('mappe un timeout en AiTimeoutError', async () => {
    mockPost.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' });
    await expect(aiService.process({ requestId: 'r' })).rejects.toBeInstanceOf(AiTimeoutError);
  });

  it('mappe une absence de réponse réseau en AiServiceUnavailableError', async () => {
    mockPost.mockRejectedValue({ message: 'connect ECONNREFUSED' });
    await expect(aiService.process({ requestId: 'r' })).rejects.toBeInstanceOf(
      AiServiceUnavailableError
    );
  });

  it('mappe une erreur applicative dyper-ai en AiProcessingError', async () => {
    mockPost.mockRejectedValue({ response: { status: 422, data: { detail: 'image illisible' } } });
    await expect(aiService.process({ requestId: 'r' })).rejects.toMatchObject({
      name: 'AppError',
      code: 'AI_PROCESSING_ERROR',
      message: 'image illisible',
    });
    expect(AiProcessingError).toBeDefined();
  });

  it('isHealthy retourne false si dyper-ai est injoignable', async () => {
    mockGet.mockRejectedValue(new Error('down'));
    expect(await aiService.isHealthy()).toBe(false);
  });
});
