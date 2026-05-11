/**
 * Scope indicator strip — rendered above the chat message list when the user
 * has narrowed the next send to specific documents or folders. Shows one chip
 * per selected id; clicking the × removes that id; "Clear all" empties the
 * whole selection.
 *
 * Filenames are pulled from `useDocumentMetadata` per documentId — TanStack
 * Query dedupes/caches across the viewer, so the chip lookups are usually
 * cache hits. When the metadata hasn't loaded yet, the chip shows a short
 * placeholder rather than the raw guid (better than leaking ids into the UI).
 *
 * Folders: today the consumer has no folder-metadata hook (folder lists live
 * inside the indexer remote). Until the indexer's selection event ships
 * `folderName` (see docs/architecture/indexer-handoff-selection-event.md),
 * folder chips render as "Folder N" placeholders.
 */

import { X } from '@phosphor-icons/react';
import { memo } from 'react';

import { useDocumentMetadata } from '../viewer';

import styles from './ScopeIndicator.module.scss';
import type { ChatScopeState } from './chatScopeReducer';

interface Props {
  state: ChatScopeState;
  onRemoveDocument: (documentId: string) => void;
  onRemoveFolder: (folderId: string) => void;
  onClearAll: () => void;
}

interface DocumentChipProps {
  documentId: string;
  onRemove: (id: string) => void;
}

const DocumentChipBase = ({ documentId, onRemove }: DocumentChipProps) => {
  const { data } = useDocumentMetadata(documentId);
  const label = data?.fileName ?? 'Document';
  return (
    <li className={styles.chip}>
      <span className={styles.chipLabel} title={data?.fileName ?? documentId}>
        {label}
      </span>
      <button
        type="button"
        className={styles.chipRemove}
        aria-label={`Remove ${label} from chat scope`}
        onClick={() => onRemove(documentId)}
      >
        <X size={14} weight="regular" aria-hidden="true" focusable="false" />
      </button>
    </li>
  );
};
DocumentChipBase.displayName = 'DocumentChip';
// List item rendered in .map() — memo + stable parent callbacks per
// web-component-architecture.md.
const DocumentChip = memo(DocumentChipBase);

interface FolderChipProps {
  folderId: string;
  ordinal: number;
  onRemove: (id: string) => void;
}

const FolderChipBase = ({ folderId, ordinal, onRemove }: FolderChipProps) => {
  const label = `Folder ${ordinal}`;
  return (
    <li className={styles.chip}>
      <span className={styles.chipLabel} title={folderId}>
        {label}
      </span>
      <button
        type="button"
        className={styles.chipRemove}
        aria-label={`Remove ${label} from chat scope`}
        onClick={() => onRemove(folderId)}
      >
        <X size={14} weight="regular" aria-hidden="true" focusable="false" />
      </button>
    </li>
  );
};
FolderChipBase.displayName = 'FolderChip';
const FolderChip = memo(FolderChipBase);

export const ScopeIndicator = ({ state, onRemoveDocument, onRemoveFolder, onClearAll }: Props) => {
  const total = state.documentIds.length + state.folderIds.length;
  if (total === 0) return null;
  return (
    <section className={styles.indicator} aria-label="Chat scope">
      <span className={styles.label} aria-live="polite" aria-atomic="true">
        Scoped to {total}
      </span>
      <ul className={styles.chipList}>
        {state.documentIds.map((documentId) => (
          <DocumentChip key={documentId} documentId={documentId} onRemove={onRemoveDocument} />
        ))}
        {state.folderIds.map((folderId, index) => (
          <FolderChip
            key={folderId}
            folderId={folderId}
            ordinal={index + 1}
            onRemove={onRemoveFolder}
          />
        ))}
      </ul>
      <button type="button" className={styles.clearAll} onClick={onClearAll}>
        Clear all
      </button>
    </section>
  );
};
