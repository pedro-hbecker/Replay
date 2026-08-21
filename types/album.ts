export interface Album {
  id: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string;
  genres: string[];
  description?: string;
  addedBy?: string;
  addedAt?: string;
}

export type AlbumSearchResult = Omit<Album, 'addedBy' | 'addedAt'>;
