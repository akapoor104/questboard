// The icon set. Every icon is drawn on a 24x24 grid with a 2px round stroke and
// no fill, so they all match. Category icons and the child's avatar are stored
// in the database by key (for example categories.icon = 'tent').
//
// To render one:  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
//                      stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"> ...nodes... </svg>

export type IconNode =
  | ['path', { d: string }]
  | ['rect', { x: number; y: number; width: number; height: number; rx?: number }]
  | ['circle', { cx: number; cy: number; r: number }];

const p = (d: string): IconNode => ['path', { d }];

export const ICONS = {
  // Categories
  math: [p('M4 20 20 4v16H4Z'), p('M14 16h2v-2')],
  moon: [p('M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z')],
  chip: [['rect', { x: 6, y: 6, width: 12, height: 12, rx: 2 }], p('M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4')],
  die: [['rect', { x: 4, y: 4, width: 16, height: 16, rx: 3 }], p('M9 9h.01M15 9h.01M9 15h.01M15 15h.01')],
  note: [p('M9 18V5l10-2v13'), ['circle', { cx: 6.5, cy: 18, r: 2.5 }], ['circle', { cx: 16.5, cy: 16, r: 2.5 }]],
  tent: [p('M12 4 3 20h18L12 4Z'), p('M12 12v8')],
  book: [p('M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3V4Z'), p('M9 9h5M9 13h5')],
  home: [p('M4 11 12 4l8 7v9H4v-9Z'), p('M10 20v-5h4v5')],
  compass: [['circle', { cx: 12, cy: 12, r: 9 }], p('m15.5 8.5-2 5-5 2 2-5 5-2Z')],
  // Extra category choices
  star: [p('m12 3 2.7 5.6 6.1.8-4.5 4.3 1.1 6.1L12 16.9l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8L12 3Z')],
  heart: [p('M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z')],
  flask: [p('M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3'), p('M7.5 15h9')],
  ball: [['circle', { cx: 12, cy: 12, r: 9 }], p('M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18')],
  brush: [p('M14 4l6 6-8 8H6v-6l8-8Z'), p('M4 20h4')],
  // Avatars
  d20: [p('M12 2 21 7v10l-9 5-9-5V7l9-5Z'), p('m12 7 5 8H7l5-8Z')],
  shield: [p('M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z')],
  rocket: [p('M12 3c3 2 5 5.5 5 10l-2 3H9l-2-3c0-4.5 2-8 5-10Z'), p('M9 16l-2 4M15 16l2 4'), ['circle', { cx: 12, cy: 10, r: 1.5 }]],
  drum: [p('M4 9c0-1.7 3.6-3 8-3s8 1.3 8 3v7c0 1.7-3.6 3-8 3s-8-1.3-8-3V9Z'), p('M4 9c0 1.7 3.6 3 8 3s8-1.3 8-3M8 12v6.5M16 12v6.5')],
  sword: [p('M19 3 9 13l2 2L21 5V3h-2Z'), p('m7 13 4 4M5 19l3-3M4 20l1-1')],
  // Interface
  flame: [p('M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9Z')],
  lock: [['rect', { x: 5, y: 11, width: 14, height: 9, rx: 2 }], p('M8 11V8a4 4 0 0 1 8 0v3')],
  check: [p('m5 12 5 5 9-10')],
  pin: [p('M12 17v5M8 3h8l-1 6 3 4H6l3-4-1-6Z')],
  clock: [['circle', { cx: 12, cy: 12, r: 9 }], p('M12 7v5l3 2')],
  plus: [p('M12 5v14M5 12h14')],
  close: [p('M6 6l12 12M18 6 6 18')],
  tray: [p('M4 13 6 5h12l2 8v6H4v-6Z'), p('M4 13h5l1 2h4l1-2h5')],
  play: [p('M8 5v14l11-7L8 5Z')],
  pause: [p('M8 5v14M16 5v14')],
  left: [p('m15 5-7 7 7 7')],
  right: [p('m9 5 7 7-7 7')],
  backspace: [p('M9 5h11v14H9l-6-7 6-7Z'), p('m12 9 5 6M17 9l-5 6')],
  chart: [p('M5 20V10M12 20V4M19 20v-7')],
  calendar: [['rect', { x: 4, y: 5, width: 16, height: 15, rx: 2 }], p('M4 10h16M8 3v4M16 3v4')],
  gear: [['circle', { cx: 12, cy: 12, r: 3 }], p('M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1')],
  edit: [p('M4 20h4L19 9l-4-4L4 16v4Z'), p('m13 7 4 4')],
  trash: [p('M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13')],
  undo: [p('M9 7 4 12l5 5'), p('M4 12h10a5 5 0 0 1 0 10h-2')],
  alert: [p('M12 4 3 20h18L12 4Z'), p('M12 10v5M12 17.5h.01')],
  user: [['circle', { cx: 12, cy: 8, r: 4 }], p('M4 21c0-4 3.6-6 8-6s8 2 8 6')],
} satisfies Record<string, IconNode[]>;

export type IconName = keyof typeof ICONS;

/** Keys a parent can pick for a category. */
export const CATEGORY_ICONS: IconName[] = ['math', 'moon', 'chip', 'die', 'note', 'tent', 'book', 'home', 'compass',
  'star', 'heart', 'flask', 'ball', 'brush'];

/** Keys he can pick for his avatar. */
export const AVATAR_ICONS: IconName[] = ['d20', 'shield', 'rocket', 'drum', 'sword', 'star', 'tent', 'book'];

/** Unknown keys (old data, typos) fall back to a safe default instead of crashing. */
export function iconNodes(name: string, fallback: IconName = 'star'): IconNode[] {
  return (ICONS as Record<string, IconNode[]>)[name] ?? ICONS[fallback];
}
