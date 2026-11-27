import { useCallback } from 'react';
import type { Api } from '../api/client.ts';
import type { Card } from '../api/types.ts';
import { useToast } from '../components/Toast.tsx';
import { canUndo } from '../lib/cardActions.ts';
import { useAction } from './useLoad.ts';

export interface MarkDoneOptions {
  api: Api;
  role: 'kid' | 'parent';
  /** Today, from the server (board.today or whoami().today). */
  today: string;
  /** Reloads everything the screen shows. */
  reload: () => Promise<void>;
}

/**
 * "Done": one tap records 100 % (no leftover, no form). The toast offers Undo when the
 * server allows a reopen (him: today and yesterday; parents: any day).
 * `markDone` resolves to true when the card was marked done.
 */
export function useMarkDone({ api, role, today, reload }: MarkDoneOptions) {
  const toast = useToast();
  const { run, busy, error, clearError } = useAction(reload);

  const markDone = useCallback(async (card: Card): Promise<boolean> => {
    const result = await run(() => api.resolveCard(card.id, 100));
    if (!result) return false;
    const undo = canUndo(card, today, role) ? {
      label: 'Undo',
      onPress: () => {
        void api.reopenCard(card.id)
          .then(() => toast.show('Undone.'))
          .catch((e: unknown) => toast.showError(e))
          .finally(() => void reload());
      },
    } : undefined;
    toast.show('Done. Nice work.', undo);
    return true;
  }, [api, role, today, reload, run, toast]);

  return { markDone, busy, error, clearError };
}
