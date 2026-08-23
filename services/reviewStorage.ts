import type { Review } from '../types/review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'app-reviews';

type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function getLocalStorage(): LocalStorageLike | null {
  if (typeof globalThis === 'undefined') return null;
  const storage = (globalThis as typeof globalThis & { localStorage?: LocalStorageLike }).localStorage;
  return storage ?? null;
}

export async function getReviews(): Promise<Review[]> {
  const storage = getLocalStorage();
  try {
    const storedReviews = storage ? storage.getItem(STORAGE_KEY) : await AsyncStorage.getItem(STORAGE_KEY);
    if (!storedReviews) return [];
    const parsedReviews: unknown = JSON.parse(storedReviews);
    return Array.isArray(parsedReviews)
      ? parsedReviews.map((review) => ({
        ...(review as Review),
        albumId: String((review as Review).albumId),
        likedBy: Array.isArray((review as Review).likedBy) ? (review as Review).likedBy : [],
      }))
      : [];
  } catch {
    return [];
  }
}

export async function getReviewsByAlbum(albumId: string): Promise<Review[]> {
  const normalizedAlbumId = String(albumId);
  return (await getReviews()).filter((review) => review.albumId === normalizedAlbumId);
}

export async function getReviewsByUser(userId: string): Promise<Review[]> {
  return (await getReviews()).filter((review) => review.userId === userId);
}

async function persist(reviews: Review[]): Promise<void> {
  const storage = getLocalStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(reviews));
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(reviews));
  }
}

export async function saveReview(review: Review): Promise<Review[]> {
  const reviews = await getReviews();
  if (reviews.some((storedReview) => storedReview.id === review.id)) return reviews;

  const updatedReviews = [...reviews, { ...review, albumId: String(review.albumId), likedBy: review.likedBy ?? [] }];
  try {
    await persist(updatedReviews);
    return updatedReviews;
  } catch {
    return reviews;
  }
}

export async function updateReview(id: string, data: Partial<Omit<Review, 'id'>>): Promise<Review[]> {
  const reviews = await getReviews();
  const reviewIndex = reviews.findIndex((review) => review.id === id);
  if (reviewIndex === -1) return reviews;

  const updatedReviews = [...reviews];
  updatedReviews[reviewIndex] = {
    ...updatedReviews[reviewIndex],
    ...data,
    id,
    albumId: String(data.albumId ?? updatedReviews[reviewIndex].albumId),
    likedBy: data.likedBy ?? updatedReviews[reviewIndex].likedBy ?? [],
  };
  try {
    await persist(updatedReviews);
    return updatedReviews;
  } catch {
    return reviews;
  }
}

export async function toggleLike(reviewId: string, userId: string): Promise<Review[]> {
  const reviews = await getReviews();
  const reviewIndex = reviews.findIndex((review) => review.id === reviewId);
  if (reviewIndex === -1) return reviews;

  const review = reviews[reviewIndex];
  const likedBy = Array.isArray(review.likedBy) ? review.likedBy : [];
  const updatedLikedBy = likedBy.includes(userId) ? likedBy.filter((id) => id !== userId) : [...likedBy, userId];
  const updatedReviews = [...reviews];
  updatedReviews[reviewIndex] = { ...review, likedBy: updatedLikedBy };
  try {
    await persist(updatedReviews);
    return updatedReviews;
  } catch {
    return reviews;
  }
}

export async function removeReview(id: string): Promise<Review[]> {
  const reviews = await getReviews();
  const updatedReviews = reviews.filter((review) => review.id !== id);
  if (updatedReviews.length === reviews.length) return reviews;
  try {
    await persist(updatedReviews);
    return updatedReviews;
  } catch {
    return reviews;
  }
}