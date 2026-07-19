import React, { useState } from 'react';
import { DigitalSignature, IdentityProfile } from '../../types';
import { db } from '../../db/mockDb';
import { SignaturePad } from './SignaturePad';
import { SignatureRenderer } from './SignatureRenderer';
import { Edit3, CheckCircle, Trash2 } from 'lucide-react';

interface SignatureManagerProps {
  identity: IdentityProfile;
  onIdentityUpdate: (identity: IdentityProfile) => void;
}

export function SignatureManager({ identity, onIdentityUpdate }: SignatureManagerProps) {
  const [showPad, setShowPad] = useState(false);

  // Always find the primary default signature, or fallback to the first one
  const activeSig = identity.signatures.find(s => s.status === 'Default') || identity.signatures[0];

  const handleSaveNewSignature = (data: Partial<DigitalSignature>) => {
    const newSig: DigitalSignature = {
      id: `sig-${Date.now()}`,
      label: data.type === 'typed' ? (data.typedText || 'Signature') : `Signature ${new Date().toLocaleDateString()}`,
      status: 'Default',
      strokes: data.strokes || [],
      type: data.type || 'drawn',
      typedText: data.typedText,
      fontFamily: data.fontFamily,
      typographyStyle: data.typographyStyle,
      penStyle: data.penStyle,
      createdAt: new Date().toISOString()
    };

    // Replace the entire signatures array with just this single active signature (no archiving)
    const updatedIdentity = { 
      ...identity, 
      signatures: [newSig] 
    };
    db.updateIdentity(updatedIdentity);
    onIdentityUpdate(updatedIdentity);
    setShowPad(false);
  };

  const handleRemoveSignature = () => {
    if (window.confirm('Are you sure you want to remove your signature?')) {
      const updatedIdentity = { 
        ...identity, 
        signatures: [] 
      };
      db.updateIdentity(updatedIdentity);
      onIdentityUpdate(updatedIdentity);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-stone-200 pb-2">
        <div>
          <h3 className="font-serif text-lg text-stone-900">Handwritten Signature</h3>
          <p className="font-sans text-xs text-stone-500">
            Signatures replace profile photographs. This represents your official and public identity on Adjung.
          </p>
        </div>
        {!showPad && activeSig && (
          <button
            type="button"
            onClick={() => setShowPad(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FDFDFD] border border-Adjung-maroon/20 hover:bg-Adjung-maroon/5 text-Adjung-maroon rounded text-xs font-mono tracking-wider uppercase transition"
          >
            <Edit3 className="w-3.5 h-3.5" /> Change Signature
          </button>
        )}
      </div>

      {showPad && (
        <SignaturePad 
          onSave={handleSaveNewSignature} 
          onCancel={() => setShowPad(false)} 
          defaultName={identity.penName || identity.displayName}
          existingSignature={activeSig}
        />
      )}

      {!showPad && (!activeSig ? (
        <div className="text-center py-12 border border-dashed border-stone-300 rounded bg-stone-50">
          <p className="text-stone-500 font-serif italic mb-2">No active signature configured.</p>
          <button
            onClick={() => setShowPad(true)}
            className="text-Adjung-maroon font-mono text-xs uppercase tracking-wider hover:underline"
          >
            Create your primary signature
          </button>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto">
          <div className="border border-Adjung-maroon/30 p-5 rounded-lg bg-white relative shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-start mb-3">
              <div>
                <h4 className="font-mono text-[10px] uppercase tracking-widest font-bold text-stone-500">
                  Active Signature
                </h4>
                <p className="text-[10px] font-mono text-stone-400 mt-0.5">
                  Created on: {new Date(activeSig.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[9px] font-mono uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
                  <CheckCircle className="w-2.5 h-2.5" /> Active
                </span>
              </div>
            </div>

            <div 
              style={{
                backgroundColor: '#fdfbf7',
                backgroundImage: 'linear-gradient(rgba(139, 92, 26, 0.03) 1px, transparent 1px)',
                backgroundSize: '100% 12px',
              }}
              className="h-32 border border-stone-200/60 rounded-md flex items-center justify-center p-4 mb-4 relative overflow-hidden shadow-inner select-none"
            >
              <div className="absolute left-6 right-6 bottom-8 border-b border-dashed border-stone-300/40 pointer-events-none"></div>
              <SignatureRenderer 
                strokes={activeSig.strokes} 
                type={activeSig.type}
                typedText={activeSig.typedText}
                fontFamily={activeSig.fontFamily}
                className="w-full h-full z-10" 
                color="#802334" 
                enableBleed={true}
              />
            </div>

            <div className="flex justify-between items-center pt-2.5 border-t border-stone-100">
              <span className="text-[10px] font-mono uppercase tracking-wider text-stone-400">
                Style: {activeSig.type === 'typed' ? 'Typography (Typed)' : 'Drawn'}
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRemoveSignature}
                  className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-mono text-stone-500 hover:text-red-600 hover:bg-red-50 rounded transition border border-transparent hover:border-red-100"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
