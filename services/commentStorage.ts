import type { Comment } from '../types/comment';

const STORAGE_KEY = 'app-comments';

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

export function getComments(): Comment[] {
  const storage = getLocalStorage();

  if (!storage) {
    return [];
  }

  try {
    const storedComments = storage.getItem(STORAGE_KEY);

    if (!storedComments) {
      return [];
    }

    const parsedComments: unknown = JSON.parse(storedComments);
    return Array.isArray(parsedComments) ? (parsedComments as Comment[]) : [];
  } catch {
    return [];
  }
}

export function getCommentsByReview(reviewId: string): Comment[] {
  return getComments().filter((comment) => comment.reviewId === reviewId);
}

export function saveComment(comment: Comment): Comment[] {
  const comments = getComments();

  if (comments.some((storedComment) => storedComment.id === comment.id)) {
    return comments;
  }

  const updatedComments = [...comments, comment];
  const storage = getLocalStorage();

  if (!storage) {
    return comments;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updatedComments));
    return updatedComments;
  } catch {
    return comments;
  }
}

export function removeComment(id: string): Comment[] {
  const comments = getComments();
  const updatedComments = comments.filter((comment) => comment.id !== id);

  if (updatedComments.length === comments.length) {
    return comments;
  }

  const storage = getLocalStorage();

  if (!storage) {
    return comments;
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(updatedComments));
    return updatedComments;
  } catch {
    return comments;
  }
}
