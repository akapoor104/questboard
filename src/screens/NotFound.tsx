import { Link } from 'react-router-dom';
import { usePageTitle } from '../components/usePageTitle.ts';

export function NotFound() {
  usePageTitle('Page not found');
  return (
    <main className="page page-narrow">
      <h1>Page not found</h1>
      <p><Link to="/">Back to the board</Link></p>
    </main>
  );
}
