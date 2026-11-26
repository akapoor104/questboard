import { useId, useState, type ReactNode } from 'react';
import type { Api } from '../api/client.ts';
import type { Board, Card, CardPatch } from '../api/types.ts';
import { errorText } from '../app/errors.ts';
import type { Categories } from '../app/useCategories.ts';
import { useAction } from '../app/useLoad.ts';
import { ACTION_LABEL, cardActions, whereText, type CardAction } from '../lib/cardActions.ts';
import { formatClock, minutesInZone } from '../lib/dates.ts';
import { pctText } from '../lib/today.ts';
import { EditCardForm } from './EditCardForm.tsx';
import { Icon } from './Icon.tsx';
import { PlaceForm, type Place } from './PlaceForm.tsx';
import { ResolveDialog } from './ResolveDialog.tsx';
import { Sheet } from './Sheet.tsx';
import { useToast } from './Toast.tsx';
import './CardSheet.css';

type View = 'menu' | 'move' | 'give_time' | 'resolve' | 'edit' | 'drop' | 'ask_drop';

export interface CardSheetProps {
  card: Card;
  board: Board;
  role: 'kid' | 'parent';
  api: Api;
  /** Reloads everything the screen shows; called after every change. */
  reload: () => Promise<void>;
  onClose: () => void;
  cats: Categories;
  /** The family's day and time zone, from whoami(). */
  settings: { day_start_min: number; day_end_min: number };
  timeZone: string;
  /** Open straight on one action's form (an inline button on a card) instead of the card details. */
  start?: CardAction;
  /** The days "Move" offers (default: today and the next six). */
  placeDays?: { date: string; label: string }[];
  /** The week whose stack "This week's stack" means (default: this week). */
  stackWeek?: string;
}

function viewFor(action: CardAction | undefined): View {
  switch (action) {
    case 'move': case 'give_time': case 'resolve': case 'edit': case 'drop': case 'ask_drop': return action;
    default: return 'menu';
  }
}

