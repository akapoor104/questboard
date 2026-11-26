import { useId, useState, type FormEvent } from 'react';
import type { Api } from '../../../api/client.ts';
import type { Settings } from '../../../api/types.ts';
import { errorText } from '../../../app/errors.ts';
import { useAction } from '../../../app/useLoad.ts';
import { useToast } from '../../../components/Toast.tsx';
import { familyForm, familyPatch, timeZoneOptions, type FamilyForm } from '../../../lib/settings.ts';
import './FamilyPanel.css';

interface Props {
  api: Api;
  /** getSettings() as the server has it now. */
  settings: Settings;
  reload: () => Promise<void>;
}

type Field = keyof FamilyForm;

/** "Family": name, time zone, the day's hours, unlock time, the tray alert and the weekly guide. */
export function FamilyPanel({ api, settings, reload }: Props) {
  const id = useId();
  const toast = useToast();
  const { run, busy, error, clearError } = useAction(reload);
  const [form, setForm] = useState<FamilyForm>(() => familyForm(settings));
  const [problem, setProblem] = useState<string | null>(null);

  const set = (field: Field, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setProblem(null);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    const checked = familyPatch(settings, form);
    if ('problem' in checked) return setProblem(checked.problem);
    setProblem(null);
    if (Object.keys(checked.patch).length === 0) {
      toast.show('Nothing to change.');
      return;
    }
    const done = await run(() => api.updateSettings(checked.patch));
    if (done !== undefined) toast.show('Saved.');
  };

  const field = (name: Field, label: string, input: object) => (
    <div className="settings-field">
      <label htmlFor={`${id}-${name}`}>{label}</label>
      <input
        id={`${id}-${name}`} value={form[name]} onChange={(e) => set(name, e.target.value)} {...input}
      />
    </div>
  );

  const message = problem ?? (error !== null ? errorText(error) : null);
  return (
    <section className="panel settings-panel" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="settings-paneltitle">Family</h2>
      <form className="family-form" onSubmit={(e) => void save(e)} noValidate>
        {field('family_name', 'Family name', { type: 'text', maxLength: 60, autoComplete: 'off' })}
        <div className="settings-field">
          <label htmlFor={`${id}-timezone`}>Time zone</label>
          <select id={`${id}-timezone`} value={form.timezone} onChange={(e) => set('timezone', e.target.value)}>
            {timeZoneOptions(settings.timezone).map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </div>
        <div className="family-pair">
          {field('day_start', 'Day starts', { type: 'time', step: 900 })}
          {field('day_end', 'Day ends', { type: 'time', step: 900 })}
        </div>
        {field('unlock_hours', 'Unlock lasts (hours)', { type: 'number', min: 0.5, step: 0.5, inputMode: 'decimal' })}
        {field('tray_alert', 'Alert me when the tray holds (cards)', { type: 'number', min: 1, max: 99, step: 1, inputMode: 'numeric' })}
        {field('weekly_hours', 'Weekly guide for structured time (hours)', { type: 'number', min: 0, step: 0.5, inputMode: 'decimal' })}
        {message && <p role="alert" className="settings-error">{message}</p>}
        <div>
          <button type="submit" className="btn btn-primary" disabled={busy}>Save</button>
        </div>
      </form>
    </section>
  );
}
