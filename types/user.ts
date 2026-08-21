export interface User {
  id: string;
  name: string;
  photoUrl: string;
  bio: string;
  topArtists: string[];
  topAlbumIds: string[];
  followerIds: string[];
  followingIds: string[];
}
