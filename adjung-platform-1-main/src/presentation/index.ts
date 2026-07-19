import { PresentationSpec } from './specs';
import { noteSpec } from './noteSpec';
import { essaySpec } from './essaySpec';
import { articleSpec } from './articleSpec';

export * from './specs';
export { noteSpec } from './noteSpec';
export { essaySpec } from './essaySpec';
export { articleSpec } from './articleSpec';

export const noticeSpec: PresentationSpec = {
  contentType: 'Notice',
  typography: {
    bodyFont: 'font-serif text-[#111111] leading-relaxed text-base md:text-lg font-light',
    signatureFont: 'font-signature text-3xl'
  },
  spacing: {
    canvasMaxWidth: 'max-w-2xl',
    canvasPadding: 'py-8 px-4 md:px-8',
    headerBottomMargin: 'mb-6 border-b border-stone-300 pb-4',
    paragraphSpacing: 'mb-4',
    signatureMarginTop: 'mt-12 pt-8 border-t border-stone-200'
  },
  visibility: {
    showTitle: true,
    showSubtitle: true,
    showAbstract: false,
    showCoverImage: false,
    showSignatureClosure: true,
    showNoteFooter: false,
    showCitations: false,
    showFootnotes: false
  }
};

export const editorsNoteSpec: PresentationSpec = {
  contentType: "Editor's Note",
  typography: {
    bodyFont: 'font-serif text-[#111111] leading-relaxed text-justify text-base md:text-lg font-light',
    signatureFont: 'font-signature text-4xl'
  },
  spacing: {
    canvasMaxWidth: 'max-w-3xl',
    canvasPadding: 'py-10 px-4 md:px-8',
    headerBottomMargin: 'mb-8 border-b border-stone-300 pb-6',
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

export const presentationSpecs: Record<string, PresentationSpec> = {
  'Note': noteSpec,
  'Essay': essaySpec,
  'Article': articleSpec,
  'Notice': noticeSpec,
  "Editor's Note": editorsNoteSpec
};

export function getPresentationSpec(contentType: string): PresentationSpec {
  return presentationSpecs[contentType] || essaySpec;
}
