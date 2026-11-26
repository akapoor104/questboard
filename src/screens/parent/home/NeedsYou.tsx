import { useId } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Board, Card } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { Icon } from '../../../components/Icon.tsx';
import { useToast } from '../../../components/Toast.tsx';
import { dueSoonCards } from '../../../lib/board.ts';
import { dropRequestLine, dueSoonLine, trayLine, unconfirmedLine } from '../../../lib/parentHome.ts';
import './NeedsYou.css';

export interface NeedsYouProps {
  api: Api;
  childId: string;
  role: 'parent';
  /** This week's board: drop requests, unconfirmed cards, due-soon must-dos and the tray. */
  board: Board;
  /** `catchup_alert_threshold` from getSettings(). */
  threshold: number;
  reload: () => Promise<void>;
  /** Opens the card sheet on a drop request's card. */
  onOpenCard: (card: Card) => void;
}

/** "Needs you": what is waiting for a parent right now, and the Catch-up tray line. */
export function NeedsYou({ api, board, threshold, reload, onOpenCard }: NeedsYouProps) {
  const id = useId();
  const toast = useToast();
  const { run, busy, error } = useAction(reload);
  const requests = board.drop_requests;
  const unconfirmed = board.unconfirmed.length;
  const dueSoon = dueSoonCards(board);
  const trayMinutes = board.tray.reduce((sum, c) => sum + c.minutes, 0);
  const tray = trayLine(board.tray.length, trayMinutes, threshold);
  const nothing = requests.length === 0 && unconfirmed === 0 && dueSoon.length === 0 && !tray.alert;

  const decide = async (card: Card, approve: boolean) => {
    const done = await run(() => api.decideDrop(card.id, approve));
    if (done !== undefined) toast.show(approve ? 'Let go.' : 'Kept.');
  };

  return (
    <section className="panel needsyou" aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="label needsyou-title">Needs you</h2>
      {error !== null && <p role="alert" className="page-error">{errorText(error)}</p>}

      {requests.map((card) => {
        const line = dropRequestLine(card);
        return (
          <div key={card.id} className="needsyou-drop" data-testid="drop-request">
            <h3 className="needsyou-drop-title">He asked to drop a must-do</h3>
            <p className="needsyou-drop-line">
              <button type="button" className="needsyou-card" onClick={() => onOpenCard(card)}>{card.title}</button>
              {line.slice(card.title.length)}
            </p>
            <div className="needsyou-drop-buttons">
              <button type="button" className="btn" disabled={busy} onClick={() => void decide(card, false)}>Keep it</button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void decide(card, true)}>
                Let it go
              </button>
            </div>
          </div>
        );
      })}

      {unconfirmed > 0 && <p className="needsyou-line">{unconfirmedLine(unconfirmed)}</p>}
      {dueSoon.map((card) => <p key={card.id} className="needsyou-line">{dueSoonLine(card)}</p>)}
      {nothing && <p className="needsyou-line">Nothing needs you right now.</p>}

      <p
        className={`needsyou-tray${tray.alert ? ' needsyou-tray-alert' : ''}`}
        data-testid={tray.alert ? 'alert-tray' : 'tray-line'}
      >
        <Icon name={tray.alert ? 'alert' : 'tray'} size={18} />
        <span>{tray.text}</span>
      </p>
    </section>
  );
}
