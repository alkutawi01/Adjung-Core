export interface TypographySpec {
  bodyFont: string;       // CSS font class or style variable
  signatureFont: string;  // CSS signature font class
  headerFont?: string;    // CSS header font class
  interlinearFont?: string; // CSS interlinear note font class
}

export interface SpacingSpec {
  canvasMaxWidth: string; // CSS width class (e.g. 'max-w-4xl')
  canvasPadding: string;  // CSS padding class (e.g. 'py-8 px-4')
  headerBottomMargin: string; // CSS margin class (e.g. 'mb-10')
  paragraphSpacing: string;  // CSS spacing class between blocks
  signatureMarginTop: string; // Top spacing for signature block
}

export interface VisibilityRules {
  showTitle: boolean;
  showSubtitle: boolean;
  showAbstract: boolean;
  showCoverImage: boolean;
  showSignatureClosure: boolean; // Scholarly large signature block
  showNoteFooter: boolean;        // Short inline note attribution footer
  showCitations: boolean;
  showFootnotes: boolean;
}

export interface PresentationSpec {
  contentType: 'Note' | 'Essay' | 'Article' | 'Notice' | "Editor's Note";
  typography: TypographySpec;
  spacing: SpacingSpec;
  visibility: VisibilityRules;
}
