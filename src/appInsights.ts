import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

export const appInsights = connectionString
  ? new ApplicationInsights({ config: { connectionString } })
  : null;

appInsights?.loadAppInsights();
