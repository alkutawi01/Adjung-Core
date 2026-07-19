import { PresentationSpec } from './specs';

export const noteSpec: PresentationSpec = {
  contentType: 'Note',
  typography: {
    bodyFont: 'font-serif text-[#111111] leading-relaxed text-base md:text-lg font-light',
    signatureFont: 'font-signature text-2xl',
    interlinearFont: 'font-signature text-[#802334]'
  },
  spacing: {
    canvasMaxWidth: 'max-w-2xl',
    canvasPadding: 'py-8 px-4 md:px-8',
    headerBottomMargin: 'mb-4',
    paragraphSpacing: 'mb-4',
    signatureMarginTop: 'mt-8 pt-4'
  },
  visibility: {
    showTitle: false,
    showSubtitle: false,
    showAbstract: false,
    showCoverImage: false,
    showSignatureClosure: false,
    showNoteFooter: true,
    showCitations: true,
    showFootnotes: true
  }
};
