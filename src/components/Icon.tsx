import { createElement } from 'react';
import { iconNodes } from '../ui/icons.ts';

export interface IconProps {
  name: string;
  size?: number;
  /** Only for an icon that means something on its own; next to text, leave it out. */
  label?: string;
}

/** One icon from src/ui/icons.ts. Decorative unless it has a label. */
export function Icon({ name, size = 20, label }: IconProps) {
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  return (
    <svg
      viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round" focusable="false" {...a11y}
    >
      {iconNodes(name).map(([tag, attrs], i) => createElement(tag, { key: i, ...attrs }))}
    </svg>
  );
}
