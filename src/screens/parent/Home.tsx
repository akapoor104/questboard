import { useParentChild } from '../../app/session.tsx';

/** Parent: This week (placeholder until T09). */
export function Home() {
  const child = useParentChild();
  return <h1>{child.name}'s week</h1>;
}
