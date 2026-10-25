/**
 * Catching Light, Mani Odubo's first album: out on the streaming services
 * since 2025-09-26, 12 songs, not hosted on this site. The links go to the
 * album itself (not the artist page); the cover is Apple's artwork, kept in
 * /public so the page does not lean on another site.
 */
export const CATCHING_LIGHT = {
  title: 'Catching Light',
  year: 2025,
  songs: 12,
  cover: '/music/catching-light.jpg',
  listen: [
    { platform: 'spotify', label: 'Spotify', url: 'https://open.spotify.com/album/4mfV40qKXokeC5hNG7sQzf' },
    { platform: 'apple_music', label: 'Apple Music', url: 'https://music.apple.com/ca/album/catching-light/1837435888' },
  ],
} as const;
