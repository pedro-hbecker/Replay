import type { AlbumSearchResult } from '../types/album';

const MUSICBRAINZ_URL = 'https://musicbrainz.org/ws/2/release-group';
const COVER_ART_ARCHIVE_URL = 'https://coverartarchive.org/release-group';
const USER_AGENT = 'Replay/1.0.0 (https://github.com/replay-app)';

type MusicBrainzArtistCredit = {
  name?: string;
  artist?: {
    name?: string;
  };
};

type MusicBrainzReleaseGroup = {
  id: string;
  title?: string;
  'first-release-date'?: string;
  'artist-credit'?: MusicBrainzArtistCredit[];
  tags?: Array<{ name?: string }>;
  genres?: Array<{ name?: string }>;
};

type MusicBrainzResponse = {
  'release-groups'?: MusicBrainzReleaseGroup[];
};

function getArtistName(artistCredits: MusicBrainzArtistCredit[] = []): string {
  return artistCredits
    .map((credit) => credit.name ?? credit.artist?.name)
    .filter((name): name is string => Boolean(name))
    .join(', ');
}

function getGenres(releaseGroup: MusicBrainzReleaseGroup): string[] {
  const genreNames = [
    ...(releaseGroup.genres ?? []).map((genre) => genre.name),
    ...(releaseGroup.tags ?? []).map((tag) => tag.name),
  ];

  return [...new Set(genreNames.filter((name): name is string => Boolean(name)))];
}

async function getCoverUrl(releaseGroupId: string): Promise<string | null> {
  try {
    const response = await fetch(`${COVER_ART_ARCHIVE_URL}/${releaseGroupId}/front-500`, {
      headers: { Accept: 'image/*' },
    });

    return response.ok ? response.url : null;
  } catch {
    return null;
  }
}

export async function musicSearch(term: string): Promise<AlbumSearchResult[]> {
  const normalizedTerm = term.trim();

  if (!normalizedTerm) {
    return [];
  }

  const query = encodeURIComponent(normalizedTerm);
  const response = await fetch(
    `${MUSICBRAINZ_URL}?query=${query}&fmt=json&limit=25`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    },
  );

  if (!response.ok) {
    throw new Error(`MusicBrainz request failed with status ${response.status}`);
  }

  const data = (await response.json()) as MusicBrainzResponse;
  const releaseGroups = data['release-groups'] ?? [];
  const coverUrls = await Promise.all(
    releaseGroups.map((releaseGroup) => getCoverUrl(releaseGroup.id)),
  );

  return releaseGroups.map((releaseGroup, index) => ({
    id: releaseGroup.id,
    title: releaseGroup.title ?? '',
    artist: getArtistName(releaseGroup['artist-credit']),
    coverUrl: coverUrls[index],
    releaseDate: releaseGroup['first-release-date'] ?? '',
    genres: getGenres(releaseGroup),
  }));
}

export const searchAlbums = musicSearch;
