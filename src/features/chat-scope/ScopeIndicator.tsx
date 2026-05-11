/**
 * Scope indicator strip — rendered above the chat message list when the user
 * has narrowed the next send to specific documents or folders. Shows one chip
 * per selected item; clicking the × removes that item *locally* (the chip
 * disappears, the next chat send omits that id); "Clear all" empties the
 * whole local view.
 *
 * Source of truth is the indexer's `selection/changed` event (PR #3 / 3cf5603),
 * which now ships `fileName`, `folderName`, and a slash-joined ancestor `path`
 * directly in the payload. We render straight from chat-scope state — no
 * `useDocumentMetadata` round-trip for chip labels.
 *
 * Known divergence (documented in the slice doc): chat-side `×` and "Clear all"
 * are local overrides — they do NOT push back to the indexer's selection UI.
 * The next `selection/changed` mutation re-syncs the chip rack to the
 * indexer's authoritative set. Acceptable v1; revisit if user feedback warrants
 * an imperative back-channel.
 */

import { X } from '@phosphor-icons/react';
import { memo } from 'react';

import type { SelectionDocument, SelectionFolder } from '@shared/types';

import styles from './ScopeIndicator.module.scss';
import type { ChatScopeState } from './chatScopeReducer';

interface Props {
  state: ChatScopeState;
  onRemoveDocument: (documentId: string) => void;
  onRemoveFolder: (folderId: string) => void;
  onClearAll: () => void;
}

interface DocumentChipProps {
  document: SelectionDocument;
  onRemove: (id: string) => void;
}

const DocumentChipBase = ({ document, onRemove }: DocumentChipProps) => {
  return (
    <li className={styles.chip}>
      <span className={styles.chipLabel} title={document.fileName}>
        {document.fileName}
      </span>
      <button
        type="button"
        className={styles.chipRemove}
        aria-label={`Remove ${document.fileName} from chat scope`}
        onClick={() => onRemove(document.documentId)}
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
  folder: SelectionFolder;
  onRemove: (id: string) => void;
}

const FolderChipBase = ({ folder, onRemove }: FolderChipProps) => {
  return (
    <li className={styles.chip}>
      <span className={styles.chipLabel} title={folder.path}>
        {folder.folderName}
      </span>
      <button
        type="button"
        className={styles.chipRemove}
        aria-label={`Remove folder ${folder.folderName} from chat scope`}
        onClick={() => onRemove(folder.folderId)}
      >
        <X size={14} weight="regular" aria-hidden="true" focusable="false" />
      </button>
    </li>
  );
};
FolderChipBase.displayName = 'FolderChip';
const FolderChip = memo(FolderChipBase);

export const ScopeIndicator = ({ state, onRemoveDocument, onRemoveFolder, onClearAll }: Props) => {
  const total = state.documents.length + state.folders.length;
  if (total === 0) return null;
  return (
    <section className={styles.indicator} aria-label="Chat scope">
      <span className={styles.label} aria-live="polite" aria-atomic="true">
        Scoped to {total}
      </span>
      <ul className={styles.chipList}>
        {state.documents.map((document) => (
          <DocumentChip key={document.documentId} document={document} onRemove={onRemoveDocument} />
        ))}
        {state.folders.map((folder) => (
          <FolderChip key={folder.folderId} folder={folder} onRemove={onRemoveFolder} />
        ))}
      </ul>
      <button type="button" className={styles.clearAll} onClick={onClearAll}>
        Clear all
      </button>
    </section>
  );
};
