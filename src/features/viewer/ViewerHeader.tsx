/**
 * Document viewer header — file name, file-type pill, page count, close button.
 *
 * `fileType` from the metadata response (REQUIREMENTS.md §5.7) is the
 * server's `FileTypeCode` enum. We render it via `<Pill>` with a
 * meaning-bearing `tone` per the design tokens; the label always reads the
 * canonical type name so the badge is not colour-only.
 */

import { X } from '@phosphor-icons/react';

import type { DocumentMetadataResponse, FileTypeCode } from '@shared/types';

import { IconButton } from '../../components/IconButton';
import { Pill } from '../../components/Pill';

import styles from './ViewerHeader.module.scss';

interface Props {
  metadata: DocumentMetadataResponse | null;
  documentId: string | null;
  totalPages: number;
  onClose: () => void;
}

const FILE_TYPE_TONE: Record<FileTypeCode, 'info' | 'success' | 'warning' | 'neutral'> = {
  Financial: 'success',
  Contract: 'info',
  Regulatory: 'warning',
  Other: 'neutral',
};

export const ViewerHeader = ({ metadata, documentId, totalPages, onClose }: Props) => {
  // Fall back to the documentId as the display title until metadata loads —
  // documentId is `fileName` in the v1 wiring (see useCitationClick).
  const title = metadata?.fileName ?? documentId ?? 'Document';

  return (
    <header className={styles.header}>
      <div className={styles.titleRow}>
        <h2 className={styles.title} title={title}>
          {title}
        </h2>
        {metadata && (
          <Pill
            label={metadata.fileType}
            tone={FILE_TYPE_TONE[metadata.fileType]}
            ariaLabel={`File type: ${metadata.fileType}`}
          />
        )}
        {totalPages > 0 && (
          <span className={styles.meta}>
            {totalPages} {totalPages === 1 ? 'page' : 'pages'}
          </span>
        )}
      </div>
      <IconButton icon={X} ariaLabel="Close document viewer" onClick={onClose} />
    </header>
  );
};
