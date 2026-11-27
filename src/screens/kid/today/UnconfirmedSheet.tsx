import { useState } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Board, Card } from '../../../api/types.ts';
import type { Categories } from '../../../app/useCategories.ts';
import { useMarkDone } from '../../../app/useMarkDone.ts';
import { CardTile } from '../../../components/CardTile.tsx';
import { ResolveDialog } from '../../../components/ResolveDialog.tsx';
import { Sheet } from '../../../components/Sheet.tsx';
import { errorText } from '../../../app/errors.ts';
import { formatLongDate } from '../../../lib/dates.ts';
import './UnconfirmedSheet.css';

export interface UnconfirmedSheetProps {
  board: Board;
  api: Api;
  role: 'kid' | 'parent';
  reload: () => Promise<void>;
  cats: Categories;
  settings: { day_start_min: number; day_end_min: number };
  timeZone: string;
  onClose: () => void;
}

/** Open cards on earlier days, by date, each with "Done" and "How did it go?". */
export function UnconfirmedSheet(props: UnconfirmedSheetProps) {
  const { board, api, role, reload, cats, settings, timeZone, onClose } = props;
  const [resolving, setResolving] = useState<string | null>(null);
  const done = useMarkDone({ api, role, today: board.today, reload });

  const current = resolving ? board.unconfirmed.find((c) => c.id === resolving) : undefined;
  if (current) {
    return (
      <ResolveDialog
        card={current} board={board} role={role} api={api} reload={reload}
        category={cats.byId.get(current.category_id)} colorClass={cats.colorClass(current.category_id)}
        settings={settings} timeZone={timeZone} onClose={() => setResolving(null)}
      />
    );
  }

  const byDate = new Map<string, Card[]>();
  for (const c of [...board.unconfirmed].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.seq - b.seq)) {
    const key = c.date ?? '';
    byDate.set(key, [...(byDate.get(key) ?? []), c]);
  }

  return (
    <Sheet title="Cards that still need a percent" onClose={onClose}>
      {done.error !== null && <p role="alert" className="unconfirmed-error">{errorText(done.error)}</p>}
      {byDate.size === 0 ? (
        <>
          <p className="unconfirmed-done">All sorted. Nice.</p>
          <button type="button" className="btn btn-primary" onClick={onClose}>Close</button>
        </>
      ) : (
        [...byDate].map(([date, cards]) => (
          <section key={date} className="unconfirmed-day" aria-label={date ? formatLongDate(date) : 'Earlier'}>
            <h3 className="unconfirmed-date">{date ? formatLongDate(date) : 'Earlier'}</h3>
            <ul className="unconfirmed-list">
              {cards.map((c) => (
                <li key={c.id}>
                  <CardTile
                    card={c} category={cats.byId.get(c.category_id)} colorClass={cats.colorClass(c.category_id)}
                    variant="row" timeZone={timeZone} onOpen={() => setResolving(c.id)}
                    actions={
                      <>
                        <button type="button" className="btn btn-small btn-primary" disabled={done.busy}
                          onClick={() => void done.markDone(c)}>
                          Done
                        </button>
                        <button type="button" className="btn btn-small" onClick={() => setResolving(c.id)}>
                          How did it go?
                        </button>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </Sheet>
  );
}
