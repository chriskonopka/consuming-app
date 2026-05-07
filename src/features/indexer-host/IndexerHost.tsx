/**
 * What belongs here: the React boundary that lazy-loads `mws_indexer/IndexerApp`
 * via Module Federation, passes props (apiBaseUrl, getAccessToken, appInsights,
 * initialState, onEvent), and routes IndexerEvents to the rest of the app.
 *
 * Scaffolded — implementation lands in slice 2 (Indexer host integration).
 */

export const IndexerHost = () => {
  return (
    <div role="status" aria-label="Indexer host placeholder">
      Indexer host — wired in slice 2.
    </div>
  );
};
