import type { User } from '../types/user';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'app-current-user';
const USERS_STORAGE_KEY = 'app-users';

type LocalStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getLocalStorage(): LocalStorageLike | null {
  if (typeof globalThis === 'undefined') {
    return null;
  }

  const storage = (globalThis as typeof globalThis & {
    localStorage?: LocalStorageLike;
  }).localStorage;

  return storage ?? null;
}

async function readStoredUsers(): Promise<User[]> {
  const storage = getLocalStorage();
  const storedUsers = storage ? storage.getItem(USERS_STORAGE_KEY) : await AsyncStorage.getItem(USERS_STORAGE_KEY);
  if (storedUsers) {
    const parsedUsers: unknown = JSON.parse(storedUsers);
    if (Array.isArray(parsedUsers)) return parsedUsers as User[];
  }

  const currentUser = await getCurrentUser();
  return currentUser ? [currentUser] : [];
}

async function writeStoredUsers(users: User[]): Promise<void> {
  const storage = getLocalStorage();
  if (storage) {
    storage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } else {
    await AsyncStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  }
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

export async function getUserById(id: string): Promise<User | null> {
  try {
    const users = await readStoredUsers();
    return users.find((user) => user.id === id) || null;
  } catch {
    return null;
  }
}

export async function saveUser(user: User): Promise<User | null> {
  const storage = getLocalStorage();

  try {
    const users = await readStoredUsers();
    const normalizedEmail = user.email?.trim().toLowerCase();
    if (normalizedEmail && users.some((storedUser) => storedUser.id !== user.id && storedUser.email?.toLowerCase() === normalizedEmail)) {
      return null;
    }

    const updatedUsers = [...users.filter((storedUser) => storedUser.id !== user.id), user];
    await writeStoredUsers(updatedUsers);
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

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const users = await readStoredUsers();
    const user = users.find((storedUser) => storedUser.email?.toLowerCase() === normalizedEmail && storedUser.password === password);
    if (!user) return null;

    const storage = getLocalStorage();
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

export async function clearCurrentUser(): Promise<void> {
  const storage = getLocalStorage();

  if (storage) {
    storage.removeItem(STORAGE_KEY);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}

export async function updateUser(data: Partial<User>): Promise<User | null> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return null;
  }

  return saveUser({ ...currentUser, ...data, id: currentUser.id });
}

export async function toggleFavoriteAlbum(albumId: string): Promise<{ user: User | null; limitReached: boolean }> {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return { user: null, limitReached: false };
  }

  const currentTop = Array.isArray(currentUser.topAlbumIds) ? currentUser.topAlbumIds : [];

  if (currentTop.includes(albumId)) {
    const updated = { ...currentUser, topAlbumIds: currentTop.filter((id) => id !== albumId) };
    const saved = await saveUser(updated);
    return { user: saved, limitReached: false };
  }

  if (currentTop.length >= 3) {
    return { user: currentUser, limitReached: true };
  }

  const updated = { ...currentUser, topAlbumIds: [...currentTop, albumId] };
  const saved = await saveUser(updated);
  return { user: saved, limitReached: false };
}
