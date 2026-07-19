import React, { useState, useEffect } from 'react';
import { BiographyItem, IdentityProfile, User } from '../../types';
import { stripMarkdown, parseInlineFormatting } from '../../utils';
import { SignatureRenderer } from '../desk/SignatureRenderer';
import { PresentationSpec, getPresentationSpec } from '../../presentation';
import { Fingerprint, Edit3 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { IdentityStudio } from './IdentityStudio';
import { db } from '../../db/mockDb';

interface BiographyViewProps {
  authorProfile: IdentityProfile;
  currentAuthor: User;
  currentUser: User | null;
  selectedAuthorId: string;
  setEditingBioItem: (item: BiographyItem | null) => void;
  setShowAddBioModal: (show: boolean) => void;
  handleRemoveBioItem: (itemId: string) => void;
  presentationSpec?: PresentationSpec;
}

export function BiographyView({
  authorProfile,
  currentAuthor,
  currentUser,
  selectedAuthorId,
  setEditingBioItem,
  setShowAddBioModal,
  handleRemoveBioItem,
  presentationSpec,
}: BiographyViewProps) {
  const activeSpec = presentationSpec || getPresentationSpec('Essay');
  const { refreshDbState } = useAppContext();

  const [isEditingBio, setIsEditingBio] = useState(false);
  const [editedBio, setEditedBio] = useState(authorProfile.biography || '');
  const [showIdentityModal, setShowIdentityModal] = useState(false);

  useEffect(() => {
    setEditedBio(authorProfile.biography || '');
  }, [authorProfile.biography]);

  const handleSaveBio = async () => {
    const updatedIdentity: IdentityProfile = {
      ...authorProfile,
      biography: editedBio
    };

    await fetch('/api/identities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedIdentity)
    });

    db.updateIdentity(updatedIdentity);
    setIsEditingBio(false);
    refreshDbState();
  };
  return (
    <div className="space-y-16">
      {/* Intro Profile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start border-b border-stone-300 pb-12">
        <div className="lg:col-span-8 space-y-6">
          <h2 className="font-serif text-3xl md:text-4xl font-light tracking-tight text-[#111111] text-left">
            Biography
          </h2>
          
          <div className="relative group/bio">
            {isEditingBio ? (
              <div className="space-y-2 py-2 text-left">
                <textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  className="w-full border border-stone-200 p-3 rounded text-sm font-serif leading-relaxed text-[#111111]/90 focus:outline-none focus:border-[#802334] min-h-[200px] resize-y"
                  placeholder="Enter a description of yourself, your intellectual background, or interests..."
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditingBio(false)}
                    className="px-2.5 py-1 border border-stone-200 text-stone-600 rounded text-[10px] uppercase font-mono tracking-wider hover:bg-stone-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveBio}
                    className="px-2.5 py-1 bg-[#802334] text-white rounded text-[10px] uppercase font-mono tracking-wider hover:opacity-90 cursor-pointer"
                  >
                    Save Biography
                  </button>
                </div>
              </div>
            ) : (
              <div className="relative">
                <div 
                  className={`${activeSpec.typography.bodyFont} text-[9px] text-[#111111]/80 leading-relaxed whitespace-pre-line text-justify pr-2 columns-1 md:columns-2 gap-8 md:h-[130px]`}
                  style={{ columnFill: 'auto' }}
                >
                  {authorProfile.biography || <span className="text-stone-400 italic">No biography written yet. Click edit to write one!</span>}
                </div>
                {currentUser?.id === selectedAuthorId && (
                  <button
                    onClick={() => setIsEditingBio(true)}
                    className="absolute -top-6 right-0 opacity-0 group-hover/bio:opacity-100 transition-opacity p-1 text-stone-400 hover:text-[#802334] flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-wider cursor-pointer"
                    title="Edit Biography"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Biography
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Signature stamp card representation */}
        <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-stone-300 pt-8 lg:pt-0 lg:pl-8 text-center select-none">
          <span className="font-sans text-[9px] uppercase tracking-widest text-[#111111]/40 block mb-2">Signature</span>
          <div className="h-32 flex items-center justify-center z-10 overflow-visible">
            {(() => {
              const defaultSig = authorProfile.signatures.find(s => s.status === 'Default');
              return (
                <SignatureRenderer 
                  strokes={defaultSig?.strokes || []}
                  type={defaultSig?.type || 'drawn'}
                  typedText={defaultSig?.typedText || currentAuthor.signature}
                  fontFamily={defaultSig?.fontFamily}
                  typographyStyle={defaultSig?.typographyStyle}
                  penStyle={defaultSig?.penStyle}
                  className="w-full h-full overflow-visible origin-center"
                  color="#802334"
                  strokeWidth={2.5}
                  enableBleed={true}
                />
              );
            })()}
          </div>
          <div className="border-t border-stone-300/80 pt-4 mt-2 space-y-2">
            <div>
              <span className="block text-[9px] font-sans uppercase tracking-wider text-[#111111]/40">Pen Name</span>
              <span className="font-serif font-semibold text-[#111111] text-sm">{currentAuthor.penName}</span>
            </div>
            {authorProfile.displayName && authorProfile.displayName !== currentAuthor.penName && (
              <div>
                <span className="block text-[9px] font-sans uppercase tracking-wider text-[#111111]/40">Full Name</span>
                <span className="font-serif font-semibold text-[#111111] text-sm">{authorProfile.displayName}</span>
              </div>
            )}
            {authorProfile.affiliation && (
              <div>
                <span className="block text-[9px] font-sans uppercase tracking-wider text-[#111111]/40">Affiliation</span>
                <span className="font-serif font-semibold text-[#111111] text-sm">{authorProfile.affiliation}</span>
              </div>
            )}
            <div className="pt-2 border-t border-stone-300/70">
              <span className="block text-[9px] font-sans uppercase tracking-wider text-[#111111]/40 mb-0.5">Email / Contact</span>
              <a 
                href={`mailto:${currentAuthor.email}`} 
                className="font-mono text-xs text-adjung-maroon hover:underline block"
              >
                {currentAuthor.email}
              </a>
            </div>
            {currentUser?.id === selectedAuthorId && (
              <div className="pt-3 border-t border-stone-300/70 mt-2">
                <button
                  onClick={() => setShowIdentityModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 bg-[#802334] text-white hover:opacity-95 py-2 px-3 rounded font-mono text-[9px] uppercase tracking-wider transition cursor-pointer font-semibold shadow-sm"
                >
                  <Fingerprint className="w-3.5 h-3.5" />
                  Edit Identity
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chronological Life Timeline */}
      <div className="space-y-8">
        <div className="flex items-center justify-between border-b border-stone-300 pb-3">
          <h3 className="font-serif text-xl font-semibold tracking-tight text-[#111111]">
            Timeline
          </h3>
          {currentUser && currentUser.id === selectedAuthorId && (
            <button
              type="button"
              onClick={() => {
                setEditingBioItem(null);
                setShowAddBioModal(true);
              }}
              className="bg-[#802334] text-white px-3 py-1.5 uppercase tracking-wider text-[10px] font-sans font-medium hover:opacity-90 transition shadow-sm"
            >
              Add Milestone
            </button>
          )}
        </div>

        {authorProfile.lifeTimeline.length === 0 ? (
          <p className="text-xs text-[#111111]/40 italic">No timeline milestones cataloged yet.</p>
        ) : (
          <div className="relative border-l border-stone-300 ml-4 md:ml-32 pl-6 space-y-10 py-2">
            {authorProfile.lifeTimeline.map(item => (
              <div key={item.id} className="relative group">
                
                {/* Left float year for desktop layout */}
                <span className="absolute -left-[145px] top-0.5 hidden md:block w-24 text-right font-serif font-bold text-lg text-[#802334]">
                  {item.year}
                </span>

                {/* Bullet on timeline */}
                <span className="absolute -left-[31px] top-2 w-3 h-3 rounded-full bg-[#FDFDFD] border-2 border-[#802334]" />

                {/* Content block */}
                <div className="space-y-1.5 max-w-2xl bg-[#FDFDFD]/80 p-5 rounded border border-stone-200/40 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="md:hidden font-serif font-bold text-base text-[#802334]">{item.year}</span>
                      <span className="md:hidden text-stone-300">|</span>
                      <h4 className="font-serif font-semibold text-[#111111] text-base">{parseInlineFormatting(item.title)}</h4>
                    </div>
                    <span className="font-mono text-[9px] uppercase tracking-wider text-[#111111]/50 bg-[#111111]/5 px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                  </div>
                  <p className="font-serif text-[#111111]/70 text-sm leading-relaxed text-justify">
                    {item.description}
                  </p>
                  
                  {/* Remove milestone for owner */}
                  {currentUser && currentUser.id === selectedAuthorId && (
                    <div className="pt-2 text-right border-t border-stone-200/30 mt-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Delete this milestone permanently?')) {
                            handleRemoveBioItem(item.id);
                          }
                        }}
                        className="text-[10px] font-mono uppercase text-red-700 hover:underline"
                      >
                        Delete Milestone
                      </button>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}
      </div>

      {/* Identity Studio Modal */}
      {showIdentityModal && (
        <IdentityStudio isModal={true} onClose={() => setShowIdentityModal(false)} />
      )}
    </div>
  );
}
