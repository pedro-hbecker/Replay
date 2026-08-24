export interface User {
  id: string;
  name: string;
  photoUrl: string;
  bio: string;
  topAlbumIds: string[];
  followerIds: string[];
  followingIds: string[];
}
