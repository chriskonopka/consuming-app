/**
 * Auth state types — owned by auth/.
 */

/** Subset of MSAL's AccountInfo we expose to the rest of the app. */
export interface AccountInfo {
  /** Stable Entra ID object ID (the `sub` claim). Pseudonymous; safe for telemetry. */
  homeAccountId: string;
  /** Display name for header UI only — never log this. */
  name: string | null;
  /** Username (UPN/email) for display only — never log this. */
  username: string;
}

export type AuthState =
  | { status: 'unauthenticated' }
  | { status: 'authenticating' }
  | { status: 'authenticated'; account: AccountInfo }
  | { status: 'expired' };

/**
 * The single canonical token-acquisition function. Used by:
 *   - <IndexerApp getAccessToken={...} />
 *   - useApiClient() for the consuming app's own fetches
 *
 * Same audience, same scope, same MSAL instance — never two.
 */
export type GetAccessToken = () => Promise<string>;
