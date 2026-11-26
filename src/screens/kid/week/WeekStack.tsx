import { useId } from 'react';
import type { Card } from '../../../api/types.ts';
import type { Categories } from '../../../app/useCategories.ts';
import type { CardDrop } from '../../../app/useDrag.ts';
import { CardTile } from '../../../components/CardTile.tsx';
import { formatDuration } from '../../../lib/dates.ts';
import { cardCount, stackGroups } from '../../../lib/today.ts';
import './WeekStack.css';

interface Props {
  /** The shown week's stack cards. */
  cards: Card[];
  cats: Categories;
  timeZone: string;
  onOpen: (card: Card) => void;
  /** Drag and drop: the stack is a drop target and its cards can be dragged (T16). */
  drop?: CardDrop;
}

/** "Any day this week": the week's stack as rows. Tap a card to give it a day. */
export function WeekStack({ cards, cats, timeZone, onOpen, drop }: Props) {
  const id = useId();
  const groups = stackGroups(cards);
  return (
    <section className="panel weekstack" aria-labelledby={`${id}-title`} data-drop={drop ? 'week' : undefined}>
      <div className="weekstack-head">
        <h2 id={`${id}-title`}>Any day this week</h2>
        <span className="muted">{cardCount(cards.length)}</span>
        <p className="weekstack-hint">Drag a card onto a day, or tap it to choose a day and time.</p>
      </div>
      {groups.length === 0
        ? <p className="weekstack-empty">Nothing waiting for a day. Add cards from the Library below.</p>
        : (
          <ul className="weekstack-list">
            {groups.map(({ card, more }) => (
              <li key={card.id}>
                <CardTile
                  card={card} category={cats.byId.get(card.category_id)} colorClass={cats.colorClass(card.category_id)}
                  variant="row" timeZone={timeZone} onOpen={() => onOpen(card)} drop={drop}
                  extra={[formatDuration(card.minutes), ...(more > 0 ? [`${more} more`] : [])].join(' · ')}
                />
              </li>
            ))}
          </ul>
        )}
    </section>
  );
}