/** Tap a card: its details and one button per thing he can do with it. */
export function CardSheet(props: CardSheetProps) {
  const { card, board, role, api, reload, onClose, cats, settings, timeZone, start, placeDays, stackWeek } = props;
  const id = useId();
  const toast = useToast();
  const { run, busy, error, clearError } = useAction(reload);
  const [view, setView] = useState<View>(() => viewFor(start));
  const [reason, setReason] = useState('');
  const category = cats.byId.get(card.category_id);
  const colorClass = cats.colorClass(card.category_id);

  const show = (v: View) => {
    clearError();
    setView(v);
  };
  /** Cancel inside a form: back to the details, or closed when the form was opened directly. */
  const back = () => (start && viewFor(start) !== 'menu' ? onClose() : show('menu'));

  /** Runs a change; on success shows `done` (if any) and closes. On failure the sheet stays with the error. */
  const change = async (call: () => Promise<unknown>, done?: string) => {
    const ok = await run(async () => { await call(); return true; });
    if (!ok) return;
    if (done) toast.show(done);
    onClose();
  };

  const press = (a: CardAction) => {
    switch (a) {
      case 'start': return void change(() => api.startCard(card.id));
      case 'stop': return void change(() => api.stopCard(card.id));
      case 'to_today': return void change(() => api.placeCard(card.id, { place: 'day', date: board.today }), 'Moved to today.');
      case 'undo': return void change(() => api.reopenCard(card.id), 'Undone.');
      default: return show(viewFor(a));
    }
  };

  const place = (p: Place) => void change(
    () => api.placeCard(card.id, p.place === 'week' ? { place: 'week', week_start: stackWeek } : { place: 'day', date: p.date, start_min: p.start_min }),
    p.place === 'week' ? "Back in this week's stack." : 'Moved.',
  );
  const edit = (patch: CardPatch) => {
    if (Object.keys(patch).length === 0) return onClose();
    void change(() => api.updateCard(card.id, patch), 'Saved.');
  };

  if (view === 'resolve') {
    return (
      <ResolveDialog
        key="resolve" card={card} board={board} role={role} api={api} reload={reload} category={category}
        colorClass={colorClass} settings={settings} timeZone={timeZone} onClose={onClose}
      />
    );
  }

  const problem = error !== null && <p role="alert" className="cardsheet-error">{errorText(error)}</p>;
  let body: ReactNode;

  if (view === 'move' || view === 'give_time') {
    body = (
      <PlaceForm
        card={card} board={board} settings={settings} timeZone={timeZone} allowStack={view === 'move' && card.place !== 'tray'}
        initialDate={card.place === 'day' && card.date !== null ? card.date : board.today} onSave={place} busy={busy}
        days={placeDays}
      />
    );
  } else if (view === 'edit') {
    body = <EditCardForm card={card} categories={cats.categories} busy={busy} onSave={edit} onCancel={back} />;
  } else if (view === 'drop') {
    body = (
      <>
        <p className="cardsheet-ask">Drop this card?</p>
        <div className="cardsheet-buttons">
          <button type="button" className="btn btn-primary" disabled={busy}
            onClick={() => void change(() => api.dropCard(card.id), 'Dropped.')}>Drop it</button>
          <button type="button" className="btn" onClick={back}>Keep it</button>
        </div>
      </>
    );
  } else if (view === 'ask_drop') {
    body = (
      <form className="cardsheet-form" onSubmit={(e) => {
        e.preventDefault();
        void change(() => api.dropCard(card.id, reason.trim() || undefined), 'Asked. A parent will decide.');
      }}>
        <label htmlFor={`${id}-why`} className="cardsheet-label">Why should it go? (optional)</label>
        <input id={`${id}-why`} className="cardsheet-input" type="text" maxLength={500} value={reason}
          onChange={(e) => setReason(e.target.value)} />
        <div className="cardsheet-buttons">
          <button type="submit" className="btn btn-primary" disabled={busy}>Ask a parent</button>
          <button type="button" className="btn" onClick={back}>Cancel</button>
        </div>
      </form>
    );
  } else {
    const actions = cardActions(card, board.today, role);
    const doing = card.doing_since !== null && card.status === 'open';
    body = (
      <>
        <div className="cardsheet-facts">
          <span className={`chip cardsheet-cat ${colorClass}`}>
            <Icon name={category?.icon ?? 'star'} size={16} />{category?.name ?? 'Other'}
          </span>
          <p className="cardsheet-where">{whereText(card, board.today)}</p>
          {doing && (
            <p className="cardsheet-doing">
              Doing now · started {formatClock(minutesInZone(Date.parse(card.doing_since as string), timeZone))}
            </p>
          )}
          {card.details && <p className="cardsheet-details">{card.details}</p>}
          <p className="cardsheet-kind">
            {card.kind === 'must' ? <><Icon name="pin" size={16} />Must-do</> : 'My pick'}
          </p>
          {card.status === 'resolved' && card.pct !== null && (
            <p className="cardsheet-result">
              <Icon name="check" size={16} />{pctText(card.pct)}
              {card.note && <span className="cardsheet-note"> "{card.note}"</span>}
            </p>
          )}
          {card.drop_requested_at !== null && card.status === 'open' && (
            <p className="cardsheet-waiting">Waiting for a parent to decide.</p>
          )}
        </div>
        {actions.length > 0 && (
          <div className="cardsheet-actions">
            {actions.map((a) => (
              <button
                key={a} type="button" disabled={busy}
                className={`btn${a === 'resolve' || a === 'to_today' || a === 'give_time' ? ' btn-primary' : ''}`}
                onClick={() => press(a)}
              >
                {ACTION_LABEL[a]}
              </button>
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <Sheet key={view} title={card.title} onClose={onClose}>
      {body}
      {problem}
    </Sheet>
  );
}
