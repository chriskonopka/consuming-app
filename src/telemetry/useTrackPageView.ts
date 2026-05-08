/**
 * Subscribes to react-router-dom location changes and calls
 * `appInsights.trackPageView`. Strips query strings from logged URIs to avoid
 * leaking PII (per web-error-logging.md). Only the pathname is reported.
 *
 * No-op when App Insights is not configured (connection string missing).
 */

import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

import { appInsights } from '../appInsights';

export const useTrackPageView = (): void => {
  const location = useLocation();

  useEffect(() => {
    if (!appInsights) return;
    appInsights.trackPageView({
      name: location.pathname,
      uri: location.pathname,
    });
  }, [location.pathname]);
};
