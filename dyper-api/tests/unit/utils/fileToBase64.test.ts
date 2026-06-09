import { fileToBase64 } from '../../../src/utils/fileToBase64';

describe('fileToBase64', () => {
  it('encode un Buffer en base64', () => {
    const buffer = Buffer.from('dyper', 'utf-8');
    expect(fileToBase64(buffer)).toBe(buffer.toString('base64'));
  });

  it('round-trip : décoder le base64 redonne le contenu original', () => {
    const original = Buffer.from('hello world');
    const decoded = Buffer.from(fileToBase64(original), 'base64').toString('utf-8');
    expect(decoded).toBe('hello world');
  });

  it('lève une TypeError si l’argument n’est pas un Buffer', () => {
    // @ts-expect-error test d'un argument invalide volontaire.
    expect(() => fileToBase64('not a buffer')).toThrow(TypeError);
  });
});
