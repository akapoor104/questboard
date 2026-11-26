import { useState } from 'react';
import type { Alert, Board, Card } from '../../../api/types.ts';
import type { Categories } from '../../../app/useCategories.ts';
import { CardTile } from '../../../components/CardTile.tsx';
import { Icon } from '../../../components/Icon.tsx';
import { Sheet } from '../../../components/Sheet.tsx';
import { dueSoonCards } from '../../../lib/board.ts';
import { dueSoonText, unconfirmedText } from '../../../lib/today.ts';
import './Reminders.css';

export interface RemindersProps {
  alerts: Alert[];
  board: Board;
  cats: Categories;
  timeZone: string;
  /** "Sort them out": the cards from earlier days. */
  onSortOut: () => void;
  /** "Give it a day" on a must-do that is due soon. */
  onGiveDay: (card: Card) => void;
}

/** His reminders: cards that still need a percent, and must-dos due soon. */
export function Reminders({ alerts, board, cats, timeZone, onSortOut, onGiveDay }: RemindersProps) {
  const [listOpen, setListOpen] = useState(false);
  const shown = alerts.filter((a) => a.type === 'unconfirmed' || a.type === 'due_soon');
  const due = dueSoonCards(board);
  if (shown.length === 0) return null;

  return (
    <section className="reminders" aria-label="Reminders">
      {shown.map((a) => {
        let text: string;
        let button: string;
        let press: () => void;
        if (a.type === 'unconfirmed') {
          text = unconfirmedText(a.count);
          button = 'Sort them out';
          press = onSortOut;
        } else {
          text = dueSoonText(a.count, due);
          const one = a.count === 1 && due.length === 1;
          button = one ? 'Give it a day' : 'Show them';
          press = one ? () => onGiveDay(due[0]) : () => setListOpen(true);
        }
        return (
          <div key={a.type} className="reminders-row" data-testid={`alert-${a.type}`}>
            <Icon name="clock" />
            <span className="reminders-text">{text}</span>
            <button type="button" className="btn reminders-btn" onClick={press}>{button}</button>
          </div>
        );
      })}
      {listOpen && (
        <Sheet title="Must-dos due soon" onClose={() => setListOpen(false)}>
          {due.length === 0 ? (
            <>
              <p className="reminders-done">Every one of them has a day now.</p>
              <button type="button" className="btn btn-primary" onClick={() => setListOpen(false)}>Close</button>
            </>
          ) : (
            <ul className="reminders-list">
              {due.map((c) => {
                const give = () => {
                  setListOpen(false);
                  onGiveDay(c);
                };
                return (
                  <li key={c.id}>
                    <CardTile
                      card={c} category={cats.byId.get(c.category_id)} colorClass={cats.colorClass(c.category_id)}
                      variant="row" timeZone={timeZone} onOpen={give}
                      actions={<button type="button" className="btn btn-small btn-primary" onClick={give}>Give it a day</button>}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Sheet>
      )}
    </section>
  );
}
