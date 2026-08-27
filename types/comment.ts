export interface Comment {
  id: string;
  reviewId: string;
  userId: string;
  authorName?: string;
  authorPhotoUrl?: string;
  text: string;
  createdAt: string;
}
