import { useEffect, useState } from 'react';
import type { Board, Card } from '../../api/types.ts';
import { useSession, useChild } from '../../app/session.tsx';
import { useTodayData } from '../../app/TodayProvider.tsx';
import { useCategories } from '../../app/useCategories.ts';
import { useCardDrop } from '../../app/useDrag.ts';
import { useAction, useLoad } from '../../app/useLoad.ts';
import { ErrorPanel } from '../../components/ErrorPanel.tsx';
import { usePageTitle } from '../../components/usePageTitle.ts';
import { CardSheet } from '../../components/CardSheet.tsx';
import { useToast } from '../../components/Toast.tsx';
import type { CardAction } from '../../lib/cardActions.ts';
import { addDays, formatLongDate, monday } from '../../lib/dates.ts';
import { openCount } from '../../lib/today.ts';
import { CloseOutDialog } from './today/CloseOutDialog.tsx';
import { CloseOutPanel } from './today/CloseOutPanel.tsx';
import { DayTimeline } from './today/DayTimeline.tsx';
import { Reminders } from './today/Reminders.tsx';
import { StackColumn } from './today/StackColumn.tsx';
import { TimeBar } from './today/TimeBar.tsx';
import { TrayColumn } from './today/TrayColumn.tsx';
import { UnconfirmedSheet } from './today/UnconfirmedSheet.tsx';
import { WordPanel } from './today/WordPanel.tsx';
import './Today.css';

/** The newest copy of a card in the board, wherever it now sits. */
function findCard(b: Board, id: string): Card | undefined {
  for (const list of [b.cards, b.pool, b.tray, b.unconfirmed, b.drop_requests]) {
    const c = list.find((x) => x.id === id);
    if (c) return c;
  }
  return undefined;
}

/** His Today screen. Tap a card for its sheet; the inline buttons are shortcuts into it. */
export function Today() {
  usePageTitle('Today');
  const { api, me } = useSession();
  if (!me) throw new Error('Today needs an unlocked device');
  const child = useChild();
  const toast = useToast();
  const week = monday(me.today);
  // Four weeks back, so leftovers can say where they came from and nothing left in an
  // older stack is lost from view. Today's cards are the ones with date === board.today.
  const board = useLoad(() => api.getBoard(child.id, addDays(week, -28), addDays(week, 6)), [child.id, week]);
  const today = useTodayData();
  const cats = useCategories();
  const [open, setOpen] = useState<{ card: Card; start?: CardAction } | null>(null);
  /** The other dialogs Today can show (one at a time, never with the card sheet). */
  const [dialog, setDialog] = useState<'closeout' | 'unconfirmed' | null>(null);

  const reload = async () => {
    await Promise.all([board.reload(), today.reload()]);
  };
  const quick = useAction(reload);
  // Drag and drop (T16): from the stack or the day onto a time on the timeline.
  const drop = useCardDrop({ api, role: 'kid', today: me.today, stackWeek: null, reload, toast });
  useEffect(() => {
    if (quick.error !== null) toast.showError(quick.error);
  }, [quick.error, toast]);

  const loads = [board, today, cats.library];
  const reloadAll = () => { for (const l of loads) void l.reload(); };
  const failed = loads.find((l) => l.error);

  if (!board.data || !today.data || !cats.library.data) {
    return (
      <main id="main" className="page today-page">
        {failed ? (
          <ErrorPanel error={failed.error} onRetry={reloadAll} />
        ) : <p className="muted">Loading...</p>}
      </main>
    );
  }

  const b = board.data;
  const t = today.data;
  const todayCards = b.cards.filter((c) => c.date === b.today);
  const openCard = (card: Card, start?: CardAction) => setOpen({ card, start });
  const closeout = b.closeouts.find((c) => c.date === b.today) ?? null;
  const toToday = (card: Card) => {
    void quick.run(() => api.placeCard(card.id, { place: 'day', date: b.today }))
      .then((r) => { if (r) toast.show('Moved to today.'); });
  };
  // The sheet always shows the server's latest copy of its card.
  const sheetCard = open ? findCard(b, open.card.id) ?? open.card : null;

  return (
    <main id="main" className="page today-page">
      {failed && (
        <ErrorPanel error={failed.error} onRetry={reloadAll} className="today-wide" />
      )}
      <div className="today">
        <div className="today-head">
          <div>
            <h1 className="today-title">{formatLongDate(b.today)}</h1>
            <p className="today-cheer" data-testid="encouragement">{t.encouragement ?? 'One card at a time.'}</p>
          </div>
          {t.parent_note && (
            <div className="panel today-note">
              <span className="label">A note from Mom or Dad</span>
              <p>{t.parent_note}</p>
            </div>
          )}
          <TimeBar cards={todayCards} cats={cats} />
        </div>
        {t.word && <div className="today-word"><WordPanel word={t.word} api={api} childId={child.id} reload={today.reload} /></div>}
        <div className="today-alerts">
          <Reminders
            alerts={t.alerts} board={b} cats={cats} timeZone={me.timezone}
            onSortOut={() => setDialog('unconfirmed')} onGiveDay={(card) => openCard(card, 'give_time')}
          />
        </div>
        <div className="today-stack">
          <StackColumn
            pool={b.pool} week={week} cats={cats} timeZone={me.timezone} onOpen={openCard} onToToday={toToday} busy={quick.busy} drop={drop}
          />
        </div>
        <div className="today-day">
          <DayTimeline
            date={b.today} cards={todayCards} dayStartMin={me.day_start_min} dayEndMin={me.day_end_min} cats={cats} timeZone={me.timezone}
            onOpen={openCard} drop={drop}
          />
        </div>
        <div className="today-side">
          <TrayColumn tray={b.tray} cards={b.cards} cats={cats} timeZone={me.timezone} onOpen={openCard} />
          <CloseOutPanel open={openCount(b.cards, b.today)} closed={closeout !== null} onOpen={() => setDialog('closeout')} />
        </div>
      </div>
      {open && sheetCard && (
        <CardSheet
          key={open.card.id + (open.start ?? '')} card={sheetCard} board={b} role="kid" api={api} reload={reload}
          onClose={() => setOpen(null)} cats={cats} settings={me} timeZone={me.timezone} start={open.start}
        />
      )}
      {dialog === 'closeout' && (
        <CloseOutDialog api={api} childId={child.id} closeout={closeout} reload={reload} onClose={() => setDialog(null)} />
      )}
      {dialog === 'unconfirmed' && (
        <UnconfirmedSheet
          board={b} api={api} role="kid" reload={reload} cats={cats} settings={me} timeZone={me.timezone}
          onClose={() => setDialog(null)}
        />
      )}
    </main>
  );
}
