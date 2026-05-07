/**
 * Public surface of the auth module — see module-boundaries.md §2.1.
 * Other modules import from here; never reach into the internals.
 */

export { MsalAppProvider } from './MsalAppProvider';
export { AuthGate } from './AuthGate';
export { UserMenu } from './UserMenu';
export { useAuth } from './useAuth';
export { useAccessToken } from './useAccessToken';
