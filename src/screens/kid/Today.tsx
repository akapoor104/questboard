import { useSession } from '../../app/session.tsx';
import { formatLongDate } from '../../lib/dates.ts';

/** Today (placeholder until T04). */
export function Today() {
  const { me } = useSession();
  return (
    <main className="page">
      <h1>{me ? formatLongDate(me.today) : ''}</h1>
    </main>
  );
}
