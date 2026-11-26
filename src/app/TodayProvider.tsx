import { createContext, useContext, type ReactNode } from 'react';
import type { Today } from '../api/types.ts';
import { useChild, useSession } from './session.tsx';
import { useLoad, type Loaded } from './useLoad.ts';

const TodayContext = createContext<Loaded<Today> | null>(null);

/**
 * Loads getToday() once for his screens: the top bar shows the campfire from it and
 * Today shows the rest. Lives in the kid layout, inside DeviceGate.
 */
export function TodayProvider({ children }: { children: ReactNode }) {
  const { api } = useSession();
  const child = useChild();
  const today = useLoad(() => api.getToday(child.id), [child.id]);
  return <TodayContext.Provider value={today}>{children}</TodayContext.Provider>;
}

export function useTodayData(): Loaded<Today> {
  const t = useContext(TodayContext);
  if (!t) throw new Error('useTodayData must be used inside <TodayProvider>');
  return t;
}
