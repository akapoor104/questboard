import { useEffect, useRef, useState } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Categories } from '../../../app/useCategories.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { Icon } from '../../../components/Icon.tsx';
import { Sheet } from '../../../components/Sheet.tsx';
import type { MustGroup } from '../../../lib/board.ts';
import { mustDoMeta, mustDoStatus, removable } from '../../../lib/parentPlan.ts';
import './MustDoSheet.css';

export interface MustDoSheetProps {
  api: Api;
  childId: string;
  role: 'kid' | 'parent';
  /** The newest copy of the group (the screen hands it in after every reload). */
  group: MustGroup;
  cats: Categories;
  reload: () => Promise<void>;
  onClose: () => void;
}

/** One must-do group: remove one copy, or every copy that is still open. Finished ones stay. */
export function MustDoSheet({ api, group, cats, reload, onClose }: MustDoSheetProps) {
  const { run, busy, error } = useAction(reload);
  const [confirming, setConfirming] = useState(false);
  const open = removable(group);
  const cat = cats.byId.get(group.category_id);
  const oneRef = useRef<HTMLButtonElement>(null);
  const allRef = useRef<HTMLButtonElement>(null);
  const yesRef = useRef<HTMLButtonElement>(null);
  const noteRef = useRef<HTMLParagraphElement>(null);
  /** The pressed button may be disabled or gone afterwards: say where focus goes next. */
  const [focusTo, setFocusTo] = useState<'one' | 'all' | 'yes' | null>(null);

  useEffect(() => {
    if (busy || focusTo === null) return;
    const target = { one: oneRef, all: allRef, yes: yesRef }[focusTo].current ?? noteRef.current;
    target?.focus();
    setFocusTo(null);
  }, [busy, focusTo, confirming, open.length]);

  const removeOne = async () => {
    const first = open[0];
    if (!first) return;
    await run(() => api.deleteCard(first.id));
    setFocusTo('one');
  };
  const removeAll = async () => {
    // One by one: each delete is its own change; stop at the first refusal.
    await run(async () => {
      for (const c of open) await api.deleteCard(c.id);
    });
    setConfirming(false);
    setFocusTo('all');
  };
  const ask = (on: boolean) => {
    setConfirming(on);
    setFocusTo(on ? 'yes' : 'all');
  };

  return (
    <Sheet title={group.title} onClose={onClose}>
      <p className={`mustdosheet-meta ${cats.colorClass(group.category_id)}`}>
        <span className="mustdosheet-cat"><Icon name={cat?.icon ?? 'star'} size={16} />{cat?.name ?? 'Other'}</span>
        <span>{mustDoMeta(group)}</span>
        <span>{mustDoStatus(group)}</span>
      </p>
      {open.length === 0 ? (
        <p ref={noteRef} tabIndex={-1} className="mustdosheet-note">
          All of these are finished. Finished cards stay on the board.
        </p>
      ) : confirming ? (
        <div className="mustdosheet-confirm">
          <p className="mustdosheet-ask">
            {open.length === 1 ? 'Remove the 1 open card?' : `Remove all ${open.length} open cards?`}
            {' '}Finished ones stay.
          </p>
          <div className="mustdosheet-buttons">
            <button type="button" className="btn" disabled={busy} onClick={() => ask(false)}>Keep them</button>
            <button ref={yesRef} type="button" className="btn btn-primary" disabled={busy} onClick={() => void removeAll()}>
              Remove them
            </button>
          </div>
        </div>
      ) : (
        <div className="mustdosheet-buttons">
          <button ref={oneRef} type="button" className="btn" disabled={busy} onClick={() => void removeOne()}>
            Remove one
          </button>
          <button ref={allRef} type="button" className="btn" disabled={busy} onClick={() => ask(true)}>
            Remove all that are still open
          </button>
        </div>
      )}
      {error !== null && <p role="alert" className="mustdosheet-error">{errorText(error)}</p>}
    </Sheet>
  );
}
