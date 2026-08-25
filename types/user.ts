export interface User {
  id: string;
  name: string;
  email?: string;
  password?: string;
  photoUrl: string;
  bio: string;
  topAlbumIds: string[];
  followerIds: string[];
  followingIds: string[];
}
