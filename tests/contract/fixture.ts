// A small family used by every contract test. Same shape as a backup file,
// plus a "test" block (parent allowlist and PINs) that only test_reset reads.
import { KID, PIN } from './world.ts';

export const CATEGORIES = [
  { id: 'academics', name: 'Math & School', color: 'blue', icon: 'math', kind: 'structured', sort: 1 },
  { id: 'rest', name: 'Reading & Rest', color: 'orange', icon: 'moon', kind: 'free', sort: 2 },
  { id: 'build', name: 'Build & Code', color: 'aqua', icon: 'chip', kind: 'structured', sort: 3 },
  { id: 'fun', name: 'Fun & Friends', color: 'yellow', icon: 'die', kind: 'free', sort: 4 },
  { id: 'music', name: 'Music', color: 'magenta', icon: 'note', kind: 'structured', sort: 5 },
  { id: 'outdoors', name: 'Outdoors & Scouts', color: 'green', icon: 'tent', kind: 'free', sort: 6 },
  { id: 'story', name: 'Story & D&D', color: 'violet', icon: 'book', kind: 'structured', sort: 7 },
  { id: 'home', name: 'Home & Helping', color: 'red', icon: 'home', kind: 'free', sort: 8 },
  { id: 'plan', name: 'Plan & Reflect', color: 'slate', icon: 'compass', kind: 'free', sort: 9 },
];

export function fixture(extraTables: Record<string, unknown[]> = {}): object {
  return {
    version: 1,
    tables: {
      children: [{ id: KID, name: 'Anush' }],
      categories: CATEGORIES,
      library_items: [
        { id: 'lib-recap', title: 'Write a session recap', category_id: 'story', minutes: 15, source: 'guide' },
        { id: 'lib-math', title: 'Math Academy lesson', category_id: 'academics', minutes: 30, source: 'guide' },
        { id: 'lib-old', title: 'Retired idea', category_id: 'fun', minutes: 20, active: false },
      ],
      words: [
        { id: 1, word: 'tenacious', part_of_speech: 'adjective', definition: 'Not giving up.', example: 'A tenacious ranger.' },
        { id: 2, word: 'lucid', part_of_speech: 'adjective', definition: 'Clear and easy to understand.', example: 'A lucid map.' },
        { id: 3, word: 'forage', part_of_speech: 'verb', definition: 'To search for food.', example: 'They forage at dawn.' },
      ],
      encouragements: [
        { id: 1, text: 'A plan is a map, not a cage.' },
        { id: 2, text: 'Small steps add up.' },
      ],
      ...extraTables,
    },
    test: { parent_emails: ['mom@example.com', 'dad@example.com'], pins: { [KID]: PIN } },
  };
}
