import React, { useState, useEffect } from 'react';
import { User, Entry, SystemSettings } from '../../types';
import { BRAND } from '../../config/brand';
import { parseInlineFormatting, isArabicText, parseInTheNews, getDeskAccentColor, parseWorldClockHolidays } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Info, ChevronLeft, ChevronRight } from 'lucide-react';

interface ClockTime {
  timeStr: string;
  isHoliday: boolean;
  holidayName: string;
  isWeekend: boolean;
}

const HOLIDAYS_2026: Record<string, Record<string, string>> = {
  'New York': {
    '01/01': "New Year's Day",
    '01/19': "Martin Luther King Jr. Day",
    '02/16': "Presidents' Day",
    '05/25': "Memorial Day",
    '06/19': "Juneteenth",
    '07/04': "Independence Day",
    '09/07': "Labor Day",
    '10/12': "Columbus Day",
    '11/11': "Veterans Day",
    '11/26': "Thanksgiving",
    '12/25': "Christmas Day"
  },
  'London': {
    '01/01': "New Year's Day",
    '04/03': "Good Friday",
    '04/06': "Easter Monday",
    '05/04': "Early May Bank Holiday",
    '05/25': "Spring Bank Holiday",
    '08/31': "Summer Bank Holiday",
    '12/25': "Christmas Day",
    '12/26': "Boxing Day"
  },
  'Mecca': {
    '02/22': "Saudi Founding Day",
    '03/19': "Eid al-Fitr Holiday",
    '03/20': "Eid al-Fitr Holiday",
    '03/21': "Eid al-Fitr Holiday",
    '03/22': "Eid al-Fitr Holiday",
    '05/26': "Eid al-Adha Holiday",
    '05/27': "Eid al-Adha Holiday",
    '05/28': "Eid al-Adha Holiday",
    '05/29': "Eid al-Adha Holiday",
    '09/23': "Saudi National Day"
  },
  'Kuala Lumpur': {
    '01/01': "New Year's Day",
    '01/29': "Chinese New Year",
    '01/30': "Chinese New Year (Day 2)",
    '02/01': "Federal Territory Day",
    '02/03': "Thaipusam",
    '03/20': "Hari Raya Aidilfitri",
    '03/21': "Hari Raya Aidilfitri (Day 2)",
    '05/01': "Labour Day",
    '05/27': "Hari Raya Aidiladha",
    '05/31': "Wesak Day",
    '06/01': "Yang di-Pertuan Agong's Birthday",
    '07/16': "Awal Muharram",
    '08/31': "National Day (Merdeka)",
    '09/16': "Malaysia Day",
    '09/25': "Maulidur Rasul",
    '11/08': "Deepavali",
    '12/25': "Christmas Day"
  },
  'Tokyo': {
    '01/01': "New Year's Day",
    '01/12': "Coming of Age Day",
    '02/11': "National Foundation Day",
    '02/23': "Emperor's Birthday",
    '03/20': "Vernal Equinox Day",
    '04/29': "Showa Day",
    '05/03': "Constitution Memorial Day",
    '05/04': "Greenery Day",
    '05/05': "Children's Day",
    '07/20': "Marine Day",
    '08/11': "Mountain Day",
    '09/21': "Respect for the Aged Day",
    '09/23': "Autumnal Equinox Day",
    '10/12': "Sports Day",
    '11/03': "Culture Day",
    '11/23': "Labor Thanksgiving Day"
  }
};

interface FrontpageViewProps {
  entries: Entry[];
  users: User[];
  systemSettings: SystemSettings;
  setSelectedEntry: (entry: Entry | null) => void;
  setSelectedAuthorId: (id: string | null) => void;
  setActiveTab: (tab: string) => void;
  currentUser?: User | null;
  inTheNewsGoogleDocText?: string;
  worldClockHolidaysGoogleDocText?: string;
}

