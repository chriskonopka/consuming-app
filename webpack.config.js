// @ts-check
const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const { ModuleFederationPlugin } = require('@module-federation/enhanced/webpack');

// Federation host name the indexer remote ships under.
// Must match the indexer's `ModuleFederationPlugin({ name: 'mws_indexer' })`.
// See ../reusable-indexer/web/webpack.config.js.
const INDEXER_REMOTE_NAME = 'mws_indexer';

/**
 * Emits `staticwebapp.config.json` from the repo root into the build output.
 * Azure Static Web Apps reads this file at the root of the deployed bundle to
 * decide how to route requests; without it, hitting a deep-link like
 * `/c/{documentSetId}` on refresh returns a 404 because SWA looks for a real
 * file at that path. The config rewrites unknown paths to `/index.html` so
 * react-router can pick them up client-side.
 *
 * Lives as an inline plugin (rather than `copy-webpack-plugin`) to avoid a
 * new direct dependency for a single static asset.
 */
class CopyStaticWebAppConfigPlugin {
  constructor(sourceFile) {
    this.sourceFile = sourceFile;
  }
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('CopyStaticWebAppConfigPlugin', (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: 'CopyStaticWebAppConfigPlugin',
          stage: compiler.webpack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL,
        },
        () => {
          const contents = fs.readFileSync(this.sourceFile);
          compilation.emitAsset(
            'staticwebapp.config.json',
            new compiler.webpack.sources.RawSource(contents),
          );
        },
      );
    });
  }
}

