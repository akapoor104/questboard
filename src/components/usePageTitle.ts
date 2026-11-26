import { useEffect } from 'react';

/** Sets the browser tab's title to `{screen} · Questboard` while the screen is shown. */
export function usePageTitle(screen: string): void {
  useEffect(() => {
    document.title = `${screen} · Questboard`;
  }, [screen]);
}