export function HoverWords({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  const words = text.split(/(\s+)/);
  return (
    <span className={className}>
      {words.map((w, idx) => {
        if (/\s+/.test(w)) return w;
        const isMaroon = className?.includes('text-adjung-maroon') || className?.includes('text-[#7B2737]') || className?.includes('text-[#802334]');
        const hoverClass = isMaroon 
          ? 'hover:text-stone-900 transition-colors duration-150 cursor-default' 
          : 'hover:text-adjung-maroon transition-colors duration-150 cursor-default';
        return (
          <span key={idx} className={hoverClass}>
            {w}
          </span>
        );
      })}
    </span>
  );
}

export const FrontpageView: React.FC<FrontpageViewProps> = ({
  entries,
  users,
  systemSettings,
  setSelectedEntry,
  setSelectedAuthorId,
  setActiveTab,
  currentUser,
  inTheNewsGoogleDocText = '',
  worldClockHolidaysGoogleDocText = '',
  setIndexSearchQuery,
}) => {
  // 1. World Clock State
  const [times, setTimes] = useState<(ClockTime | null)[]>([null, null, null, null, null]);

  // In The News digest overlay state
  const [showNewsOverlay, setShowNewsOverlay] = useState(false);
  const [activeOverlayIndex, setActiveOverlayIndex] = useState(0);
  const [activeFrontpageIndex, setActiveFrontpageIndex] = useState(0);

  const { items: parsedNewsItemsA } = parseInTheNews(systemSettings.inTheNewsText || '');
  const { items: parsedNewsItemsB } = parseInTheNews(inTheNewsGoogleDocText || '');

  const parsedNewsItems = React.useMemo(() => {
    let merged: any[] = [];
    if (parsedNewsItemsA.length === 0) {
      merged = parsedNewsItemsB;
    } else if (parsedNewsItemsB.length === 0) {
      merged = parsedNewsItemsA;
    } else {
      const result: any[] = [];
      let iA = 0;
      let iB = 0;
      while (iA < parsedNewsItemsA.length || iB < parsedNewsItemsB.length) {
        if (iB < parsedNewsItemsB.length) {
          result.push(parsedNewsItemsB[iB++]);
        }
        if (iA < parsedNewsItemsA.length) {
          result.push(parsedNewsItemsA[iA++]);
        }
      }
      merged = result;
    }
    // Limit display to maximum 50 news items
    return merged.slice(0, 50);
  }, [parsedNewsItemsA, parsedNewsItemsB]);

  const newestEssays = React.useMemo(() => {
    const list = entries
      .filter(e => e.status === 'Published' && e.contentType === 'Essay')
      .sort((a, b) => new Date(b.publishedDate || b.createdDate).getTime() - new Date(a.publishedDate || a.createdDate).getTime())
      .slice(0, 3);
    
    const fallbacks = [
      { id: 'fallback-essay-1', title: 'The Preservation Papers', authorId: null, fallback: true },
      { id: 'fallback-essay-2', title: 'Letters on Method', authorId: null, fallback: true },
      { id: 'fallback-essay-3', title: 'Foundations of Inquiry', authorId: null, fallback: true }
    ];

    return list.length > 0 ? list : fallbacks as any[];
  }, [entries]);

  const featuredTopics = React.useMemo(() => {
    const tagCounts: Record<string, number> = {};
    entries
      .filter(e => e.status === 'Published')
      .forEach(entry => {
        (entry.tags || []).forEach(tag => {
          if (tag) {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          }
        });
      });
    
    const sortedTags = Object.keys(tagCounts)
      .sort((a, b) => tagCounts[b] - tagCounts[a])
      .slice(0, 10);
    
    const fallbacks = ['Philosophy', 'History', 'Science', 'Literature'];
    return sortedTags.length > 0 ? sortedTags : fallbacks;
  }, [entries]);

  const activeNewsItem = parsedNewsItems[activeFrontpageIndex];
  const overlayItem = parsedNewsItems[activeOverlayIndex];

  // Frontpage news preview rotation (10 seconds)
  useEffect(() => {
    if (parsedNewsItems.length <= 1) return;
    const interval = setInterval(() => {
      setActiveFrontpageIndex((prev) => (prev + 1) % parsedNewsItems.length);
    }, 10000);
    return () => clearInterval(interval);
  }, [parsedNewsItems.length]);

  // Fullscreen overlay news rotation (10 seconds)
  useEffect(() => {
    if (!showNewsOverlay || parsedNewsItems.length <= 1) return;
    
    const interval = setInterval(() => {
      setActiveOverlayIndex((prev) => (prev + 1) % parsedNewsItems.length);
    }, 10000);
    
    return () => clearInterval(interval);
  }, [showNewsOverlay, parsedNewsItems.length]);

  useEffect(() => {
    if (!showNewsOverlay) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewsOverlay(false);
      } else if (e.key === 'ArrowRight' && parsedNewsItems.length > 1) {
        setActiveOverlayIndex((prev) => (prev + 1) % parsedNewsItems.length);
      } else if (e.key === 'ArrowLeft' && parsedNewsItems.length > 1) {
        setActiveOverlayIndex((prev) => (prev - 1 + parsedNewsItems.length) % parsedNewsItems.length);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewsOverlay, parsedNewsItems.length]);

  const handleNextNewsItem = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (parsedNewsItems.length <= 1) return;
    setActiveOverlayIndex((prev) => (prev + 1) % parsedNewsItems.length);
  };

  const handlePrevNewsItem = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (parsedNewsItems.length <= 1) return;
    setActiveOverlayIndex((prev) => (prev - 1 + parsedNewsItems.length) % parsedNewsItems.length);
  };

  useEffect(() => {
    const cities = [
      { name: 'New York', tz: 'America/New_York' },
      { name: 'London', tz: 'Europe/London' },
      { name: 'Mecca', tz: 'Asia/Riyadh' }, // Mecca is in Riyadh timezone (UTC+3)
      { name: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur' },
      { name: 'Tokyo', tz: 'Asia/Tokyo' }
    ];

    const updateTime = () => {
      const newTimes = cities.map(c => {
        try {
          const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: c.tz,
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          });
          const parts = formatter.formatToParts(new Date());
          const obj: any = {};
          parts.forEach(p => { obj[p.type] = p.value; });

          let dateStr = `${obj.day}/${obj.month}/${obj.year}`;
          if (c.name === 'New York') {
            dateStr = `${obj.month}/${obj.day}/${obj.year}`;
          } else if (c.name === 'Tokyo') {
            dateStr = `${obj.year}/${obj.month}/${obj.day}`;
          } else if (c.name === 'Mecca') {
            try {
              const hijriFormatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
                timeZone: c.tz,
                year: '2-digit',
                month: '2-digit',
                day: '2-digit'
              });
              const hParts = hijriFormatter.formatToParts(new Date());
              const hObj: any = {};
              hParts.forEach(p => { hObj[p.type] = p.value; });
              dateStr = `${hObj.day}/${hObj.month}/${hObj.year}`;
            } catch (err) {
              console.error(err);
            }
          }

          // Parse custom holidays
          const { items: customHolidaysText } = parseWorldClockHolidays(systemSettings.worldClockHolidaysText || '');
          const { items: customHolidaysGoogle } = parseWorldClockHolidays(worldClockHolidaysGoogleDocText || '');
          const allCustomHolidays = [...customHolidaysText, ...customHolidaysGoogle];

          // Find match for this city and dateStr
          const customMatch = allCustomHolidays.find(h => 
            h.city.toLowerCase() === c.name.toLowerCase() && 
            h.dateStr === dateStr
          );

          let isHoliday = false;
          let holidayName = '';
          let isWeekend = false;

          const day = obj.weekday.toUpperCase();

          if (customMatch) {
            if (customMatch.status === 'Holiday') {
              isHoliday = true;
              holidayName = customMatch.holidayName || 'Public Holiday';
              isWeekend = c.name === 'Mecca'
                ? (day === 'FRI' || day === 'SAT')
                : (day === 'SAT' || day === 'SUN');
            } else if (customMatch.status === 'Weekend') {
              isWeekend = true;
            } else if (customMatch.status === 'Working') {
              isWeekend = false;
              isHoliday = false;
            }
          } else {
            // Default pre-seeded logic
            const gregKey = `${obj.month}/${obj.day}`;
            const cityHolidays = HOLIDAYS_2026[c.name] || {};
            holidayName = cityHolidays[gregKey] || '';
            isHoliday = !!holidayName;

            isWeekend = c.name === 'Mecca'
              ? (day === 'FRI' || day === 'SAT')
              : (day === 'SAT' || day === 'SUN');
          }

          const timeStr = `${dateStr} · ${day} · ${obj.hour}:${obj.minute}`;

          return {
            timeStr,
            isHoliday,
            holidayName,
            isWeekend
          };
        } catch (e) {
          return null;
        }
      });
      setTimes(newTimes);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [systemSettings.worldClockHolidaysText, worldClockHolidaysGoogleDocText]);

  // Helper to extract name initials (e.g. "Elena Vasquez" -> "E.V.")
  const getInitials = (name: string): string => {
    if (!name) return '';
    return name
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase())
      .filter(c => /[A-Z]/.test(c))
      .join('.') + '.';
  };

  // Helper to estimate reading duration
  const estimateReadingTime = (content: string): number => {
    if (!content) return 1;
    const words = content.trim().split(/\s+/).length;
    return Math.max(1, Math.ceil(words / 200));
  };

  // 2. Curated & Dynamic Content Prep
  const featuredEntry = entries.find(
    (e) => e.id === systemSettings.featuredEntryId && e.status === 'Published'
  );

  const fallbackFeatured: Entry = {
    id: 'fallback-featured',
    authorId: null,
    publisher: 'Elena Vasquez',
    contentType: 'Essay',
    status: 'Published',
    visibility: 'Public',
    createdDate: new Date(2026, 6, 4).toISOString(),
    updatedDate: new Date(2026, 6, 4).toISOString(),
    publishedDate: new Date(2026, 6, 4).toISOString(),
    title: 'On the Preservation of Human Knowledge in an Age of Impermanence',
    slug: 'preservation-of-human-knowledge',
    tags: ['Philosophy', 'Preservation', 'Institutions'],
    canonicalUrl: 'https://adjung.com/essay/preservation-of-human-knowledge',
    content: `A meditation on why civilizations forget, how libraries burn, and what it means to build institutions that outlast their founders. This essay traces the arc from Alexandria to the digital present, arguing that preservation is not passive but an active, moral commitment.`,
    excerpt: `A meditation on why civilizations forget, how libraries burn, and what it means to build institutions that outlast their founders. This essay traces the arc from Alexandria to the digital present, arguing that preservation is not passive but an active, moral commitment.`
  };

  const activeFeatured = featuredEntry || fallbackFeatured;
  const featuredAuthor = activeFeatured.authorId 
    ? users.find(u => u.id === activeFeatured.authorId) 
    : null;
  const featuredAuthorName = featuredAuthor?.penName || activeFeatured.publisher || 'Elena Vasquez';
  const featuredAuthorSig = featuredAuthor?.signature || getInitials(featuredAuthorName);

  // Editorial Note Aside
  const dbEditorNote = entries
    .filter((e) => e.contentType === "Editor's Note" && e.status === 'Published')
    .sort(
      (a, b) =>
        new Date(b.publishedDate || b.createdDate).getTime() -
        new Date(a.publishedDate || a.createdDate).getTime()
    )[0];

  // News Ticker State & Logic
  const [tickerIndex, setTickerIndex] = useState(0);
  const notices = entries.filter((e) => e.contentType === 'Notice' && e.status === 'Published');
  const fallbackTicker = [
    "New archaeological findings reveal previously unknown trade routes across Central Asia during the 8th century.",
    "Leading institutions establish consortium for digital preservation of endangered linguistic archives.",
    "Study examines long-term effects of historical documentation practices on contemporary scholarship."
  ];
  const tickerItems = notices.length > 0
    ? notices.map(n => `${n.title} - ${n.excerpt || n.content.substring(0, 100)}`)
    : fallbackTicker;

  useEffect(() => {
    if (tickerItems.length <= 1) return;
    const interval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerItems.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [tickerItems.length]);

  // Curation permissions
  const canCurate = currentUser && (
    currentUser.role === 'Chief Editor' || 
    currentUser.role === 'Editor' || 
    currentUser.role === 'Admin'
  );

  // Editor's Selections Grid (3 Columns)
  // Editor's Selections Grid (3 Columns)
  const selectedEntries = (systemSettings.editorialSelectionIds || [])
    .map(id => entries.find(e => e.id === id && e.status === 'Published'))
    .filter(Boolean) as Entry[];

  let selectionsList: any[] = selectedEntries.map(e => {
    const auth = users.find(u => u.id === e.authorId);
    const authName = auth?.penName || e.publisher || 'Scholar';
    return {
      id: e.id,
      title: e.title || (e.contentType === 'Note' ? 'Philosophical Fragment' : 'Untitled'),
      excerpt: e.excerpt || e.content.substring(0, 150) + '...',
      discipline: e.discipline || e.tags[0] || e.contentType,
      authorName: authName,
      authorSig: auth?.signature || getInitials(authName),
      entryObj: e
    };
  });

  while (selectionsList.length < 3) {
    selectionsList.push({
      id: `empty-selection-${selectionsList.length}`,
      title: '',
      excerpt: '',
      discipline: '',
      authorName: '',
      authorSig: '',
      entryObj: null
    });
  }

  // Featured Essays (3 entries)
  const essaySelections = (systemSettings.featuredEssayIds || [])
    .map(id => entries.find(e => e.id === id && e.status === 'Published' && e.id !== activeFeatured.id))
    .filter(Boolean) as Entry[];

  const displayEssays: any[] = essaySelections.map(e => {
    const auth = users.find(u => u.id === e.authorId);
    const name = auth?.penName || e.publisher || 'Writer';
    return { id: e.id, title: e.title, author: name, sig: auth?.signature || getInitials(name), entryObj: e };
  });

  while (displayEssays.length < 3) {
    displayEssays.push({
      id: `empty-essay-${displayEssays.length}`,
      title: '',
      author: '',
      sig: '',
      entryObj: null
    });
  }

  // Featured Notes (2 entries)
  const noteSelections = (systemSettings.featuredNoteIds || [])
    .map(id => entries.find(e => e.id === id && e.status === 'Published'))
    .filter(Boolean) as Entry[];

  const displayNotes: any[] = noteSelections.map(n => {
    const auth = users.find(u => u.id === n.authorId);
    const name = auth?.penName || n.publisher || 'Writer';
    return { id: n.id, title: n.title || n.content.substring(0, 80) + '...', author: name, sig: auth?.signature || getInitials(name), entryObj: n };
  });

  while (displayNotes.length < 2) {
    displayNotes.push({
      id: `empty-note-${displayNotes.length}`,
      title: '',
      author: '',
      sig: '',
      entryObj: null
    });
  }

  // Institutional Notice Board
  const noticeBoardText = notices.length > 0
    ? `${notices[0].title}: ${notices[0].excerpt || notices[0].content.substring(0, 150)}`
    : "Adjung will begin accepting applications for the 2027 Fellowship Programme in September. Details will be published in the Directory.";

  return (
    <div className="bg-transparent text-[#1F1F1F] font-serif w-full min-h-screen px-4 md:px-8 py-12 select-none animate-fade-in">
      <div className="max-w-5xl mx-auto">
        
        {/* Wordmark Hero */}
        <section className="text-center pt-8 pb-6 animate-fade-in">
          <motion.h1 
            animate={{
              color: ['#1F1F1F', '#802334', '#1F1F1F']
            }}
            transition={{
              duration: 15,
              ease: 'easeInOut',
              repeat: Infinity
            }}
            className="font-serif font-light tracking-tight text-6xl md:text-7xl"
          >
            <HoverWords text={BRAND.logoText} />
          </motion.h1>
          <p className="font-sans text-[10px] md:text-xs tracking-editorial uppercase text-[#555555] mt-3">
            <HoverWords text={BRAND.tagline} />
          </p>
        </section>

        <hr className="rule border-t border-stone-300 my-3" />

        {/* World Clock Strip */}
        <div className="py-2.5 flex justify-center items-center overflow-x-auto gap-10 px-1 text-center" id="world-clock">
          {[
            { city: 'New York', tz: 'America/New_York' },
            { city: 'London', tz: 'Europe/London' },
            { city: 'Mecca', tz: 'Asia/Riyadh' },
            { city: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur' },
            { city: 'Tokyo', tz: 'Asia/Tokyo' }
          ].map((c, i) => {
            const timeData = times[i];
            let cityColor = 'text-[#555555]';
            let isHoliday = false;
            let isWeekend = false;
            let holidayName = '';

            if (timeData) {
              isHoliday = timeData.isHoliday;
              isWeekend = timeData.isWeekend;
              holidayName = timeData.holidayName;

              if (isHoliday) {
                cityColor = 'text-[#1F1F1F] font-bold border-b border-dashed border-[#1F1F1F]/40';
              } else if (isWeekend) {
                cityColor = 'text-stone-400 font-light';
              } else {
                cityColor = 'text-[#7B2737] font-semibold';
              }
            }

            return (
              <div key={c.city} className="flex-shrink-0 group relative">
                <p className={`font-sans text-[9px] tracking-editorial uppercase mb-0.5 inline-block select-none transition-colors duration-200 ${cityColor} ${isHoliday ? 'cursor-help' : ''}`}>
                  {c.city}
                </p>
                {isHoliday && holidayName && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#1F1F1F] text-[#FDFDFD] text-[9px] font-sans py-1 px-2.5 rounded shadow-lg whitespace-nowrap z-50 animate-fade-in pointer-events-none tracking-normal">
                    {holidayName}
                  </div>
                )}
                <p className="font-serif text-xs md:text-sm text-[#1F1F1F] font-light min-w-[140px]">
                  {timeData ? timeData.timeStr : 'Loading...'}
                </p>
              </div>
            );
          })}
        </div>

        <hr className="rule border-t border-stone-300 my-3" />

        {/* Landing Page quiet news panel */}
        <div 
          onClick={() => {
            if (parsedNewsItems.length > 0) {
              setActiveOverlayIndex(activeFrontpageIndex);
              setShowNewsOverlay(true);
            }
          }}
          className="py-3 px-0 bg-transparent hover:opacity-85 transition duration-300 cursor-pointer text-left space-y-2 group relative"
        >
          <div className="flex justify-between items-center select-none">
            <p className="font-sans text-[10px] tracking-editorial uppercase text-[#7B2737] font-semibold">
              IN THE NEWS
            </p>
            {parsedNewsItems.length > 0 && (
              <span className="font-mono text-[8px] uppercase tracking-wider text-stone-400 group-hover:text-adjung-maroon transition duration-200">
                ● Read Fullscreen
              </span>
            )}
          </div>
          
          {activeNewsItem ? (
            <div className="select-text py-1 min-h-[2.5rem] flex items-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.h4
                  key={activeFrontpageIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="font-serif text-[#1F1F1F] text-base md:text-lg leading-snug tracking-tight"
                >
                  <strong 
                    className="font-sans text-[11px] md:text-xs uppercase tracking-wider mr-2.5 font-bold inline-block"
                    style={{ color: getDeskAccentColor(activeNewsItem.desk) }}
                  >
                    <HoverWords text={activeNewsItem.desk} />
                  </strong>
                  <HoverWords text={activeNewsItem.title} />
                </motion.h4>
              </AnimatePresence>
            </div>
          ) : (
            <p className="font-serif italic text-stone-400 text-xs py-2 select-none">No curated news items available.</p>
          )}
        </div>

        <hr className="rule border-t border-stone-300 my-3" />

        {/* Featured Entry Label with Curation Option */}
        <div className="pt-4 pb-2 flex items-center justify-between">
          <div className="flex items-center">
            <span className="font-sans text-[10px] md:text-xs tracking-editorial uppercase text-[#7B2737] font-semibold">
              FEATURED ENTRY
            </span>
            {canCurate && (
              <button
                onClick={() => setActiveTab('editorium')}
                className="ml-3 flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[#7B2737] hover:bg-stone-200/50 px-1.5 py-0.5 rounded border border-[#7B2737]/25 transition cursor-pointer"
                title="Manage Frontpage Curation"
              >
                <Settings className="w-2.5 h-2.5" /> Curate
              </button>
            )}
          </div>
        </div>

        {/* Two Column Hero */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-10 pt-3 pb-8">
          
          {/* Left: Main Featured Article */}
          <div className="md:col-span-2 space-y-4">
            <h2 
              onClick={() => {
                if (activeFeatured.id !== 'fallback-featured') {
                  setSelectedEntry(activeFeatured);
                  setSelectedAuthorId(activeFeatured.authorId);
                  setActiveTab('folio');
                }
              }}
              className={`font-serif font-light leading-tight text-3xl md:text-4xl text-[#1F1F1F] hover:text-[#7B2737] transition-all duration-200 ${
                activeFeatured.id !== 'fallback-featured' ? 'cursor-pointer hover:font-medium' : ''
              }`}
            >
              <HoverWords text={activeFeatured.title} />
            </h2>
            
            <p className="font-serif text-[16px] md:text-[17px] text-[#2D2D2D] leading-relaxed">
              <HoverWords text={activeFeatured.excerpt || activeFeatured.content.substring(0, 300) + '...'} />
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1 text-[10px] md:text-xs text-[#555555]">
              <span 
                onClick={() => {
                  if (activeFeatured.authorId) {
                    setSelectedAuthorId(activeFeatured.authorId);
                    setActiveTab('bio');
                  }
                }}
                className={`font-sans tracking-editorial uppercase text-[#1F1F1F] transition-all duration-200 ${
                  activeFeatured.authorId ? 'hover:text-[#7B2737] cursor-pointer font-medium hover:font-bold' : ''
                }`}
              >
                {featuredAuthorName}
              </span>
              <span className="sig italic font-serif text-[9.5px] opacity-70">
                {featuredAuthorSig}
              </span>
              <span className="text-[#E0DDD8]">·</span>
              <span className="font-sans">
                {activeFeatured.publishedDate 
                  ? new Date(activeFeatured.publishedDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                  : '4 July 2026'}
              </span>
              <span className="text-[#E0DDD8]">·</span>
              <span className="font-sans">
                {estimateReadingTime(activeFeatured.content)} min read
              </span>
              <span className="text-[#E0DDD8]">·</span>
              <span className="font-sans">
                {activeFeatured.tags[0] || 'Scholarly'}
              </span>
            </div>

            {/* Author Script Signature stamp */}
            <div className="pt-2">
              <p className="sig font-serif text-[16px] md:text-[18px] text-[#1F1F1F] opacity-80 select-none">
                {featuredAuthorSig.replace(/\./g, '')}
              </p>
            </div>

            <div className="pt-4">
              <button
                type="button"
                onClick={() => {
                  if (activeFeatured.id !== 'fallback-featured') {
                    setSelectedEntry(activeFeatured);
                    setSelectedAuthorId(activeFeatured.authorId);
                    setActiveTab('folio');
                  } else {
                    setActiveTab('index');
                  }
                }}
                className="font-sans text-xs tracking-editorial uppercase text-[#7B2737] hover:text-[#9e3347] transition-all border-b border-[#7B2737] pb-0.5 font-semibold hover:font-bold cursor-pointer"
              >
                Read Full Entry →
              </button>
            </div>
          </div>

          {/* Right Column: Editorial Note */}
          <aside className="border-l border-stone-300 pl-6 md:pl-8 space-y-4">
            <span className="block font-sans text-[10px] md:text-xs tracking-editorial uppercase text-[#7B2737] font-semibold">
              EDITORIAL NOTE
            </span>
            
            {dbEditorNote ? (
              <div 
                onClick={() => {
                  setSelectedEntry(dbEditorNote);
                  setActiveTab('editorial');
                }}
                className="cursor-pointer group space-y-3"
              >
                <h4 className="font-serif text-lg md:text-xl text-[#1F1F1F] leading-snug group-hover:text-[#7B2737] group-hover:font-medium transition-all duration-200">
                  <HoverWords text={dbEditorNote.title} />
                </h4>
                <p className="font-serif text-sm leading-relaxed text-[#2D2D2D] italic">
                  <HoverWords text={dbEditorNote.excerpt || dbEditorNote.content.substring(0, 220) + '...'} />
                </p>
                <span className="inline-block font-sans text-[9px] uppercase tracking-wider text-[#7B2737] hover:underline hover:font-bold transition-all duration-200">
                  Continue Reading →
                </span>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="font-serif text-[14px] leading-relaxed text-[#2D2D2D]">
                  <HoverWords text="This week we return to a question that has occupied Adjung since its founding: what does it mean to publish something that endures? In an era of ephemeral content and algorithmic decay, the act of writing for permanence is itself a form of resistance. We present Dr. Vasquez's essay as both argument and demonstration." />
                </p>
                <p className="font-sans text-[9px] tracking-editorial uppercase text-[#555555] font-medium leading-normal">
                  THE ADJUNG EDITORIAL BOARD
                </p>
              </div>
            )}
          </aside>

        </section>

        <hr className="rule border-t border-stone-300" />

        {/* Editor's Selections */}
        <section className="py-10">
          <div className="flex items-center justify-between mb-8">
            <span className="font-sans text-[10px] md:text-xs tracking-editorial uppercase text-[#7B2737] font-semibold">
              FEATURED ARTICLES
            </span>
            {canCurate && (
              <button
                onClick={() => setActiveTab('editorium')}
                className="flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider text-[#7B2737] hover:bg-stone-200/50 px-1.5 py-0.5 rounded border border-[#7B2737]/25 transition-all duration-200 hover:font-bold cursor-pointer"
              >
                Curate Selection
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
            {selectionsList.map((item, idx) => (
              <div 
                key={item.id} 
                onClick={() => {
                  if (item.entryObj) {
                    setSelectedEntry(item.entryObj);
                    setSelectedAuthorId(item.entryObj.authorId);
                    setActiveTab('folio');
                  }
                }}
                className={`space-y-2.5 ${idx > 0 ? 'md:border-l md:border-stone-300 md:pl-8' : ''} ${item.entryObj ? 'cursor-pointer group' : ''}`}
              >
                {item.entryObj ? (
                  <>
                    <p className="font-sans text-[9px] md:text-[10px] tracking-editorial uppercase text-[#555555]">
                      {item.discipline}
                    </p>
                    <h3 className="font-serif font-light text-[20px] md:text-[22px] text-[#1F1F1F] leading-snug group-hover:text-[#7B2737] group-hover:font-medium transition-all duration-200">
                      <HoverWords text={item.title} />
                    </h3>
                    <p className="font-serif text-sm leading-relaxed text-[#2D2D2D]">
                      <HoverWords text={item.excerpt} />
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="font-sans text-[9px] md:text-[10px] text-[#555555]">
                        {item.authorName.toUpperCase()}
                      </span>
                      <span className="sig italic text-[9px] text-[#555555] opacity-70">
                        {item.authorSig}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="min-h-[150px] flex items-center justify-center border border-dashed border-stone-300 rounded-sm select-none bg-stone-50/10">
                    <span className="font-sans text-[9px] uppercase tracking-wider text-stone-500">Empty Selection Slot</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <hr className="rule border-t border-stone-300" />

        {/* Featured Essays & Notes Section */}
        <section className="py-10 grid grid-cols-1 md:grid-cols-3 gap-10">
          
          {/* Column 1 & 2: Featured Essays */}
          <div className="md:col-span-2 space-y-6">
            <span className="block font-sans text-[10px] md:text-xs tracking-editorial uppercase text-[#7B2737] font-semibold mb-2">
              FEATURED ESSAYS
            </span>
            <div className="space-y-4">
              {displayEssays.map((essay) => (
                <div 
                  key={essay.id}
                  onClick={() => {
                    if (essay.entryObj) {
                      setSelectedEntry(essay.entryObj);
                      setSelectedAuthorId(essay.entryObj.authorId);
                      setActiveTab('folio');
                    }
                  }}
                  className={`flex justify-between items-baseline border-b border-stone-300 pb-3 ${
                    essay.entryObj ? 'cursor-pointer group' : ''
                  }`}
                >
                  {essay.entryObj ? (
                    <>
                      <h3 className="font-serif font-light text-[18px] md:text-[20px] text-[#1F1F1F] group-hover:text-[#7B2737] group-hover:font-medium transition-all duration-200 max-w-[70%]">
                        <HoverWords text={essay.title} />
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-[#555555]">
                        <span className="font-sans font-light">{essay.author}</span>
                        <span className="sig italic font-serif text-[9px] opacity-70">{essay.sig}</span>
                      </div>
                    </>
                  ) : (
                    <div className="w-full flex justify-between items-center py-2 text-stone-500 select-none">
                      <span className="font-sans text-[9px] uppercase tracking-wider">Empty Essay Slot</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: Featured Notes */}
          <div className="border-l border-stone-300 pl-6 md:pl-8 space-y-6">
            <span className="block font-sans text-[10px] md:text-xs tracking-editorial uppercase text-[#7B2737] font-semibold mb-2">
              FEATURED NOTES
            </span>
            <div className="space-y-5">
              {displayNotes.map((note) => (
                <div 
                  key={note.id}
                  onClick={() => {
                    if (note.entryObj) {
                      setSelectedEntry(note.entryObj);
                      setSelectedAuthorId(note.entryObj.authorId);
                      setActiveTab('folio');
                    }
                  }}
                  className={`space-y-1.5 ${note.entryObj ? 'cursor-pointer group' : ''}`}
                >
                  {note.entryObj ? (
                    <>
                      <h3 className="font-serif font-light text-[18px] text-[#1F1F1F] leading-snug group-hover:text-[#7B2737] group-hover:font-medium transition-all duration-200">
                        <HoverWords text={note.title} />
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-[#555555]">
                        <span className="font-sans font-light">{note.author}</span>
                        <span className="sig italic text-[9px] opacity-70">{note.sig}</span>
                      </div>
                    </>
                  ) : (
                    <div className="py-2 text-stone-500 select-none">
                      <span className="font-sans text-[9px] uppercase tracking-wider">Empty Note Slot</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

        </section>

        <hr className="rule border-t border-stone-300" />

        {/* Institutional Section */}
        <section className="py-10">
          <span className="block font-sans text-[10px] md:text-xs tracking-editorial uppercase text-[#7B2737] font-semibold mb-8">
            INSTITUTIONAL
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Notice Board */}
            <div>
              <p className="font-sans text-[9px] md:text-[10px] tracking-editorial uppercase text-[#555555] mb-2 font-medium">
                NOTICE BOARD
              </p>
              <p className="font-serif text-sm leading-relaxed text-[#2D2D2D]">
                {parseInlineFormatting(noticeBoardText)}
              </p>
            </div>
            
            {/* Publishing Policy */}
            <div className="md:border-l md:border-stone-300 md:pl-8">
              <p className="font-sans text-[9px] md:text-[10px] tracking-editorial uppercase text-[#555555] mb-2 font-medium">
                PUBLISHING POLICY
              </p>
              <p className="font-serif text-sm leading-relaxed text-[#2D2D2D]">
                All works are reviewed for intellectual merit and editorial clarity. Adjung does not optimise for engagement. We publish what endures.
              </p>
            </div>
            
            {/* About */}
            <div className="md:border-l md:border-stone-300 md:pl-8">
              <p className="font-sans text-[9px] md:text-[10px] tracking-editorial uppercase text-[#555555] mb-2 font-medium">
                ABOUT ADJUNG
              </p>
              <p className="font-serif text-sm leading-relaxed text-[#2D2D2D]">
                Adjung is a knowledge publishing platform dedicated to thoughtful writing, scholarly publishing, and the long-term preservation of human knowledge.
              </p>
            </div>
          </div>
        </section>

        <hr className="rule border-t border-stone-300" />

        {/* Newest Essays & Topics */}
        <section className="py-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <p className="font-sans text-[10px] md:text-xs tracking-editorial uppercase text-[#7B2737] font-semibold mb-4">
                NEWEST ESSAYS & ARTICLES
              </p>
              {newestEssays.map(coll => (
                <p 
                  key={coll.id}
                  onClick={() => {
                    if (coll.fallback) {
                      setActiveTab('index');
                    } else {
                      setSelectedEntry(coll);
                      setSelectedAuthorId(coll.authorId);
                      setActiveTab('folio');
                    }
                  }} 
                  className="font-serif text-[16px] text-[#1F1F1F] hover:text-[#7B2737] transition duration-150 mb-2.5 cursor-pointer inline-block w-full"
                >
                  {coll.title}
                </p>
              ))}
            </div>
            
            <div className="md:border-l md:border-stone-300 md:pl-8">
              <p className="font-sans text-[10px] md:text-xs tracking-editorial uppercase text-[#7B2737] font-semibold mb-4">
                TOPICS
              </p>
              <div className="grid grid-cols-2 gap-2">
                {featuredTopics.map(topic => (
                  <p 
                    key={topic}
                    onClick={() => {
                      if (setIndexSearchQuery) {
                        setIndexSearchQuery(topic);
                      }
                      setActiveTab('index');
                    }}
                    className="font-serif text-[16px] text-[#1F1F1F] hover:text-[#7B2737] transition duration-150 cursor-pointer"
                  >
                    {topic}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>

      {/* Full-screen Reading Display Overlay */}
      {showNewsOverlay && overlayItem && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/80 backdrop-blur-lg transition-all duration-300 animate-fade-in p-6 select-none"
          onClick={() => setShowNewsOverlay(false)}
        >
          {/* Top Centered Logo */}
          <div className="absolute top-6 left-1/2 -translate-x-1/2 font-serif text-lg font-semibold tracking-wider text-[#802334] select-none">
            {BRAND.logoText}
          </div>

          {/* Top Right Instructions */}
          <div className="absolute top-6 right-6 font-mono text-[8px] uppercase tracking-widest text-stone-400 select-none">
            ESC or Click to close
          </div>

          {/* Left Arrow */}
          {parsedNewsItems.length > 1 && (
            <button 
              type="button"
              onClick={handlePrevNewsItem}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-3 text-stone-400 hover:text-adjung-maroon transition cursor-pointer hover:bg-stone-200/50 rounded-full animate-fade-in"
              title="Previous News (Left Arrow)"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Right Arrow */}
          {parsedNewsItems.length > 1 && (
            <button 
              type="button"
              onClick={handleNextNewsItem}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-3 text-stone-400 hover:text-adjung-maroon transition cursor-pointer hover:bg-stone-200/50 rounded-full animate-fade-in"
              title="Next News (Right Arrow)"
            >
              <ChevronRight className="w-8 h-8" />
            </button>
          )}

          {/* Main Centered Reading block */}
          <div className="max-w-2xl w-full text-center relative px-4" onClick={(e) => e.stopPropagation()}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeOverlayIndex}
                initial={{ opacity: 0, y: 15, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -15, scale: 0.995 }}
                transition={{ duration: 0.45, ease: 'easeInOut' }}
                className="space-y-6 flex flex-col items-center justify-center w-full"
              >
                {/* Accent colored Desk label */}
                <div 
                  className="font-mono text-xs uppercase tracking-widest font-extrabold"
                  style={{ color: getDeskAccentColor(overlayItem.desk) }}
                >
                  {overlayItem.desk}
                </div>

                {/* Large Serif Title */}
                <h1 className="font-serif text-3xl md:text-5xl text-stone-900 leading-tight tracking-tight font-medium px-4">
                  {overlayItem.title}
                </h1>

                {/* Brief body */}
                <p className="font-serif text-lg md:text-xl text-stone-600 leading-relaxed max-w-xl mx-auto px-4 font-light">
                  {overlayItem.brief}
                </p>

                {/* Read Original button */}
                <div className="pt-4 select-none">
                  <a 
                    href={overlayItem.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 bg-adjung-maroon hover:bg-[#631c28] text-white px-6 py-2.5 rounded font-mono text-[10px] uppercase tracking-wider transition shadow-sm"
                  >
                    Read Original →
                  </a>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

            {/* Navigation Dots */}
            {parsedNewsItems.length > 1 && (
              <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex justify-center gap-2 select-none">
                {Array.from({ length: Math.min(10, parsedNewsItems.length) }).map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveOverlayIndex(idx);
                    }}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                      idx === (activeOverlayIndex % 10) 
                        ? 'bg-adjung-maroon w-4' 
                        : 'bg-stone-300 hover:bg-stone-400'
                    }`}
                  />
                ))}
              </div>
            )}
        </div>
      )}

    </div>
  );
};
