import { Link } from 'react-router-dom';
import type { Card } from '../../../api/types.ts';
import type { Categories } from '../../../app/useCategories.ts';
import { CardTile } from '../../../components/CardTile.tsx';
import { Icon } from '../../../components/Icon.tsx';
import { cardCount, splitPool, stackGroups } from '../../../lib/today.ts';
import './StackColumn.css';

interface Props {
  pool: Card[];
  /** The Monday of this week. */
  week: string;
  cats: Categories;
  timeZone: string;
}

/** This week's stack, and anything left in an earlier week's stack. "To today" works from T05. */
export function StackColumn({ pool, week, cats, timeZone }: Props) {
  const { current, older } = splitPool(pool, week);
  const tiles = (cards: Card[], label: string) => stackGroups(cards).map(({ card, more }) => (
    <li key={card.id}>
      <CardTile
        card={card} category={cats.byId.get(card.category_id)} colorClass={cats.colorClass(card.category_id)}
        variant="full" timeZone={timeZone} extra={more > 0 ? `${more} more ${label}` : undefined}
        actions={<button type="button" className="btn btn-small">To today</button>}
      />
    </li>
  ));
  return (
    <section className="today-col stack" aria-labelledby="stack-title">
      <div className="today-colhead">
        <h2 id="stack-title">This week's stack</h2>
        <span className="muted">{cardCount(current.length)}</span>
      </div>
      <p className="today-hint">Planned for any day this week. Move a card to today when you are ready.</p>
      {current.length === 0
        ? <p className="today-empty">Your stack is empty. Add cards from the Library.</p>
        : <ul className="today-list">{tiles(current, 'this week')}</ul>}
      <Link to="/week#library" className="stack-add">
        <Icon name="plus" size={16} />
        <span>Add from the Library</span>
      </Link>
      {older.length > 0 && (
        <>
          <h3 className="label stack-older">Left from earlier weeks</h3>
          <ul className="today-list">{tiles(older, 'like it')}</ul>
        </>
      )}
    </section>
  );
}
