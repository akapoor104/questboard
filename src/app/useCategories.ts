import { useMemo } from 'react';
import type { Category, Library, LibraryItem } from '../api/types.ts';
import { useSession } from './session.tsx';
import { useLoad, type Loaded } from './useLoad.ts';

const COLORS = new Set(['blue', 'orange', 'aqua', 'yellow', 'magenta', 'green', 'violet', 'red', 'slate']);

export interface Categories {
  /** Active categories, in order. Empty until the library has loaded. */
  categories: Category[];
  byId: Map<string, Category>;
  /** `cat-<color>` for a category id; `cat-slate` for unknown ids or colors. */
  colorClass(categoryId: string): string;
  items: LibraryItem[];
  /** The load itself: `loading`, `error`, `reload`. */
  library: Loaded<Library>;
}

/** The library's categories (and items), loaded once per screen. */
export function useCategories(): Categories {
  const { api } = useSession();
  const library = useLoad(() => api.getLibrary(), []);
  const data = library.data;
  const derived = useMemo(() => {
    const categories = (data?.categories ?? []).filter((c) => c.active !== false);
    const byId = new Map(categories.map((c) => [c.id, c]));
    const colorClass = (id: string) => {
      const color = byId.get(id)?.color;
      return color && COLORS.has(color) ? `cat-${color}` : 'cat-slate';
    };
    return { categories, byId, colorClass, items: data?.items ?? [] };
  }, [data]);
  return { ...derived, library };
}
