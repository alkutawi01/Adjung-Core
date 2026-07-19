import React, { useState, useEffect } from 'react';
import { User, IdentityProfile } from '../../types';
import { db } from '../../db/mockDb';
import { SignatureManager } from '../desk/SignatureManager';
import { ShieldCheck, User as UserIcon, BookOpen, Key, Fingerprint } from 'lucide-react';

import { useAppContext } from '../../context/AppContext';

interface IdentityStudioProps {
  isModal?: boolean;
  onClose?: () => void;
}

export function IdentityStudio({ isModal = false, onClose }: IdentityStudioProps) {
  const { currentUser, setActiveTab, refreshDbState: refreshGlobalState } = useAppContext();
  
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      setActiveTab('desk');
    }
  };

  const [identity, setIdentity] = useState<IdentityProfile | null>(null);
  
  // Form states
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [penName, setPenName] = useState('');
  const [visibility, setVisibility] = useState<'Public' | 'Private'>('Public');
  const [affiliation, setAffiliation] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let ident = db.getIdentityByAccountId(currentUser.id);
    
    // Robust fallback: if no identity is found, construct a default one so the studio never hangs
    if (!ident) {
      ident = {
        identityId: `id-${currentUser.id}`,
        accountId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.penName || currentUser.username,
        penName: currentUser.penName || currentUser.username,
        biography: currentUser.bioSummary || '',
        publicVisibility: 'Public',
        lifeTimeline: [],
        signatures: currentUser.signature ? [{
          id: `sig-${Date.now()}`,
          label: currentUser.signature,
          type: 'typed',
          typedText: currentUser.signature,
          fontFamily: 'Outfit',
          status: 'Default',
          strokes: [],
          createdAt: new Date().toISOString()
        }] : []
      };
      // Force save to db
      try {
        db.updateIdentity(ident);
      } catch (e) {
        console.error("Could not save fallback identity", e);
      }
    }

    setIdentity(ident);
    setUsername(ident.username);
    setDisplayName(ident.displayName || '');
    setPenName(ident.penName);
    setVisibility(ident.publicVisibility || 'Public');
    setAffiliation(ident.affiliation || '');
  }, [currentUser]);

  if (!identity) return <div className="p-8 text-center text-stone-500 font-mono text-sm">Loading Identity...</div>;

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    const updatedIdentity: IdentityProfile = {
      ...identity,
      username,
      displayName,
      penName,
      publicVisibility: visibility,
      signatures: identity.signatures,
      affiliation
    };

    // Also update the User object penName & username & signature to keep in sync
    const defaultSig = updatedIdentity.signatures.find(s => s.status === 'Default');
    const updatedUser: User = {
      ...currentUser,
      username,
      penName,
      affiliation,
      signature: defaultSig ? (defaultSig.type === 'typed' ? defaultSig.typedText || '' : defaultSig.label) : currentUser.signature
    };

    // Make POST requests to server
    Promise.all([
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      }),
      fetch('/api/identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedIdentity)
      })
    ]).then(() => {
      // Update active storage session
      const rememberMe = !!localStorage.getItem('Adjung_session_user_id');
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('Adjung_session_user_data', JSON.stringify(updatedUser));
      
      // Update local mockDb
      db.updateIdentity(updatedIdentity);
      setIdentity(updatedIdentity);
      const usersList = db.getUsers();
      const uIdx = usersList.findIndex(u => u.id === currentUser.id);
      if (uIdx !== -1) {
        usersList[uIdx] = updatedUser;
        db.saveUsersToStorage();
      }

      setTimeout(() => {
        setIsSaving(false);
        setSaveSuccess(true);
        refreshGlobalState();
        setTimeout(() => setSaveSuccess(false), 3000);
      }, 400);
    }).catch(err => {
      console.error('Failed to save identity to server:', err);
      setIsSaving(false);
    });
  };

  const handleIdentityUpdateFromSignature = (updatedIdentity: IdentityProfile) => {
    // If default signature is typed, sync its text back to penName and displayName
    const defaultSig = updatedIdentity.signatures.find(s => s.status === 'Default');
    let finalIdentity = { ...updatedIdentity };
    let newPenName = penName;
    let newDisplayName = displayName;

    // Keep penName and displayName as configured in the form without overwriting them with signature text

    setIdentity(finalIdentity);

    // Sync to User object
    const updatedUser: User = {
      ...currentUser,
      penName: newPenName,
      signature: defaultSig ? (defaultSig.type === 'typed' ? defaultSig.typedText || '' : defaultSig.label) : currentUser.signature
    };

    // Make POST requests to server
    Promise.all([
      fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedUser)
      }),
      fetch('/api/identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalIdentity)
      })
    ]).then(() => {
      // Update active storage session
      const rememberMe = !!localStorage.getItem('Adjung_session_user_id');
      const storage = rememberMe ? localStorage : sessionStorage;
      storage.setItem('Adjung_session_user_data', JSON.stringify(updatedUser));
      
      // Update local mockDb in case it is queried before refresh
      db.updateIdentity(finalIdentity);
      const usersList = db.getUsers();
      const uIdx = usersList.findIndex(u => u.id === currentUser.id);
      if (uIdx !== -1) {
        usersList[uIdx] = updatedUser;
        db.saveUsersToStorage();
      }

      refreshGlobalState();
    }).catch(err => console.error('Failed to save signature updates to server:', err));
  };

  const renderContent = () => (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-stone-200 pb-5">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-light text-stone-900 flex items-center gap-2">
            <Fingerprint className="w-6 h-6 text-[#802334]" />
            Identity
          </h2>
          <p className="font-mono text-[10px] uppercase tracking-widest text-stone-400">
            Decoupled authorship, signature, and verification management.
          </p>
        </div>
        <button
          onClick={handleClose}
          className="px-4 py-1.5 border border-stone-200 text-stone-600 rounded hover:bg-stone-50 font-mono text-xs uppercase tracking-wider transition cursor-pointer"
        >
          {isModal ? 'Close' : 'Return to Desk'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Details */}
        <div className="lg:col-span-7 space-y-8">
          
          <form onSubmit={handleSaveProfile} className="bg-white border border-stone-200 rounded p-6 shadow-sm space-y-6">
            <h3 className="font-mono text-xs uppercase tracking-widest font-bold text-stone-700 flex items-center gap-2 border-b pb-3">
              <UserIcon className="w-4 h-4 text-Adjung-maroon" /> Public Identity
            </h3>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1">Subdomain (ID Unik)</label>
                  <input
                    type="text"
                    value={username}
                    className="w-full border border-stone-200 p-2 rounded bg-stone-50 text-stone-400 font-mono text-xs cursor-not-allowed select-none"
                    disabled
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1">Visibility</label>
                  <select
                    value={visibility}
                    onChange={(e) => setVisibility(e.target.value as 'Public' | 'Private')}
                    className="w-full border border-stone-200 p-2 rounded focus:outline-none focus:border-Adjung-maroon text-xs"
                  >
                    <option value="Public">Public (Directory Visible)</option>
                    <option value="Private">Private (Unlisted)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1">Full Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full border border-stone-200 p-2 rounded focus:outline-none focus:border-Adjung-maroon font-sans text-sm"
                  />
                </div>
                <div>
                  <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1">Pen & Short Name</label>
                  <input
                    type="text"
                    value={penName}
                    onChange={(e) => setPenName(e.target.value)}
                    className="w-full border border-stone-200 p-2 rounded focus:outline-none focus:border-Adjung-maroon font-serif font-semibold text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block font-mono uppercase text-[9px] text-stone-500 tracking-wider mb-1">Affiliation</label>
                  <input
                    type="text"
                    value={affiliation}
                    onChange={(e) => setAffiliation(e.target.value)}
                    placeholder="e.g. Universiti Mu'tah, Jordan or Cairo, Egypt"
                    className="w-full border border-stone-200 p-2 rounded focus:outline-none focus:border-Adjung-maroon text-xs font-sans"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-stone-100">
              {saveSuccess ? (
                <span className="text-emerald-600 font-mono text-[10px] uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Identity Saved
                </span>
              ) : (
                <span className="text-stone-400 font-mono text-[10px] uppercase tracking-wider">
                  Unsaved Changes
                </span>
              )}
              <button
                type="submit"
                disabled={isSaving}
                className="bg-stone-900 text-white px-6 py-2 rounded text-xs font-mono uppercase tracking-wider hover:bg-stone-800 transition disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>

          {/* Placeholder for Future Verification & Privacy */}
          <div className="bg-white border border-stone-200 rounded p-6 shadow-sm opacity-60">
             <h3 className="font-mono text-xs uppercase tracking-widest font-bold text-stone-600 flex items-center gap-2 border-b pb-3 mb-4">
              <Key className="w-4 h-4" /> Verification & Credentials
            </h3>
            <p className="font-sans text-xs text-stone-500">
              Cryptographic verification architecture is prepared but currently disabled.
            </p>
          </div>

        </div>

        {/* Right Column: Signature System */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white border border-stone-200 rounded p-6 shadow-sm">
            <SignatureManager identity={identity} onIdentityUpdate={handleIdentityUpdateFromSignature} />
          </div>
        </div>

      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
        <div className="bg-[#FDFDFD] border border-adjung-maroon/20 rounded shadow-2xl max-w-5xl w-full p-8 relative max-h-[90vh] overflow-y-auto scholarly-border animate-fade-in">
          <button onClick={handleClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 font-mono text-xs uppercase tracking-wider cursor-pointer">✕ Close</button>
          {renderContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12">
      {renderContent()}
    </div>
  );
}
