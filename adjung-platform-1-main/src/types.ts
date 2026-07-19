export type UserRole = 'Chief Editor' | 'Editor' | 'Writer' | 'Visitor';

export interface VectorStroke {
  x: number;
  y: number;
  pressure?: number;
}

export interface DigitalSignature {
  id: string;
  label: string; 
  status: 'Archived' | 'Default';
  strokes: VectorStroke[][]; 
  type?: 'drawn' | 'typed';
  typedText?: string;
  fontFamily?: string;
  createdAt: string;
  penStyle?: {
    nibAngle?: number;
    inkFlowWeight?: number;
    baselineY?: number;
    canvasHeight?: number;
    inkColor?: string;
    paperTexture?: string;
  };
  typographyStyle?: {
    letterSpacing?: number;
    fontWeight?: number;
    slantAngle?: number;
    scale?: number;
    yOffset?: number;
  };
}


export interface RolePermissions {
  viewIndex: boolean;
  viewDirectory: boolean;
  curateFrontpage: boolean;
  inviteWriters: boolean;
  moderateReports: boolean;
  editOthersContent: boolean; // LOCKED FALSE
  manageSettings: boolean;    // LOCKED (TRUE for Chief Editor, FALSE for others)
  manageRbac: boolean;        // LOCKED (TRUE for Chief Editor, FALSE for others)
  manageLogs: boolean;
  createNotice: boolean;
  editNotice: boolean;
  publishNotice: boolean;
  archiveNotice: boolean;
  deleteNotice: boolean;
  createEditorNote: boolean;
  editEditorNote: boolean;
  publishEditorNote: boolean;
  archiveEditorNote: boolean;
  deleteEditorNote: boolean;
}

export interface User {
  id: string; // UUID or simple identifier
  username: string;
  email: string;
  role: UserRole;
  penName: string;
  signature: string; // Text representation of handwritten signature or styling instructions
  avatarColor?: string;
  bioSummary?: string;
  suspended?: boolean;
  affiliation?: string;
}

export type PublicationClass = 'Scholarly' | 'Institutional';
export type ScholarlyType = 'Note' | 'Essay' | 'Article';
export type InstitutionalType = 'Notice' | 'Editor\'s Note';
export type EntryType = ScholarlyType | InstitutionalType;
export type EntryStatus = 'Draft' | 'Published' | 'Archived';
export type EntryVisibility = 'Public' | 'Private';

export interface ReleaseLog {
  id: string;
  version: string;
  date: string;
  changes: {
    added?: string[];
    improved?: string[];
    fixed?: string[];
    deprecated?: string[];
  };
}

export interface PolicySection {
  id: string;
  title: string;
  content: string;
}

export interface PolicyDocument {
  id: string;
  type: 'Publishing' | 'Editorial' | 'AI' | 'Community' | 'Citation';
  title: string;
  sections: PolicySection[];
  lastUpdated: string;
}

export interface Citation {
  id: string;
  author: string;
  title: string;
  year: number;
  publisher: string;
  url?: string;
  doi?: string;
  isbn?: string;
}

export interface Footnote {
  id: string;
  content: string;
  label?: string; // Platform-wide subtitle/heading for footnotes
}

export interface EditorBlock {
  id: string;
  type: string;
  data: any;
}

export interface Revision {
  id: string;
  timestamp: string; // ISO String
  title: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  footnotes?: string[];
  footnotesData?: Footnote[];
  marginNotes?: { [key: number]: string };
  marginNotesData?: Record<string, string>;
  status: EntryStatus;
  visibility: EntryVisibility;
  tags: string[];
  slug: string;
  citations?: Citation[];
  citationIds?: string[];
  referenceSortOrder?: 'alphabetical' | 'appearance';
  referenceStyle?: string;
  signatureVersionId?: string;
  
  // Institutional Metadata
  publicationClass?: PublicationClass;
  publisher?: string;
  priority?: 'High' | 'Normal' | 'Low';
  effectiveFrom?: string;
  effectiveUntil?: string;
  isPinned?: boolean;
  editorialCategory?: string;
  isInstitutional?: boolean;
}

export interface Entry {
  id: string;
  publicationClass?: PublicationClass;
  authorId: string | null;
  publisher?: string;
  contentType: EntryType;
  status: EntryStatus;
  visibility: EntryVisibility;
  createdDate: string; // ISO String
  updatedDate: string; // ISO String
  publishedDate: string | null; // ISO String
  title: string;
  slug: string;
  tags: string[];
  canonicalUrl: string;
  content: string; // Rich text / markdown or custom structured format
  footnotes?: string[]; // Used for Essay
  footnotesData?: Footnote[];
  marginNotes?: { [key: number]: string }; // Map of paragraph index to margin note text for Article
  marginNotesData?: Record<string, string>; // Map of block ID to margin note text
  excerpt?: string;
  subtitle?: string;
  featuredImage?: string;
  revisions?: Revision[];
  citations?: Citation[];
  citationIds?: string[];
  referenceSortOrder?: 'alphabetical' | 'appearance';
  referenceStyle?: string;
  signatureVersionId?: string;
  
  // Institutional Metadata
  priority?: 'High' | 'Normal' | 'Low';
  effectiveFrom?: string;
  effectiveUntil?: string;
  isPinned?: boolean;
  editorialCategory?: string;
  isInstitutional?: boolean;
  discipline?: string;
  underReview?: boolean;
}

export interface BiographyItem {
  id: string;
  year: string;
  title: string;
  description: string;
  category: 'Education' | 'Career' | 'Publication' | 'Award' | 'Personal' | 'Other';
}

export interface WriterProfile {
  authorId: string;
  heroTitle: string;
  heroSubtitle: string;
}

export interface IdentityProfile {
  identityId: string;
  accountId: string;
  username: string;
  displayName: string;
  penName: string;
  biography: string;
  lifeTimeline: BiographyItem[];
  signatures: DigitalSignature[];
  publicVisibility: 'Public' | 'Private';
  affiliation?: string;
}

export interface SystemSettings {
  academicAffiliation: string;
  editorialPolicy: string;
  accentColor: string;
  allowSelfRegistration: boolean;
  featuredScholarId?: string;
  featuredEntryId?: string;
  featuredEssayIds?: string[];
  featuredNoteIds?: string[];
  editorialSelectionIds?: string[]; // Max 10 entries for Frontpage curation
  announcementBanner?: string;
  enableArabicAccent?: boolean;
  layoutDensity?: 'Standard' | 'Compact' | 'Classical';
  allowedSignatureFonts?: string[];
  rolePermissions?: {
    'Chief Editor': RolePermissions;
    'Editor': RolePermissions;
    'Writer': RolePermissions;
    'Visitor': RolePermissions;
  };
  inTheNewsText?: string;
  inTheNewsGoogleDocUrl?: string;
  worldClockHolidaysText?: string;
  worldClockHolidaysGoogleDocUrl?: string;
  researchFindingsText?: string;
  researchFindingsGoogleDocUrl?: string;
}

export interface SystemLog {
  id: string;
  timestamp: string;
  operator: string;
  role: string;
  action: string;
}

export interface NewsItem {
  desk: string;
  title: string;
  brief: string;
  source: string;
  url: string;
  rawIndex: number;
}

export interface ParseError {
  index: number;
  error: string;
}
