/**
 * Placeholder for the `/c/:documentSetId` route. Slice 2 replaces this with
 * `<IndexerHost />` mounting `<IndexerApp />` from the federation remote.
 *
 * In slice 1 this just shows the active collection ID so deep-link routing
 * is testable end-to-end.
 */

import { useParams } from 'react-router-dom';

export const CollectionPlaceholder = () => {
  const { documentSetId } = useParams<{ documentSetId: string }>();

  return (
    <section aria-labelledby="collection-heading" style={{ padding: '1rem' }}>
      <h2 id="collection-heading">Collection</h2>
      <p>
        Active collection ID: <code>{documentSetId}</code>
      </p>
      <p>
        Slice 2 mounts <code>&lt;IndexerHost /&gt;</code> here. Until then, this
        placeholder confirms deep-link routing is wired through{' '}
        <code>react-router-dom</code>.
      </p>
    </section>
  );
};
