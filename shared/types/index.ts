/**
 * Barrel export for cross-module type vocabulary.
 *
 * Modules import from '@shared/types' rather than reaching into individual files.
 * Per web-file-structure.md, barrel files are forbidden in src/components/ and
 * src/hooks/ — but they're appropriate here because /shared/types/ is a type-only
 * surface with no runtime cost.
 */

export * from './api-dtos';
export * from './auth';
export * from './chat';
export * from './citation';
export * from './indexer-host';
export * from './layout';
export * from './viewer';
