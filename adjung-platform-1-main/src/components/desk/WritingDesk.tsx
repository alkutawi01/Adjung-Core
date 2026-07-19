import React, { useState, useEffect, useRef } from 'react';
import { PenTool, ChevronLeft, FileEdit, Lock, Globe, Settings } from 'lucide-react';
import { Entry, User, EntryType } from '../../types';
import { EntryRenderer } from '../rendering/EntryRenderer';
import { parseInlineFormatting, stripMarkdown } from '../../utils';
import { db } from '../../db/mockDb';
import { useAppContext } from '../../context/AppContext';

interface WritingDeskProps {
  entry?: Entry | null;
  onSave?: (entry: Entry) => void;
  onClose?: () => void;
  mode?: 'production' | 'laboratory';
  viewModeOverride?: 'preview' | 'editor';
  authorName?: string;
  authorSignature?: string;
  authorSignatureFont?: string;
}

export function WritingDesk({
  entry,
  onSave,
  onClose,
  mode = 'production',
  viewModeOverride,
  authorName,
  authorSignature,
  authorSignatureFont
}: WritingDeskProps = {}) {
  const {
    currentUser,
    setCurrentUser,
    entries,
    editingEntry: contextEditingEntry,
    setEditingEntry: contextSetEditingEntry,
    refreshDbState,
    createNewEntry,
    saveEntry: contextSaveEntry,
    deleteEntry: contextDeleteEntry,
    showToast
  } = useAppContext();

  const activeEntry = mode === 'laboratory' ? entry : contextEditingEntry;

  const [viewMode, setViewMode] = useState<'preview' | 'editor'>(viewModeOverride || 'preview');
  const lastScrollY = useRef<number>(0);

  // Settings states
  const [deskUsername, setDeskUsername] = useState('');
  const [deskPenName, setDeskPenName] = useState('');
  const [deskSignature, setDeskSignature] = useState('');
  const [deskBioText, setDeskBioText] = useState('');
  const [deskHeroTitle, setDeskHeroTitle] = useState('');
  const [deskHeroSubtitle, setDeskHeroSubtitle] = useState('');

  useEffect(() => {
    if (viewModeOverride) {
      setViewMode(viewModeOverride);
    }
  }, [viewModeOverride]);

  useEffect(() => {
    if (currentUser) {
      const userProfile = db.getProfileByAuthorId(currentUser.id);
      const identity = db.getIdentityByAccountId(currentUser.id);
      setDeskUsername(currentUser.username);
      setDeskPenName(currentUser.penName);
      setDeskSignature(currentUser.signature);
      setDeskBioText(identity ? identity.biography : '');
      setDeskHeroTitle(userProfile.heroTitle);
      setDeskHeroSubtitle(userProfile.heroSubtitle);
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeEntry && mode !== 'laboratory') {
      setViewMode('preview');
    }
  }, [activeEntry?.id, mode]);

  const handleSaveFolioSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    // 1. Update user's public identity metadata
    const updatedUser: User = {
      ...currentUser,
      username: deskUsername,
      penName: deskPenName,
      signature: deskSignature
    };
    db.updateUser(updatedUser);
    setCurrentUser(updatedUser);

    // 2. Update writer profile info
    const profile = db.getProfileByAuthorId(currentUser.id);
    const updatedProfile = {
      ...profile,
      heroTitle: deskHeroTitle,
      heroSubtitle: deskHeroSubtitle,
    };
    db.updateProfile(updatedProfile);

    const identity = db.getIdentityByAccountId(currentUser.id);
    if (identity) {
      db.updateIdentity({
        ...identity,
        penName: deskPenName,
        username: deskUsername,
        biography: deskBioText
      });
    }
    
    refreshDbState();
    showToast('Writing profile updated successfully', 'success');
  };

  const handleSave = (updatedEntry: Entry) => {
    if (mode === 'laboratory') {
      if (onSave) onSave(updatedEntry);
    } else {
      contextSaveEntry(updatedEntry);
    }
  };

  const handleDelete = (id: string) => {
    if (mode === 'laboratory') {
      // no op
    } else {
      contextDeleteEntry(id);
    }
  };

  const handleClose = () => {
    if (mode === 'laboratory') {
      if (onClose) onClose();
    } else {
      contextSetEditingEntry(null);
      refreshDbState();
    }
  };

  const renderComposer = () => {
    if (!activeEntry) return null;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between bg-[#111111]/5 p-2 border border-[#111111]/10 rounded">
          {mode !== 'laboratory' ? (
            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center gap-1 text-[#111111]/60 hover:text-[#802334] font-mono text-xs uppercase cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" /> Close Composer
            </button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#111111]/40">View</span>
            <div className="flex items-center border border-[#111111]/10 rounded overflow-hidden bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => {
                  lastScrollY.current = window.scrollY;
                  setViewMode('preview');
                  setTimeout(() => {
                    window.scrollTo({
                      top: lastScrollY.current,
                      behavior: 'auto'
                    });
                  }, 0);
                }}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition rounded-sm cursor-pointer ${
                  viewMode === 'preview'
                    ? 'bg-[#802334] text-white font-medium shadow-sm'
                    : 'text-[#111111]/60 hover:text-[#802334]'
                }`}
              >
                ● Visual
              </button>
              <button
                type="button"
                onClick={() => {
                  lastScrollY.current = window.scrollY;
                  setViewMode('editor');
                  setTimeout(() => {
                    window.scrollTo({
                      top: lastScrollY.current,
                      behavior: 'auto'
                    });
                  }, 0);
                }}
                className={`px-3 py-1 text-[10px] font-mono uppercase tracking-wider transition rounded-sm cursor-pointer ${
                  viewMode === 'editor'
                    ? 'bg-[#802334] text-white font-medium shadow-sm'
                    : 'text-[#111111]/60 hover:text-[#802334]'
                }`}
              >
                ○ Source
              </button>
            </div>
          </div>
        </div>

        <EntryRenderer
          entry={activeEntry}
          mode="edit"
          viewMode={viewMode}
          onSave={handleSave}
          onDelete={handleDelete}
          authorName={authorName || currentUser.penName}
          authorSignature={authorSignature || currentUser.signature}
          authorSignatureFont={authorSignatureFont || undefined}
          authorDigitalSignature={(() => {
            if (mode === 'laboratory' && authorName) {
              return {
                id: 'sig-sandbox',
                label: 'Sandbox Signature',
                accountId: activeEntry?.authorId || '',
                type: 'typed',
                fontFamily: authorSignatureFont || 'Mrs Saint Delafield',
                typedText: authorSignature || '',
                status: 'Default',
                strokes: [],
                createdAt: new Date().toISOString()
              };
            }
            const identity = db.getIdentityByAccountId(currentUser.id);
            if (!identity) return undefined;
            if (activeEntry?.signatureVersionId) {
              const sig = identity.signatures.find(s => s.id === activeEntry.signatureVersionId);
              if (sig) return sig;
            }
            return identity.signatures.find(s => s.status === 'Default');
          })()}
        />
      </div>
    );
  };

  if (!currentUser) return null;

  if (mode === 'laboratory') {
    return renderComposer();
  }

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[#111111]/10 pb-5">
        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-light text-[#111111] flex items-center gap-2">
            <PenTool className="w-5 h-5 text-[#802334]" />
            Desk
          </h2>
          <p className="font-sans text-[10px] uppercase tracking-widest text-[#111111]/40">
            Write, edit and manage your publications.
          </p>
        </div>

        {!contextEditingEntry && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => createNewEntry('Note')}
              className="px-3 py-1.5 bg-[#802334] text-white uppercase text-[10px] tracking-wider font-sans font-medium hover:opacity-95 transition cursor-pointer"
            >
              + Note
            </button>
            <button
              type="button"
              onClick={() => createNewEntry('Essay')}
              className="px-3 py-1.5 bg-[#802334] text-white uppercase text-[10px] tracking-wider font-sans font-medium hover:opacity-95 transition cursor-pointer"
            >
              + Essay
            </button>
            <button
              type="button"
              onClick={() => createNewEntry('Article')}
              className="px-3 py-1.5 bg-[#802334] text-white uppercase text-[10px] tracking-wider font-sans font-medium hover:opacity-95 transition cursor-pointer"
            >
              + Article
            </button>
          </div>
        )}
      </div>

      {activeEntry ? (
        renderComposer()
      ) : (
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Drafts & Published Lists */}
          <div className="space-y-10">
            
            {/* Drafts list */}
            <div className="space-y-4">
              <h3 className="font-sans text-[11px] uppercase tracking-widest font-semibold text-[#111111]/50 flex items-center justify-between border-b border-[#111111]/10 pb-2">
                <span>Drafts</span>
                <span className="bg-[#111111]/5 text-[#111111] px-2 py-0.5 rounded text-[10px]">
                  {entries.filter(e => {
                    const isOwner = e.authorId === currentUser.id;
                    const isInst = e.publicationClass === 'Institutional' && (currentUser.role === 'Chief Editor' || currentUser.role === 'Editor');
                    return (isOwner || isInst) && e.status === 'Draft';
                  }).length}
                </span>
              </h3>

              {entries.filter(e => {
                const isOwner = e.authorId === currentUser.id;
                const isInst = e.publicationClass === 'Institutional' && (currentUser.role === 'Chief Editor' || currentUser.role === 'Editor');
                return (isOwner || isInst) && e.status === 'Draft';
              }).length === 0 ? (
                <p className="text-xs text-[#111111]/40 italic py-3">No pending drafts. Your mind is quiet.</p>
              ) : (
                <div className="space-y-3">
                  {entries.filter(e => {
                    const isOwner = e.authorId === currentUser.id;
                    const isInst = e.publicationClass === 'Institutional' && (currentUser.role === 'Chief Editor' || currentUser.role === 'Editor');
                    return (isOwner || isInst) && e.status === 'Draft';
                  }).map(draft => (
                    <div 
                      key={draft.id} 
                      onClick={() => contextSetEditingEntry(draft)}
                      className="bg-white hover:bg-[#FDFDFD] border border-[#111111]/10 p-4 rounded flex items-center justify-between cursor-pointer group transition-colors shadow-sm"
                    >
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[#111111]/40">
                          <span className="text-[#802334] font-semibold">{draft.contentType}</span>
                          <span>•</span>
                          <span>Updated {new Date(draft.updatedDate).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-serif font-semibold text-[#111111] text-base group-hover:text-[#802334] transition-colors text-left">
                          {parseInlineFormatting(draft.title)}
                        </h4>
                      </div>
                      <FileEdit className="w-4 h-4 text-[#111111]/40 group-hover:text-[#802334] flex-shrink-0" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Published list */}
            <div className="space-y-4">
              <h3 className="font-sans text-[11px] uppercase tracking-widest font-semibold text-[#111111]/50 flex items-center justify-between border-b border-[#111111]/10 pb-2">
                <span>Published</span>
                <span className="bg-[#111111]/5 text-[#111111] px-2 py-0.5 rounded text-[10px]">
                  {entries.filter(e => {
                    const isOwner = e.authorId === currentUser.id;
                    const isInst = e.publicationClass === 'Institutional' && (currentUser.role === 'Chief Editor' || currentUser.role === 'Editor');
                    return (isOwner || isInst) && e.status === 'Published';
                  }).length}
                </span>
              </h3>

              {entries.filter(e => {
                const isOwner = e.authorId === currentUser.id;
                const isInst = e.publicationClass === 'Institutional' && (currentUser.role === 'Chief Editor' || currentUser.role === 'Editor');
                return (isOwner || isInst) && e.status === 'Published';
              }).length === 0 ? (
                <p className="text-xs text-[#111111]/40 italic py-3">No published records on file.</p>
              ) : (
                <div className="space-y-3">
                  {entries.filter(e => {
                    const isOwner = e.authorId === currentUser.id;
                    const isInst = e.publicationClass === 'Institutional' && (currentUser.role === 'Chief Editor' || currentUser.role === 'Editor');
                    return (isOwner || isInst) && e.status === 'Published';
                  }).map(pub => (
                    <div 
                      key={pub.id} 
                      onClick={() => contextSetEditingEntry(pub)}
                      className="bg-white hover:bg-[#FDFDFD] border border-[#111111]/10 p-4 rounded flex items-center justify-between cursor-pointer group transition-colors shadow-sm"
                    >
                      <div className="space-y-1 pr-4">
                        <div className="flex items-center gap-2 text-[10px] font-mono text-[#111111]/40">
                          <span className="text-[#802334] font-semibold">{pub.contentType}</span>
                          <span>•</span>
                          <span>Published {pub.publishedDate ? new Date(pub.publishedDate).toLocaleDateString() : 'N/A'}</span>
                        </div>
                        <h4 className="font-serif font-semibold text-[#111111] text-base group-hover:text-[#802334] transition-colors text-left">
                          {parseInlineFormatting(pub.title)}
                        </h4>
                      </div>
                      <div className="flex items-center gap-3 text-stone-400 flex-shrink-0">
                        {pub.visibility === 'Private' ? (
                          <Lock className="w-3.5 h-3.5 text-red-600" title="Private" />
                        ) : (
                          <Globe className="w-3.5 h-3.5 text-stone-400" title="Public" />
                        )}
                        <FileEdit className="w-4 h-4 group-hover:text-[#802334]" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
