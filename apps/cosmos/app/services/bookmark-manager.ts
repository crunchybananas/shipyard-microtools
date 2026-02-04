export interface Bookmark {
  id: number;
  name: string;
  x: number;
  y: number;
  zoom: number;
  timestamp: string;
}

const STORAGE_KEY = "cosmos_bookmarks";

export function getBookmarks(): Bookmark[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]") as Bookmark[];
  } catch {
    return [];
  }
}

export function saveBookmark(
  name: string,
  x: number,
  y: number,
  zoom: number,
): Bookmark {
  const bookmarks = getBookmarks();

  const bookmark: Bookmark = {
    id: Date.now(),
    name,
    x,
    y,
    zoom,
    timestamp: new Date().toISOString(),
  };

  bookmarks.push(bookmark);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));

  return bookmark;
}

export function deleteBookmark(id: number): void {
  const bookmarks = getBookmarks().filter((b) => b.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(bookmarks));
}

export function getBookmarkById(id: number): Bookmark | undefined {
  return getBookmarks().find((b) => b.id === id);
}
