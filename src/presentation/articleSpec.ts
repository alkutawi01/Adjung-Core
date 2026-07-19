import { PresentationSpec } from './specs';

export const articleSpec: PresentationSpec = {
  contentType: 'Article',
  typography: {
    bodyFont: 'font-serif text-[#111111] leading-relaxed text-justify text-base md:text-lg font-light',
    signatureFont: 'font-signature text-5xl',
    interlinearFont: 'font-signature text-[#802334]'
  },
  spacing: {
    canvasMaxWidth: 'max-w-4xl',
    canvasPadding: 'py-10 px-4 md:px-12',
    headerBottomMargin: 'mb-10 border-b border-stone-300 pb-6',
    paragraphSpacing: 'mb-6',
    signatureMarginTop: 'mt-16 pt-12 border-t border-stone-200'
  },
  visibility: {
    showTitle: true,
    showSubtitle: true,
    showAbstract: true,
    showCoverImage: true,
    showSignatureClosure: true,
    showNoteFooter: false,
    showCitations: true,
    showFootnotes: true
  }
};
