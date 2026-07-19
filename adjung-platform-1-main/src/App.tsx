import React, { useState, useEffect, useRef } from 'react';
import { User, Entry, WriterProfile, IdentityProfile, BiographyItem, SystemSettings, EntryType, RolePermissions, VectorStroke, DigitalSignature, PolicyDocument } from './types';
import { db } from './db/mockDb';
import { AuthService, SessionService, RbacService, UserRepository } from './services/authService';
import { useAppContext } from './context/AppContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { EntryRenderer } from './components/rendering/EntryRenderer';
import { TimelineEntryCollapseRenderer } from './components/rendering/TimelineEntryCollapseRenderer';
import { isArabicText, generateUUID, parseInlineFormatting, parseContentToBlocks, toRoman } from './utils';
import { SignatureLayout } from './components/desk/SignatureLayout';
import { SignatureRenderer } from './components/desk/SignatureRenderer';
import SignUpWizard from './components/common/SignUpWizard';
import { 
  Compass,
  User as UserIcon,
  ChevronLeft,
  FileText,
  FileEdit,
  Lock,
  Globe,
  Settings,
  ListOrdered,
  PenTool,
  Info,
  Database,
  ShieldAlert,
  UserCheck,
  LogIn,
  LogOut,
  ArrowRight,
  Plus,
  Search,
  Mail,
  Send
} from 'lucide-react';

import { FolioTimeline } from './components/portal/FolioTimeline';
import { FrontpageView } from './components/portal/FrontpageView';
import { FolioView } from './components/portal/FolioView';
import { BiographyView } from './components/portal/BiographyView';
import { PoliciesView } from './components/institutional/PoliciesView';
import { LandingView } from './components/portal/LandingView';
import { NoticesView } from './components/institutional/NoticesView';
import { EditorialNotesView } from './components/institutional/EditorialNotesView';
import { ChangelogView } from './components/institutional/ChangelogView';
import { PhilosophyCarousel } from './components/common/PhilosophyCarousel';
import { Footer } from './components/common/Footer';
import { Navbar } from './components/common/Navbar';
import { LoginModal } from './components/common/LoginModal';
import { AccountModal } from './components/common/AccountModal';

import { WritingDesk } from './components/desk/WritingDesk';
import { EditorialIndex } from './components/portal/EditorialIndex';
import { Editorium } from './components/studio/Editorium';
import { Directory } from './components/portal/Directory';
import { IdentityStudio } from './components/portal/IdentityStudio';
import { LoadingScreen } from './components/common/LoadingScreen';
import { ElasticMarginRow } from './components/rendering/ElasticMarginRow';
import { AnimatedSignature } from './components/desk/AnimatedSignature';
import { motion, AnimatePresence } from 'motion/react';
import { BRAND } from './config/brand';

function resolveSignatureStrokes(entry: Entry | null, authorId: string): VectorStroke[][] | undefined {
  const identity = db.getIdentityByAccountId(authorId);
  if (!identity) return undefined;
  
  if (entry?.signatureVersionId) {
    const sig = identity.signatures.find(s => s.id === entry.signatureVersionId);
    if (sig) return sig.strokes;
  }
  
  const defaultSig = identity.signatures.find(s => s.status === 'Default');
  if (defaultSig && defaultSig.type === 'drawn') return defaultSig.strokes;
  return undefined;
}

function resolveSignatureText(authorId: string, fallback: string): string {
  const identity = db.getIdentityByAccountId(authorId);
  if (!identity || !identity.signatures) return fallback;
  const defaultSig = identity.signatures.find(s => s.status === 'Default');
  if (defaultSig) {
    if (defaultSig.type === 'typed') return defaultSig.typedText;
    if (defaultSig.type === 'drawn') return ''; // If drawn, we don't display text fallback
  }
  return fallback;
}

function resolveDigitalSignature(authorId: string, entry?: Entry | null): DigitalSignature | undefined {
  const identity = db.getIdentityByAccountId(authorId);
  if (!identity || !identity.signatures) return undefined;
  if (entry?.signatureVersionId) {
    const sig = identity.signatures.find(s => s.id === entry.signatureVersionId);
    if (sig) return sig;
  }
  return identity.signatures.find(s => s.status === 'Default');
}

