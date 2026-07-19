import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, RefreshCw, Edit, Upload, Link, Check, Loader2, Image as ImageIcon } from 'lucide-react';

interface EntryImageProps {
  key?: React.Key | null;
  url: string;
  alt: string;
  figNum?: number;
  isAuthor?: boolean;
  onUpdateImage?: (newUrl: string, newAlt: string) => void;
}

export function EntryImage({ url, alt, figNum, isAuthor, onUpdateImage }: EntryImageProps) {
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [inputUrl, setInputUrl] = useState(url);
  const [inputAlt, setInputAlt] = useState(alt);

  useEffect(() => {
    setInputUrl(url);
    setInputAlt(alt);
  }, [url, alt]);

  useEffect(() => {
    if (!url) {
      setStatus('failed');
      return;
    }
    setStatus('loading');
    
    // Base64, blob and local URLs are immediately successful as they are local/uploaded
    if (url.startsWith('data:') || url.startsWith('blob:') || !url.startsWith('http')) {
      setStatus('success');
      return;
    }

    const img = new Image();
    let isMounted = true;

    img.onload = () => {
      if (isMounted) setStatus('success');
    };
    img.onerror = () => {
      if (isMounted) setStatus('failed');
    };
    img.src = url;

    return () => {
      isMounted = false;
    };
  }, [url, retryCount]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
  };

  const handleSaveEdit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (onUpdateImage) {
      onUpdateImage(inputUrl, inputAlt);
    }
    setIsEditing(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result && onUpdateImage) {
          onUpdateImage(event.target.result as string, file.name.split('.')[0] || 'Uploaded Image');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // READER view (FOLIO): Omit and let layout reflow if loading fails
  if (!isAuthor) {
    if (status === 'loading') {
      // Gentle, silent loading spacer without broken image icons
      return (
        <div className="my-8 w-full max-w-lg mx-auto aspect-video bg-stone-50/55 rounded flex items-center justify-center border border-stone-200/20 select-none">
          <Loader2 className="w-5 h-5 text-stone-300 animate-spin" />
        </div>
      );
    }
    if (status === 'failed') {
      // Completely omit and reflow as requested!
      return null;
    }
    return (
      <figure className="my-8 text-center bg-transparent select-none">
        <img 
          src={url} 
          alt={alt} 
          referrerPolicy="no-referrer"
          className="max-w-full h-auto mx-auto border border-stone-200/50 p-1.5 bg-white shadow-sm rounded-sm"
        />
        <figcaption className="text-xs text-stone-400 mt-2.5 italic font-serif">
          {figNum !== undefined ? `Figure ${figNum}: ` : ''}{alt || 'Untitled'}
        </figcaption>
      </figure>
    );
  }

  // AUTHOR view (DESK): Display warn panels/editors
  return (
    <div className="my-4 p-4 border border-stone-200/60 rounded bg-stone-50/30 text-left select-none relative overflow-visible">
      {isEditing ? (
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="flex items-center justify-between border-b border-stone-200/60 pb-2 mb-2">
            <span className="font-mono text-[9px] uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-Adjung-maroon" /> Edit Image Asset Properties
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="font-mono text-[9px] uppercase text-stone-400 hover:text-stone-600 transition cursor-pointer"
            >
              Cancel
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[9.5px] font-mono uppercase tracking-wider text-stone-500 mb-1">Image URL (External Link)</label>
              <div className="relative">
                <Link className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-stone-400" />
                <input
                  type="text"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full bg-white border border-stone-200 pl-8 pr-3 py-1.5 rounded text-xs font-mono focus:outline-none focus:border-Adjung-maroon text-stone-700"
                />
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-mono uppercase tracking-wider text-stone-500 mb-1 font-semibold">Upload File (Supported Local Asset)</label>
              <div className="relative">
                <input
                  type="file"
                  id={`image-upload-file-${figNum || 'author'}`}
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label
                  htmlFor={`image-upload-file-${figNum || 'author'}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-stone-200 bg-white hover:bg-stone-50 hover:border-stone-300 rounded text-xs font-mono uppercase tracking-wider text-stone-600 cursor-pointer transition"
                >
                  <Upload className="w-3.5 h-3.5" /> Upload File Asset
                </label>
                <span className="text-[10px] text-stone-450 font-sans ml-3">Local base64 secure storage</span>
              </div>
            </div>

            <div>
              <label className="block text-[9.5px] font-mono uppercase tracking-wider text-stone-500 mb-1">Alternative Text / Caption Text</label>
              <input
                type="text"
                value={inputAlt}
                onChange={(e) => setInputAlt(e.target.value)}
                placeholder="Figure caption or alt description..."
                className="w-full bg-white border border-stone-200 px-3 py-1.5 rounded text-xs focus:outline-none focus:border-Adjung-maroon text-stone-700"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1.5">
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3 py-1.5 bg-Adjung-maroon hover:opacity-90 text-[#FDFDFD] font-mono text-[10px] uppercase tracking-wider rounded transition cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" /> Apply Changes
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {status === 'loading' && (
            <div className="p-8 border border-dashed border-stone-200 rounded flex flex-col items-center justify-center bg-white space-y-2">
              <Loader2 className="w-5 h-5 text-stone-400 animate-spin" />
              <span className="text-[10px] font-mono text-stone-400 uppercase tracking-widest animate-pulse">Loading Asset...</span>
            </div>
          )}

          {status === 'success' && (
            <div className="relative group/img text-center">
              <img 
                src={url} 
                alt={alt} 
                referrerPolicy="no-referrer"
                className="max-w-full max-h-80 h-auto mx-auto border border-stone-200/50 p-1.5 bg-white shadow-sm rounded-sm"
              />
              <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover/img:opacity-100 focus-within:opacity-100 transition-opacity duration-200">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="bg-white/95 hover:bg-white text-stone-700 p-1.5 rounded shadow-sm border border-stone-200/70 hover:text-Adjung-maroon transition cursor-pointer"
                  title="Edit properties"
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
              </div>
              {figNum !== undefined && (
                <figcaption className="text-xs text-stone-400 mt-2 italic font-serif">
                  Figure {figNum}: {alt || 'Untitled'}
                </figcaption>
              )}
            </div>
          )}

          {status === 'failed' && (
            <div className="p-4 border border-amber-250 bg-amber-50/50 rounded-md text-amber-900 space-y-3 shadow-sm select-text">
              <div className="flex gap-2.5 items-start">
                <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-mono text-xs uppercase tracking-wide font-semibold text-amber-800">
                    Image Loading Failed (Editor Warning)
                  </h4>
                  <p className="text-xs leading-relaxed text-stone-600 font-sans">
                    The external image asset at URL: <code className="font-mono bg-amber-100/60 px-1 py-0.5 rounded text-[10.5px] select-all break-all">{url}</code> is inaccessible or offline.
                  </p>
                  <p className="text-[10px] italic text-stone-450 font-sans">
                    Note: Readers will see the surrounding layout reflow naturally; they won't see broken placeholders or browser error icons.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1.5 border-t border-amber-200/50 select-none">
                <button
                  type="button"
                  onClick={handleRetry}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-amber-300 bg-white hover:bg-amber-50 text-amber-800 font-mono text-[9.5px] uppercase tracking-wider rounded transition cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry Load
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-amber-300 bg-white hover:bg-amber-50 text-amber-800 font-mono text-[9.5px] uppercase tracking-wider rounded transition cursor-pointer"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit URL
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-amber-700 hover:bg-amber-800 text-white font-mono text-[9.5px] uppercase tracking-wider rounded transition cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" /> Replace Image
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface EntryImageEditorProps {
  url: string;
  alt: string;
  idx: number;
  onUpdate: (newUrl: string, newAlt: string) => void;
  onConvertToParagraph?: () => void;
}

export function EntryImageEditor({ url, alt, idx, onUpdate, onConvertToParagraph }: EntryImageEditorProps) {
  return (
    <div className="border border-stone-200/70 rounded-md p-4 bg-white shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
        <span className="font-mono text-[9.5px] uppercase tracking-wider text-stone-500 font-semibold flex items-center gap-1">
          📷 Image Block Editor
        </span>
        {onConvertToParagraph && (
          <button
            type="button"
            onClick={onConvertToParagraph}
            className="text-[9.5px] font-mono uppercase text-stone-400 hover:text-Adjung-maroon transition underline cursor-pointer"
          >
            Edit as Raw Markdown
          </button>
        )}
      </div>

      <EntryImage
        url={url}
        alt={alt}
        figNum={idx + 1}
        isAuthor={true}
        onUpdateImage={onUpdate}
      />
    </div>
  );
}