/** @param {Record<string, unknown>} _env @param {{ mode: string }} argv */
module.exports = (_env, argv) => {
  const isProd = argv.mode === 'production';

  // Remote URL for the indexer. Empty in test/CI runs where the remote is not
  // served — the consuming app's E2E stub branch (MSAL_E2E_STUB) skips the
  // dynamic remote import in that case so the bundle still boots.
  const indexerRemoteUrl = process.env.INDEXER_REMOTE_URL || '';
  // The MF runtime expects the form `<name>@<remoteEntry-url>`. When the URL is
  // empty (e.g. unit-test bundling), pass a placeholder that fails fast at
  // runtime instead of at build time.
  const indexerRemote = indexerRemoteUrl
    ? `${INDEXER_REMOTE_NAME}@${indexerRemoteUrl}/remoteEntry.js`
    : `${INDEXER_REMOTE_NAME}@http://localhost/__indexer-not-configured__/remoteEntry.js`;

  return {
    entry: './src/main.tsx',

    output: {
      path: path.resolve(__dirname, 'dist'),
      // Content-hash filenames in production for long-term caching.
      filename: isProd ? '[name].[contenthash].js' : '[name].js',
      chunkFilename: isProd ? '[name].[contenthash].js' : '[name].js',
      // Allow the public path to be overridden via an environment variable.
      // Used in CI to set the correct base path for GitHub Pages deployments
      // (e.g. PUBLIC_PATH=/web-app/). Defaults to / for local dev.
      publicPath: process.env.PUBLIC_PATH || '/',
      clean: true,
    },

    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      alias: {
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },

    module: {
      rules: [
        // pdf.js worker — emit as a separate asset and surface its URL via the
        // default import. Must come before the JS / SCSS rules so the file is
        // not also processed by babel-loader. Slice 4: features/viewer/
        // imports `pdfjs-dist/build/pdf.worker.min.mjs` for its URL only.
        {
          test: /pdfjs-dist[\\/]build[\\/]pdf\.worker(\.min)?\.mjs$/,
          type: 'asset/resource',
          generator: {
            filename: isProd ? 'pdfjs/[name].[contenthash][ext]' : 'pdfjs/[name][ext]',
          },
        },

        // TypeScript / JSX — transpiled by Babel; type-checking is handled
        // separately by ForkTsCheckerWebpackPlugin in parallel.
        {
          test: /\.[jt]sx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/preset-env', { targets: 'defaults' }],
                ['@babel/preset-react', { runtime: 'automatic' }],
                '@babel/preset-typescript',
              ],
            },
          },
        },

        // CSS Modules — scoped styles used by all components.
        {
          test: /\.module\.css$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: {
                // Use CommonJS-style exports so the default import resolves
                // correctly regardless of how babel-loader handles ES modules.
                esModule: false,
                modules: {
                  // Readable class names in dev; hashed in production.
                  localIdentName: isProd ? '[hash:base64]' : '[local]__[hash:base64:5]',
                },
              },
            },
          ],
        },

        // SCSS Modules — scoped styles for components using Sass.
        {
          test: /\.module\.scss$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            {
              loader: 'css-loader',
              options: {
                esModule: false,
                modules: {
                  localIdentName: isProd ? '[hash:base64]' : '[local]__[hash:base64:5]',
                },
              },
            },
            'sass-loader',
          ],
        },

        // Global CSS (e.g. src/styles/global.css).
        {
          test: /\.css$/,
          exclude: /\.module\.css$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            { loader: 'css-loader', options: { esModule: false } },
          ],
        },

        // Global SCSS (e.g. src/styles/global.scss).
        {
          test: /\.scss$/,
          exclude: /\.module\.scss$/,
          use: [
            isProd ? MiniCssExtractPlugin.loader : 'style-loader',
            { loader: 'css-loader', options: { esModule: false } },
            'sass-loader',
          ],
        },

        {
          test: /\.(png|jpe?g|gif|svg|webp|woff2?)$/i,
          type: 'asset/resource',
          generator: {
            filename: isProd ? 'assets/[name].[contenthash][ext]' : 'assets/[name][ext]',
          },
        },
      ],
    },

    plugins: [
      // Module Federation host. Loads the indexer remote at runtime as
      // `mws_indexer/IndexerApp` and `mws_indexer/types`. React + ReactDOM are
      // shared as strict singletons so a single React copy runs across both
      // bundles — required, because mismatched copies cause the "shared
      // singleton" runtime error referenced in api-contracts.md §1.1.
      new ModuleFederationPlugin({
        name: 'consuming_app',
        remotes: {
          [INDEXER_REMOTE_NAME]: indexerRemote,
        },
        shared: {
          react: { singleton: true, requiredVersion: false, eager: false },
          'react-dom': { singleton: true, requiredVersion: false, eager: false },
          'react-dom/client': { singleton: true, requiredVersion: false, eager: false },
        },
      }),

      // Injects the bundled scripts into index.html automatically.
      new HtmlWebpackPlugin({ template: './index.html' }),

      // Emit Azure Static Web Apps routing config so deep-links like
      // `/c/{documentSetId}` rewrite to /index.html on refresh.
      new CopyStaticWebAppConfigPlugin(
        path.resolve(__dirname, 'staticwebapp.config.json'),
      ),

      // Expose environment variables to the browser bundle.
      // Only whitelisted variables are forwarded — never forward the entire process.env.
      // Secrets do NOT belong here — only public configuration. The MSAL clientId,
      // authority, scopes, and API base URL are all public values safe to bake in.
      // The App Insights connection string is also a write-only ingestion key per
      // web-error-logging.md, safe to expose.
      new webpack.DefinePlugin({
        'process.env.APPLICATIONINSIGHTS_CONNECTION_STRING': JSON.stringify(
          process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || '',
        ),
        'process.env.API_BASE_URL': JSON.stringify(process.env.API_BASE_URL || ''),
        'process.env.INDEXER_REMOTE_URL': JSON.stringify(
          process.env.INDEXER_REMOTE_URL || '',
        ),
        'process.env.MSAL_CLIENT_ID': JSON.stringify(process.env.MSAL_CLIENT_ID || ''),
        'process.env.MSAL_AUTHORITY': JSON.stringify(process.env.MSAL_AUTHORITY || ''),
        'process.env.MSAL_API_SCOPE': JSON.stringify(process.env.MSAL_API_SCOPE || ''),
        // E2E test seam: when set to 'true', src/auth/msalInstance.ts swaps in
        // a deterministic stub. Production builds (no env var set) get the
        // empty string, which makes the gating expression false at compile
        // time and Terser eliminates the stub branch.
        'process.env.MSAL_E2E_STUB': JSON.stringify(process.env.MSAL_E2E_STUB || ''),
      }),

      // Runs TypeScript type-checking in a separate worker so it does not
      // block the webpack compilation.
      new ForkTsCheckerWebpackPlugin(),

      // Extract CSS to separate files in production only.
      ...(isProd ? [new MiniCssExtractPlugin({ filename: '[name].[contenthash].css' })] : []),
    ],

    optimization: isProd
      ? {
          minimize: true,
          minimizer: [
            new TerserPlugin({
              terserOptions: {
                compress: {
                  // Strip all console.* calls and debugger statements from
                  // the production bundle.
                  drop_console: true,
                  drop_debugger: true,
                },
              },
            }),
          ],
          splitChunks: {
            cacheGroups: {
              // Split React + ReactDOM into a separate vendor chunk so it
              // can be cached independently from app code.
              vendor: {
                test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                name: 'vendor',
                chunks: 'all',
              },
              // Module Federation runtime in its own chunk.
              mfRuntime: {
                test: /[\\/]node_modules[\\/]@module-federation[\\/]/,
                name: 'mf-runtime',
                chunks: 'all',
              },
            },
          },
        }
      : {},

    devServer: {
      port: 8080,
      hot: true,
      // Required for client-side routing (SPA fallback).
      historyApiFallback: true,
      open: false,
      // The indexer remote runs on a different origin in dev (see
      // `INDEXER_REMOTE_URL`). Browsers fetch `remoteEntry.js` over CORS, so
      // the indexer dev server already returns Access-Control-Allow-Origin.
    },

    // Inline source maps in dev for fast rebuilds; disabled in production.
    devtool: isProd ? false : 'eval-source-map',
  };
};