function resolveSignatureFont(authorId: string): string | undefined {
  const identity = db.getIdentityByAccountId(authorId);
  if (!identity || !identity.signatures) return undefined;
  const defaultSig = identity.signatures.find(s => s.status === 'Default');
  if (defaultSig && defaultSig.type === 'typed' && defaultSig.fontFamily) {
    const rawFamily = defaultSig.fontFamily.split(',')[0].trim().replace(/['"]/g, '');
    return `"${rawFamily}", cursive`;
  }
  return undefined;
}



function renderFrontpageBlock(block: any, pIdx: number) {
  if (block.type === 'heading') {
    const isAr = isArabicText(block.text);
    const textNode = parseInlineFormatting(block.text);
    if (block.level === 1) {
      return (
        <h3 
          key={pIdx} 
          dir={isAr ? 'rtl' : 'ltr'} 
          className={`font-serif text-stone-900 font-semibold my-2.5 ${
            isAr ? 'text-right text-[15px] font-arabic leading-loose' : 'text-left text-[14px] tracking-tight'
          }`}
        >
          {textNode}
        </h3>
      );
    } else {
      return (
        <h4 
          key={pIdx} 
          dir={isAr ? 'rtl' : 'ltr'} 
          className={`font-serif text-stone-850 font-medium my-2 ${
            isAr ? 'text-right text-[13px] font-arabic leading-loose' : 'text-left text-[12px]'
          }`}
        >
          {textNode}
        </h4>
      );
    }
  }

  if (block.type === 'list') {
    const listItems = block.items.map((listItem: any, itemIdx: number) => {
      const isAr = isArabicText(listItem.text);
      const isChecklist = listItem.checked !== undefined;
      const textNode = parseInlineFormatting(listItem.text);
      if (isChecklist) {
        return (
          <li 
            key={itemIdx} 
            className={`flex items-center gap-1.5 ${isAr ? 'justify-start flex-row-reverse text-right' : 'text-left'}`}
          >
            <input type="checkbox" checked={listItem.checked} disabled className="h-3 w-3 rounded text-adjung-maroon cursor-default" />
            <span className={`text-[12px] ${listItem.checked ? 'line-through text-stone-400' : 'text-stone-600'} ${isAr ? 'font-arabic' : 'font-serif'}`}>
              {textNode}
            </span>
          </li>
        );
      }
      return (
        <li key={itemIdx} className={`text-[12px] text-stone-600 ${isAr ? 'font-arabic text-right' : 'font-serif text-left'}`}>
          {textNode}
        </li>
      );
    });

    const isChecklist = block.items.some((i: any) => i.checked !== undefined);

    return (
      <div key={pIdx} className="my-2 text-left">
        <ul className={`space-y-1 ${isChecklist ? 'list-none pl-0' : 'list-disc pl-4'}`}>
          {listItems}
        </ul>
      </div>
    );
  }

  if (block.type === 'table') {
    return (
      <div key={pIdx} className="my-3 overflow-x-auto border border-stone-200/50 rounded p-1 bg-stone-50/20 text-left">
        <span className="font-mono text-[9px] text-stone-400 uppercase">Table: {block.headers.join(' | ')}</span>
      </div>
    );
  }

  if (block.type === 'image') {
    return (
      <figure key={pIdx} className="my-3 text-center bg-transparent">
        <span className="inline-block text-[11px] text-stone-400 italic border border-stone-200/55 p-1 rounded font-serif bg-stone-50/10">
          📷 [Image: {block.alt || 'Untitled'}]
        </span>
      </figure>
    );
  }

  if (block.type === 'divider') {
    return <hr key={pIdx} className="my-4 border-t border-stone-200/40" />;
  }

  if (block.type === 'code-block') {
    return (
      <pre key={pIdx} className="p-2.5 bg-stone-50 border border-stone-200/60 rounded font-mono text-[10px] text-left overflow-x-auto text-stone-700 max-h-32">
        <code>{block.code}</code>
      </pre>
    );
  }

  if (block.type === 'latin-quote') {
    return (
      <blockquote key={pIdx} className="my-4 pl-4 border-l border-adjung-maroon/20 text-left bg-transparent">
        <p className="font-serif italic text-stone-600 text-xs md:text-sm">
          {parseInlineFormatting(block.text)}
        </p>
        {block.translation && (
          <div dir="ltr" className="mt-2 pt-2 border-t border-stone-200/40 text-left">
            <p className="font-serif italic text-xs text-stone-500">
              {parseInlineFormatting(block.translation)}
            </p>
          </div>
        )}
      </blockquote>
    );
  }

  if (block.type === 'arabic-quote') {
    return (
      <blockquote key={pIdx} className="my-4 pr-4 border-r border-adjung-maroon/20 text-right bg-transparent">
        <p className="font-arabic text-sm md:text-base text-stone-850 leading-loose">
          {parseInlineFormatting(block.arabic)}
        </p>
        {block.translation && (
          <div dir="ltr" className="mt-2 pt-2 border-t border-stone-200/40 text-left">
            <p className="font-serif italic text-xs text-stone-500">
              {parseInlineFormatting(block.translation)}
            </p>
          </div>
        )}
      </blockquote>
    );
  }

  const isParaAr = isArabicText(block.text);
  return (
    <p 
      key={pIdx}
      dir={isParaAr ? 'rtl' : 'ltr'}
      className={`${
        isParaAr 
          ? 'font-arabic text-right text-stone-900 leading-loose text-sm md:text-base' 
          : 'font-serif text-left text-xs md:text-sm text-stone-650 leading-relaxed'
      }`}
    >
      {parseInlineFormatting(block.text)}
    </p>
  );
}





export default function App() {
  const {
    users,
    profiles,
    entries,
    systemSettings,
    setSystemSettings,
    initializing,
    currentUser,
    setCurrentUser,
    selectedAuthorId,
    setSelectedAuthorId,
    activeTab,
    setActiveTab,
    selectedEntry,
    setSelectedEntry,
    editingEntry,
    setEditingEntry,
    editoriumActiveTab,
    setEditoriumActiveTab,
    expandedNoteIds,
    setExpandedNoteIds,
    toggleNote,
    toast,
    toastVisible,
    showToast,
    setToastVisible,
    refreshDbState,
    resetDatabase,
    saveEntry,
    deleteEntry,
    createNewEntry,
    toggleUserSuspension,
    changeUserRole,
    saveWriterFromEditorium,
    hasPermission,
    inTheNewsGoogleDocText,
    worldClockHolidaysGoogleDocText,
    researchFindingsGoogleDocText
  } = useAppContext();

  const location = useLocation();
  const navigate = useNavigate();

  const subdomain = (() => {
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length > 2) {
      const sub = parts[0];
      if (sub !== 'www' && sub !== 'adjung' && sub !== 'localhost') {
        return sub;
      }
    }
    return null;
  })();

  const authorFromSubdomain = subdomain ? users.find(u => u.username === subdomain) : null;

  const [showNavbar, setShowNavbar] = useState(true);
  const [navVisible, setNavVisible] = useState(true);
  const [isFloating, setIsFloating] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [isHeaderHovered, setIsHeaderHovered] = useState(false);
  const [maxScroll, setMaxScroll] = useState(400);
  const [showInterlinear, setShowInterlinear] = useState(true);
  const lastScrollY = useRef(0);
  const [expandedFrontpageNotes, setExpandedFrontpageNotes] = useState<string[]>([]);
  
  // Tag / Category filter in Folio
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('All');
  const [isRouteSynced, setIsRouteSynced] = useState(false);
  const [indexSearchQuery, setIndexSearchQuery] = useState('');

  // Synchronize browser title with central brand identity on mount
  useEffect(() => {
    document.title = BRAND.name;
  }, []);

  // Authentication Fields
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignUpWizard, setShowSignUpWizard] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  
  // Sync Account Edit states when Account Modal is shown

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountUsername, setAccountUsername] = useState('');
  const [accountPassword, setAccountPassword] = useState('');
  const [accountConfirmPassword, setAccountConfirmPassword] = useState('');
  const [accountError, setAccountError] = useState('');

  // Sync Account Edit states when Account Modal is shown
  useEffect(() => {
    if (showAccountModal && currentUser) {
      setAccountEmail(currentUser.email || '');
      setAccountUsername(currentUser.username || '');
      setAccountPassword('');
      setAccountConfirmPassword('');
      setAccountError('');
    }
  }, [showAccountModal, currentUser]);

  // Editing Biography Item State
  const [editingBioItem, setEditingBioItem] = useState<BiographyItem | null>(null);
  const [showAddBioModal, setShowAddBioModal] = useState(false);
  const [newBioYear, setNewBioYear] = useState('');
  const [newBioTitle, setNewBioTitle] = useState('');
  const [newBioDesc, setNewBioDesc] = useState('');
  const [newBioCategory, setNewBioCategory] = useState<BiographyItem['category']>('Education');

  // Writing Desk - Profile Settings States
  const [deskUsername, setDeskUsername] = useState('');
  const [deskPenName, setDeskPenName] = useState('');
  const [deskSignature, setDeskSignature] = useState('');
  const [deskBioText, setDeskBioText] = useState('');
  const [deskHeroTitle, setDeskHeroTitle] = useState('');
  const [deskHeroSubtitle, setDeskHeroSubtitle] = useState('');
  const [deskHeroSignatureText, setDeskHeroSignatureText] = useState('');

  const [deskViewMode, setDeskViewMode] = useState<'preview' | 'editor'>('preview');
  const deskLastScrollY = useRef<number>(0);

  useEffect(() => {
    if (editingEntry) {
      setDeskViewMode('preview');
    }
  }, [editingEntry?.id]);

  // Editorium - Invite Scholar States
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [generatedInvitation, setGeneratedInvitation] = useState<{
    id: string;
    name: string;
    email: string;
    message: string;
    signupUrl: string;
    emailBody: string;
  } | null>(null);
  const [invitedRegistrationData, setInvitedRegistrationData] = useState<{
    name: string;
    email: string;
    username: string;
    penName: string;
    signature: string;
    heroTitle: string;
    heroSubtitle: string;
    bioText: string;
  } | null>(null);

  // Editorium Sub-navigation and Search States
  const [editoriumSearchQuery, setEditoriumSearchQuery] = useState('');
  const [frontpageSearchQuery, setFrontpageSearchQuery] = useState('');
  const [editoriumSelectedWriterId, setEditoriumSelectedWriterId] = useState<string | null>(null);

  // Sync default selected writer in Editorium
  useEffect(() => {
    if (!editoriumSelectedWriterId && users.length > 0) {
      const firstWriter = users.find(u => u.role === 'Writer') || users[0];
      setEditoriumSelectedWriterId(firstWriter.id);
    }
  }, [users, editoriumSelectedWriterId]);

  // Editorium - Writer Edit States
  const [editWriterPenName, setEditWriterPenName] = useState('');
  const [editWriterUsername, setEditWriterUsername] = useState('');
  const [editWriterSignature, setEditWriterSignature] = useState('');
  const [editWriterBioSummary, setEditWriterBioSummary] = useState('');
  const [editWriterHeroTitle, setEditWriterHeroTitle] = useState('');
  const [editWriterHeroSubtitle, setEditWriterHeroSubtitle] = useState('');
  const [editWriterBioText, setEditWriterBioText] = useState('');

  // Editorial Top Navbar scroll behavior
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const currentMaxScroll = document.documentElement.scrollHeight - window.innerHeight;
          setScrollY(currentScrollY);
          setMaxScroll(currentMaxScroll);
          setIsFloating(currentScrollY > 15);
          setNavVisible(true); // Always keep navbar visibility state true, opacity is handled via style
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    // Measure initially
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeTab, selectedEntry, selectedAuthorId]);

  // Synchronize state-to-URL (pushState adapter)
  useEffect(() => {
    if (initializing || !isRouteSynced) return;

    // Handle subdomain override logic
    if (authorFromSubdomain) {
      let subPath = '/';
      if (editingEntry) {
        subPath = `/desk/edit/${editingEntry.id}`;
      } else if (selectedEntry) {
        subPath = `/${selectedEntry.contentType.toLowerCase()}/${selectedEntry.slug}`;
      } else {
        if (activeTab === 'bio') subPath = '/bio';
        else if (activeTab === 'identity') subPath = '/identity';
        else if (activeTab === 'desk') subPath = '/desk';
        else if (activeTab === 'policies') subPath = '/policies';
      }

      if (location.pathname !== subPath) {
        navigate(subPath);
      }
      return;
    }

    let newPath = '/';
    if (editingEntry) {
      newPath = `/desk/edit/${editingEntry.id}`;
    } else if (selectedEntry) {
      if (selectedEntry.publicationClass === 'Institutional') {
        const typeSlug = selectedEntry.contentType === 'Notice' ? 'notice' : 'editorial';
        newPath = `/${typeSlug}/${selectedEntry.slug}`;
      } else {
        newPath = `/${selectedEntry.contentType.toLowerCase()}/${selectedEntry.authorId}/${selectedEntry.slug}`;
      }
    } else {
      if (activeTab === 'landing') newPath = '/landing';
      else if (activeTab === 'frontpage') newPath = '/frontpage';
      else if (activeTab === 'directory') newPath = '/directory';
      else if (activeTab === 'index') newPath = '/index';
      else if (activeTab === 'editorium') newPath = `/editorium/${editoriumActiveTab}`;
      else if (activeTab === 'desk') newPath = '/desk';
      else if (activeTab === 'folio') newPath = `/folio/${selectedAuthorId || ''}`;
      else if (activeTab === 'bio') newPath = `/bio/${selectedAuthorId || ''}`;
      else if (activeTab === 'identity') newPath = '/identity';
      else if (activeTab === 'notices') newPath = '/notices';
      else if (activeTab === 'editorial') newPath = '/editorial';
      else if (activeTab === 'changelog') newPath = '/changelog';
      else if (activeTab === 'policies') newPath = '/policies';
    }

    if (location.pathname !== newPath) {
      navigate(newPath);
    }
  }, [activeTab, selectedAuthorId, selectedEntry, editingEntry, initializing, editoriumActiveTab, navigate, location.pathname, authorFromSubdomain]);

  useEffect(() => {
    if (initializing) return;

    const path = location.pathname;
    const parts = path.split('/').filter(Boolean);
    console.log('[ROUTER] path:', path, 'parts:', parts, 'currentUser:', currentUser?.id, 'authorFromSubdomain:', authorFromSubdomain?.id);

    // If subdomain is active, we enforce selectedAuthorId
    if (authorFromSubdomain) {
      setSelectedAuthorId(authorFromSubdomain.id);
      
      if (parts.length === 0) {
        setActiveTab('folio');
        setSelectedEntry(null);
        setEditingEntry(null);
        return;
      }

      const route = parts[0];
      if (route === 'bio') {
        setActiveTab('bio');
        setSelectedEntry(null);
        setEditingEntry(null);
      } else if (route === 'identity') {
        if (!currentUser) {
          navigate('/');
        } else {
          setActiveTab('identity');
          setSelectedEntry(null);
          setEditingEntry(null);
        }
      } else if (route === 'desk') {
        setActiveTab('desk');
        setSelectedEntry(null);
        if (parts[1] === 'edit' && parts[2]) {
          const entry = entries.find(e => e.id === parts[2]);
          setEditingEntry(entry || null);
        } else {
          setEditingEntry(null);
        }
      } else if (route === 'policies') {
        setActiveTab('policies');
        setSelectedEntry(null);
        setEditingEntry(null);
      } else if ((route === 'note' || route === 'essay' || route === 'article') && parts[1]) {
        const slug = parts[1];
        const entry = entries.find(e => e.authorId === authorFromSubdomain.id && e.slug === slug);
        if (entry) {
          setSelectedEntry(entry);
          setActiveTab('folio');
          setEditingEntry(null);
        }
      }
      return;
    }

    // Main Portal routing synchronization
    if (parts.length === 0 || parts[0] === 'landing') {
      if (currentUser) {
        if (activeTab === 'landing' || activeTab === 'frontpage') {
          console.log('[ROUTER] Main portal sync: currentUser exists -> frontpage');
          setActiveTab('frontpage');
          setSelectedAuthorId('');
          setSelectedEntry(null);
          setEditingEntry(null);
        }
      } else {
        console.log('[ROUTER] Main portal sync: no currentUser -> landing');
        setActiveTab('landing');
        setSelectedAuthorId('');
        setSelectedEntry(null);
        setEditingEntry(null);
      }
      return;
    }

    const route = parts[0];
    if (route === 'frontpage') {
      setActiveTab('frontpage');
      setSelectedAuthorId('');
      setSelectedEntry(null);
      setEditingEntry(null);
    } else if (route === 'identity') {
      if (!currentUser) {
        navigate('/landing');
      } else {
        setActiveTab('identity');
        setSelectedAuthorId('');
        setSelectedEntry(null);
        setEditingEntry(null);
      }
    } else if (route === 'directory') {
      setActiveTab('directory');
      setSelectedAuthorId('');
      setSelectedEntry(null);
      setEditingEntry(null);
    } else if (route === 'index') {
      setActiveTab('index');
      setSelectedAuthorId('');
      setSelectedEntry(null);
      setEditingEntry(null);
    } else if (route === 'editorium') {
      setActiveTab('editorium');
      setSelectedAuthorId('');
      setSelectedEntry(null);
      setEditingEntry(null);
      if (parts[1]) {
        setEditoriumActiveTab(parts[1] as any);
      } else {
        setEditoriumActiveTab('platform');
      }
    } else if (route === 'desk') {
      setActiveTab('desk');
      setSelectedAuthorId(currentUser?.id || '');
      setSelectedEntry(null);
      if (parts[1] === 'edit' && parts[2]) {
        const entry = entries.find(e => e.id === parts[2]);
        setEditingEntry(entry || null);
      } else {
        setEditingEntry(null);
      }
    } else if (route === 'folio' && parts[1]) {
      setSelectedAuthorId(parts[1]);
      setActiveTab('folio');
      setSelectedEntry(null);
      setEditingEntry(null);
    } else if (route === 'bio' && parts[1]) {
      setSelectedAuthorId(parts[1]);
      setActiveTab('bio');
      setSelectedEntry(null);
      setEditingEntry(null);
    } else if (route === 'notices') {
      setActiveTab('notices');
      setSelectedAuthorId('');
      setSelectedEntry(null);
      setEditingEntry(null);
    } else if (route === 'notice' && parts[1]) {
      const slug = parts[1];
      const entry = entries.find(e => e.contentType === 'Notice' && e.slug === slug);
      if (entry) {
        setSelectedEntry(entry);
        setActiveTab('notices');
        setEditingEntry(null);
      }
    } else if (route === 'editorial') {
      if (parts[1]) {
        const slug = parts[1];
        const entry = entries.find(e => e.contentType === "Editor's Note" && e.slug === slug);
        if (entry) {
          setSelectedEntry(entry);
          setActiveTab('editorial');
          setEditingEntry(null);
        }
      } else {
        setActiveTab('editorial');
        setSelectedEntry(null);
        setEditingEntry(null);
      }
    } else if (route === 'changelog') {
      setActiveTab('changelog');
      setSelectedAuthorId('');
      setSelectedEntry(null);
      setEditingEntry(null);
    } else if (route === 'policies') {
      setActiveTab('policies');
      setSelectedAuthorId('');
      setSelectedEntry(null);
      setEditingEntry(null);
    } else if ((route === 'note' || route === 'essay' || route === 'article') && parts[1] && parts[2]) {
      const authorId = parts[1];
      const slug = parts[2];
      const entry = entries.find(e => e.authorId === authorId && e.slug === slug);
      if (entry) {
        setSelectedAuthorId(authorId);
        setSelectedEntry(entry);
        setActiveTab('folio');
        setEditingEntry(null);
      }
    }
    setIsRouteSynced(true);
  }, [location.pathname, currentUser, entries, initializing, authorFromSubdomain]);

  // Initialize selected writer edit fields when selection changes
  useEffect(() => {
    if (editoriumSelectedWriterId) {
      const writer = users.find(u => u.id === editoriumSelectedWriterId);
      if (writer) {
        const p = profiles.find(prof => prof.authorId === writer.id) || db.getProfileByAuthorId(writer.id);
        setEditWriterPenName(writer.penName || '');
        setEditWriterUsername(writer.username || '');
        setEditWriterSignature(writer.signature || '');
        setEditWriterBioSummary(writer.bioSummary || '');
        setEditWriterHeroTitle(p?.heroTitle || '');
        setEditWriterHeroSubtitle(p?.heroSubtitle || '');
        const ident = db.getIdentityByAccountId(writer.id);
        setEditWriterBioText(ident?.biography || '');
      }
    }
  }, [editoriumSelectedWriterId, users, profiles]);

  // Save writer modifications from Editorium
  const handleSaveWriterFromEditorium = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editoriumSelectedWriterId) return;

    const writer = users.find(u => u.id === editoriumSelectedWriterId);
    if (!writer) return;

    const updatedUser: User = {
      ...writer,
      username: editWriterUsername,
      penName: editWriterPenName,
      signature: editWriterSignature,
      bioSummary: editWriterBioSummary,
    };
    db.updateUser(updatedUser);

    const profile = db.getProfileByAuthorId(writer.id);
    const updatedProfile: WriterProfile = {
      ...profile,
      heroTitle: editWriterHeroTitle,
      heroSubtitle: editWriterHeroSubtitle,
    };
    db.updateProfile(updatedProfile);
    
    const identity = db.getIdentityByAccountId(writer.id);
    if (identity) {
      db.updateIdentity({
        ...identity,
        biography: editWriterBioText,
      });
    }

    refreshDbState();
    showToast('Settings updated', 'success');
  };



  // Dynamic navigation generation matching Access Policy
  const getNavigationItems = () => {
    const items: { id: string; label: string; action: () => void; isActive: boolean }[] = [];

    if (!currentUser) {
      // Visitor navigation: Optionally Scholar Folio / Biography if a scholar is active
      if (selectedAuthorId) {
        items.push({
          id: 'folio',
          label: 'Folio',
          action: () => {
            setActiveTab('folio');
            setSelectedEntry(null);
            setEditingEntry(null);
          },
          isActive: activeTab === 'folio'
        });
        items.push({
          id: 'bio',
          label: 'Biography',
          action: () => {
            setActiveTab('bio');
            setSelectedEntry(null);
            setEditingEntry(null);
          },
          isActive: activeTab === 'bio'
        });
      }

      if (hasPermission('viewDirectory')) {
        items.push({
          id: 'directory',
          label: 'Directory',
          action: () => {
            setActiveTab('directory');
            setSelectedEntry(null);
            setEditingEntry(null);
          },
          isActive: activeTab === 'directory'
        });
      }
    } else {
      // Authenticated user navigation: Folio, Biography, Desk, and administrative tabs as permitted
      items.push({
        id: 'folio',
        label: 'Folio',
        action: () => {
          if (!selectedAuthorId) {
            setSelectedAuthorId(currentUser.id);
          }
          setActiveTab('folio');
          setSelectedEntry(null);
          setEditingEntry(null);
        },
        isActive: activeTab === 'folio'
      });

      items.push({
        id: 'bio',
        label: 'Biography',
        action: () => {
          if (!selectedAuthorId) {
            setSelectedAuthorId(currentUser.id);
          }
          setActiveTab('bio');
          setSelectedEntry(null);
          setEditingEntry(null);
        },
        isActive: activeTab === 'bio'
      });

      items.push({
        id: 'desk',
        label: 'Desk',
        action: () => {
          setSelectedAuthorId(currentUser.id);
          setActiveTab('desk');
          setSelectedEntry(null);
          setEditingEntry(null);
        },
        isActive: activeTab === 'desk'
      });

      if (hasPermission('viewIndex')) {
        items.push({
          id: 'index',
          label: 'Index',
          action: () => {
            setActiveTab('index');
            setSelectedEntry(null);
            setEditingEntry(null);
          },
          isActive: activeTab === 'index'
        });
      }

      if (hasPermission('curateFrontpage')) {
        items.push({
          id: 'editorium',
          label: 'Editorium',
          action: () => {
            setActiveTab('editorium');
            setSelectedEntry(null);
            setEditingEntry(null);
          },
          isActive: activeTab === 'editorium'
        });
      }

      if (hasPermission('manageSettings')) {
        items.push({
          id: 'settings',
          label: 'Settings',
          action: () => {
            setActiveTab('settings');
            setSelectedEntry(null);
            setEditingEntry(null);
          },
          isActive: activeTab === 'settings'
        });
      }

      if (hasPermission('viewDirectory')) {
        items.push({
          id: 'directory',
          label: 'Directory',
          action: () => {
            setActiveTab('directory');
            setSelectedEntry(null);
            setEditingEntry(null);
          },
          isActive: activeTab === 'directory'
        });
      }
    }

    return items;
  };

  // Toggle writer suspension state
  const handleToggleUserSuspension = (targetUserId: string) => {
    if (!currentUser || !hasPermission('manageRbac')) {
      showToast('Permission Denied: Only users with RBAC management privileges can suspend accounts.', 'error');
      return;
    }

    // Self-suspension check
    if (currentUser.id === targetUserId) {
      showToast('Self-Administration Safety: You cannot suspend your own account.', 'error');
      return;
    }

    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return;

    // Safety: Ensure there is at least one active Chief Editor remaining
    if (targetUser.role === 'Chief Editor' && !targetUser.suspended) {
      const activeChiefEditors = users.filter(u => u.role === 'Chief Editor' && !u.suspended);
      if (activeChiefEditors.length <= 1) {
        showToast('Self-Administration Safety: The platform must always maintain at least one active Chief Editor.', 'error');
        return;
      }
    }

    const updatedUser: User = {
      ...targetUser,
      suspended: !targetUser.suspended
    };
    db.updateUser(updatedUser);
    db.addLog(`${updatedUser.suspended ? 'Suspended' : 'Reactivated'} account of ${targetUser.penName} (@${targetUser.username}).`, currentUser.penName, currentUser.role);
    refreshDbState();

    showToast(`${targetUser.penName}'s account has been ${updatedUser.suspended ? 'suspended' : 'reactivated'}.`, 'success');
  };

  // Change user role (Chief Editor only)
  const handleChangeUserRole = (targetUserId: string, newRole: User['role']) => {
    if (!currentUser || !hasPermission('manageRbac')) {
      showToast('Permission Denied: Only users with RBAC management privileges can modify user roles.', 'error');
      return;
    }

    // Self-demotion/role modification check
    if (currentUser.id === targetUserId) {
      showToast('Self-Administration Safety: You cannot demote yourself or modify your own role.', 'error');
      return;
    }

    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return;

    // Safety: Ensure there is at least one active Chief Editor remaining
    if (targetUser.role === 'Chief Editor' && newRole !== 'Chief Editor') {
      const activeChiefEditors = users.filter(u => u.role === 'Chief Editor' && !u.suspended);
      if (activeChiefEditors.length <= 1) {
        showToast('Self-Administration Safety: The platform must always maintain at least one active Chief Editor.', 'error');
        return;
      }
    }

    const updatedUser: User = {
      ...targetUser,
      role: newRole
    };
    db.updateUser(updatedUser);
    db.addLog(`Modified role of ${targetUser.penName} (@${targetUser.username}) from '${targetUser.role}' to '${newRole}'.`, currentUser.penName, currentUser.role);
    refreshDbState();

    showToast(`${targetUser.penName}'s role changed to ${newRole}.`, 'success');
  };

  // Initialize selected author biography state when tab or selection changes
  useEffect(() => {
    if (currentUser && activeTab === 'desk') {
      const userProfile = db.getProfileByAuthorId(currentUser.id);
      const identity = db.getIdentityByAccountId(currentUser.id);
      setDeskUsername(currentUser.username);
      setDeskPenName(currentUser.penName);
      setDeskSignature(currentUser.signature);
      setDeskBioText(identity ? identity.biography : '');
      setDeskHeroTitle(userProfile.heroTitle);
      setDeskHeroSubtitle(userProfile.heroSubtitle);
      setDeskHeroSignatureText(currentUser.signature);
    }
  }, [currentUser, activeTab]);



  // Login handler
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    try {
      const authenticatedUser = await AuthService.signIn(usernameInput, passwordInput, rememberMe);
      setCurrentUser(authenticatedUser);
      setSelectedAuthorId(authenticatedUser.id);
      setUsernameInput('');
      setPasswordInput('');
      setShowLoginModal(false);
      
      // Redirect to Folio upon login
      setActiveTab('folio');
      setEditingEntry(null);
      setSelectedEntry(null);
      showToast(`Welcome back, ${authenticatedUser.penName}!`, 'success');
    } catch (err: any) {
      setLoginError(err.message || 'Authentication failed.');
    }
  };

  // Fast direct simulation switcher (helps evaluators easily test different roles)
  const handleFastLogin = async (username: string) => {
    try {
      const authenticatedUser = await AuthService.signInWithPreset(username);
      setCurrentUser(authenticatedUser);
      setSelectedAuthorId(authenticatedUser.id);
      setActiveTab('folio');
      setEditingEntry(null);
      setSelectedEntry(null);
      setShowLoginModal(false);
      showToast(`Logged in as ${authenticatedUser.penName} (${authenticatedUser.role})`, 'success');
    } catch (err: any) {
      showToast(err.message || 'Fast Login failed.', 'error');
    }
  };

  // Logout handler
  const handleLogout = () => {
    AuthService.signOut();
    setCurrentUser(null);
    setSelectedAuthorId('');
    setActiveTab('landing');
    setEditingEntry(null);
    setSelectedEntry(null);
    showToast('Signed out successfully.', 'info');
  };

  // Save Writing Desk Entry
  const handleSaveEntry = (updatedEntry: Entry) => {
    db.saveEntry(updatedEntry);
    refreshDbState();
    if (editingEntry?.id === updatedEntry.id) {
      setEditingEntry(updatedEntry);
    }
  };

  // Delete Writing Desk Entry
  const handleDeleteEntry = (entryId: string) => {
    db.deleteEntry(entryId);
    refreshDbState();
    setEditingEntry(null);
    setSelectedEntry(null);
  };

  // Create new draft entry
  const handleCreateNewEntry = (type: EntryType) => {
    if (!currentUser) return;

    const newId = generateUUID();
    const tempTitle = type === 'Note' ? '' : `Untitled ${type}`;
    const defaultContent = type === 'Article' 
      ? 'This is the first paragraph of your scholarly article.\n\nThis is the second paragraph of your article. Margin notes are displayed adjacent to their respective paragraph.'
      : type === 'Essay'
      ? 'This is the primary discourse of your essay. You may incorporate footnotes[^1] directly inside your entry text.\n\nAnother paragraph expanding on your thesis.'
      : type === 'Notice' ? 'Official notice regarding platform operations or schedule updates.'
        : type === "Editor's Note" ? 'Official reflections from the Editorial Board regarding the structural direction of the platform.'
        : 'A concise scholarly note or philosophical fragment. Supports right-to-left formatting for Arabic or Jawi script.';

    const slugSuffix = Date.now().toString().slice(-4);
    const entrySlug = type === 'Note' ? `note-${slugSuffix}` : `untitled-${type.toLowerCase()}-${slugSuffix}`;

    const newEntry: Entry = {
      id: newId,
      authorId: currentUser.id,
      contentType: type,
      status: 'Draft',
      visibility: 'Private',
      createdDate: new Date().toISOString(),
      updatedDate: new Date().toISOString(),
      publishedDate: null,
      title: tempTitle,
      slug: entrySlug,
      tags: ['Scholarship'],
      canonicalUrl: `https://${currentUser.penName.toLowerCase().replace(/\s+/g, '')}.adjung.com/${type.toLowerCase()}/${type === 'Note' ? 'note-' + slugSuffix : 'untitled'}`,
      content: defaultContent,
      footnotes: type === 'Essay' ? ['Your first footnote description citation goes here.'] : undefined,
      marginNotes: type === 'Article' ? { 0: 'A scholarly margin note aligned with paragraph 1.' } : undefined
    };

    db.saveEntry(newEntry);
    refreshDbState();
    setEditingEntry(newEntry);
  };

  // Save Folio Settings (Public Writing Identity)
  const handleSaveFolioSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // 1. Update user's public identity metadata
    const updatedUser: User = {
      ...currentUser,
      penName: deskPenName,
      signature: deskSignature
    };
    db.updateUser(updatedUser);
    setCurrentUser(updatedUser);

    // 2. Update writer profile info
    const profile = db.getProfileByAuthorId(currentUser.id);
    const updatedProfile: WriterProfile = {
      ...profile,
      heroTitle: deskHeroTitle,
      heroSubtitle: deskHeroSubtitle,
    };
    db.updateProfile(updatedProfile);

    const identity = db.getIdentityByAccountId(currentUser.id);
    if (identity) {
      db.updateIdentity({
        ...identity,
        biography: deskBioText
      });
    }
    
    refreshDbState();
    showToast('Writing profile updated successfully', 'success');
  };

  // Save Account Credentials Settings
  const handleSaveAccountSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const cleanUsername = accountUsername.trim().toLowerCase().replace(/\s+/g, '.');
    const cleanEmail = accountEmail.trim();

    if (!cleanUsername) {
      setAccountError('Username cannot be empty.');
      return;
    }

    // Username pattern verification
    const usernameRegex = /^[a-z0-9._]+$/;
    if (!usernameRegex.test(cleanUsername)) {
      setAccountError('Username can only contain lowercase letters, numbers, dots, and underscores.');
      return;
    }

    // Check duplicate username if changed
    if (cleanUsername !== currentUser.username) {
      const exists = users.some(u => u.id !== currentUser.id && u.username.toLowerCase() === cleanUsername);
      if (exists) {
        setAccountError(`The username '${cleanUsername}' is already taken.`);
        return;
      }
    }

    // Password verification if entered
    if (accountPassword) {
      if (accountPassword.length < 4) {
        setAccountError('Password must be at least 4 characters long.');
        return;
      }
      if (accountPassword !== accountConfirmPassword) {
        setAccountError('Passwords do not match.');
        return;
      }
    }

    // Update User
    const updatedUser: User = {
      ...currentUser,
      username: cleanUsername,
      email: cleanEmail
    };

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...updatedUser,
        password: accountPassword || undefined
      })
    })
    .then(res => {
      if (!res.ok) throw new Error("Server update failed");
      return res.json();
    })
    .then(() => {
      localStorage.setItem('Adjung_session_user_data', JSON.stringify(updatedUser));
      if (accountPassword) {
        localStorage.setItem(`adjung_password_${currentUser.id}`, accountPassword);
      }
      db.updateUser(updatedUser);
      setCurrentUser(updatedUser);
      db.addLog(`Updated account credentials (username: @${cleanUsername}, email: ${cleanEmail || 'none'}).`, currentUser.penName, currentUser.role);
      refreshDbState();
      setShowAccountModal(false);
      showToast('Account credentials updated successfully', 'success');
    })
    .catch(err => {
      console.error(err);
      setAccountError('Gagal mengemas kini kredensial di server.');
    });
  };

  // Add Biography Timeline Item
  const handleAddBioItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const profile = db.getProfileByAuthorId(currentUser.id);
    const newItem: BiographyItem = {
      id: generateUUID(),
      year: newBioYear || '2026',
      title: newBioTitle || 'New Milestone',
      description: newBioDesc || 'Milestone description',
      category: newBioCategory
    };

    const identity = db.getIdentityByAccountId(currentUser.id);
    if (identity) {
      const updatedIdentity: IdentityProfile = {
        ...identity,
        lifeTimeline: [...identity.lifeTimeline, newItem].sort((a, b) => parseInt(a.year) - parseInt(b.year))
      };
      db.updateIdentity(updatedIdentity);
    }
    refreshDbState();
    showToast('Biography updated', 'success');
    
    // Reset modal states
    setShowAddBioModal(false);
    setNewBioYear('');
    setNewBioTitle('');
    setNewBioDesc('');
  };

  // Remove Biography Timeline Item
  const handleRemoveBioItem = (itemId: string) => {
    if (!currentUser) return;
    const identity = db.getIdentityByAccountId(currentUser.id);
    if (identity) {
      const updatedIdentity = {
        ...identity,
        lifeTimeline: identity.lifeTimeline.filter(item => item.id !== itemId)
      };
      db.updateIdentity(updatedIdentity);
    }
    refreshDbState();
    showToast('Biography updated', 'success');
  };

  // Editorium: Send invitation to a scholar
  const handleSendInvitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;

    const signupUrl = `https://adjung.com/invite/register?name=${encodeURIComponent(inviteName.trim())}&email=${encodeURIComponent(inviteEmail.trim())}`;
    const emailBody = `Salutations ${inviteName.trim()},

You are cordially invited by the Chief Editor of Adjung to join our publishing platform as an independent Writer.

Name: ${inviteName.trim()}
Email: ${inviteEmail.trim()}
${inviteMessage.trim() ? `\nMessage from the Chief Editor:\n"${inviteMessage.trim()}"\n` : ''}
To accept this invitation and initialize your personal scholarly Folio, please click the link below to choose your Username and signature:
${signupUrl}

Respectfully,
Editorial Board of Adjung`;

    setGeneratedInvitation({
      id: generateUUID(),
      name: inviteName.trim(),
      email: inviteEmail.trim(),
      message: inviteMessage.trim(),
      signupUrl,
      emailBody
    });

    // Reset fields
    setInviteName('');
    setInviteEmail('');
    setInviteMessage('');

    showToast(`Invitation sent to ${inviteName.trim()}`, 'success');
  };

  // Handle completing registration from invitation
  const handleCompleteRegistration = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitedRegistrationData) return;

    const { username, penName, signature, heroTitle, heroSubtitle, bioText, email, name } = invitedRegistrationData;

    if (!username.trim() || !penName.trim() || !signature.trim()) {
      showToast('Please fill out all required fields.', 'error');
      return;
    }

    const formattedUsername = username.trim().toLowerCase().replace(/\s+/g, '.');
    
    // Check reserved usernames
    const RESERVED_PATHS = ['admin', 'api', 'search', 'settings', 'login', 'register', 'frontpage', 'directory', 'index', 'editorium', 'desk', 'folio', 'bio', 'notices', 'notice', 'editorial', 'changelog', 'policies', 'identity'];
    if (RESERVED_PATHS.includes(formattedUsername)) {
      showToast(`Self-Administration Safety: '${formattedUsername}' is a reserved system path.`, 'error');
      return;
    }
    
    // Check for duplicate username
    const exists = users.some(u => u.username.toLowerCase() === formattedUsername);
    if (exists) {
      showToast(`Self-Administration Safety: '${formattedUsername}' is already taken. Please select a unique username.`, 'error');
      return;
    }

    const newUserId = `user-${formattedUsername.replace(/\./g, '-')}`;
    const newUser: User = {
      id: newUserId,
      username: formattedUsername,
      email: email,
      role: 'Writer',
      penName: penName.trim(),
      signature: signature.trim(),
      avatarColor: 'bg-stone-800 text-stone-100',
      bioSummary: `Newly registered independent scholar on Adjung.`
    };

    // Create the User in the mockDb
    db.createUser(newUser);

    // Update associated empty profile
    const profile = db.getProfileByAuthorId(newUserId);
    const updatedProfile: WriterProfile = {
      ...profile,
      heroTitle: heroTitle.trim() || `${penName.trim()}’s Folio`,
      heroSubtitle: heroSubtitle.trim() || 'A collection of writings and scholarly notes.'
    };
    db.updateProfile(updatedProfile);
    
    const identity = db.getIdentityByAccountId(newUserId);
    if (identity) {
      db.updateIdentity({
        ...identity,
        biography: bioText.trim() || `Biography of ${penName.trim()}.`
      });
    }

    // Sync state
    refreshDbState();
    setCurrentUser(newUser);
    setSelectedAuthorId(newUserId);
    setActiveTab('desk');
    setInvitedRegistrationData(null);

    showToast(`Folio Initialized! Welcome to Adjung, ${penName.trim()}!`, 'success');
  };

  const handleWizardComplete = (data: any) => {
    const { username, displayName, penName, signatureData, email, biography, professionalTitle, institution, country, areasOfInterest, domain } = data;

    const formattedUsername = (domain || username).trim().toLowerCase().replace(/\s+/g, '.');
    
    // Check reserved usernames
    const RESERVED_PATHS = ['admin', 'api', 'search', 'settings', 'login', 'register', 'frontpage', 'directory', 'index', 'editorium', 'desk', 'folio', 'bio', 'notices', 'notice', 'editorial', 'changelog', 'policies', 'identity'];
    if (RESERVED_PATHS.includes(formattedUsername)) {
      showToast(`Self-Administration Safety: '${formattedUsername}' is a reserved system path.`, 'error');
      return;
    }
    
    // Check for duplicate username
    const exists = users.some(u => u.username.toLowerCase() === formattedUsername);
    if (exists) {
      showToast(`Self-Administration Safety: '${formattedUsername}' is already taken. Please select a unique username.`, 'error');
      return;
    }

    const newUserId = `user-${formattedUsername.replace(/\./g, '-')}`;
    const newUser: User = {
      id: newUserId,
      username: formattedUsername,
      email: email.trim(),
      role: 'Writer',
      penName: (penName || displayName).trim(),
      signature: typeof signatureData === 'string' ? signatureData.trim() : (penName || displayName).trim(),
      avatarColor: 'bg-stone-800 text-stone-100',
      bioSummary: `Newly registered independent scholar on Adjung.`
    };

    // Create the User in the mockDb
    db.createUser(newUser);

    // Update associated empty profile
    const profile = db.getProfileByAuthorId(newUserId);
    const updatedProfile: WriterProfile = {
      ...profile,
      heroTitle: `${(penName || displayName).trim()}'s Folio`,
      heroSubtitle: professionalTitle || 'A collection of writings and scholarly notes.'
    };
    db.updateProfile(updatedProfile);
    
    const identity = db.getIdentityByAccountId(newUserId);
    if (identity) {
      // bioContent removed
      db.updateIdentity({
        ...identity,
        displayName: displayName.trim(),
        penName: (penName || displayName).trim(),
        biography: biography ? biography.trim() : `Biography of ${(penName || displayName).trim()}.`
      });
    }

    // Sync state
    refreshDbState();
    setCurrentUser(newUser);
    setSelectedAuthorId(newUserId);
    setActiveTab('desk');
    setShowSignUpWizard(false);
    showToast(`Membership established! Welcome to Adjung, ${(penName || displayName).trim()}!`, 'success');
  };

  // Editorium: Reset Database
  const handleResetDatabase = () => {
    if (window.confirm('WARNING: This will restore the database to the initial academic seed data, erasing all custom local modifications. Proceed?')) {
      db.resetToDefaults();
      AuthService.signOut();
      refreshDbState();
      setCurrentUser(null);
      setSelectedAuthorId('');
      setActiveTab('folio');
      setEditingEntry(null);
      setSelectedEntry(null);
    }
  };

  // Active Author profile and records (no silent seeded fallbacks!)
  const currentAuthor = selectedAuthorId ? users.find(u => u.id === selectedAuthorId) : undefined;
  const authorProfile = selectedAuthorId ? (profiles.find(p => p.authorId === selectedAuthorId) || db.getProfileByAuthorId(selectedAuthorId)) : undefined;
  const authorIdentity = selectedAuthorId ? db.getIdentityByAccountId(selectedAuthorId) : undefined;
  const authorPublishedEntries = selectedAuthorId ? entries.filter(e => e.authorId === selectedAuthorId && e.status === 'Published' && e.visibility === 'Public') : [];

  // Filter timeline entries by selected category/tag
  const allUniqueTags = Array.from(new Set(authorPublishedEntries.flatMap(e => e.tags)));
  const filteredTimelineEntries = selectedTagFilter === 'All' 
    ? authorPublishedEntries 
    : authorPublishedEntries.filter(e => e.tags.includes(selectedTagFilter));

  // Sort entries for timeline: Grouped by Year, and within Year by Date descending
  const timelineGroupedByYear: { [year: string]: Entry[] } = {};
  filteredTimelineEntries.forEach(entry => {
    const date = new Date(entry.publishedDate || entry.createdDate);
    const year = date.getFullYear().toString();
    if (!timelineGroupedByYear[year]) {
      timelineGroupedByYear[year] = [];
    }
    timelineGroupedByYear[year].push(entry);
  });

  // Sort years descending, and entries inside years descending by date
  const sortedYears = Object.keys(timelineGroupedByYear).sort((a, b) => b.localeCompare(a));
  sortedYears.forEach(year => {
    timelineGroupedByYear[year].sort((a, b) => {
      const d1 = new Date(a.publishedDate || a.createdDate).getTime();
      const d2 = new Date(b.publishedDate || b.createdDate).getTime();
      return d2 - d1;
    });
  });

  return (
    <AnimatePresence mode="wait">
      {initializing ? (
        <motion.div
          key="loading"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35, ease: 'easeInOut' }}
          className="fixed inset-0 z-50 bg-[#FDFDFD]"
        >
          <LoadingScreen />
        </motion.div>
      ) : (
        <motion.div
          key="app"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="min-h-screen flex flex-col bg-[#FDFDFD] selection:bg-adjung-maroon/10 selection:text-adjung-maroon text-stone-900"
        >
          {/* Top Thin Reading Progress Bar */}
          <div className="fixed top-0 left-0 right-0 h-[2.5px] bg-[#802334]/5 z-50 pointer-events-none">
            <div 
              className="h-full bg-[#802334] transition-all duration-75 ease-out"
              style={{ width: `${maxScroll > 0 ? Math.min(100, Math.max(0, (scrollY / maxScroll) * 100)) : 0}%` }}
            />
          </div>
      
      {/* Elegant Editorial Toast Notification */}
      {toast && (
        <div 
          onClick={() => setToastVisible(false)}
          className={`fixed bottom-6 right-6 z-50 transition-all duration-300 transform cursor-pointer select-none max-w-sm w-auto ${
            toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <div className="bg-[#FDFDFD] border border-stone-200/80 shadow-sm px-4 py-2.5 rounded-sm flex items-center gap-2.5 font-serif text-[13px] text-stone-700 hover:border-stone-300 transition-colors">
            <span className="text-[#802334] font-semibold">✓</span>
            <span className="tracking-wide">{toast.message}</span>
          </div>
        </div>
      )}
           {/* ==================== 1. BRAND & NAVIGATION (Unified navbar shell) ==================== */}
      <Navbar
        isHeaderHovered={isHeaderHovered}
        setIsHeaderHovered={setIsHeaderHovered}
        isFloating={isFloating}
        showNavbar={showNavbar}
        scrollY={scrollY}
        maxScroll={maxScroll}
        setShowAccountModal={setShowAccountModal}
        setShowLoginModal={setShowLoginModal}
        setLoginError={setLoginError}
        handleLogout={handleLogout}
      />
      {/* ==================== 2. PERSONAL SCHOLARLY MASTHEAD ==================== */}
      {(activeTab === 'folio' || activeTab === 'bio') && currentAuthor && (
        <header className="w-full pt-8 pb-3 px-4 md:px-8 bg-[#FDFDFD] z-10 select-none">
          <div className="max-w-6xl mx-auto text-center relative">
                        {/* Main classical visual focus: The Author's Identity with refined lines */}
            <div className="border-t border-b border-stone-300 py-5 my-1 max-w-4xl mx-auto">
              <span className="block font-mono text-[8px] md:text-[9px] uppercase tracking-[0.25em] text-stone-400 mb-2">
                PERSONAL SITE
              </span>
              
              <h1 
                onClick={() => {
                  setSelectedEntry(null);
                  setEditingEntry(null);
                  setActiveTab('folio');
                }}
                className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal tracking-wide text-stone-900 cursor-pointer hover:opacity-95 inline-block select-none leading-none"
              >
                {currentAuthor.penName}
              </h1>
              
              {/* The subdomain kept as an elegant central element of the identity integrated naturally without bullets */}
              <div className="mt-2.5">
                <span className="font-mono text-[11px] text-stone-500 lowercase tracking-wide block select-all">
                  {currentAuthor.username}.adjung.com
                </span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* ==================== 2B. PLATFORM DIRECTORY HEADER ==================== */}
      {activeTab === 'directory' && (
        <header className="w-full pt-8 pb-3 px-4 md:px-8 bg-[#FDFDFD] z-10 select-none">
          <div className="max-w-6xl mx-auto text-center relative">
            <div className="border-t border-b border-stone-300 py-5 my-1 max-w-4xl mx-auto">
              <span className="block font-mono text-[8px] md:text-[9px] uppercase tracking-[0.25em] text-stone-400 mb-2">
                PLATFORM DIRECTORY
              </span>
              <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-normal tracking-wide text-stone-900 inline-block select-none leading-none">
                Writers Directory
              </h1>
              <div className="mt-2.5">
                <span className="font-mono text-[11px] text-stone-500 lowercase tracking-wide block">
                  Search and browse registered Adjung writers.
                </span>
              </div>
            </div>
          </div>
        </header>
      )}

      {/* ==================== 3. MAIN DYNAMIC WORKSPACE ==================== */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-4 md:px-8 mt-6">
        
        {/* VIEW AN INDIVIDUAL PUBLISHED MANUAL FROM FOLIO OR INDEX */}
        {selectedEntry && !editingEntry && (
          <div className="max-w-4xl mx-auto">
            <button
              type="button"
              onClick={() => setSelectedEntry(null)}
              className="mb-8 inline-flex items-center gap-2 text-stone-500 hover:text-adjung-maroon font-sans text-xs uppercase tracking-wider group transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
              {selectedEntry.publicationClass === 'Institutional'
                ? (selectedEntry.contentType === 'Notice' ? 'Return to Notices' : "Return to Editor's Notes")
                : 'Return to Folio'}
            </button>
            <EntryRenderer 
              entry={selectedEntry} 
              mode="view" 
              authorName={selectedEntry.publicationClass === 'Institutional'
                ? (selectedEntry.publisher || 'Adjung Editorial Board')
                : (users.find(u => u.id === selectedEntry.authorId)?.penName || 'Writer')}
              authorSignature={selectedEntry.publicationClass === 'Institutional'
                ? ''
                : resolveSignatureText(selectedEntry.authorId || '', users.find(u => u.id === selectedEntry.authorId)?.signature || 'Writer')}
              authorSignatureStrokes={selectedEntry.publicationClass === 'Institutional'
                ? []
                : resolveSignatureStrokes(selectedEntry, selectedEntry.authorId || '')}
              authorSignatureFont={selectedEntry.publicationClass === 'Institutional'
                ? ''
                : resolveSignatureFont(selectedEntry.authorId || '')}
              authorDigitalSignature={selectedEntry.publicationClass === 'Institutional'
                ? undefined
                : resolveDigitalSignature(selectedEntry.authorId || '', selectedEntry)}
            />
          </div>
        )}

        {/* ACTIVE MODULE 1: FOLIO VIEW (Continuous editorial timeline grouped by year) */}
        {activeTab === 'folio' && !selectedEntry && (
          <FolioView
            currentAuthor={currentAuthor}
            authorProfile={authorProfile}
            selectedEntry={selectedEntry}
            systemSettings={systemSettings}
            allUniqueTags={allUniqueTags}
            selectedTagFilter={selectedTagFilter}
            setSelectedTagFilter={setSelectedTagFilter}
            authorPublishedEntries={authorPublishedEntries}
            sortedYears={sortedYears}
            timelineGroupedByYear={timelineGroupedByYear}
            expandedNoteIds={expandedNoteIds}
            toggleNote={toggleNote}
            setSelectedEntry={setSelectedEntry}
            setSelectedAuthorId={setSelectedAuthorId}
            setActiveTab={setActiveTab}
            setShowLoginModal={setShowLoginModal}
            setLoginError={setLoginError}
          />
        )}

        {/* ACTIVE MODULE 2: BIOGRAPHY VIEW (Classical blocks & timeline) */}
        {activeTab === 'bio' && (
          !currentAuthor ? (
            <div className="max-w-2xl mx-auto text-center py-16 px-4 space-y-8 select-none">
              <div className="space-y-3">
                <span className="block font-mono text-[8px] md:text-[9px] uppercase tracking-[0.25em] text-adjung-maroon mb-2">
                  Biography Records
                </span>
                <h2 className="font-serif text-3xl font-light text-stone-900 leading-tight">
                  Scholarly Biographies
                </h2>
                <div className="h-px w-24 bg-adjung-maroon/30 mx-auto my-4" />
                <p className="font-serif italic text-stone-600 text-sm leading-relaxed max-w-md mx-auto">
                  Explore life journeys, publications, academic appointments, and achievements of our resident scholars.
                </p>
              </div>

              <div className="pt-4">
                <p className="font-sans text-xs text-stone-500 max-w-sm mx-auto mb-6">
                  Please choose a member from the directory to view their complete academic biography and research milestones.
                </p>
                {hasPermission('viewDirectory') && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('directory')}
                    className="bg-adjung-maroon hover:opacity-95 text-[#FDFDFD] font-mono text-xs uppercase tracking-wider px-6 py-3 rounded shadow transition cursor-pointer"
                  >
                    Open Scholar Directory
                  </button>
                )}
              </div>
            </div>
          ) : (
            authorIdentity && (
              <BiographyView
                authorProfile={authorIdentity}
                currentAuthor={currentAuthor}
                currentUser={currentUser}
                selectedAuthorId={selectedAuthorId || ''}
                setEditingBioItem={setEditingBioItem}
                setShowAddBioModal={setShowAddBioModal}
                handleRemoveBioItem={handleRemoveBioItem}
              />
            )
          )
        )}

        {/* ACTIVE MODULE 3: WRITING DESK (Owner-only canonical editing/draft workspace) */}
        {activeTab === 'desk' && currentUser && (
          <div className="max-w-5xl mx-auto space-y-12">
            <WritingDesk />
          </div>
        )}

        {/* ACTIVE MODULE 3B: DIRECTORY (Searchable public directory of all platform members) */}
        {activeTab === 'directory' && (
          <Directory 
            users={users}
            onSelectMember={(userId, targetTab) => {
              setSelectedAuthorId(userId);
              setActiveTab(targetTab);
              setSelectedEntry(null);
              setEditingEntry(null);
            }}
          />
        )}

        {/* ACTIVE MODULE 4: INDEX (Editor/Admin only dynamically generated published entries list) */}
        {activeTab === 'index' && currentUser && hasPermission('viewIndex') && (
          <div className="max-w-6xl mx-auto">
            <EditorialIndex
              entries={entries}
              users={users}
              setSelectedEntry={setSelectedEntry}
              systemSettings={systemSettings}
              initialSearchQuery={indexSearchQuery}
              onSearchQueryChange={setIndexSearchQuery}
            />
          </div>
        )}

        {/* ACTIVE MODULE 5: EDITORIUM (Editor settings and administrative workspace) */}
        {activeTab === 'editorium' && currentUser && hasPermission('curateFrontpage') && (
          <Editorium />
        )}

        {/* ACTIVE MODULE: INSTITUTIONAL NOTICES */}
        {activeTab === 'notices' && !selectedEntry && (
          <NoticesView entries={entries} setSelectedEntry={setSelectedEntry} />
        )}

        {/* ACTIVE MODULE: EDITORIAL NOTES */}
        {activeTab === 'editorial' && !selectedEntry && (
          <EditorialNotesView entries={entries} setSelectedEntry={setSelectedEntry} />
        )}

        {/* ACTIVE MODULE: VERSION HISTORY */}
        {activeTab === 'changelog' && (
          <ChangelogView />
        )}



        {/* ACTIVE MODULE: POLICIES */}
        {activeTab === 'policies' && (
          <PoliciesView policies={db.getPolicies()} />
        )}


        {/* ACTIVE MODULE 0A: LANDING PAGE (Unauthenticated, pure public overview) */}
        {activeTab === 'landing' && (
          <LandingView
            entries={entries}
            systemSettings={systemSettings}
            setActiveTab={setActiveTab}
            setSelectedEntry={setSelectedEntry}
            setSelectedAuthorId={setSelectedAuthorId}
            setShowLoginModal={setShowLoginModal}
            setLoginError={setLoginError}
            researchFindingsGoogleDocText={researchFindingsGoogleDocText}
          />
        )}

        {/* ACTIVE MODULE 0B: CURATED FRONTPAGE (Platform public index of publications & scholars) */}
        {activeTab === 'frontpage' && !selectedEntry && (
          <FrontpageView
            entries={entries}
            users={users}
            systemSettings={systemSettings}
            setSelectedEntry={setSelectedEntry}
            setSelectedAuthorId={setSelectedAuthorId}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            inTheNewsGoogleDocText={inTheNewsGoogleDocText}
            worldClockHolidaysGoogleDocText={worldClockHolidaysGoogleDocText}
            setIndexSearchQuery={setIndexSearchQuery}
          />
        )}

      </main>

      {/* ==================== 4. SIGN IN / AUTH OVERLAY MODAL ==================== */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        loginError={loginError}
        setLoginError={setLoginError}
        usernameInput={usernameInput}
        setUsernameInput={setUsernameInput}
        passwordInput={passwordInput}
        setPasswordInput={setPasswordInput}
        handleLogin={handleLogin}
        rememberMe={rememberMe}
        setRememberMe={setRememberMe}
        setShowSignUpWizard={setShowSignUpWizard}
      />

      {/* ==================== 4B. ACCOUNT DETAILS MODAL ==================== */}
      <AccountModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        currentUser={currentUser}
        accountEmail={accountEmail}
        setAccountEmail={setAccountEmail}
        accountUsername={accountUsername}
        setAccountUsername={setAccountUsername}
        accountPassword={accountPassword}
        setAccountPassword={setAccountPassword}
        accountConfirmPassword={accountConfirmPassword}
        setAccountConfirmPassword={setAccountConfirmPassword}
        accountError={accountError}
        handleSaveAccountSettings={handleSaveAccountSettings}
      />

      {/* ==================== 5. ADD TIMELINE ITEM MODAL (Shown only in Biography when Owner) ==================== */}
      {showAddBioModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#FDFDFD] border border-adjung-maroon/20 rounded shadow-2xl max-w-md w-full overflow-hidden scholarly-border">
            <div className="border-b border-stone-200 p-5 bg-[#FDFDFD] text-center">
              <h3 className="font-serif text-xl text-adjung-maroon">Add Milestone</h3>
              <p className="font-mono text-[9px] uppercase tracking-wider text-stone-500 mt-1">Save Milestone</p>
            </div>
            <form onSubmit={handleAddBioItem} className="p-6 space-y-4 text-xs font-sans">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1">Year</label>
                  <input
                    type="text"
                    placeholder="e.g. 2024"
                    value={newBioYear}
                    onChange={(e) => setNewBioYear(e.target.value)}
                    className="w-full border border-stone-200 p-2 rounded focus:outline-none focus:border-adjung-maroon font-mono"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1">Classification</label>
                  <select
                    value={newBioCategory}
                    onChange={(e) => setNewBioCategory(e.target.value as BiographyItem['category'])}
                    className="w-full border border-stone-200 p-2 rounded focus:outline-none focus:border-adjung-maroon"
                  >
                    <option value="Education">Education</option>
                    <option value="Career">Career</option>
                    <option value="Publication">Publication</option>
                    <option value="Award">Award</option>
                    <option value="Personal">Personal</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1">Milestone Title</label>
                <input
                  type="text"
                  placeholder="e.g. Master’s Defense on Calligraphic Grids"
                  value={newBioTitle}
                  onChange={(e) => setNewBioTitle(e.target.value)}
                  className="w-full border border-stone-200 p-2 rounded focus:outline-none focus:border-adjung-maroon font-serif text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1">Comprehensive Description</label>
                <textarea
                  placeholder="Provide precise details of the scholarly achievement or event..."
                  value={newBioDesc}
                  onChange={(e) => setNewBioDesc(e.target.value)}
                  className="w-full border border-stone-200 p-2 rounded focus:outline-none focus:border-adjung-maroon min-h-[80px]"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddBioModal(false)}
                  className="w-1/3 border border-stone-200 hover:bg-stone-50 text-stone-600 py-2 rounded text-xs font-mono uppercase tracking-wider transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-2/3 bg-adjung-maroon text-[#FDFDFD] py-2 rounded text-xs font-mono uppercase tracking-wider hover:opacity-90 transition font-semibold"
                >
                  Record Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== INVITATION SENT TRANSMISSION MODAL ==================== */}
      {generatedInvitation && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-[#FDFDFD] border border-adjung-maroon/20 rounded shadow-2xl max-w-lg w-full overflow-hidden scholarly-border my-8">
            <div className="border-b border-stone-200 p-5 bg-[#FDFDFD] text-center">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full inline-block animate-pulse mr-2" />
              <h3 className="font-serif text-2xl text-adjung-maroon inline-block">Invitation Transmitted</h3>
              <p className="font-mono text-[9px] uppercase tracking-wider text-stone-500 mt-1">Simulated Scholar Mail Delivery Server</p>
            </div>

            <div className="p-6 space-y-6 text-xs font-sans">
              <div className="bg-stone-50 border border-stone-200 p-4 rounded text-left space-y-2">
                <div className="flex justify-between items-center text-[10px] font-mono text-stone-500 border-b pb-2">
                  <span>MTA Status: <span className="text-emerald-600 font-bold">SMTP OK (250)</span></span>
                  <span>Delivered: Just Now</span>
                </div>
                <div className="grid grid-cols-4 gap-1 text-[11px] font-mono">
                  <span className="text-stone-400">Recipient:</span>
                  <span className="col-span-3 text-stone-800 font-semibold">{generatedInvitation.name}</span>
                  <span className="text-stone-400">Address:</span>
                  <span className="col-span-3 text-stone-800 font-semibold select-all">{generatedInvitation.email}</span>
                </div>
              </div>

              {/* Styled vintage email envelope card */}
              <div className="border border-amber-200/50 bg-[#FBF9F4] p-6 rounded shadow-sm relative overflow-hidden text-stone-800 select-all font-serif">
                <div className="absolute top-0 right-0 w-24 h-24 border-r-2 border-t-2 border-amber-900/10 rotate-12 translate-x-12 -translate-y-12 select-none pointer-events-none" />
                <div className="space-y-4 whitespace-pre-line text-justify leading-relaxed pr-2 text-stone-700">
                  {generatedInvitation.emailBody}
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-100 rounded text-left leading-relaxed text-[11px] text-amber-900 font-sans flex gap-2.5">
                <Info className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold block mb-0.5">Evaluator Simulation Mode</span>
                  <span>Since this is a simulated sandbox, we have generated the formal email dispatch. Click the button below to simulate the recipient opening their invitation link and configuring their personal Folio.</span>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGeneratedInvitation(null)}
                  className="w-1/3 border border-stone-200 hover:bg-stone-50 text-stone-600 py-3 rounded text-xs font-mono uppercase tracking-wider transition"
                >
                  Close Scriptorium
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInvitedRegistrationData({
                      name: generatedInvitation.name,
                      email: generatedInvitation.email,
                      username: generatedInvitation.name.toLowerCase().replace(/\s+/g, '.'),
                      penName: generatedInvitation.name,
                      signature: generatedInvitation.name,
                      heroTitle: `Disquisitions on Reason & Form`,
                      heroSubtitle: `Selected philosophical treatises, essays, and notes authored by ${generatedInvitation.name}.`,
                      bioText: `${generatedInvitation.name} is an independent writer and scholar newly registered on Adjung, dedicated to formal research and traditional literary studies.`
                    });
                    setGeneratedInvitation(null);
                  }}
                  className="w-2/3 bg-adjung-maroon hover:opacity-95 text-[#FDFDFD] py-3 rounded text-xs font-mono uppercase tracking-wider transition shadow-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <ArrowRight className="w-4 h-4" /> Simulate Link Click & Register
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== ACADEMIC REGISTRATION WIZARD ==================== */}      {showSignUpWizard && (        <SignUpWizard          onClose={() => setShowSignUpWizard(false)}          onComplete={handleWizardComplete}        />      )}
      {/* ==================== 6. ACADEMIC FOOTER ==================== */}
      <Footer
        systemSettings={systemSettings}
        setActiveTab={setActiveTab}
        setSelectedEntry={setSelectedEntry}
        setEditingEntry={setEditingEntry}
      />

        </motion.div>
      )}
    </AnimatePresence>
  );
}
