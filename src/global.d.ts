declare module '*.module.scss' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.webp' {
  const src: string;
  export default src;
}

// pdf.js worker — bundled by webpack 5's asset/resource rule (see
// webpack.config.js); the import resolves to the emitted worker file URL.
// In tests, jest's moduleNameMapper redirects this to a string stub.
declare module 'pdfjs-dist/build/pdf.worker.min.mjs' {
  const workerUrl: string;
  export default workerUrl;
}

// Env vars exposed via webpack.DefinePlugin. Mirror what's whitelisted in
// webpack.config.js's DefinePlugin block. Adding one here without adding it
// to DefinePlugin (or vice versa) is a build error waiting to happen.
declare namespace NodeJS {
  interface ProcessEnv {
    APPLICATIONINSIGHTS_CONNECTION_STRING: string;
    API_BASE_URL: string;
    INDEXER_REMOTE_URL: string;
    MSAL_CLIENT_ID: string;
    MSAL_AUTHORITY: string;
    MSAL_API_SCOPE: string;
  }
}

// Build identifier baked into the bundle by webpack.DefinePlugin. Same value
// is emitted to `dist/version.json` so the running client can poll and reload
// when the live id no longer matches. Read via `src/utils/buildId.ts`.
declare const __BUILD_ID__: string;
