// Drag and drop (ticket T16), with pointer events and no library. Tapping stays the main way
// to move a card; this is a shortcut. A drag starts only after the pointer moved 8px (mouse,
// pen) or after a 250 ms press without moving (touch), so taps and swipes are untouched.
//
// Drop targets are plain elements marked with data attributes:
//   data-drop="day"  data-drop-date="2026-12-23"                         a day (Week)
//   data-drop="time" data-drop-date=... data-drop-start=420 data-drop-end=1260   a timeline
//   data-drop="week"                                                     the week's stack
// While a drag runs, each target gets data-drop-ok="true" or "false", and the one under the
// pointer data-drop-over="true" (the components' CSS draws the outlines).
import { useCallback, useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import type { Api } from '../api/client.ts';
import type { Card, Role } from '../api/types.ts';
import { addDays, formatClock, weekdayName } from '../lib/dates.ts';
import { canDrop, dropPlace, slotFromOffset, targetDate, type DropTarget } from '../lib/drop.ts';
import { useAction } from './useLoad.ts';

/** What a screen hands its draggable cards: where they may go, and what a drop does. */
export interface CardDrop {
  canDrop(card: Card, target: DropTarget): boolean;
  drop(card: Card, target: DropTarget): void;
}

interface CardDropOptions {
  api: Api;
  role: Role;
  /** The family's today, from the server. */
  today: string;
  /** The Monday of the stack a card dropped on "the stack" goes to; null when the stack is no target. */
  stackWeek: string | null;
  reload: () => Promise<void>;
  /** The toaster (useToast()). */
  toast: { show(text: string): void; showError(err: unknown): void };
}

/** A screen's drop handler: the same placeCard() calls as PlaceForm, then a reload. No optimistic move. */
export function useCardDrop({ api, role, today, stackWeek, reload, toast }: CardDropOptions): CardDrop {
  const { run, error } = useAction(reload);
  const saving = useRef(false);
  useEffect(() => {
    if (error !== null) toast.showError(error);
  }, [error, toast]);

  return useMemo<CardDrop>(() => ({
    canDrop: (card, target) => {
      if (target.kind === 'week' && stackWeek === null) return false;
      return canDrop(card, targetDate(target, addDays(stackWeek ?? today, 6)), today, role);
    },
    drop: (card, target) => {
      if (saving.current) return;
      if (target.kind === 'week' && stackWeek === null) return;
      const to = dropPlace(card, target, stackWeek ?? today);
      if (!to) return;
      saving.current = true;
      void run(() => api.placeCard(card.id, to)).then((r) => {
        saving.current = false;
        if (!r) return;
        if (target.kind === 'week') toast.show("Back in this week's stack.");
        else if (target.kind === 'time') toast.show(`Moved to ${formatClock(target.start_min)}.`);
        else toast.show(`Moved to ${weekdayName(target.date)}.`);
      });
    },
  }), [api, role, today, stackWeek, run, toast]);
}

const MOUSE_SLOP = 8;       // px before a mouse drag starts
const TOUCH_SLOP = 8;       // px a finger may wander during the press; more is a swipe
const PRESS_MS = 250;       // how long a finger rests before a drag starts
const EDGE = 48;            // px from an edge where the page starts to scroll
const MAX_SPEED = 14;       // px per frame

/** The target an element stands for, with the ghost's top `top` px down the page (for a timeline). */
function readTarget(el: HTMLElement, top: number, minutes: number): DropTarget | null {
  const date = el.dataset.dropDate;
  switch (el.dataset.drop) {
    case 'week': return { kind: 'week' };
    case 'day': return date ? { kind: 'day', date } : null;
    case 'time': {
      if (!date) return null;
      const start = Number(el.dataset.dropStart);
      const end = Number(el.dataset.dropEnd);
      const rect = el.getBoundingClientRect();
      const slotPx = (rect.height * 15) / Math.max(end - start, 15);
      return { kind: 'time', date, start_min: slotFromOffset(top - rect.top, slotPx, start, end, minutes) };
    }
    default: return null;
  }
}

/** The containers that scroll sideways and hold drop targets (Week's day strip on a narrow screen). */
function sidewaysScrollers(targets: HTMLElement[]): HTMLElement[] {
  const found = new Set<HTMLElement>();
  for (const t of targets) {
    for (let e = t.parentElement; e && e !== document.body; e = e.parentElement) {
      if (e.scrollWidth > e.clientWidth) {
        const o = getComputedStyle(e).overflowX;
        if (o === 'auto' || o === 'scroll') found.add(e);
      }
    }
  }
  return [...found];
}

const speed = (into: number) => Math.ceil((Math.min(into, EDGE) / EDGE) * MAX_SPEED);

/** Stops the click that follows a drag, so dropping a card never also opens its sheet. */
function swallowNextClick() {
  const stop = (e: MouseEvent) => { e.stopPropagation(); e.preventDefault(); };
  window.addEventListener('click', stop, { capture: true, once: true });
  window.setTimeout(() => window.removeEventListener('click', stop, { capture: true }), 0);
}

interface Drag {
  active: boolean;
  end(): void;
}

/** One drag from pointerdown to pointerup. Calls `done` once, however it ends. */
function beginDrag(
  node: HTMLElement, e: ReactPointerEvent, current: () => { card: Card; drop: CardDrop | undefined }, done: () => void,
): Drag {
  const id = e.pointerId;
  const touch = e.pointerType === 'touch';
  const x0 = e.clientX;
  const y0 = e.clientY;
  let x = x0;
  let y = y0;
  const box = node.getBoundingClientRect();
  const grabX = x0 - box.left;
  const grabY = y0 - box.top;
  let ghost: HTMLElement | null = null;
  let label: HTMLElement | null = null;
  let over: HTMLElement | null = null;
  let target: DropTarget | null = null;
  let frame = 0;
  let timer = 0;
  let ended = false;
  let scrollers: HTMLElement[] = [];
  const drag: Drag = { active: false, end: () => finish(false) };

  const targets = () => Array.from(document.querySelectorAll<HTMLElement>('[data-drop]'));

  const update = () => {
    if (!ghost || !label) return;
    ghost.style.transform = `translate(${x - grabX}px, ${y - grabY}px)`;
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop]') ?? null;
    if (hit !== over) {
      over?.removeAttribute('data-drop-over');
      over = hit;
    }
    const { card } = current();
    target = hit && hit.dataset.dropOk === 'true' ? readTarget(hit, y - grabY, card.minutes) : null;
    if (over) over.dataset.dropOver = target ? 'true' : 'false';
    ghost.dataset.target = target ? 'true' : 'false';
    label.textContent = target?.kind === 'time' ? formatClock(target.start_min) : '';
  };

  const scroll = () => {
    let dy = 0;
    if (y < EDGE) dy = -speed(EDGE - y);
    else if (y > window.innerHeight - EDGE) dy = speed(y - (window.innerHeight - EDGE));
    if (dy !== 0) window.scrollBy(0, dy);
    let moved = dy !== 0;
    // A strip scrolls sideways while the pointer is level with it and near (or past) its ends:
    // on a phone the strip stops short of the screen's edge, where a finger rests.
    for (const side of scrollers) {
      const r = side.getBoundingClientRect();
      if (y < r.top || y > r.bottom) continue;
      const dx = x < r.left + EDGE ? -speed(r.left + EDGE - x) : x > r.right - EDGE ? speed(x - (r.right - EDGE)) : 0;
      if (dx !== 0) {
        side.scrollLeft += dx;
        moved = true;
      }
    }
    if (moved) update();
    frame = window.requestAnimationFrame(scroll);
  };

  const activate = () => {
    if (ended || drag.active) return;
    const { card, drop } = current();
    if (!drop) return finish(false);
    drag.active = true;
    window.clearTimeout(timer);
    try { node.setPointerCapture(id); } catch { /* the pointer is already gone */ }

    // A see-through copy of the tile follows the pointer. It is decoration only.
    ghost = node.cloneNode(true) as HTMLElement;
    for (const el of [ghost, ...Array.from(ghost.querySelectorAll('*'))]) {
      for (const a of ['id', 'data-testid', 'data-card-id', 'aria-describedby', 'aria-labelledby']) el.removeAttribute(a);
    }
    ghost.setAttribute('aria-hidden', 'true');
    ghost.inert = true;
    ghost.classList.add('cardtile-ghost');
    ghost.style.width = `${box.width}px`;
    label = document.createElement('span');
    label.className = 'cardtile-ghost-time';
    ghost.append(label);
    document.body.append(ghost);
    document.documentElement.dataset.dragging = 'true';

    scrollers = sidewaysScrollers(targets());
    // A snapping strip would pull every small step straight back; it snaps again when the drag ends.
    for (const side of scrollers) side.style.scrollSnapType = 'none';
    for (const el of targets()) {
      const t = readTarget(el, y, card.minutes);
      el.dataset.dropOk = t && drop.canDrop(card, t) ? 'true' : 'false';
    }
    update();
    frame = window.requestAnimationFrame(scroll);
  };

  const move = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    x = ev.clientX;
    y = ev.clientY;
    if (!drag.active) {
      const dist = Math.hypot(x - x0, y - y0);
      if (touch) {
        if (dist > TOUCH_SLOP) finish(false);      // a swipe: the page scrolls as usual
      } else if (dist >= MOUSE_SLOP) activate();
      return;
    }
    ev.preventDefault();
    update();
  };
  const up = (ev: PointerEvent) => {
    if (ev.pointerId !== id) return;
    x = ev.clientX;
    y = ev.clientY;
    if (drag.active) update();
    finish(true);
  };
  const cancel = (ev: PointerEvent) => {
    if (ev.pointerId === id) finish(false);
  };
  const key = (ev: KeyboardEvent) => {
    if (ev.key === 'Escape' && drag.active) {
      ev.preventDefault();
      ev.stopPropagation();
      finish(false);
    }
  };

  function finish(dropIt: boolean) {
    if (ended) return;
    ended = true;
    const wasActive = drag.active;
    const landed = dropIt && wasActive ? target : null;
    window.clearTimeout(timer);
    window.cancelAnimationFrame(frame);
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', key, true);
    ghost?.remove();
    for (const el of targets()) {
      el.removeAttribute('data-drop-ok');
      el.removeAttribute('data-drop-over');
    }
    delete document.documentElement.dataset.dragging;
    for (const side of scrollers) side.style.scrollSnapType = '';
    try { if (node.hasPointerCapture(id)) node.releasePointerCapture(id); } catch { /* gone */ }
    drag.active = false;
    done();
    if (wasActive) swallowNextClick();
    if (landed) {
      const { card, drop } = current();
      drop?.drop(card, landed);
    }
  }

  window.addEventListener('pointermove', move, { passive: false });
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
  window.addEventListener('keydown', key, true);
  if (touch) timer = window.setTimeout(activate, PRESS_MS);
  return drag;
}

