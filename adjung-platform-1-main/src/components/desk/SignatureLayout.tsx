import React from 'react';
import { VectorStroke, DigitalSignature } from '../../types';
import { SignatureRenderer } from './SignatureRenderer';
import { ShieldCheck } from 'lucide-react';

interface SignatureLayoutProps {
  strokes?: VectorStroke[][];
  signature?: DigitalSignature;
  penName: string;
  date?: string;
  className?: string;
  color?: string;
  strokeWidth?: number;
  role?: string;
  affiliation?: string;
}

export function SignatureLayout({
  strokes,
  signature,
  penName,
  date,
  className = "",
  color = "#802334", // Adjung-maroon
  strokeWidth = 3.2,
  role,
  affiliation
}: SignatureLayoutProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center select-none ${className}`}>
      
      {/* Signature Graphic Area */}
      <div className="w-72 h-20 z-10 overflow-visible pointer-events-none mix-blend-multiply">
        <SignatureRenderer 
          strokes={signature?.strokes || strokes || []} 
          type={signature?.type || 'drawn'}
          typedText={signature?.typedText}
          fontFamily={signature?.fontFamily}
          typographyStyle={signature?.typographyStyle}
          penStyle={signature?.penStyle}
          className="w-full h-full overflow-visible" 
          color={color} 
          strokeWidth={strokeWidth} 
          enableBleed={true}
        />
      </div>

      {/* Elegant Architectural Baseline */}
      <div className="w-64 border-b border-stone-400 my-1">
      </div>

      {/* Author details */}
      <div className="mt-2 flex flex-col items-center">
        <div className="font-serif font-semibold text-stone-900 tracking-wide text-sm">
          {penName}
        </div>
        {affiliation && (
          <div className="font-sans font-normal text-[10px] text-stone-400 mt-0.5 select-all">
            {affiliation}
          </div>
        )}
        {role && (
          <div className="font-mono text-[8px] uppercase tracking-widest text-stone-400/80 mt-0.5">
            {role}
          </div>
        )}
        {date && (
          <div className="font-mono text-[8px] uppercase tracking-widest text-stone-500 mt-1 select-none">
            {new Date(date).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        )}
      </div>

    </div>
  );
}
export default SignatureLayout;
