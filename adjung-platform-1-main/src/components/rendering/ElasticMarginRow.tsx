import React, { useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ElasticMarginRowProps {
  key?: React.Key;
  children: React.ReactNode;
  noteLabel?: string;
  noteContent?: React.ReactNode;
  noteIndexRoman?: string;
}

export function ElasticMarginRow({
  children,
  noteLabel,
  noteContent,
  noteIndexRoman
}: ElasticMarginRowProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(true);
  const x = useMotionValue(0);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint in Tailwind is 1024px
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Map drag offset to opacity and scale of the margin note for a parallax elastic reveal
  const noteOpacity = useTransform(x, [0, -180, -260], [0, 0.9, 1]);
  const noteScale = useTransform(x, [0, -180, -260], [0.93, 0.98, 1]);

  // Desktop layout (always visible split-screen, perfectly aligned paragraphs)
  if (!isMobile) {
    return (
      <div className="w-full py-3 border-b border-stone-100/40 last:border-0">
        <div className="grid grid-cols-12 gap-8 items-start">
          {/* Main content column */}
          <div className="col-span-8 text-[#111111] leading-relaxed select-text">
            {children}
          </div>

          {/* Margin note column (empty if there is no note content for this paragraph) */}
          <div className="col-span-4 pl-6 text-left select-text">
            {noteContent ? (
              <div className="border-l-2 border-[#802334]/25 py-0.5 pl-4">
                <div className="flex items-center gap-1.5 mb-1">
                  {noteIndexRoman && (
                    <span className="font-sans text-[10px] font-semibold text-[#802334]">
                      ({noteIndexRoman})
                    </span>
                  )}
                  {noteLabel && (
                    <span className="block font-mono text-[8px] uppercase tracking-wider text-stone-400 font-bold">
                      {noteLabel}
                    </span>
                  )}
                </div>
                <div className="text-stone-500 italic text-[13px] md:text-[13.5px] leading-relaxed font-serif">
                  {noteContent}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  // Mobile / Tablet layout
  if (!noteContent) {
    return <div className="py-2 select-text">{children}</div>;
  }

  const handleDragEnd = (_event: any, info: any) => {
    if (info.offset.x < -60 || info.velocity.x < -150) {
      setIsOpen(true);
    } else if (info.offset.x > 60 || info.velocity.x > 150) {
      setIsOpen(false);
    }
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div className="relative w-full overflow-hidden py-3 group border-b border-stone-100/40 last:border-0 select-none">
      {/* Elastic Drag Container */}
      <motion.div
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -260, right: 0 }}
        dragElastic={{ left: 0.2, right: 0 }}
        onDragEnd={handleDragEnd}
        animate={{ x: isOpen ? -260 : 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        style={{ x }}
        className="w-full flex cursor-grab active:cursor-grabbing"
      >
        {/* Main Text Content Area */}
        <div 
          onClick={(e) => {
            const target = e.target as HTMLElement;
            if (target.closest('.margin-note-badge')) {
              e.preventDefault();
              e.stopPropagation();
              toggleOpen();
            }
          }}
          className="w-full flex-shrink-0 pr-8 relative select-text"
        >
          {children}
          
          {/* Subtle Indicator/Handle on the Right Edge of Text (Centered vertically for professional alignment) */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-30 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleOpen();
              }}
              className="p-1 rounded-full hover:bg-stone-100 text-[#802334]/70 hover:text-[#802334] transition-colors flex items-center justify-center"
              title="Drag or click to reveal margin note"
            >
              {isOpen ? (
                <ChevronRight className="w-3.5 h-3.5" />
              ) : (
                <ChevronLeft className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Hidden / Revealed Margin Note Area */}
        <motion.div
          style={{
            opacity: noteOpacity,
            scale: noteScale,
            width: 260
          }}
          className="flex-shrink-0 pl-6 pr-4 flex flex-col justify-center text-left select-text"
        >
          <div className="border-l-2 border-[#802334]/25 pl-4 py-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              {noteIndexRoman && (
                <span className="font-sans text-[10px] font-semibold text-[#802334]">
                  ({noteIndexRoman})
                </span>
              )}
              {noteLabel && (
                <span className="block font-mono text-[8px] uppercase tracking-wider text-stone-400 font-bold">
                  {noteLabel}
                </span>
              )}
            </div>
            <div className="text-stone-500 italic text-[13px] leading-relaxed font-serif">
              {noteContent}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