/**
 * Makes a card tile draggable when the screen passed a CardDrop and the card is open.
 * `ref` and `onPointerDown` go on the tile's root element; `draggable` says whether it is.
 */
export function useDragSource(card: Card, drop: CardDrop | undefined) {
  const latest = useRef({ card, drop });
  latest.current = { card, drop };
  const node = useRef<HTMLElement | null>(null);
  const drag = useRef<Drag | null>(null);
  const enabled = drop !== undefined && card.status === 'open';

  useEffect(() => () => drag.current?.end(), []);
  useEffect(() => {
    if (!enabled) drag.current?.end();
  }, [enabled]);

  const ref = useCallback((el: HTMLElement | null) => {
    node.current = el;
    if (!el) return;
    // Once a drag runs, a finger moving must not scroll the page (touchmove is passive in React).
    const touchmove = (e: TouchEvent) => { if (drag.current?.active && e.cancelable) e.preventDefault(); };
    const menu = (e: Event) => { if (drag.current) e.preventDefault(); };
    el.addEventListener('touchmove', touchmove, { passive: false });
    el.addEventListener('contextmenu', menu);
    return () => {
      el.removeEventListener('touchmove', touchmove);
      el.removeEventListener('contextmenu', menu);
    };
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    const { card: c, drop: d } = latest.current;
    if (!d || c.status !== 'open' || drag.current || !node.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if ((e.target as Element).closest('.cardtile-actions')) return;     // its own buttons stay buttons
    drag.current = beginDrag(node.current, e, () => latest.current, () => { drag.current = null; });
  }, []);

  return { ref, onPointerDown: enabled ? onPointerDown : undefined, draggable: enabled };
}
