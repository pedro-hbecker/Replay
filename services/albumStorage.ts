import type { Album } from '../types/album';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'app-albums';

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

export async function getAlbums(): Promise<Album[]> {
  const storage = getLocalStorage();

  try {
    const storedAlbums = storage ? storage.getItem(STORAGE_KEY) : await AsyncStorage.getItem(STORAGE_KEY);

    if (!storedAlbums) {
      return [];
    }

    const parsedAlbums: unknown = JSON.parse(storedAlbums);
    return Array.isArray(parsedAlbums) ? (parsedAlbums as Album[]) : [];
  } catch {
    return [];
  }
}

export async function saveAlbum(album: Album): Promise<Album[]> {
  const albums = await getAlbums();

  if (albums.some((storedAlbum) => storedAlbum.id === album.id)) {
    return albums;
  }

  const updatedAlbums = [...albums, album];
  const storage = getLocalStorage();

  try {
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(updatedAlbums));
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAlbums));
    }
    return updatedAlbums;
  } catch {
    return albums;
  }
}

export async function updateAlbum(id: string, data: Partial<Omit<Album, 'id'>>): Promise<Album[]> {
  const albums = await getAlbums();
  const albumIndex = albums.findIndex((album) => album.id === id);

  if (albumIndex === -1) {
    return albums;
  }

  const updatedAlbums = [...albums];
  updatedAlbums[albumIndex] = { ...updatedAlbums[albumIndex], ...data, id };
  const storage = getLocalStorage();

  try {
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(updatedAlbums));
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAlbums));
    }
    return updatedAlbums;
  } catch {
    return albums;
  }
}

export async function getAlbumById(id: string): Promise<Album | undefined> {
  return (await getAlbums()).find((album) => album.id === id);
}

export async function removeAlbum(id: string): Promise<Album[]> {
  const albums = await getAlbums();
  const updatedAlbums = albums.filter((album) => album.id !== id);

  if (updatedAlbums.length === albums.length) {
    return albums;
  }

  const storage = getLocalStorage();

  try {
    if (storage) {
      storage.setItem(STORAGE_KEY, JSON.stringify(updatedAlbums));
    } else {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAlbums));
    }
    return updatedAlbums;
  } catch {
    return albums;
  }
}
