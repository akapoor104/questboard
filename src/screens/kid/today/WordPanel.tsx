import { useEffect } from 'react';
import type { Api } from '../../../api/client.ts';
import type { WordOfDay } from '../../../api/types.ts';
import { useAction } from '../../../app/useLoad.ts';
import { Icon } from '../../../components/Icon.tsx';
import { useToast } from '../../../components/Toast.tsx';
import './WordPanel.css';

export interface WordPanelProps {
  word: WordOfDay;
  api: Api;
  childId: string;
  /** Reloads getToday(). */
  reload: () => Promise<void>;
}

/** The word of the day, and "I used it today". */
export function WordPanel({ word, api, childId, reload }: WordPanelProps) {
  const toast = useToast();
  const { run, busy, error } = useAction(reload);
  useEffect(() => {
    if (error !== null) toast.showError(error);
  }, [error, toast]);

  return (
    <section className="word" aria-labelledby="word-title">
      <h2 id="word-title" className="word-label">Word of the day</h2>
      <p className="word-head">
        <span className="word-word">{word.word}</span>
        <span className="word-pos">{word.part_of_speech}</span>
      </p>
      <p className="word-def">{word.definition}</p>
      <p className="word-example">"{word.example}"</p>
      <button
        type="button" className="word-used" aria-pressed={word.used} disabled={busy} onClick={() => void run(() => api.markWordUsed(childId, !word.used))}
      >
        {word.used && <Icon name="check" size={18} />}
        {word.used ? 'Used today' : 'I used it today'}
      </button>
    </section>
  );
}
