import { useId, useState } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Review } from '../../../api/types.ts';
import { Sheet } from '../../../components/Sheet.tsx';
import { useToast } from '../../../components/Toast.tsx';
import { monthDay } from '../../../lib/month.ts';
import { CHECK_IN_FIELDS, CheckInForm } from './CheckInForm.tsx';
import './CheckInPanel.css';

export interface CheckInPanelProps {
  api: Api;
  childId: string;
  role: 'kid' | 'parent';
  /** The Monday of this week (the week a new check-in is for). */
  week: string;
  /** This week's check-in, or null. */
  current: Review | null;
  /** The newest check-in to show: this week's, else last week's, else null. */
  latest: Review | null;
  reload: () => Promise<void>;
}

/** "Sunday check-in": the latest answers, and the button that writes or edits this week's. */
export function CheckInPanel({ api, childId, role, week, current, latest, reload }: CheckInPanelProps) {
  const id = useId();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const answers = CHECK_IN_FIELDS.filter((f) => f.key !== 'notes');
  const action = current ? "Edit this week's check-in" : "Write this week's check-in";

  return (
    <section className="panel checkin" aria-labelledby={`${id}-h`}>
      <div className="checkin-head">
        <h2 id={`${id}-h`} className="checkin-title">Sunday check-in</h2>
        <p className="checkin-hint">You lead it. Four short answers, agreed with Mom and Dad.</p>
      </div>
      {latest ? (
        <>
          <p className="label checkin-week">
            {latest.week_start === week ? 'This week' : `Week of ${monthDay(latest.week_start)}`}
          </p>
          <dl className="checkin-answers">
            {answers.map((f) => (
              <div key={f.key} className="checkin-answer">
                <dt className="label">{f.label}</dt>
                <dd>{latest[f.key] ?? <span className="muted">Nothing written.</span>}</dd>
              </div>
            ))}
          </dl>
          {latest.notes && (
            <p className="checkin-notes"><span className="label">Notes</span> {latest.notes}</p>
          )}
        </>
      ) : (
        <p className="muted checkin-empty">No check-in yet. On Sunday, sit down with Mom or Dad and write the first one.</p>
      )}
      <div>
        <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>{action}</button>
      </div>
      {open && (
        <Sheet title={current ? "Edit this week's check-in" : "This week's check-in"} onClose={() => setOpen(false)}>
          <CheckInForm
            api={api} childId={childId} role={role} week={week} review={current} reload={reload}
            onCancel={() => setOpen(false)}
            onDone={() => { setOpen(false); toast.show('Check-in saved.'); }}
          />
        </Sheet>
      )}
    </section>
  );
}
