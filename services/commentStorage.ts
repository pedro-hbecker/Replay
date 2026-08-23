import type { Comment } from '../types/comment';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'app-comments';

type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem'>;

function getLocalStorage(): LocalStorageLike | null {
  if (typeof globalThis === 'undefined') return null;
  const storage = (globalThis as typeof globalThis & { localStorage?: LocalStorageLike }).localStorage;
  return storage ?? null;
}

async function persist(comments: Comment[]): Promise<void> {
  const storage = getLocalStorage();
  if (storage) {
    storage.setItem(STORAGE_KEY, JSON.stringify(comments));
  } else {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
  }
}

export async function getComments(): Promise<Comment[]> {
  const storage = getLocalStorage();
  try {
    const storedComments = storage ? storage.getItem(STORAGE_KEY) : await AsyncStorage.getItem(STORAGE_KEY);
    if (!storedComments) return [];
    const parsedComments: unknown = JSON.parse(storedComments);
    return Array.isArray(parsedComments) ? (parsedComments as Comment[]) : [];
  } catch {
    return [];
  }
}

export async function getCommentsByReview(reviewId: string): Promise<Comment[]> {
  return (await getComments()).filter((comment) => comment.reviewId === reviewId);
}

export async function saveComment(comment: Comment): Promise<Comment[]> {
  const comments = await getComments();
  if (comments.some((storedComment) => storedComment.id === comment.id)) return comments;
  const updatedComments = [...comments, comment];
  try {
    await persist(updatedComments);
    return updatedComments;
  } catch {
    return comments;
  }
}

export async function removeComment(id: string): Promise<Comment[]> {
  const comments = await getComments();
  const updatedComments = comments.filter((comment) => comment.id !== id);
  if (updatedComments.length === comments.length) return comments;
  try {
    await persist(updatedComments);
    return updatedComments;
  } catch {
    return comments;
  }
}