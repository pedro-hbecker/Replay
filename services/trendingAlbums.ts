import type { AlbumSearchResult } from '../types/album';

const APPLE_RSS_URL = 'https://rss.applemarketingtools.com/api/v2';

export async function getTrendingAlbums(country = 'br', limit = 25): Promise<AlbumSearchResult[]> {
  try {
    const normalizedCountry = String(country || 'br');
    const normalizedLimit = Number(limit) || 25;
    const url = `${APPLE_RSS_URL}/${encodeURIComponent(normalizedCountry)}/music/most-played/${encodeURIComponent(String(normalizedLimit))}/albums.json`;

    const response = await fetch(url, { headers: { Accept: 'application/json' } });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const results = Array.isArray(data?.feed?.results) ? data.feed.results : [];

    return results.map((item: any) => {
      const id = item.id ? `apple-${String(item.id)}` : `apple-${String(item.name ?? Math.random())}`;
      const title = item.name ?? '';
      const artist = item.artistName ?? '';
      const releaseDate = item.releaseDate ?? '';
      const genres = Array.isArray(item.genres) ? item.genres.map((g: any) => g.name).filter(Boolean) : [];
      const artwork = typeof item.artworkUrl100 === 'string' ? item.artworkUrl100.replace('100x100bb', '600x600bb') : undefined;

      return {
        id,
        title,
        artist,
        coverUrl: artwork || null,
        releaseDate,
        genres,
      } as AlbumSearchResult;
    });
  } catch {
    return [];
  }
}
