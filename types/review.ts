export interface Review {
  id: string;
  albumId: string;
  userId: string;
  rating: number;
  reviewText?: string;
  createdAt: string;
  likedBy: string[];
}
