import type { Review } from '../types/review';

const STORAGE_KEY = 'app-reviews';

type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function getLocalStorage(): LocalStorageLike | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }

  const storage = (globalThis as typeof globalThis & {
    localStorage?: LocalStorageLike;
  }).localStorage;

  return storage ?? null;
}

export function getReviews(): Review[] {
  const storage = getLocalStorage();

  if (!storage) {
    return [];
  }

  try {
    const storedReviews = storage.getItem(STORAGE_KEY);

    if (!storedReviews) {
      return [];
    }

    const parsedReviews: unknown = JSON.parse(storedReviews);
    return Array.isArray(parsedReviews)
      ? parsedReviews.map((review) => ({
        ...(review as Review),
        likedBy: Array.isArray((review as Review).likedBy) ? (review as Review).likedBy : [],
      }))
      : [];
  } catch {
    return [];
  }
}

export function getReviewsByAlbum(albumId: string): Review[] {
  return getReviews().filter((review) => review.albumId === albumId);
}

export function getReviewsByUser(userId: string): Review[] {
  return getReviews().filter((review) => review.userId === userId);
}

export function saveReview(review: Review): Review[] {
  const reviews = getReviews();

  if (reviews.some((storedReview) => storedReview.id === review.id)) {
    return reviews;
  }

  const updatedReviews = [...reviews, { ...review, likedBy: review.likedBy ?? [] }];
  const storage = getLocalStorage();

  if (!storage) {
    return reviews;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updatedReviews));
    return updatedReviews;
  } catch {
    return reviews;
  }
}

export function updateReview(id: string, data: Partial<Omit<Review, 'id'>>): Review[] {
  const reviews = getReviews();
  const reviewIndex = reviews.findIndex((review) => review.id === id);

  if (reviewIndex === -1) {
    return reviews;
  }

  const updatedReviews = [...reviews];
  updatedReviews[reviewIndex] = { ...updatedReviews[reviewIndex], ...data, id };
  const storage = getLocalStorage();

  if (!storage) {
    return reviews;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updatedReviews));
    return updatedReviews;
  } catch {
    return reviews;
  }
}

export function toggleLike(reviewId: string, userId: string): Review[] {
  const reviews = getReviews();
  const reviewIndex = reviews.findIndex((review) => review.id === reviewId);

  if (reviewIndex === -1) {
    return reviews;
  }

  const review = reviews[reviewIndex];
  const likedBy = review.likedBy.includes(userId)
    ? review.likedBy.filter((id) => id !== userId)
    : [...review.likedBy, userId];
  const updatedReviews = [...reviews];
  updatedReviews[reviewIndex] = { ...review, likedBy };
  const storage = getLocalStorage();

  if (!storage) {
    return reviews;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updatedReviews));
    return updatedReviews;
  } catch {
    return reviews;
  }
}

export function removeReview(id: string): Review[] {
  const reviews = getReviews();
  const updatedReviews = reviews.filter((review) => review.id !== id);

  if (updatedReviews.length === reviews.length) {
    return reviews;
  }

  const storage = getLocalStorage();

  if (!storage) {
    return reviews;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updatedReviews));
    return updatedReviews;
  } catch {
    return reviews;
  }
}
