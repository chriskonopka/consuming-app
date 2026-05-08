/**
 * Subscribes to react-router-dom location changes and calls
 * appInsights.trackPageView. Strips query strings from logged URIs to avoid
 * leaking PII (per api-pii-handling.md / web-error-logging.md).
 */

import { useEffect } from 'react';

import { useLocation } from 'react-router-dom';

import { appInsights } from '../appInsights';

export const useTrackPageView = (): void => {
  const location = useLocation();

  useEffect(() => {
    if (!appInsights) return;
    // Strip query strings — they may contain sensitive identifiers.
    const uri = location.pathname;
    appInsights.trackPageView({ uri, name: uri });
  }, [location.pathname]);
};
