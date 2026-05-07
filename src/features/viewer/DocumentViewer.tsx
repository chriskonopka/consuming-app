/**
 * What belongs here: right-side panel that renders PDFs (via pdf.js with
 * three-layer canvas/text/highlight overlay) and images (via blob-URL).
 * Page navigation, citation highlight overlay with drift guard, "Locating
 * citation" banner, "Couldn't locate" fallback.
 *
 * Scaffolded — PDF rendering lands in slice 4, image rendering in slice 5.
 */

export const DocumentViewer = () => {
  return (
    <div role="status" aria-label="Document viewer placeholder">
      Document viewer — wired in slice 4 (PDF) and slice 5 (image).
    </div>
  );
};
