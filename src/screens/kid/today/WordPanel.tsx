import type { WordOfDay } from '../../../api/types.ts';
import './WordPanel.css';

/** The word of the day. The "I used it today" button arrives in T06. */
export function WordPanel({ word }: { word: WordOfDay }) {
  return (
    <section className="word" aria-labelledby="word-title">
      <h2 id="word-title" className="word-label">Word of the day</h2>
      <p className="word-head">
        <span className="word-word">{word.word}</span>
        <span className="word-pos">{word.part_of_speech}</span>
      </p>
      <p className="word-def">{word.definition}</p>
      <p className="word-example">"{word.example}"</p>
    </section>
  );
}
