import { isVideoPlatformUrl } from '../../../src/utils/videoUrl';

describe('isVideoPlatformUrl', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=abc',
    'https://youtube.com/shorts/abc123',
    'https://youtu.be/dQw4w9WgXcQ',
    'https://clips.twitch.tv/FunnyClipName',
    'https://www.twitch.tv/streamer/clip/FunnyClipName',
    'https://www.twitch.tv/streamer/clip/Funny-Clip_Name-AbC123?filter=clips&range=7d',
    'https://m.twitch.tv/streamer/clip/FunnyClipName',
    'https://m.twitch.tv/clip/FunnyClipName',
    'https://www.twitch.tv/videos/123456789',
    'https://m.twitch.tv/videos/123456789',
  ])('détecte %s comme plateforme vidéo', (url) => {
    expect(isVideoPlatformUrl(url)).toBe(true);
  });

  it.each([
    'https://example.com/photo.jpg',
    'https://twitch.tv/juste-une-chaine',
    'https://youtube.com/@unechaine',
    'https://evil.com/youtu.be/abc',
    'pas-une-url',
  ])('ne détecte pas %s', (url) => {
    expect(isVideoPlatformUrl(url)).toBe(false);
  });
});
