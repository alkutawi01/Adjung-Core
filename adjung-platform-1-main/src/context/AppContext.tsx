import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { User, Entry, WriterProfile, IdentityProfile, BiographyItem, SystemSettings, EntryType, RolePermissions, DigitalSignature, PolicyDocument } from '../types';
import { db } from '../db/mockDb';
import { AuthService, SessionService, RbacService } from '../services/authService';
import { BRAND } from '../config/brand';
import { generateUUID } from '../utils';

export type ActiveTabType = 
  | 'landing' 
  | 'frontpage' 
  | 'folio' 
  | 'bio' 
  | 'directory' 
  | 'desk' 
  | 'index' 
  | 'editorium' 
  | 'identity' 
  | 'notices' 
  | 'editorial' 
  | 'changelog' 
  | 'policies';

export type EditoriumTabType = 
  | 'platform' 
  | 'landing'
  | 'frontpage' 
  | 'directory' 
  | 'index' 
  | 'editorial' 
  | 'users' 
  | 'roles' 
  | 'moderation' 
  | 'system' 
  | 'dangerZone' 
  | 'architecture' 
  | 'reference-library';

interface AppContextType {
  // DB States
  users: User[];
  profiles: WriterProfile[];
  entries: Entry[];
  systemSettings: SystemSettings;
  setSystemSettings: (settings: SystemSettings) => void;
  inTheNewsGoogleDocText: string;
  worldClockHolidaysGoogleDocText: string;
  researchFindingsGoogleDocText: string;
  inTheNewsGoogleDocStatus: string;
  worldClockHolidaysGoogleDocStatus: string;
  researchFindingsGoogleDocStatus: string;
  initializing: boolean;
  
  // Navigation & Session
  currentUser: User | null;
  selectedAuthorId: string;
  activeTab: ActiveTabType;
  selectedEntry: Entry | null;
  editingEntry: Entry | null;
  editoriumActiveTab: EditoriumTabType;
  
  // Setter actions
  setCurrentUser: (user: User | null) => void;
  setSelectedAuthorId: (id: string) => void;
  setActiveTab: (tab: ActiveTabType) => void;
  setSelectedEntry: (entry: Entry | null) => void;
  setEditingEntry: (entry: Entry | null) => void;
  setEditoriumActiveTab: (tab: EditoriumTabType) => void;
  
  // Note inline expansion
  expandedNoteIds: string[];
  setExpandedNoteIds: React.Dispatch<React.SetStateAction<string[]>>;
  toggleNote: (id: string) => void;
  
  // Toast notifications
  toast: { message: string; type: 'success' | 'info' | 'error' } | null;
  toastVisible: boolean;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  setToastVisible: (visible: boolean) => void;
  
  // DB operations
  refreshDbState: () => void;
  resetDatabase: () => void;
  saveEntry: (updatedEntry: Entry) => void;
  deleteEntry: (entryId: string) => void;
  createNewEntry: (type: EntryType) => void;
  
  // User operations
  toggleUserSuspension: (targetUserId: string) => void;
  changeUserRole: (targetUserId: string, newRole: User['role']) => void;
  saveWriterFromEditorium: (writerData: {
    id: string;
    username: string;
    penName: string;
    signature: string;
    bioSummary: string;
    heroTitle: string;
    heroSubtitle: string;
    bioText: string;
  }) => void;
  
  // RBAC permissions helper
  hasPermission: (permissionKey: keyof RolePermissions) => boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // DB States
  const [users, setUsers] = useState<User[]>(db.getUsers());
  const [profiles, setProfiles] = useState<WriterProfile[]>(db.getProfiles());
  const [entries, setEntries] = useState<Entry[]>(db.getEntries());
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(db.getSystemSettings());
  const [inTheNewsGoogleDocText, setInTheNewsGoogleDocText] = useState('');
  const [worldClockHolidaysGoogleDocText, setWorldClockHolidaysGoogleDocText] = useState('');
  const [researchFindingsGoogleDocText, setResearchFindingsGoogleDocText] = useState('');
  const [inTheNewsGoogleDocStatus, setInTheNewsGoogleDocStatus] = useState('empty');
  const [worldClockHolidaysGoogleDocStatus, setWorldClockHolidaysGoogleDocStatus] = useState('empty');
  const [researchFindingsGoogleDocStatus, setResearchFindingsGoogleDocStatus] = useState('empty');
  const [initializing, setInitializing] = useState(true);

