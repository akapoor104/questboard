import type { Alert, Board } from '../../../api/types.ts';
import { Icon } from '../../../components/Icon.tsx';
import { dueSoonCards } from '../../../lib/board.ts';
import { dueSoonText, unconfirmedText } from '../../../lib/today.ts';
import './Reminders.css';

/** His reminders: cards that still need a percent, and must-dos due soon. The buttons work from T06. */
export function Reminders({ alerts, board }: { alerts: Alert[]; board: Board }) {
  const shown = alerts.filter((a) => a.type === 'unconfirmed' || a.type === 'due_soon');
  if (shown.length === 0) return null;
  return (
    <section className="reminders" aria-label="Reminders">
      {shown.map((a) => {
        let text: string;
        let button: string;
        if (a.type === 'unconfirmed') {
          text = unconfirmedText(a.count);
          button = 'Sort them out';
        } else {
          const cards = dueSoonCards(board);
          text = dueSoonText(a.count, cards);
          button = a.count === 1 && cards.length === 1 ? 'Give it a day' : 'Show them';
        }
        return (
          <div key={a.type} className="reminders-row" data-testid={`alert-${a.type}`}>
            <Icon name="clock" />
            <span className="reminders-text">{text}</span>
            <button type="button" className="btn reminders-btn">{button}</button>
          </div>
        );
      })}
    </section>
  );
}
