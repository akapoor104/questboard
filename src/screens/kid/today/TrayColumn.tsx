import type { Card } from '../../../api/types.ts';
import type { Categories } from '../../../app/useCategories.ts';
import { CardTile } from '../../../components/CardTile.tsx';
import type { CardAction } from '../../../lib/cardActions.ts';
import { formatDuration } from '../../../lib/dates.ts';
import { cardCount, trayOrigin, trayOriginText } from '../../../lib/today.ts';

interface Props {
  tray: Card[];
  /** Every loaded day card, to say where a leftover came from. */
  cards: Card[];
  cats: Categories;
  timeZone: string;
  /** Opens the card sheet, or one of its forms. */
  onOpen: (card: Card, start?: CardAction) => void;
}

/** The Catch-up tray. */
export function TrayColumn({ tray, cards, cats, timeZone, onOpen }: Props) {
  const minutes = tray.reduce((s, c) => s + c.minutes, 0);
  return (
    <section className="today-col" aria-labelledby="tray-title">
      <div className="today-colhead">
        <h2 id="tray-title">Catch-up tray</h2>
        <span className="muted">{cardCount(tray.length)} · {formatDuration(minutes)}</span>
      </div>
      <p className="today-hint">Leftovers wait here until you give them a new time.</p>
      {tray.length === 0 ? <p className="today-empty">Nothing left over. Nice.</p> : (
        <ul className="today-list">
          {tray.map((card) => {
            const origin = trayOrigin(card, cards);
            return (
              <li key={card.id}>
                <CardTile
                  card={card} category={cats.byId.get(card.category_id)} colorClass={cats.colorClass(card.category_id)}
                  variant="full" timeZone={timeZone} extra={origin ? trayOriginText(origin) : undefined} wideActions
                  onOpen={() => onOpen(card)}
                  actions={(
                    <>
                      <button type="button" className="btn btn-primary" onClick={() => onOpen(card, 'give_time')}>Give it a time</button>
                      {card.drop_requested_at === null && (
                        <button type="button" className="btn" onClick={() => onOpen(card, card.kind === 'must' ? 'ask_drop' : 'drop')}>
                          {card.kind === 'must' ? 'Ask to drop' : 'Drop it'}
                        </button>
                      )}
                    </>
                  )}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
