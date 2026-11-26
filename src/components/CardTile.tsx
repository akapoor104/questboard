import type { ReactNode } from 'react';
import type { Card, Category } from '../api/types.ts';
import { formatDuration } from '../lib/dates.ts';
import { cardMeta } from '../lib/today.ts';
import { Icon } from './Icon.tsx';
import './CardTile.css';

export type CardVariant = 'full' | 'row' | 'timed';

export interface CardTileProps {
  card: Card;
  /** The card's category (undefined while unknown: drawn in slate with a star). */
  category: Category | undefined;
  /** `cat-<color>` from useCategories().colorClass. */
  colorClass: string;
  variant: CardVariant;
  /** The family's time zone, for "started 9:45 AM". */
  timeZone: string;
  /** One more piece of text for the meta line, such as "6 more this week" or where a leftover came from. */
  extra?: string;
  /** Buttons under the card (full variant), or at its end (row and timed, such as "How did it go?"). */
  actions?: ReactNode;
  /** Make the action buttons share the card's width (the tray). */
  wideActions?: boolean;
  /** Opens the card sheet. */
  onOpen?: () => void;
}

/** One card. The root element and its data- attributes are a contract (docs/05-design.md, "Shared pieces"). */
export function CardTile({ card, category, colorClass, variant, timeZone, extra, actions, wideActions, onOpen }: CardTileProps) {
  const icon = category?.icon ?? 'star';
  const name = category?.name ?? 'Other';
  const done = card.status === 'resolved' && card.pct === 100;
  const must = card.kind === 'must' && card.drop_requested_at === null;
  let parts = cardMeta(card, timeZone);
  if (variant === 'full' && card.place !== 'day' && card.drop_requested_at === null) {
    parts = parts.filter((p) => !p.endsWith(' left'));
  }

  const mustMark = must && (
    <span className="cardtile-must"><Icon name="pin" size={14} /><span className="cardtile-must-text">Must-do</span></span>
  );
  const metaText = [...parts, ...(extra ? [extra] : [])].join(' · ');
  const title = (
    <button type="button" className="cardtile-open card-title" onClick={onOpen}>{card.title}</button>
  );

  return (
    <article
      className={`card ${colorClass} cardtile cardtile-${variant}`}
      data-testid="card"
      data-card-id={card.id}
      data-status={card.status === 'resolved' ? 'resolved' : 'open'}
      data-kind={card.kind}
      data-doing={card.doing_since !== null ? 'true' : 'false'}
      data-place={card.place}
      data-size={variant === 'timed' && card.minutes < 45 ? 'short' : undefined}
    >
      {variant === 'full' ? (
        <>
          <div className="card-meta">
            <Icon name={icon} size={16} />
            <span>{name}</span>
            <span className="cardtile-end">
              {formatDuration(card.minutes)}{card.place === 'tray' ? ' left' : ''}
            </span>
          </div>
          {title}
          {(mustMark || metaText || actions) && (
            <div className={`cardtile-foot${wideActions ? ' cardtile-foot-wide' : ''}`}>
              {(mustMark || metaText) && (
                <span className="cardtile-meta">
                  {mustMark}
                  {mustMark && metaText ? ', ' : null}
                  {metaText}
                </span>
              )}
              {actions && <div className="cardtile-actions">{actions}</div>}
            </div>
          )}
        </>
      ) : (
        <>
          <span className="cardtile-icon"><Icon name={icon} size={16} /></span>
          <span className="sr-only">{name}:</span>
          <div className="cardtile-body">
            {title}
            {(mustMark || (variant === 'timed' && card.details)) && (
              <span className="cardtile-sub">
                {mustMark}
                {variant === 'timed' && card.details && <span className="cardtile-details">{card.details}</span>}
              </span>
            )}
          </div>
          <span className="cardtile-end card-meta">
            {done && <Icon name="check" size={14} />}
            {metaText}
          </span>
          {actions && <div className="cardtile-actions cardtile-actions-inline">{actions}</div>}
        </>
      )}
    </article>
  );
}
