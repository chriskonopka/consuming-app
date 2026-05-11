/**
 * Public surface of the chat-scope feature. Imports outside this folder must
 * go through this barrel (per web-file-structure.md).
 */

export { ChatScopeProvider, useChatScope } from './ChatScopeContext';
export type { ChatScopeActions, ChatScopeContextValue } from './ChatScopeContext';
export { ScopeIndicator } from './ScopeIndicator';
export type { ChatScopeState } from './chatScopeReducer';
