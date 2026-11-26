import { ApiError } from '../api/types.ts';
import { ErrorPanel } from '../components/ErrorPanel.tsx';
import { usePageTitle } from '../components/usePageTitle.ts';

const NETWORK = new ApiError('network');

/** Development only (`/_error`): the error state, so the browser tests can look at it. */
export function ErrorPreview() {
  usePageTitle('Error');
  return (
    <main className="page page-narrow">
      <h1 className="sr-only">Error</h1>
      <ErrorPanel error={NETWORK} onRetry={() => window.location.reload()} />
    </main>
  );
}
