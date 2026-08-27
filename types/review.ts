export interface Review {
  id: string;
  albumId: string;
  userId: string;
  reviewerName?: string;
  reviewerPhotoUrl?: string;
  rating: number;
  reviewText?: string;
  createdAt: string;
  likedBy: string[];
}
