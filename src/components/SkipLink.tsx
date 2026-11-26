import type { MouseEvent } from 'react';

/** The first focusable thing of a layout: jumps past the navigation to the page's <main>. */
export function SkipLink() {
  const skip = (e: MouseEvent<HTMLAnchorElement>) => {
    const main = document.querySelector('main');
    if (!main) return;
    e.preventDefault();
    if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
    main.focus();
  };
  return <a href="#main" className="skip-link" onClick={skip}>Skip to content</a>;
}
