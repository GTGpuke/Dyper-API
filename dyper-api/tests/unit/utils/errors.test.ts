import {
  AiProcessingError,
  AiServiceUnavailableError,
  AppError,
  FileTooLargeError,
  InvalidFileTypeError,
  ValidationError,
} from '../../../src/utils/errors';

describe('Hiérarchie AppError', () => {
  it('AppError expose code, statusCode et details', () => {
    const err = new AppError('msg', 'TEST_CODE', 418, { foo: 'bar' });
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(418);
    expect(err.details).toEqual({ foo: 'bar' });
  });

  it('FileTooLargeError a le code et le statut attendus', () => {
    const err = new FileTooLargeError();
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe('FILE_TOO_LARGE');
    expect(err.statusCode).toBe(413);
  });

  it('InvalidFileTypeError → 415', () => {
    expect(new InvalidFileTypeError().statusCode).toBe(415);
  });

  it('ValidationError → 400 avec message par défaut', () => {
    const err = new ValidationError();
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.statusCode).toBe(400);
  });

  it('AiServiceUnavailableError → 503', () => {
    expect(new AiServiceUnavailableError().statusCode).toBe(503);
  });

  it('AiProcessingError → 422 et conserve un message custom', () => {
    const err = new AiProcessingError('IA en panne');
    expect(err.statusCode).toBe(422);
    expect(err.message).toBe('IA en panne');
  });
});
