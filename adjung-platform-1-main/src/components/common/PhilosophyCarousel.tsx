import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SystemSettings } from '../../types';
import { parseResearchFindings } from '../../utils';

interface PhilosophyCarouselProps {
  systemSettings: SystemSettings;
  researchFindingsGoogleDocText?: string;
}

export function PhilosophyCarousel({
  systemSettings,
  researchFindingsGoogleDocText = ''
}: PhilosophyCarouselProps) {
  const [index, setIndex] = useState(0);

  const findingsList = React.useMemo(() => {
    const { items: customFindingsText } = parseResearchFindings(systemSettings.researchFindingsText || '');
    const { items: customFindingsGoogle } = parseResearchFindings(researchFindingsGoogleDocText || '');
    const allCustomFindings = [...customFindingsText, ...customFindingsGoogle];

    const fallbacks = [
      {
        finding: "Social media usage is linked to decreased attention spans and cognitive fatigue.",
        source: "Journal of Media Psychology, 2025"
      },
      {
        finding: "Deep reading builds cognitive stamina and improves critical thinking skills.",
        source: "Stanford Research Centre, 2026"
      },
      {
        finding: "Regular digital disconnection restores neural pathways associated with empathy and reflection.",
        source: "MIT Technology Review, 2024"
      }
    ];

    return allCustomFindings.length > 0 ? allCustomFindings : fallbacks;
  }, [systemSettings.researchFindingsText, researchFindingsGoogleDocText]);

  useEffect(() => {
    if (findingsList.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % findingsList.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [findingsList.length]);

  const activeFinding = findingsList[index] || { finding: '', source: '' };

  return (
    <div className="w-full flex items-center justify-center h-[140px] md:h-[110px] overflow-hidden select-none">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full flex flex-col items-center justify-center px-4 md:px-8 py-2 text-center space-y-1.5"
        >
          <p className="font-serif text-[#2D2D2D] text-[16px] md:text-[18px] leading-relaxed max-w-xl">
            "{activeFinding.finding}"
          </p>
          {activeFinding.source && (
            <p className="font-mono text-[9px] uppercase tracking-widest text-[#555555]">
              — {activeFinding.source}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