  // App Navigation & Session States
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTabType>('landing');
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [editingEntry, setEditingEntry] = useState<Entry | null>(null);
  const [editoriumActiveTab, setEditoriumActiveTab] = useState<EditoriumTabType>('platform');

  // Inline Note expansion
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>([]);

  // Toast notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  const refreshDbState = () => {
    const sessionId = localStorage.getItem('Adjung_session_user_id') || sessionStorage.getItem('Adjung_session_user_id') || '';
    fetch('/api/db-state', {
      headers: { 'x-session-id': sessionId }
    })
      .then(res => res.json())
      .then(data => {
        if (data.users) db.setUsers(data.users);
        if (data.profiles) db.setProfiles(data.profiles);
        if (data.entries) db.setEntries(data.entries);
        if (data.systemSettings) db.setSystemSettings(data.systemSettings);
        if (data.identities) db.setIdentities(data.identities);

        setUsers(data.users);
        setProfiles(data.profiles);
        setEntries(data.entries);
        setSystemSettings(data.systemSettings);
        setInTheNewsGoogleDocText(data.inTheNewsGoogleDocText || '');
        setWorldClockHolidaysGoogleDocText(data.worldClockHolidaysGoogleDocText || '');
        setResearchFindingsGoogleDocText(data.researchFindingsGoogleDocText || '');
        setInTheNewsGoogleDocStatus(data.inTheNewsGoogleDocStatus || 'empty');
        setWorldClockHolidaysGoogleDocStatus(data.worldClockHolidaysGoogleDocStatus || 'empty');
        setResearchFindingsGoogleDocStatus(data.researchFindingsGoogleDocStatus || 'empty');
        if (data.currentUser) {
          setCurrentUser(data.currentUser);
          const rememberMe = !!localStorage.getItem('Adjung_session_user_id');
          const storage = rememberMe ? localStorage : sessionStorage;
          storage.setItem('Adjung_session_user_data', JSON.stringify(data.currentUser));
        } else if (data.isSuspended) {
          setCurrentUser(null);
          setSelectedAuthorId('');
          setActiveTab('landing');
          localStorage.removeItem('Adjung_session_user_id');
          localStorage.removeItem('Adjung_session_user_data');
          sessionStorage.removeItem('Adjung_session_user_id');
          sessionStorage.removeItem('Adjung_session_user_data');
        }
      })
      .catch(err => console.error('Failed to sync state from database:', err));
  };

  const updateSystemSettingsState = (settings: SystemSettings) => {
    fetch('/api/system/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
      .then(res => {
        if (res.ok) {
          refreshDbState();
          showToast('System settings saved', 'success');
        }
      })
      .catch(err => console.error('Failed to save system settings:', err));
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setToastVisible(true);
  };

  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => {
        setToastVisible(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  // Startup Session Restore & Verification
  useEffect(() => {
    const activeSessionUser = SessionService.validateAndRetrieveSession();
    if (activeSessionUser) {
      setCurrentUser(activeSessionUser);
      setSelectedAuthorId(activeSessionUser.id);
      setActiveTab('folio');
    } else {
      setCurrentUser(null);
      setSelectedAuthorId('');
      
      // Determine initial tab from current pathname
      const path = window.location.pathname;
      const parts = path.split('/').filter(Boolean);
      const route = parts[0];
      const PUBLIC_ROUTES = ['frontpage', 'directory', 'index', 'notices', 'notice', 'editorial', 'changelog', 'policies'];
      
      if (route && PUBLIC_ROUTES.includes(route)) {
        setActiveTab(route);
      } else {
        setActiveTab('landing');
      }
    }
    
    refreshDbState();
    setTimeout(() => {
      setInitializing(false);
    }, 1000);
  }, []);

  const toggleNote = (id: string) => {
    setExpandedNoteIds(prev =>
      prev.includes(id) ? prev.filter(noteId => noteId !== id) : [...prev, id]
    );
  };

  // Scroll to top of page when tab or entry changes
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeTab, selectedEntry]);

  const hasPermission = (permissionKey: keyof RolePermissions) => {
    return RbacService.hasPermission(currentUser, permissionKey, systemSettings);
  };

  // Enforce private environment & Access Control guards
  useEffect(() => {
    if (initializing) return;
    console.log('[GUARD] running. currentUser:', currentUser?.id, 'activeTab:', activeTab, 'selectedAuthorId:', selectedAuthorId);

    if (currentUser && activeTab === 'landing') {
      console.log('[GUARD] Redirecting because currentUser exists and activeTab is landing -> frontpage');
      setActiveTab('frontpage');
    }

    if (!currentUser && (activeTab === 'desk' || activeTab === 'index' || activeTab === 'editorium')) {
      console.log('[GUARD] Redirecting because no currentUser and tab requires auth -> landing');
      setActiveTab('landing');
    }
    
    if ((activeTab === 'folio' || activeTab === 'bio') && !selectedAuthorId) {
      if (currentUser) {
        console.log('[GUARD] Restoring selectedAuthorId to currentUser.id:', currentUser.id);
        setSelectedAuthorId(currentUser.id);
      } else {
        console.log('[GUARD] Redirecting because activeTab is folio/bio but selectedAuthorId is empty -> landing');
        setActiveTab('landing');
      }
    }

    if (activeTab === 'directory' && !hasPermission('viewDirectory')) {
      console.log('[GUARD] Redirecting because no viewDirectory permission -> landing');
      setActiveTab('landing');
    }
  }, [currentUser, activeTab, systemSettings, selectedAuthorId, initializing]);

  // DB actions
  const saveEntry = (updatedEntry: Entry) => {
    fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedEntry)
    })
      .then(res => {
        if (res.ok) {
          refreshDbState();
          if (editingEntry?.id === updatedEntry.id) {
            setEditingEntry(updatedEntry);
          }
        }
      })
      .catch(err => console.error('Failed to save entry:', err));
  };

  const deleteEntry = (entryId: string) => {
    fetch(`/api/entries/${entryId}`, { method: 'DELETE' })
      .then(res => {
        if (res.ok) {
          refreshDbState();
          setEditingEntry(null);
          setSelectedEntry(null);
        }
      })
      .catch(err => console.error('Failed to delete entry:', err));
  };

  const createNewEntry = (type: EntryType) => {
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

    fetch('/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newEntry)
    })
      .then(res => {
        if (res.ok) {
          refreshDbState();
          setEditingEntry(newEntry);
          setActiveTab('desk');
        }
      })
      .catch(err => console.error('Failed to create entry:', err));
  };

  const resetDatabase = () => {
    fetch('/api/system/reset', { method: 'POST' })
      .then(res => {
        if (res.ok) {
          AuthService.signOut();
          refreshDbState();
          setCurrentUser(null);
          setSelectedAuthorId('');
          setActiveTab('folio');
          setEditingEntry(null);
          setSelectedEntry(null);
        }
      })
      .catch(err => console.error('Failed to reset database:', err));
  };

  const toggleUserSuspension = (targetUserId: string) => {
    if (!currentUser || !hasPermission('manageRbac')) {
      showToast('Permission Denied: Only users with RBAC management privileges can suspend accounts.', 'error');
      return;
    }

    if (currentUser.id === targetUserId) {
      showToast('Self-Administration Safety: You cannot suspend your own account.', 'error');
      return;
    }

    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return;

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

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser)
    })
      .then(res => {
        if (res.ok) {
          fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: `log-${Date.now()}`,
              timestamp: new Date().toISOString(),
              operator: currentUser.penName,
              role: currentUser.role,
              action: `${updatedUser.suspended ? 'Suspended' : 'Reactivated'} account of ${targetUser.penName} (@${targetUser.username}).`
            })
          }).then(() => {
            refreshDbState();
            showToast(`${targetUser.penName}'s account has been ${updatedUser.suspended ? 'suspended' : 'reactivated'}.`, 'success');
          });
        }
      })
      .catch(err => console.error('Failed to suspend user:', err));
  };

  const changeUserRole = (targetUserId: string, newRole: User['role']) => {
    if (!currentUser || !hasPermission('manageRbac')) {
      showToast('Permission Denied: Only users with RBAC management privileges can modify user roles.', 'error');
      return;
    }

    if (currentUser.id === targetUserId) {
      showToast('Self-Administration Safety: You cannot demote yourself or modify your own role.', 'error');
      return;
    }

    const targetUser = users.find(u => u.id === targetUserId);
    if (!targetUser) return;

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

    fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedUser)
    })
      .then(res => {
        if (res.ok) {
          fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: `log-${Date.now()}`,
              timestamp: new Date().toISOString(),
              operator: currentUser.penName,
              role: currentUser.role,
              action: `Modified role of ${targetUser.penName} (@${targetUser.username}) from '${targetUser.role}' to '${newRole}'.`
            })
          }).then(() => {
            refreshDbState();
            showToast(`${targetUser.penName}'s role changed to ${newRole}.`, 'success');
          });
        }
      })
      .catch(err => console.error('Failed to change role:', err));
  };

  const saveWriterFromEditorium = (writerData: {
    id: string;
    username: string;
    penName: string;
    signature: string;
    bioSummary: string;
    heroTitle: string;
    heroSubtitle: string;
    bioText: string;
  }) => {
    const { id, username, penName, signature, bioSummary, heroTitle, heroSubtitle, bioText } = writerData;
    const writer = users.find(u => u.id === id);
    if (!writer) return;

    const updatedUser: User = {
      ...writer,
      username,
      penName,
      signature,
      bioSummary,
    };

    const profile = profiles.find(p => p.authorId === id) || { authorId: id, heroTitle: '', heroSubtitle: '' };
    const updatedProfile: WriterProfile = {
      ...profile,
      heroTitle,
      heroSubtitle,
    };

    fetch('/api/db-state')
      .then(res => res.json())
      .then(data => {
        const identitiesList: IdentityProfile[] = data.identities;
        const identity = identitiesList.find(i => i.accountId === id);
        const updatedIdentity = identity ? {
          ...identity,
          biography: bioText,
        } : {
          identityId: `id-${id}`,
          accountId: id,
          username,
          displayName: penName,
          penName,
          biography: bioText,
          publicVisibility: 'Public',
          lifeTimeline: [],
          signatures: []
        };

        Promise.all([
          fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedUser)
          }),
          fetch('/api/profiles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedProfile)
          }),
          fetch('/api/identities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedIdentity)
          })
        ]).then(() => {
          refreshDbState();
          showToast('Settings updated', 'success');
        });
      })
      .catch(err => console.error('Failed to update writer settings:', err));
  };

  return (
    <AppContext.Provider value={{
      users,
      profiles,
      entries,
      systemSettings,
      setSystemSettings: updateSystemSettingsState,
      inTheNewsGoogleDocText,
      worldClockHolidaysGoogleDocText,
      researchFindingsGoogleDocText,
      inTheNewsGoogleDocStatus,
      worldClockHolidaysGoogleDocStatus,
      researchFindingsGoogleDocStatus,
      initializing,
      
      currentUser,
      selectedAuthorId,
      activeTab,
      selectedEntry,
      editingEntry,
      editoriumActiveTab,
      
      setCurrentUser,
      setSelectedAuthorId,
      setActiveTab,
      setSelectedEntry,
      setEditingEntry,
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
      
      hasPermission
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
