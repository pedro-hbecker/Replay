import type { User } from '../types/user';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'app-current-user';

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

export async function getCurrentUser(): Promise<User | null> {
  const storage = getLocalStorage();

  try {
    const storedUser = storage ? storage.getItem(STORAGE_KEY) : await AsyncStorage.getItem(STORAGE_KEY);

    if (!storedUser) {
      return null;
    }

    const parsedUser: unknown = JSON.parse(storedUser);
    return parsedUser && typeof parsedUser === 'object' ? (parsedUser as User) : null;
  } catch {
    return null;
  }
}

export async function saveUser(user: User): Promise<User | null> {
  const storage = getLocalStorage();

  try {
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(user));
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    }
    return user;
  } catch {
    return null;
  }
}

export async function updateUser(data: Partial<User>): Promise<User | null> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  return saveUser({ ...currentUser, ...data, id: currentUser.id });
}
