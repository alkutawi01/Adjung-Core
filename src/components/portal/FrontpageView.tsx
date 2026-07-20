import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { User, Entry, SystemSettings } from '../../types';
import { BRAND } from '../../config/brand';
import { parseInlineFormatting, isArabicText, parseInTheNews, getDeskAccentColor, parseWorldClockHolidays } from '../../utils';
import { motion, AnimatePresence } from 'motion/react';
import { Info, ChevronLeft, ChevronRight, X, RotateCcw, Check, AlertCircle, Settings } from 'lucide-react';

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

const SESSION_SEED = Math.random();

const getHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
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

        let content: React.ReactNode = w;
        if (/^\*\*(.+)\*\*$/.test(w) || /^__(.+)__$/.test(w)) {
          const inner = w.replace(/^\*\*|__|\*\*|__$/g, '');
          content = <strong className="font-bold text-[#111111]">{inner}</strong>;
        } else if (/^\*(.+)\*$/.test(w) || /^_(.+)_$/.test(w)) {
          const inner = w.replace(/^[*_]|[*_]$/g, '');
          content = <em className="italic">{inner}</em>;
        }

        return (
          <span key={idx} className={hoverClass}>
            {content}
          </span>
        );
      })}
    </span>
  );
}

const formatBentoDate = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' });
};

const BentoInner: React.FC<{ itemKey: string; className?: string; aiProvider?: string; children: React.ReactNode }> = ({ itemKey, className = '', aiProvider, children }) => {
  let providerName = aiProvider;
  if (providerName) {
    if (providerName.startsWith('Google ')) providerName = providerName.replace('Google ', '');
    if (providerName.includes(' (')) providerName = providerName.split(' (')[0];
  }
  return (
    <div className="w-full h-full relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={itemKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.0, ease: 'easeInOut' }}
          className={`w-full h-full flex flex-col justify-between ${className}`}
        >
          {children}
        </motion.div>
      </AnimatePresence>
      {providerName && (
        <span className="absolute bottom-0 right-0 font-mono text-[8px] opacity-40 pointer-events-none select-none">
          {providerName}
        </span>
      )}
    </div>
  );
};



let BENTO_FALLBACKS: any[] = [];


const isColorDark = (hexColor: string | undefined): boolean => {
  if (!hexColor || hexColor === 'transparent') return false;
  const lightColors = ['#faf7f0', '#faf8f3', '#fdfdfd', '#ffffff', '#faf7f0'];
  if (lightColors.includes(hexColor.toLowerCase())) return false;
  const hex = hexColor.replace('#', '');
  if (hex.length === 6) {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq < 128;
  }
  return true;
};

const getCardTheme = (item: any, defaultBg: string = 'transparent') => {
  const bg = item.bgColor || defaultBg;
  const isDark = isColorDark(bg);
  const textColor = item.textColor || (isDark ? '#FDFDFD' : '#1F1F1F');
  const hasImage = !!item.imageUrl;
  
  const finalTextColor = hasImage ? '#FDFDFD' : textColor;
  const finalIsDark = hasImage ? true : isDark;
  
  return {
    cardStyle: {
      backgroundColor: bg,
      borderColor: item.borderColor || (bg === 'transparent' ? '#E5E7EB' : 'transparent'),
      borderWidth: '1px',
      borderStyle: 'solid',
      color: finalTextColor,
      backgroundImage: hasImage ? `linear-gradient(to bottom, rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.8)), url(${item.imageUrl})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      position: 'relative' as const,
    },
    deskStyle: {
      color: item.categoryColor || (finalIsDark ? '#E9D8A6' : '#802334')
    },
    titleStyle: {
      color: finalTextColor
    },
    briefStyle: {
      color: finalIsDark ? 'rgba(253, 253, 253, 0.95)' : '#57534e',
      fontSize: '14px'
    },
    sourceStyle: {
      color: finalIsDark ? '#d6d3d1' : '#78716c',
      borderColor: finalIsDark ? 'rgba(253, 253, 253, 0.2)' : '#e7e5e4'
    },
    finalIsDark
  };
};
const padToLimit = (text: string, maxLen: number): string => {
  return text || '';
};

const getLimitsForIndex = (idx: number, config?: any) => {
  const customTitle = config?.maxTitle;
  const customBrief = config?.maxBrief;

  let defaults = { maxTitle: 70, maxBrief: 100 };
  if (idx === -1) defaults = { maxTitle: 80, maxBrief: 220 };
  else if (idx === 0) defaults = { maxTitle: 115, maxBrief: 350 };
  else if ([1, 12, 15, 26, 29, 37].includes(idx)) defaults = { maxTitle: 72, maxBrief: 480 };
  else if ([2, 6, 19, 20, 33, 34].includes(idx)) defaults = { maxTitle: 110, maxBrief: 280 };
  else if ([3, 11, 16, 25, 30, 35, 36].includes(idx)) defaults = { maxTitle: 85, maxBrief: 200 };
  else if ([4, 5, 17, 18, 31, 32].includes(idx)) defaults = { maxTitle: 75, maxBrief: 0 };
  else if ([7, 8, 9, 10, 21, 22, 23, 24].includes(idx)) defaults = { maxTitle: 40, maxBrief: 0 };

  return {
    maxTitle: (typeof customTitle === 'number' && customTitle > 0) ? customTitle : (config?.manualTitle === undefined && typeof customTitle === 'string' && parseInt(customTitle) > 0 ? parseInt(customTitle) : defaults.maxTitle),
    maxBrief: (typeof customBrief === 'number' && customBrief >= 0) ? customBrief : (config?.manualTitle === undefined && typeof customBrief === 'string' && parseInt(customBrief) >= 0 ? parseInt(customBrief) : defaults.maxBrief)
  };
};

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

  const [parsedNewsItems, setParsedNewsItems] = useState<any[]>([]);
  const [activeLanguage, setActiveLanguage] = useState<'ms' | 'zh' | 'ar' | 'en'>('ms');
  const [enabledLanguages, setEnabledLanguages] = useState<any[]>([]);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [aiLogs, setAiLogs] = useState<any[]>([]);
  const [activeLogPayload, setActiveLogPayload] = useState<{ type: 'prompt' | 'response'; content: string } | null>(null);

  useEffect(() => {
    if (editingSlotIndex === null) {
      setAiLogs([]);
      return;
    }
    fetch(`/api/ai/logs/${editingSlotIndex}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAiLogs(data);
        }
      })
      .catch(err => console.error('Failed to fetch AI logs for slot:', err));
  }, [editingSlotIndex]);

  const isEditingBarSlot = editingSlotIndex !== null && [7, 8, 9, 10, 21, 22, 23, 24].includes(editingSlotIndex);
  const [slotsConfig, setSlotsConfig] = useState<any[]>([]);
  const [formConfig, setFormConfig] = useState<any | null>(null);
  const [isSavingSlot, setIsSavingSlot] = useState<boolean>(false);
  const [isExecutingNow, setIsExecutingNow] = useState<boolean>(false);
  const [executingSuccessMessage, setExecutingSuccessMessage] = useState<string>('');
  const [activeFooterPageKey, setActiveFooterPageKey] = useState<string | null>(null);
  const [footerPageData, setFooterPageData] = useState<any | null>(null);
  const [isEditingFooterPage, setIsEditingFooterPage] = useState<boolean>(false);
  const [footerFormTitle, setFooterFormTitle] = useState<string>('');
  const [footerFormContent, setFooterFormContent] = useState<string>('');
  const [isSavingFooterPage, setIsSavingFooterPage] = useState<boolean>(false);
  const [isLoadingFooterPage, setIsLoadingLoadingFooterPage] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [aiProviders, setAiProviders] = useState<any[]>([]);
  const [masterPrompt, setMasterPrompt] = useState<string>('');
  const [apiHolidaysData, setApiHolidaysData] = useState<{ publicHolidays: any[]; schoolHolidays: any[] } | null>(null);

  const [activeOverlayIndex, setActiveOverlayIndex] = useState(0);
  const [activeFrontpageIndex, setActiveFrontpageIndex] = useState(0);
  const [showNewsOverlay, setShowNewsOverlay] = useState(false);

  const { items: parsedNewsItemsA } = parseInTheNews(systemSettings?.inTheNewsText || '');
  const { items: parsedNewsItemsB } = parseInTheNews(inTheNewsGoogleDocText || '');

  const parsedTickerNewsItems = React.useMemo(() => {
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
    return merged.slice(0, 50);
  }, [parsedNewsItemsA, parsedNewsItemsB]);

  const activeTickerNewsItem = parsedTickerNewsItems[activeFrontpageIndex];
  const overlayItem = parsedTickerNewsItems[activeOverlayIndex];

  // Frontpage news preview rotation
  useEffect(() => {
    if (parsedTickerNewsItems.length <= 1) return;
    const tickerConfig = slotsConfig.find(s => s.slotIndex === -1);
    const tickerInterval = tickerConfig?.carouselInterval || 10;
    const interval = setInterval(() => {
      setActiveFrontpageIndex((prev) => (prev + 1) % parsedTickerNewsItems.length);
    }, tickerInterval * 1000);
    return () => clearInterval(interval);
  }, [parsedTickerNewsItems.length, slotsConfig]);

  // Fullscreen overlay news rotation
  useEffect(() => {
    if (!showNewsOverlay || parsedTickerNewsItems.length <= 1) return;
    const tickerConfig = slotsConfig.find(s => s.slotIndex === -1);
    const tickerInterval = tickerConfig?.carouselInterval || 10;
    const interval = setInterval(() => {
      setActiveOverlayIndex((prev) => (prev + 1) % parsedTickerNewsItems.length);
    }, tickerInterval * 1000);
    return () => clearInterval(interval);
  }, [showNewsOverlay, parsedTickerNewsItems.length, slotsConfig]);

  useEffect(() => {
    if (!showNewsOverlay) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNewsOverlay(false);
      } else if (e.key === 'ArrowRight' && parsedTickerNewsItems.length > 1) {
        setActiveOverlayIndex((prev) => (prev + 1) % parsedTickerNewsItems.length);
      } else if (e.key === 'ArrowLeft' && parsedTickerNewsItems.length > 1) {
        setActiveOverlayIndex((prev) => (prev - 1 + parsedTickerNewsItems.length) % parsedTickerNewsItems.length);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showNewsOverlay, parsedTickerNewsItems.length]);

  const handlePrevNewsItem = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (parsedTickerNewsItems.length > 1) {
      setActiveOverlayIndex((prev) => (prev - 1 + parsedTickerNewsItems.length) % parsedTickerNewsItems.length);
    }
  };

  const handleNextNewsItem = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (parsedTickerNewsItems.length > 1) {
      setActiveOverlayIndex((prev) => (prev + 1) % parsedTickerNewsItems.length);
    }
  };

  useEffect(() => {
    if (systemSettings?.masterPrompt) {
      setMasterPrompt(systemSettings.masterPrompt);
    }
  }, [systemSettings]);

  const loadSlotsConfig = () => {
    fetch('/api/system/slots')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setSlotsConfig(data);
        }
      })
      .catch(err => console.error('Failed to load slots config:', err));
  };

  useEffect(() => {
    fetch('/api/translation/configs')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setEnabledLanguages(data.filter((d: any) => d.isEnabled === 1));
        }
      })
      .catch(err => console.error('Failed to load enabled languages:', err));

    fetch('/api/ai/providers')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setAiProviders(data.filter((p: any) => p.enabled === 1 || p.enabled === true));
        }
      })
      .catch(err => console.error('Failed to load AI providers:', err));

    fetch('/api/system/clock-holidays')
      .then(res => res.json())
      .then(data => {
        if (data && (data.publicHolidays || data.schoolHolidays)) {
          setApiHolidaysData(data);
        }
      })
      .catch(err => console.error('Failed to load clock holidays:', err));
  }, []);

  useEffect(() => {
    fetch(`/api/system/layout/active?lang=${activeLanguage}&t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        setParsedNewsItems(data);
      })
      .catch(err => console.error('Failed to load active bento layout:', err));
    loadSlotsConfig();
  }, [systemSettings.inTheNewsText, activeLanguage, refreshKey]);

  const handleCardClick = (idx: number) => {
    if (!isEditMode) return;
    const config = slotsConfig.find(s => s.slotIndex === idx);
    const limits = getLimitsForIndex(idx, config);

    if (idx === -1) {
      setFormConfig({
        slotIndex: -1,
        contentMode: config?.contentMode || 'Manual',
        providerId: config?.providerId || '',
        model: config?.model || '',
        promptText: config?.promptText || '',
        sourcesList: config?.sourcesList || '',
        refreshRate: (config?.refreshRate === 'Daily' || config?.refreshRate === 'Weekly') ? config.refreshRate : 'Daily',
        allowedContentTypes: config?.allowedContentTypes || '',
        priority: config?.priority || 'High',
        expiresAt: config?.expiresAt || '',
        bgColor: config?.bgColor || 'transparent',
        borderColor: config?.borderColor || '',
        textColor: config?.textColor || '#1F1F1F',
        manualTitle: 'Terkini di Malaysia',
        manualSummary: config?.manualSummary || systemSettings?.inTheNewsText || '',
        manualSource: '',
        manualUrl: '',
        manualImageUrl: '',
        manualDesk: '',
        activeObjectId: '',
        searchStrategy: config?.searchStrategy || 'Structured Sources Only',
        carouselInterval: config?.carouselInterval || 10,
        carouselDelay: config?.carouselDelay || 0,
        generationLimit: config?.generationLimit || 1,
        maxTitle: config?.maxTitle !== undefined && config?.maxTitle !== null ? config.maxTitle : limits.maxTitle,
        maxBrief: config?.maxBrief !== undefined && config?.maxBrief !== null ? config.maxBrief : limits.maxBrief,
        masterPrompt: masterPrompt,
        refreshHour: config?.refreshHour || '00:00',
        refreshDay: config?.refreshDay || 'Isnin',
        eventExpiryFilter: ''
      });
      setEditingSlotIndex(-1);
      return;
    }
    const item = bentoNewsItems[idx];

    const isBarSlot = [7, 8, 9, 10, 21, 22, 23, 24].includes(idx);

    let manualSummaryText = config?.manualSummary || '';
    if (!manualSummaryText.includes('Tajuk:') && !manualSummaryText.includes('Event:')) {
      const itemsList = item?.items || [];
      if (isBarSlot) {
        if (itemsList.length > 0) {
          manualSummaryText = itemsList.map((itm: any) => {
            return `Tarikh: (contoh: 19-26 Julai 26) ${itm.source || ''}\nEvent: (had ${limits.maxTitle} aksara) ${itm.title || ''}\nURL: ${itm.url || ''}`;
          }).join('\n\n____\n\n');
        } else {
          const title = config?.manualTitle || item?.title || '';
          const source = config?.manualSource || item?.source || '';
          const url = config?.manualUrl || item?.url || '#';
          
          manualSummaryText = `Tarikh: (contoh: 19-26 Julai 26) ${source}
Event: (had ${limits.maxTitle} aksara) ${title}
URL: ${url}`;
        }
      } else {
        if (itemsList.length > 0) {
          manualSummaryText = itemsList.map((itm: any) => {
            return `Tajuk: (had ${limits.maxTitle} aksara) ${itm.title || ''}\nHuraian: ${limits.maxBrief > 0 ? `(had ${limits.maxBrief} aksara) ` : ''}${itm.brief || ''}\nKategori: ${itm.desk || ''}\nTarikh: ${itm.publishedAt || ''}\nSumber: ${itm.source || ''}\nURL: ${itm.url || ''}`;
          }).join('\n\n____\n\n');
        } else {
          const title = config?.manualTitle || item?.titleString || '';
          const brief = config?.manualSummary || item?.briefString || '';
          const desk = config?.manualDesk || item?.desk || '';
          const source = config?.manualSource || item?.source || '';
          const url = config?.manualUrl || item?.url || '#';
          const date = item?.publishedAt || '';
          
          manualSummaryText = `Tajuk: (had ${limits.maxTitle} aksara) ${title}
Huraian: ${limits.maxBrief > 0 ? `(had ${limits.maxBrief} aksara) ${brief}` : ''}
Kategori: ${desk}
Tarikh: ${date}
Sumber: ${source}
URL: ${url}`;
        }
      }
    }

    setFormConfig({
      slotIndex: idx,
      contentMode: config?.contentMode || 'Manual',
      providerId: config?.providerId || '',
      model: config?.model || '',
      promptText: config?.promptText || '',
      sourcesList: config?.sourcesList || '',
      refreshRate: (config?.refreshRate === 'Daily' || config?.refreshRate === 'Weekly') ? config.refreshRate : 'Daily',
      allowedContentTypes: config?.allowedContentTypes || '',
      priority: config?.priority || 'Medium',
      expiresAt: config?.expiresAt || '',
      bgColor: config?.bgColor || 'transparent',
      borderColor: config?.borderColor || '',
      textColor: config?.textColor || '#1F1F1F',
      manualTitle: config?.manualTitle || item?.titleString || '',
      manualSummary: manualSummaryText,
      manualSource: config?.manualSource || item?.source || '',
      manualUrl: config?.manualUrl || item?.url || '#',
      manualImageUrl: config?.manualImageUrl || item?.imageUrl || '',
      manualDesk: config?.manualDesk || item?.desk || '',
      activeObjectId: config?.activeObjectId || '',
      searchStrategy: config?.searchStrategy || 'Structured Sources Only',
      carouselInterval: config?.carouselInterval || 10,
      carouselDelay: config?.carouselDelay || 0,
      generationLimit: config?.generationLimit || 1,
      maxTitle: config?.maxTitle !== undefined && config?.maxTitle !== null ? config.maxTitle : limits.maxTitle,
      maxBrief: config?.maxBrief !== undefined && config?.maxBrief !== null ? config.maxBrief : limits.maxBrief,
      masterPrompt: masterPrompt,
      refreshHour: config?.refreshHour || '00:00',
      refreshDay: config?.refreshDay || 'Isnin',
      eventExpiryFilter: config?.eventExpiryFilter || ''
    });
    setEditingSlotIndex(idx);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formConfig) return;
    setIsSavingSlot(true);

    const finalFormConfig = { ...formConfig };
    if ([7, 8, 9, 10, 21, 22, 23, 24].includes(formConfig.slotIndex)) {
      finalFormConfig.allowedContentTypes = 'Event';
    }

    try {
      const response = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormConfig)
      });
      const data = await response.json();
      if (data.success) {
        setRefreshKey(prev => prev + 1);
        setEditingSlotIndex(null);
        setFormConfig(null);
      } else {
        alert('Gagal menyimpan slot: ' + (data.error || ''));
      }
    } catch (err: any) {
      console.error(err);
      alert('Ralat menyimpan slot: ' + (err.message || ''));
    } finally {
      setIsSavingSlot(false);
    }
  };

  const handleRunSlotNow = async () => {
    if (!formConfig) return;
    setIsExecutingNow(true);
    setExecutingSuccessMessage('');
    try {
      // Simpan konfigurasi secara senyap ke pangkalan data terlebih dahulu
      const finalFormConfig = { ...formConfig };
      const saveResponse = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormConfig)
      });
      if (!saveResponse.ok) {
        throw new Error('Gagal menyimpan tetapan semasa sebelum memulakan penjanaan.');
      }

      const response = await fetch('/api/system/slots/run-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotIndex: formConfig.slotIndex })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setExecutingSuccessMessage('Penjanaan AI berjaya diaktifkan dan dikemas kini!');
        setRefreshKey(prev => prev + 1);
        
        // Re-fetch AI logs after successful run
        fetch(`/api/ai/logs/${formConfig.slotIndex}`)
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) {
              setAiLogs(data);
            }
          })
          .catch(err => console.error('Failed to fetch AI logs for slot:', err));

        setTimeout(() => {
          setExecutingSuccessMessage('');
        }, 5000);
      } else {
        alert('Gagal mengaktifkan segera: ' + (data.error || ''));
      }
    } catch (err: any) {
      console.error(err);
      alert('Ralat mengaktifkan segera: ' + (err.message || ''));
    } finally {
      setIsExecutingNow(false);
    }
  };

  const handleFooterLinkClick = async (key: string) => {
    setActiveFooterPageKey(key);
    setIsLoadingLoadingFooterPage(true);
    setIsEditingFooterPage(false);
    setFooterPageData(null);
    try {
      const res = await fetch(`/api/pages/${key}`);
      if (res.ok) {
        const data = await res.json();
        setFooterPageData(data);
        setFooterFormTitle(data.title || '');
        setFooterFormContent(data.content || '');
      } else {
        alert('Gagal memuatkan kandungan halaman.');
        setActiveFooterPageKey(null);
      }
    } catch (err) {
      console.error(err);
      alert('Ralat memuatkan kandungan halaman.');
      setActiveFooterPageKey(null);
    } finally {
      setIsLoadingLoadingFooterPage(false);
    }
  };

  const handleSaveFooterPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeFooterPageKey) return;
    setIsSavingFooterPage(true);
    try {
      const res = await fetch(`/api/pages/${activeFooterPageKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: footerFormTitle, content: footerFormContent })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFooterPageData({
          key: activeFooterPageKey,
          title: footerFormTitle,
          content: footerFormContent,
          updatedAt: new Date().toISOString()
        });
        setIsEditingFooterPage(false);
      } else {
        alert('Gagal menyimpan kandungan: ' + (data.error || ''));
      }
    } catch (err: any) {
      console.error(err);
      alert('Ralat menyimpan kandungan: ' + (err.message || ''));
    } finally {
      setIsSavingFooterPage(false);
    }
  };

  const newestEssays = React.useMemo(() => {
    const list = [...entries]
      .filter((e) => (e.contentType === 'Essay' || e.contentType === 'Article') && e.status === 'Published')
      .sort((a, b) => new Date(b.publishedDate || b.createdDate).getTime() - new Date(a.publishedDate || a.createdDate).getTime())
      .slice(0, 6)
      .map((entry) => {
        const author = users.find((u) => u.id === entry.authorId);
        const authorName = author?.penName || entry.publisher || 'Elena Vasquez';
        return {
          id: entry.id,
          title: entry.title,
          authorId: entry.authorId,
          authorName,
          fallback: false,
          entryObj: entry
        };
      });
    
    const fallbacks = [
      { id: 'fallback-essay-1', title: 'The Preservation Papers', authorId: null, authorName: 'Elena Vasquez', fallback: true, entryObj: null },
      { id: 'fallback-essay-2', title: 'Letters on Method', authorId: null, authorName: 'Marcus Aurelius', fallback: true, entryObj: null },
      { id: 'fallback-essay-3', title: 'Foundations of Inquiry', authorId: null, authorName: 'John Locke', fallback: true, entryObj: null },
      { id: 'fallback-essay-4', title: 'On the Socratic Practice', authorId: null, authorName: 'Plato', fallback: true, entryObj: null },
      { id: 'fallback-essay-5', title: 'The Consolation of Philosophy', authorId: null, authorName: 'Boethius', fallback: true, entryObj: null },
      { id: 'fallback-essay-6', title: 'The Republic of Science', authorId: null, authorName: 'Michael Polanyi', fallback: true, entryObj: null }
    ];

    const mergedList = [...list];
    while (mergedList.length < 6) {
      const fallbackIdx = mergedList.length;
      mergedList.push(fallbacks[fallbackIdx] || {
        id: `fallback-essay-${fallbackIdx + 1}`,
        title: 'Empty Slot',
        authorId: null,
        authorName: 'Adjung Staff',
        fallback: true,
        entryObj: null
      });
    }
    return mergedList;
  }, [entries, users]);

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

  const rawBentoNewsItems = React.useMemo(() => {
    const list = [...parsedNewsItems];
    const fallbacks = [
      {
        desk: 'SLOT 0: LEBAR PENUH',
        title: 'Had Tajuk Slot Lebar Penuh: Boleh Memuatkan Sehingga 115 Aksara Serta Wrap Dua Baris Secara Kemas',
        brief: 'Kapasiti maksimum ringkasan slot lebar penuh ialah 240 aksara untuk memenuhkan 2 baris di desktop secara optimum. Had saiz ini mengekalkan reka letak bento kelihatan padat, seimbang, dan sangat profesional tanpa sebarang elipsis.',
        source: 'SLOT_0_LEBAR',
        url: '#',
        rawIndex: -1
      },
      {
        desk: 'SLOT 1: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_1_TEGAK',
        url: '#',
        rawIndex: -2
      },
      {
        desk: 'SLOT 2: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_2_LINTAS',
        url: '#',
        rawIndex: -3
      },
      {
        desk: 'SLOT 3: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_3_KOTAK',
        url: '#',
        rawIndex: -4
      },
      {
        desk: 'SLOT 4: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_4_KOMPAK',
        url: '#',
        rawIndex: -5
      },
      {
        desk: 'SLOT 5: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_5_KOMPAK',
        url: '#',
        rawIndex: -6
      },
      {
        desk: 'SLOT 6: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_6_LINTAS',
        url: '#',
        rawIndex: -7
      },
      {
        desk: 'BAR 7',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_7_BAR',
        url: '#',
        rawIndex: -8
      },
      {
        desk: 'BAR 8',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_8_BAR',
        url: '#',
        rawIndex: -9
      },
      {
        desk: 'BAR 9',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_9_BAR',
        url: '#',
        rawIndex: -10
      },
      {
        desk: 'BAR 10',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_10_BAR',
        url: '#',
        rawIndex: -11
      },
      {
        desk: 'SLOT 11: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_11_KOTAK',
        url: '#',
        rawIndex: -12
      },
      {
        desk: 'SLOT 12: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_12_TEGAK',
        url: '#',
        rawIndex: -13
      },
      {
        desk: 'SLOT 13: SEPARUH',
        title: 'Had Tajuk Separuh Melintang: Maksimum 85 Aksara',
        brief: 'Had ringkasan kad separuh melintang ialah 110 aksara untuk dua baris penuh tanpa elipsis.',
        source: 'SLOT_13_HALF',
        url: '#',
        rawIndex: -14
      },
      {
        desk: 'SLOT 14: SEPARUH',
        title: 'Had Tajuk Separuh Melintang: Maksimum 85 Aksara',
        brief: 'Had ringkasan kad separuh melintang ialah 110 aksara untuk dua baris penuh tanpa elipsis.',
        source: 'SLOT_14_HALF',
        url: '#',
        rawIndex: -15
      },
      {
        desk: 'SLOT 15: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_15_TEGAK',
        url: '#',
        rawIndex: -16
      },
      {
        desk: 'SLOT 16: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_16_KOTAK',
        url: '#',
        rawIndex: -17
      },
      {
        desk: 'SLOT 17: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_17_KOMPAK',
        url: '#',
        rawIndex: -18
      },
      {
        desk: 'SLOT 18: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_18_KOMPAK',
        url: '#',
        rawIndex: -19
      },
      {
        desk: 'SLOT 19: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_19_LINTAS',
        url: '#',
        rawIndex: -20
      },
      {
        desk: 'SLOT 20: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_20_LINTAS',
        url: '#',
        rawIndex: -21
      },
      {
        desk: 'BAR 21',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_21_BAR',
        url: '#',
        rawIndex: -22
      },
      {
        desk: 'BAR 22',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_22_BAR',
        url: '#',
        rawIndex: -23
      },
      {
        desk: 'BAR 23',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_23_BAR',
        url: '#',
        rawIndex: -24
      },
      {
        desk: 'BAR 24',
        title: 'Had Tajuk Bar Tipis: Maksimum 40 Aksara',
        brief: 'Tiada ringkasan dipaparkan untuk jenis bar.',
        source: 'SLOT_24_BAR',
        url: '#',
        rawIndex: -25
      },
      {
        desk: 'SLOT 25: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_25_KOTAK',
        url: '#',
        rawIndex: -26
      },
      {
        desk: 'SLOT 26: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_26_TEGAK',
        url: '#',
        rawIndex: -27
      },
      {
        desk: 'SLOT 27: SEPARUH',
        title: 'Had Tajuk Separuh Melintang: Maksimum 85 Aksara',
        brief: 'Had ringkasan kad separuh melintang ialah 110 aksara untuk dua baris penuh tanpa elipsis.',
        source: 'SLOT_27_HALF',
        url: '#',
        rawIndex: -28
      },
      {
        desk: 'SLOT 28: SEPARUH',
        title: 'Had Tajuk Separuh Melintang: Maksimum 85 Aksara',
        brief: 'Had ringkasan kad separuh melintang ialah 110 aksara untuk dua baris penuh tanpa elipsis.',
        source: 'SLOT_28_HALF',
        url: '#',
        rawIndex: -29
      },
      {
        desk: 'SLOT 29: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_29_TEGAK',
        url: '#',
        rawIndex: -30
      },
      {
        desk: 'SLOT 30: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_30_KOTAK',
        url: '#',
        rawIndex: -31
      },
      {
        desk: 'SLOT 31: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_31_KOMPAK',
        url: '#',
        rawIndex: -32
      },
      {
        desk: 'SLOT 32: KOMPAK',
        title: 'Had Tajuk Kad Kompak Stacked: Maksimum 75 Aksara (Dua Baris)',
        brief: 'Tiada ringkasan dipaparkan untuk kad jenis kompak (hanya memaparkan tajuk).',
        source: 'SLOT_32_KOMPAK',
        url: '#',
        rawIndex: -33
      },
      {
        desk: 'SLOT 33: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_33_LINTAS',
        url: '#',
        rawIndex: -34
      },
      {
        desk: 'SLOT 34: MELINTANG',
        title: 'Had Tajuk Kad Melintang Lebar: Maksimum 110 Aksara Dua Baris Penuh',
        brief: 'Kapasiti maksimum ringkasan kad melintang dengan had dua baris ialah 160 aksara. Jumlah ini mengisi ruang kosong di bawah tajuk dengan harmoni.',
        source: 'SLOT_34_LINTAS',
        url: '#',
        rawIndex: -35
      },
      {
        desk: 'SLOT 35: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_35_KOTAK',
        url: '#',
        rawIndex: -36
      },
      {
        desk: 'SLOT 36: SEGI EMPAT',
        title: 'Had Tajuk Kad Segi Empat: Maksimum 85 Aksara (3 Baris)',
        brief: 'Had ringkasan kad segi empat ialah 80 aksara untuk mengisi dua baris bento secara padat.',
        source: 'SLOT_36_KOTAK',
        url: '#',
        rawIndex: -37
      },
      {
        desk: 'SLOT 37: MENEGAK',
        title: 'Had Tajuk Kad Menegak: Maksimum 72 Aksara (Tiga Baris Elegan)',
        brief: 'Kapasiti ringkasan kad menegak ini ialah 145 aksara. Ditulis padat memenuhi empat baris desktop tanpa elipsis terpotong.',
        source: 'SLOT_37_TEGAK',
        url: '#',
        rawIndex: -38
      }
    ];

    BENTO_FALLBACKS = fallbacks;

    const result: any[] = [];
    for (let i = 0; i < 38; i++) {
      const customItem = list.find(item => item.rawIndex === i + 1);
      const fallbackItem = { ...fallbacks[i] };
      const limits = getLimitsForIndex(i, customItem);
      
      if (fallbackItem.desk) {
        fallbackItem.desk = fallbackItem.desk
          .replace(/SLOT (\d+)/g, (match, p1) => `SLOT ${parseInt(p1) + 1}`)
          .replace(/BAR (\d+)/g, (match, p1) => `BAR ${parseInt(p1) + 1}`);
      }

      let itemToPush: any;
      if (customItem) {
        let finalDesk = customItem.desk || '';
        if (!finalDesk || finalDesk.trim().startsWith('SLOT ') || finalDesk.trim().startsWith('BAR ')) {
          finalDesk = 'Berita';
        }
        itemToPush = {
          ...customItem,
          desk: finalDesk,
          title: customItem.title || fallbackItem.title,
          brief: customItem.brief !== undefined ? customItem.brief : fallbackItem.brief,
          source: customItem.source || fallbackItem.source,
          url: customItem.url || fallbackItem.url || '#',
          rawIndex: customItem.rawIndex !== undefined ? customItem.rawIndex : fallbackItem.rawIndex
        };
      } else {
        itemToPush = { ...fallbackItem };
      }

      if (itemToPush.title) {
        itemToPush.title = padToLimit(itemToPush.title, limits.maxTitle);
      }
      if (itemToPush.brief && limits.maxBrief > 0) {
        itemToPush.brief = padToLimit(itemToPush.brief, limits.maxBrief);
      }

      if ([7, 8, 9, 10, 21, 22, 23, 24].includes(i)) {
        itemToPush.source = itemToPush.source || '19 Jul 2026';
        if (itemToPush.source.length > 25) {
          itemToPush.source = itemToPush.source.substring(0, 25);
        }
      }
      itemToPush.index = i;
      result.push(itemToPush);
    }

    return result;
  }, [parsedNewsItems]);

  const [carouselIndices, setCarouselIndices] = useState<{[key: number]: number}>({});

  useEffect(() => {
    const activeTimers: { timeoutId?: any; intervalId?: any }[] = [];

    rawBentoNewsItems.forEach((slotItem) => {
      if (!slotItem) return;
      const actualSlotIdx = slotItem.rawIndex > 0 ? slotItem.rawIndex - 1 : slotItem.index;
      
      const items = slotItem.items || [];
      if (items.length <= 1) return;

      const initialDelaySecs = slotItem.carouselDelay || 0;
      const intervalSecs = slotItem.carouselInterval || 10;
      
      const timerRef: { timeoutId?: any; intervalId?: any } = {};
      activeTimers.push(timerRef);

      if (initialDelaySecs > 0) {
        timerRef.timeoutId = setTimeout(() => {
          setCarouselIndices(prev => {
            const currentIdx = prev[actualSlotIdx] || 0;
            const nextIdx = (currentIdx + 1) % items.length;
            return { ...prev, [actualSlotIdx]: nextIdx };
          });

          timerRef.intervalId = setInterval(() => {
            setCarouselIndices(prev => {
              const currentIdx = prev[actualSlotIdx] || 0;
              const nextIdx = (currentIdx + 1) % items.length;
              return { ...prev, [actualSlotIdx]: nextIdx };
            });
          }, intervalSecs * 1000);
        }, initialDelaySecs * 1000);
      } else {
        timerRef.intervalId = setInterval(() => {
          setCarouselIndices(prev => {
            const currentIdx = prev[actualSlotIdx] || 0;
            const nextIdx = (currentIdx + 1) % items.length;
            return { ...prev, [actualSlotIdx]: nextIdx };
          });
        }, intervalSecs * 1000);
      }
    });

    return () => {
      activeTimers.forEach(t => {
        if (t.timeoutId) clearTimeout(t.timeoutId);
        if (t.intervalId) clearInterval(t.intervalId);
      });
    };
  }, [rawBentoNewsItems]);

  const bentoNewsItems = React.useMemo(() => {
    return rawBentoNewsItems.map((item) => {
      if (!item) return item;
      const actualSlotIdx = item.rawIndex > 0 ? item.rawIndex - 1 : item.index;
      const itemsList = item.items || [];
      
      let resolvedItem;
      if (itemsList.length <= 1) {
        resolvedItem = { ...item };
      } else {
        const activeIdx = carouselIndices[actualSlotIdx] || 0;
        const activeItem = itemsList[activeIdx] || itemsList[0] || item;
        resolvedItem = {
          ...item,
          ...activeItem,
          isCarouselActive: true,
          carouselIndex: activeIdx
        };
      }

      const limits = getLimitsForIndex(actualSlotIdx, resolvedItem);
      const originalTitle = resolvedItem.title || '';
      const originalBrief = resolvedItem.brief || '';
      if (resolvedItem.title) {
        resolvedItem.title = parseInlineFormatting(padToLimit(resolvedItem.title, limits.maxTitle));
      }
      if (resolvedItem.brief && limits.maxBrief > 0) {
        resolvedItem.brief = parseInlineFormatting(padToLimit(resolvedItem.brief, limits.maxBrief));
      }
      resolvedItem.titleString = originalTitle;
      resolvedItem.briefString = originalBrief;

      if ([7, 8, 9, 10, 21, 22, 23, 24].includes(actualSlotIdx)) {
        resolvedItem.source = resolvedItem.source || '19 Jul 2026';
        if (resolvedItem.source.length > 25) {
          resolvedItem.source = resolvedItem.source.substring(0, 25);
        }
      }

      return resolvedItem;
    });
  }, [rawBentoNewsItems, carouselIndices]);



  const activeNewsItem = bentoNewsItems[0];






  useEffect(() => {
    const cities = [
      { name: 'Kangar', tz: 'Asia/Kuala_Lumpur' },
      { name: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur' },
      { name: 'Kota Bharu', tz: 'Asia/Kuala_Lumpur' },
      { name: 'Kuching', tz: 'Asia/Kuala_Lumpur' },
      { name: 'Kota Kinabalu', tz: 'Asia/Kuala_Lumpur' }
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
            hour12: true
          });
          const parts = formatter.formatToParts(new Date());
          const obj: any = {};
          parts.forEach(p => { obj[p.type] = p.value; });

          const dateStr = `${obj.day}/${obj.month}/${obj.year}`;

          // Parse custom holidays
          const { items: customHolidaysText } = parseWorldClockHolidays(systemSettings.worldClockHolidaysText || '');
          const { items: customHolidaysGoogle } = parseWorldClockHolidays(worldClockHolidaysGoogleDocText || '');
          const allCustomHolidays = [...customHolidaysText, ...customHolidaysGoogle];

          // Find match for this city and dateStr
          const customMatches = allCustomHolidays.filter(h => 
            h.city.toLowerCase() === c.name.toLowerCase() && 
            h.dateStr === dateStr
          );

          let isHoliday = false;
          let holidayName = '';
          let isWeekend = false;
          let isSchoolHoliday = false;

          const day = obj.weekday.toUpperCase();

          const gregKey = `${obj.month}/${obj.day}`;
          let cityHolidays = HOLIDAYS_2026[c.name];
          if (!cityHolidays && c.tz === 'Asia/Kuala_Lumpur') {
            cityHolidays = HOLIDAYS_2026['Kuala Lumpur'] || {};
          }
          if (cityHolidays && cityHolidays[gregKey]) {
            isHoliday = true;
            holidayName = cityHolidays[gregKey];
          }

          if (apiHolidaysData && Array.isArray(apiHolidaysData.publicHolidays)) {
            const stateMap: Record<string, string> = {
              'Kangar': 'PLS',
              'Kuala Lumpur': 'KUL',
              'Kota Bharu': 'KTN',
              'Kuching': 'SWK',
              'Kota Kinabalu': 'SBH'
            };
            const targetStateCode = stateMap[c.name];

            const apiMatch = apiHolidaysData.publicHolidays.find((h: any) => {
              const [yr, mn, dy] = h.date.split('-');
              const matchDate = `${dy}/${mn}/${yr.slice(-2)}`;
              const isDateMatch = matchDate === dateStr;
              const isStateMatch = !targetStateCode || (h.state_codes && h.state_codes.includes(targetStateCode));
              return isDateMatch && isStateMatch;
            });

            if (apiMatch) {
              isHoliday = true;
              holidayName = apiMatch.name;
            }
          }

          if (apiHolidaysData && Array.isArray(apiHolidaysData.schoolHolidays)) {
            const today = new Date();
            const yearStr = today.getFullYear();
            const monthStr = String(today.getMonth() + 1).padStart(2, '0');
            const dayStrVal = String(today.getDate()).padStart(2, '0');
            const todayISO = `${yearStr}-${monthStr}-${dayStrVal}`;
            
            const isGroupA = c.name === 'Kota Bharu';
            const schoolMatch = apiHolidaysData.schoolHolidays.find((sh: any) => {
              const groupMatch = isGroupA ? sh.group === 'A' : sh.group === 'B';
              return groupMatch && todayISO >= sh.start && todayISO <= sh.end;
            });
            if (schoolMatch) {
              isSchoolHoliday = true;
            }
          }

          const isDefaultWeekend = c.name === 'Kota Bharu'
            ? (day === 'FRI' || day === 'SAT')
            : (day === 'SAT' || day === 'SUN');
          isWeekend = isDefaultWeekend;

          const customHolidayMatch = customMatches.find(m => m.status === 'Holiday');
          if (customHolidayMatch) {
            isHoliday = true;
            holidayName = customHolidayMatch.holidayName || holidayName || 'Cuti Umum';
          }

          const customSchoolHolidayMatch = customMatches.find(m => m.status === 'SchoolHoliday');
          if (customSchoolHolidayMatch) {
            isSchoolHoliday = true;
          }

          const customWeekendMatch = customMatches.find(m => m.status === 'Weekend');
          if (customWeekendMatch) {
            isWeekend = true;
          }

          const customWorkingMatch = customMatches.find(m => m.status === 'Working');
          if (customWorkingMatch) {
            isHoliday = false;
            isWeekend = false;
            isSchoolHoliday = false;
          }

          let finalStatus: 'Holiday' | 'Weekend' | 'SchoolHoliday' | 'Working' = 'Working';
          if (isHoliday) {
            finalStatus = 'Holiday';
          } else if (isWeekend) {
            finalStatus = 'Weekend';
          } else if (isSchoolHoliday) {
            finalStatus = 'SchoolHoliday';
          }

          const timeStr = `${dateStr} · ${day} · ${obj.hour}:${obj.minute} ${obj.dayPeriod}`;

          return {
            timeStr,
            status: finalStatus,
            holidayName
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
  }, [systemSettings.worldClockHolidaysText, worldClockHolidaysGoogleDocText, apiHolidaysData]);

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

  // 2. Curated & Dynamic Content Prep (populated from published database entries)
  const activeFeatured = React.useMemo(() => {
    if (systemSettings.featuredEntryId) {
      const resolved = entries.find(
        (e) => (e.id === systemSettings.featuredEntryId || e.slug === systemSettings.featuredEntryId) && e.status === 'Published'
      );
      if (resolved) return resolved;
    }
    // Fallback: most recent Published Essay or Article
    const newestPublish = [...entries]
      .filter((e) => (e.contentType === 'Essay' || e.contentType === 'Article') && e.status === 'Published')
      .sort((a, b) => new Date(b.publishedDate || b.createdDate).getTime() - new Date(a.publishedDate || a.createdDate).getTime())[0];
    if (newestPublish) return newestPublish;

    // Fallback static entry if nothing else exists
    return {
      id: 'fallback-featured',
      authorId: null,
      publisher: 'Elena Vasquez',
      contentType: 'Essay' as const,
      status: 'Published' as const,
      visibility: 'Public' as const,
      createdDate: new Date(2026, 6, 4).toISOString(),
      updatedDate: new Date(2026, 6, 4).toISOString(),
      publishedDate: new Date(2026, 6, 4).toISOString(),
      title: 'On the Preservation of Human Knowledge in an Age of Impermanence',
      slug: 'preservation-of-human-knowledge',
      tags: ['Philosophy', 'Preservation', 'Institutions'],
      canonicalUrl: 'https://adjung.com/essay/preservation-of-human-knowledge',
      content: `A meditation on why civilizations forget, how libraries burn, and what it means to build institutions that outlast their founders. This essay traces the arc from Alexandria to the digital present, arguing that preservation is not passive but an active, moral commitment.`,
      excerpt: `A meditation on why civilizations forget, how libraries burn, and what it means to build institutions that outlast their founders. This essay traces the arc from Alexandria to the digital present, arguing that preservation is not passive but an active, moral commitment.`,
      url: ''
    };
  }, [entries, systemSettings.featuredEntryId]);

  const featuredAuthorName = React.useMemo(() => {
    if (!activeFeatured.authorId) return activeFeatured.publisher || 'Elena Vasquez';
    const author = users.find((u) => u.id === activeFeatured.authorId);
    return author?.penName || activeFeatured.publisher || 'Elena Vasquez';
  }, [activeFeatured, users]);

  const featuredAuthorSig = React.useMemo(() => {
    return getInitials(featuredAuthorName);
  }, [featuredAuthorName]);

  // Editorial Note Aside (mapped to the newest published Editor's Note entry)
  const dbEditorNote = React.useMemo(() => {
    return [...entries]
      .filter((e) => e.contentType === "Editor's Note" && e.status === 'Published')
      .sort((a, b) => new Date(b.publishedDate || b.createdDate).getTime() - new Date(a.publishedDate || a.createdDate).getTime())[0] || null;
  }, [entries]);

  // News Ticker State & Logic (unaffected)
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
            { city: 'Kangar', tz: 'Asia/Kuala_Lumpur' },
            { city: 'Kuala Lumpur', tz: 'Asia/Kuala_Lumpur' },
            { city: 'Kota Bharu', tz: 'Asia/Kuala_Lumpur' },
            { city: 'Kuching', tz: 'Asia/Kuala_Lumpur' },
            { city: 'Kota Kinabalu', tz: 'Asia/Kuala_Lumpur' }
          ].map((c, i) => {
            const timeData = times[i];
            let cityColor = 'text-[#802334] font-semibold';
            let isHoliday = false;
            let holidayName = '';

            if (timeData) {
              isHoliday = timeData.status === 'Holiday';
              holidayName = timeData.holidayName || '';

              if (timeData.status === 'Holiday') {
                cityColor = 'text-[#1F1F1F] font-bold border-b border-dashed border-[#1F1F1F]/40';
              } else if (timeData.status === 'Weekend') {
                cityColor = 'text-stone-400 font-light';
              } else if (timeData.status === 'SchoolHoliday') {
                cityColor = 'text-[#C06C84] font-medium';
              } else {
                cityColor = 'text-[#802334] font-semibold';
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
            if (parsedTickerNewsItems.length > 0) {
              setActiveOverlayIndex(activeFrontpageIndex);
              setShowNewsOverlay(true);
            }
          }}
          className="py-3 px-0 bg-transparent hover:opacity-85 transition duration-300 cursor-pointer text-left space-y-2 group relative"
        >
          <div className="flex justify-between items-center select-none">
            <div className="flex items-center gap-2">
              <p className="font-sans text-[10px] tracking-editorial uppercase text-[#802334] font-bold">
                TERKINI DI MALAYSIA
              </p>
              {isEditMode && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(-1);
                  }}
                  className="p-1 text-stone-400 hover:text-[#802334] transition cursor-pointer rounded hover:bg-stone-100"
                  title="Urus Ticker Terkini di Malaysia"
                >
                  <Settings size={12} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {parsedTickerNewsItems.length > 0 && (
                <span className="font-mono text-[8px] uppercase tracking-wider text-stone-400 group-hover:text-[#802334] transition duration-200 mr-2">
                  &bull; Baca Paparan Penuh
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditMode(!isEditMode);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all border font-sans cursor-pointer ${
                  isEditMode
                    ? 'bg-[#802334] text-white border-[#802334] shadow-sm font-semibold'
                    : 'bg-white text-stone-600 border-stone-300 hover:text-[#802334] hover:border-[#802334]'
                }`}
              >
                <Info size={12} className={isEditMode ? "animate-pulse" : ""} />
                {isEditMode ? 'Tutup Edit' : 'Edit Kandungan'}
              </button>
              {enabledLanguages.length > 0 && (
                <div 
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-1 bg-stone-100 p-0.5 border border-stone-200 rounded text-xs select-none"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveLanguage('ms');
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-all cursor-pointer ${
                      activeLanguage === 'ms' 
                        ? 'bg-[#802334] text-white font-bold' 
                        : 'text-stone-500 hover:text-[#802334]'
                    }`}
                  >
                    MS
                  </button>
                  {enabledLanguages.map((lang) => (
                    <button
                      key={lang.languageCode}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveLanguage(lang.languageCode);
                      }}
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono transition-all cursor-pointer ${
                        activeLanguage === lang.languageCode
                          ? 'bg-[#802334] text-white font-bold' 
                          : 'text-stone-500 hover:text-[#802334]'
                      }`}
                    >
                      {lang.languageCode}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          {activeTickerNewsItem ? (
            <div className="select-text py-1 min-h-[2.5rem] flex items-center overflow-hidden">
              <AnimatePresence mode="wait">
                <motion.h4
                  key={activeFrontpageIndex}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: 'easeInOut' }}
                  className="font-serif text-[#1F1F1F] text-base md:text-lg leading-snug tracking-tight font-medium"
                >
                  <strong 
                    className="font-sans text-[11px] md:text-xs uppercase tracking-wider mr-2.5 font-bold inline-block"
                    style={{ color: activeTickerNewsItem.categoryColor || getDeskAccentColor(activeTickerNewsItem.desk) }}
                  >
                    <HoverWords text={activeTickerNewsItem.desk} />
                  </strong>
                  <HoverWords text={activeTickerNewsItem.title} />
                </motion.h4>
              </AnimatePresence>
            </div>
          ) : (
            <p className="font-serif italic text-stone-400 text-xs py-2 select-none">No curated news items available.</p>
          )}
        </div>

        <hr className="rule border-t border-stone-300 my-3" />

        {/* Bento Grid News Layout */}
        <section className="my-8" id="bento-news-grid">


          <div className="flex flex-col gap-4">
            
            {/* ROW 1: Full horizontal (Index 0) */}
            {bentoNewsItems[0] && (
                <div 
                  onClick={() => handleCardClick(0)}
                  className={`col-span-1 md:col-span-6 p-6 md:p-8 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
               style={getCardTheme(bentoNewsItems[0], 'transparent').cardStyle} >
                <BentoInner itemKey={bentoNewsItems[0].titleString || "0"} className="md:flex-row md:items-center justify-between gap-6" aiProvider={bentoNewsItems[0].aiProvider}>
                  <div className="space-y-2 max-w-3xl">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[0]).deskStyle}>{bentoNewsItems[0].desk}
                    </div>
                    <h3 className="font-serif text-2xl md:text-3xl leading-tight font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[0].title}
                    </h3>
                    <p className="font-serif text-xs text-stone-100/90 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[0]).briefStyle}>{bentoNewsItems[0].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[0].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[10px] tracking-editorial uppercase text-stone-300 border-l border-stone-400/30 pl-4 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-1" style={getCardTheme(bentoNewsItems[0]).sourceStyle}>
                    <span>{bentoNewsItems[0].source}</span>
                    {formatBentoDate(bentoNewsItems[0].publishedAt) && <span className="opacity-70 normal-case font-mono text-[9px]">{formatBentoDate(bentoNewsItems[0].publishedAt)}</span>}
                  </a>
                </BentoInner>
              </div>
            )}

            {/* ROW 2 & 3: Vertical, Horizontal, Square, 2 Compact (Indices 1 to 5) */}
            <div className="grid grid-cols-1 md:grid-cols-6 md:grid-rows-[180px_180px] gap-4">
              
              {/* Left Column: Vertical (Index 1) */}
              {bentoNewsItems[1] && (
                <div 
                  onClick={() => handleCardClick(1)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[1], 'transparent').cardStyle} >
                  <BentoInner itemKey={bentoNewsItems[1].titleString || "1"} aiProvider={bentoNewsItems[1].aiProvider}>
                    <div className="space-y-4">
                      <div>
                        <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[1]).deskStyle}>{bentoNewsItems[1].desk}
                        </div>
                        <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                          {bentoNewsItems[1].title}
                        </h3>
                      </div>
                      <p className="font-serif text-xs text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[1]).briefStyle}>{bentoNewsItems[1].brief}
                      </p>
                    </div>
                    <a href={bentoNewsItems[1].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10 flex flex-col gap-0.5" style={getCardTheme(bentoNewsItems[1]).sourceStyle}>
                      <span>{bentoNewsItems[1].source}</span>
                      {formatBentoDate(bentoNewsItems[1].publishedAt) && <span className="opacity-60 normal-case font-mono text-[8px]">{formatBentoDate(bentoNewsItems[1].publishedAt)}</span>}
                    </a>
                  </BentoInner>
                </div>
              )}

              {/* Right/Top: Horizontal (Index 2) */}
              {bentoNewsItems[2] && (
                <div 
                  onClick={() => handleCardClick(2)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[2], 'transparent').cardStyle} >
                  <BentoInner itemKey={bentoNewsItems[2].titleString || "2"} className="md:flex-row md:items-center justify-between gap-4" aiProvider={bentoNewsItems[2].aiProvider}>
                    <div className="space-y-2 flex-1">
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[2]).deskStyle}>{bentoNewsItems[2].desk}
                      </div>
                      <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                        {bentoNewsItems[2].title}
                      </h3>
                      <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[2]).briefStyle}>{bentoNewsItems[2].brief}
                      </p>
                    </div>
                    <a href={bentoNewsItems[2].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex flex-col justify-center gap-0.5" style={getCardTheme(bentoNewsItems[2]).sourceStyle}>
                      <span>{bentoNewsItems[2].source}</span>
                      {formatBentoDate(bentoNewsItems[2].publishedAt) && <span className="opacity-60 normal-case font-mono text-[8px]">{formatBentoDate(bentoNewsItems[2].publishedAt)}</span>}
                    </a>
                  </BentoInner>
                </div>
              )}

              {/* Right/Bottom-Left: Square (Index 3) */}
              {bentoNewsItems[3] && (
                <div 
                  onClick={() => handleCardClick(3)}
                  className={`md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[3], 'transparent').cardStyle} >
                  <BentoInner itemKey={bentoNewsItems[3].titleString || "3"} aiProvider={bentoNewsItems[3].aiProvider}>
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[3]).deskStyle}>{bentoNewsItems[3].desk}
                      </div>
                      <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                        {bentoNewsItems[3].title}
                      </h3>
                    </div>
                    <div>
                      <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[3]).briefStyle}>{bentoNewsItems[3].brief}
                      </p>
                      <a href={bentoNewsItems[3].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10 flex flex-col gap-0.5" style={getCardTheme(bentoNewsItems[3]).sourceStyle}>
                        <span>{bentoNewsItems[3].source}</span>
                        {formatBentoDate(bentoNewsItems[3].publishedAt) && <span className="opacity-60 normal-case font-mono text-[8px]">{formatBentoDate(bentoNewsItems[3].publishedAt)}</span>}
                      </a>
                    </div>
                  </BentoInner>
                </div>
              )}

              {/* Right/Bottom-Right: Two Stacked Compacts (Indices 4 & 5) */}
              <div className="md:col-span-2 flex flex-col gap-4 h-full">
                {bentoNewsItems[4] && (
                <div 
                  onClick={() => handleCardClick(4)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[4], 'transparent').cardStyle} >
                    <BentoInner itemKey={bentoNewsItems[4].titleString || "4"} aiProvider={bentoNewsItems[4].aiProvider}>
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[4]).deskStyle}>{bentoNewsItems[4].desk}
                        </div>
                        <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                          {bentoNewsItems[4].title}
                        </h3>
                      </div>
                      <a href={bentoNewsItems[4].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2 flex flex-col gap-0.5" style={getCardTheme(bentoNewsItems[4]).sourceStyle}>
                        <span>{bentoNewsItems[4].source}</span>
                        {formatBentoDate(bentoNewsItems[4].publishedAt) && <span className="opacity-60 normal-case font-mono text-[7px]">{formatBentoDate(bentoNewsItems[4].publishedAt)}</span>}
                      </a>
                    </BentoInner>
                  </div>
                )}
                {bentoNewsItems[5] && (
                <div 
                  onClick={() => handleCardClick(5)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[5], 'transparent').cardStyle} >
                    <BentoInner itemKey={bentoNewsItems[5].titleString || "5"} aiProvider={bentoNewsItems[5].aiProvider}>
                      <div>
                        <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[5]).deskStyle}>{bentoNewsItems[5].desk}
                        </div>
                        <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                          {bentoNewsItems[5].title}
                        </h3>
                      </div>
                      <a href={bentoNewsItems[5].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2 flex flex-col gap-0.5" style={getCardTheme(bentoNewsItems[5]).sourceStyle}>
                        <span>{bentoNewsItems[5].source}</span>
                        {formatBentoDate(bentoNewsItems[5].publishedAt) && <span className="opacity-60 normal-case font-mono text-[7px]">{formatBentoDate(bentoNewsItems[5].publishedAt)}</span>}
                      </a>
                    </BentoInner>
                  </div>
                )}
              </div>

            </div>

            {/* ROW 4 & 5: Horizontal, Vertical, Bars, Square (Indices 6 to 12) */}
            <div className="grid grid-cols-1 md:grid-cols-6 md:grid-rows-[180px_180px] gap-4 animate-fade-in">
              
              {/* Left Top: Horizontal (Index 6) */}
              {bentoNewsItems[6] && (
                <div 
                  onClick={() => handleCardClick(6)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[6], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[6]).deskStyle}>{bentoNewsItems[6].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[6].title}
                    </h3>
                    <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[6]).briefStyle}>{bentoNewsItems[6].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[6].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[6]).sourceStyle}>{bentoNewsItems[6].source}
                  </a>
                
                  {bentoNewsItems[6].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[6].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Column: Vertical (Index 12) */}
              {bentoNewsItems[12] && (
                <div 
                  onClick={() => handleCardClick(12)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[12], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[12]).deskStyle}>{bentoNewsItems[12].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[12].title}
                      </h3>
                    </div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[12]).briefStyle}>{bentoNewsItems[12].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[12].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[12]).sourceStyle}>{bentoNewsItems[12].source}
                  </a>
                
                  {bentoNewsItems[12].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[12].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              <div className="md:col-span-2 flex flex-col gap-2 h-full">
                {[7, 8, 9, 10].map((idx) => {
                  const barItem = bentoNewsItems[idx];
                  if (!barItem) return null;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleCardClick(idx)} className={`px-4 py-2 rounded-md flex justify-between items-center flex-1 min-h-[38px] group hover:brightness-110 transition-all duration-200 ${isEditMode ? 'ring-2 ring-dashed ring-[#E9D8A6] cursor-pointer' : ''}`}
                      style={{ backgroundColor: '#802334' }}
                    >
                      {/* Tarikh Event */}
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold flex-shrink-0 pr-3 border-r border-white/20">
                        {barItem.source || '—'}
                      </div>
                      {/* Nama Event */}
                      <div className="font-serif text-xs text-white leading-snug flex-1 pl-3 group-hover:text-[#E9D8A6] transition-colors">
                        {barItem.title}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Left Bottom Right: Square (Index 11) */}
              {bentoNewsItems[11] && (
                <div 
                  onClick={() => handleCardClick(11)}
                  className={`md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[11], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[11]).deskStyle}>{bentoNewsItems[11].desk}
                    </div>
                    <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[11].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[11]).briefStyle}>{bentoNewsItems[11].brief}
                    </p>
                    <a href={bentoNewsItems[11].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[11]).sourceStyle}>{bentoNewsItems[11].source}
                    </a>
                  </div>
                
                  {bentoNewsItems[11].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[11].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 6: Two Half Horizontals Side-By-Side (Indices 13 & 14) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {bentoNewsItems[13] && (
                <div 
                  onClick={() => handleCardClick(13)}
                  className={`col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[13], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[13]).deskStyle}>{bentoNewsItems[13].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors ">
                      {bentoNewsItems[13].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[13]).briefStyle}>{bentoNewsItems[13].brief}
                    </p>
                    <a href={bentoNewsItems[13].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[13]).sourceStyle}>{bentoNewsItems[13].source}
                    </a>
                  </div>
                
                  {bentoNewsItems[13].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[13].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {bentoNewsItems[14] && (
                <div 
                  onClick={() => handleCardClick(14)}
                  className={`col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[14], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold" style={getCardTheme(bentoNewsItems[14]).deskStyle}>{bentoNewsItems[14].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[14].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[14]).briefStyle}>{bentoNewsItems[14].brief}
                    </p>
                    <a href={bentoNewsItems[14].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[14]).sourceStyle}>{bentoNewsItems[14].source}
                    </a>
                  </div>
                
                  {bentoNewsItems[14].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[14].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}
            </div>

            {/* ROW 7 & 8: Vertical, Square, Stacked Compacts, Horizontal (Indices 15 to 19) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Column: Vertical (Index 15) */}
              {bentoNewsItems[15] && (
                <div 
                  onClick={() => handleCardClick(15)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[15], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[15]).deskStyle}>{bentoNewsItems[15].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[15].title}
                      </h3>
                    </div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[15]).briefStyle}>{bentoNewsItems[15].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[15].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[15]).sourceStyle}>{bentoNewsItems[15].source}
                  </a>
                
                  {bentoNewsItems[15].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[15].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Square (Index 16) */}
              {bentoNewsItems[16] && (
                <div 
                  onClick={() => handleCardClick(16)}
                  className={`md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[16], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[16]).deskStyle}>{bentoNewsItems[16].desk}
                    </div>
                    <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[16].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[16]).briefStyle}>{bentoNewsItems[16].brief}
                    </p>
                    <a href={bentoNewsItems[16].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[16]).sourceStyle}>{bentoNewsItems[16].source}
                    </a>
                  </div>
                
                  {bentoNewsItems[16].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[16].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Two Stacked Compacts (Indices 17 & 18) */}
              <div className="md:col-span-2 flex flex-col gap-4 h-full">
                {bentoNewsItems[17] && (
                <div 
                  onClick={() => handleCardClick(17)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[17], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[17]).deskStyle}>{bentoNewsItems[17].desk}
                      </div>
                      <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                        {bentoNewsItems[17].title}
                      </h3>
                    </div>
                    <a href={bentoNewsItems[17].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2" style={getCardTheme(bentoNewsItems[17]).sourceStyle}>{bentoNewsItems[17].source}
                    </a>
                  
                  {bentoNewsItems[17].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[17].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
                {bentoNewsItems[18] && (
                <div 
                  onClick={() => handleCardClick(18)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[18], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[18]).deskStyle}>{bentoNewsItems[18].desk}
                      </div>
                      <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                        {bentoNewsItems[18].title}
                      </h3>
                    </div>
                    <a href={bentoNewsItems[18].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2" style={getCardTheme(bentoNewsItems[18]).sourceStyle}>{bentoNewsItems[18].source}
                    </a>
                  
                  {bentoNewsItems[18].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[18].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
              </div>

              {/* Bottom Horizontal spanning across Col 3-6 (Index 19) */}
              {bentoNewsItems[19] && (
                <div 
                  onClick={() => handleCardClick(19)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[19], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[19]).deskStyle}>{bentoNewsItems[19].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[19].title}
                    </h3>
                    <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[19]).briefStyle}>{bentoNewsItems[19].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[19].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[19]).sourceStyle}>{bentoNewsItems[19].source}
                  </a>
                
                  {bentoNewsItems[19].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[19].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 9 & 10: Horizontal, 4 Stacked Bars, Square, Vertical (Indices 20 to 26) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Column: Vertical (Index 26) */}
              {bentoNewsItems[26] && (
                <div 
                  onClick={() => handleCardClick(26)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[26], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[26]).deskStyle}>{bentoNewsItems[26].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[26].title}
                      </h3>
                    </div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[26]).briefStyle}>{bentoNewsItems[26].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[26].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[26]).sourceStyle}>{bentoNewsItems[26].source}
                  </a>
                
                  {bentoNewsItems[26].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[26].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Top: Horizontal spanning across Col 3-6 (Index 20) */}
              {bentoNewsItems[20] && (
                <div 
                  onClick={() => handleCardClick(20)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[20], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[20]).deskStyle}>{bentoNewsItems[20].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[20].title}
                    </h3>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[20]).briefStyle}>{bentoNewsItems[20].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[20].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[20]).sourceStyle}>{bentoNewsItems[20].source}
                  </a>
                
                  {bentoNewsItems[20].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[20].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Bottom Left: Square (Index 25) */}
              {bentoNewsItems[25] && (
                <div 
                  onClick={() => handleCardClick(25)}
                  className={`md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[25], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[25]).deskStyle}>{bentoNewsItems[25].desk}
                    </div>
                    <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[25].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[25]).briefStyle}>{bentoNewsItems[25].brief}
                    </p>
                    <a href={bentoNewsItems[25].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[25]).sourceStyle}>{bentoNewsItems[25].source}
                    </a>
                  </div>
                
                  {bentoNewsItems[25].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[25].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              <div className="md:col-span-2 flex flex-col gap-2 h-full">
                {[21, 22, 23, 24].map((idx) => {
                  const barItem = bentoNewsItems[idx];
                  if (!barItem) return null;
                  return (
                    <div
                      key={idx}
                      onClick={() => handleCardClick(idx)} className={`px-4 py-2 rounded-md flex justify-between items-center flex-1 min-h-[38px] group hover:brightness-110 transition-all duration-200 ${isEditMode ? 'ring-2 ring-dashed ring-[#E9D8A6] cursor-pointer' : ''}`}
                      style={{ backgroundColor: '#802334' }}
                    >
                      {/* Tarikh Event */}
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold flex-shrink-0 pr-3 border-r border-white/20">
                        {barItem.source || '—'}
                      </div>
                      {/* Nama Event */}
                      <div className="font-serif text-xs text-white leading-snug flex-1 pl-3 group-hover:text-[#E9D8A6] transition-colors">
                        {barItem.title}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>

            {/* ROW 11: Two Half Horizontals Side-By-Side (Indices 27 & 28) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {bentoNewsItems[27] && (
                <div 
                  onClick={() => handleCardClick(27)}
                  className={`col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[27], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[27]).deskStyle}>{bentoNewsItems[27].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors ">
                      {bentoNewsItems[27].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[27]).briefStyle}>{bentoNewsItems[27].brief}
                    </p>
                    <a href={bentoNewsItems[27].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[27]).sourceStyle}>{bentoNewsItems[27].source}
                    </a>
                  </div>
                
                  {bentoNewsItems[27].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[27].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {bentoNewsItems[28] && (
                <div 
                  onClick={() => handleCardClick(28)}
                  className={`col-span-1 md:col-span-3 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[28], 'transparent').cardStyle} >
                  <div className="space-y-2">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold" style={getCardTheme(bentoNewsItems[28]).deskStyle}>{bentoNewsItems[28].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[28].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[28]).briefStyle}>{bentoNewsItems[28].brief}
                    </p>
                    <a href={bentoNewsItems[28].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[28]).sourceStyle}>{bentoNewsItems[28].source}
                    </a>
                  </div>
                
                  {bentoNewsItems[28].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[28].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}
            </div>

            {/* ROW 12 & 13: Vertical, Square, Stacked Compacts, Horizontal (Indices 29 to 33) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Column: Vertical (Index 29) */}
              {bentoNewsItems[29] && (
                <div 
                  onClick={() => handleCardClick(29)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[29], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[29]).deskStyle}>{bentoNewsItems[29].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[29].title}
                      </h3>
                    </div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[29]).briefStyle}>{bentoNewsItems[29].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[29].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[29]).sourceStyle}>{bentoNewsItems[29].source}
                  </a>
                
                  {bentoNewsItems[29].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[29].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Square (Index 30) */}
              {bentoNewsItems[30] && (
                <div 
                  onClick={() => handleCardClick(30)}
                  className={`md:col-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[30], 'transparent').cardStyle} >
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[30]).deskStyle}>{bentoNewsItems[30].desk}
                    </div>
                    <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                      {bentoNewsItems[30].title}
                    </h3>
                  </div>
                  <div>
                    <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[30]).briefStyle}>{bentoNewsItems[30].brief}
                    </p>
                    <a href={bentoNewsItems[30].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[30]).sourceStyle}>{bentoNewsItems[30].source}
                    </a>
                  </div>
                
                  {bentoNewsItems[30].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[30].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Two Stacked Compacts (Indices 31 & 32) */}
              <div className="md:col-span-2 flex flex-col gap-4 h-full">
                {bentoNewsItems[31] && (
                <div 
                  onClick={() => handleCardClick(31)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[31], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[31]).deskStyle}>{bentoNewsItems[31].desk}
                      </div>
                      <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                        {bentoNewsItems[31].title}
                      </h3>
                    </div>
                    <a href={bentoNewsItems[31].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2" style={getCardTheme(bentoNewsItems[31]).sourceStyle}>{bentoNewsItems[31].source}
                    </a>
                  
                  {bentoNewsItems[31].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[31].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
                {bentoNewsItems[32] && (
                <div 
                  onClick={() => handleCardClick(32)}
                  className={`p-4 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[84px] flex-1 ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[32], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[8px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-1" style={getCardTheme(bentoNewsItems[32]).deskStyle}>{bentoNewsItems[32].desk}
                      </div>
                      <h3 className="font-serif text-xs md:text-sm leading-snug hover:text-stone-300 transition-colors ">
                        {bentoNewsItems[32].title}
                      </h3>
                    </div>
                    <a href={bentoNewsItems[32].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[8px] tracking-editorial uppercase text-stone-400 mt-2" style={getCardTheme(bentoNewsItems[32]).sourceStyle}>{bentoNewsItems[32].source}
                    </a>
                  
                  {bentoNewsItems[32].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[32].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
              </div>

              {/* Bottom Horizontal spanning across Col 3-6 (Index 33) */}
              {bentoNewsItems[33] && (
                <div 
                  onClick={() => handleCardClick(33)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[33], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[33]).deskStyle}>{bentoNewsItems[33].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[33].title}
                    </h3>
                    <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[33]).briefStyle}>{bentoNewsItems[33].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[33].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[33]).sourceStyle}>{bentoNewsItems[33].source}
                  </a>
                
                  {bentoNewsItems[33].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[33].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

            </div>

            {/* ROW 14 & 15: Horizontal, Two Half-Horizontals, Vertical (Indices 34 to 37) */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              
              {/* Left Top: Horizontal spanning across Col 1-4 (Index 34) */}
              {bentoNewsItems[34] && (
                <div 
                  onClick={() => handleCardClick(34)}
                  className={`md:col-span-4 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col md:flex-row justify-between items-start md:items-center gap-4 min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[34], 'transparent').cardStyle} >
                  <div className="space-y-2 flex-1">
                    <div className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold" style={getCardTheme(bentoNewsItems[34]).deskStyle}>{bentoNewsItems[34].desk}
                    </div>
                    <h3 className="font-serif text-lg md:text-xl leading-snug font-medium hover:text-[#E9D8A6] transition-colors">
                      {bentoNewsItems[34].title}
                    </h3>
                    <p className="font-serif text-sm text-stone-200/90 leading-relaxed font-light " style={getCardTheme(bentoNewsItems[34]).briefStyle}>{bentoNewsItems[34].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[34].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300 pl-4 md:border-l md:border-stone-400/30 flex-shrink-0 md:self-stretch flex items-center" style={getCardTheme(bentoNewsItems[34]).sourceStyle}>{bentoNewsItems[34].source}
                  </a>
                
                  {bentoNewsItems[34].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[34].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Right Column: Vertical (Index 37) */}
              {bentoNewsItems[37] && (
                <div 
                  onClick={() => handleCardClick(37)}
                  className={`md:col-span-2 md:row-span-2 p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[380px] h-full ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                 style={getCardTheme(bentoNewsItems[37], 'transparent').cardStyle} >
                  <div className="space-y-4">
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#FFE3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[37]).deskStyle}>{bentoNewsItems[37].desk}
                      </div>
                      <h3 className="font-serif text-xl md:text-2xl leading-snug font-medium hover:text-[#FFE3D1] transition-colors">
                        {bentoNewsItems[37].title}
                      </h3>
                    </div>
                    <p className="font-serif text-sm text-stone-100/95 leading-relaxed font-light" style={getCardTheme(bentoNewsItems[37]).briefStyle}>{bentoNewsItems[37].brief}
                    </p>
                  </div>
                  <a href={bentoNewsItems[37].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-200/90 pt-2 border-t border-white/10" style={getCardTheme(bentoNewsItems[37]).sourceStyle}>{bentoNewsItems[37].source}
                  </a>
                
                  {bentoNewsItems[37].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[37].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
              )}

              {/* Left Bottom: Two Side-by-Side elements in Col 1-4 */}
              <div className="md:col-span-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {bentoNewsItems[35] && (
                <div 
                  onClick={() => handleCardClick(35)}
                  className={`p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[35], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#F5EBE6] font-bold mb-2" style={getCardTheme(bentoNewsItems[35]).deskStyle}>{bentoNewsItems[35].desk}
                      </div>
                      <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-[#F5EBE6] transition-colors ">
                        {bentoNewsItems[35].title}
                      </h3>
                    </div>
                    <div>
                      <p className="font-serif text-xs text-stone-200/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[35]).briefStyle}>{bentoNewsItems[35].brief}
                      </p>
                      <a href={bentoNewsItems[35].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-300/90 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[35]).sourceStyle}>{bentoNewsItems[35].source}
                      </a>
                    </div>
                  
                  {bentoNewsItems[35].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[35].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}

                {bentoNewsItems[36] && (
                <div 
                  onClick={() => handleCardClick(36)}
                  className={`p-6 rounded-lg shadow-sm hover:scale-[1.01] hover:shadow-lg transition-all duration-300 cursor-pointer flex flex-col justify-between min-h-[180px] h-full overflow-hidden ${isEditMode ? 'ring-2 ring-dashed ring-[#802334] cursor-pointer hover:scale-[1.02]' : ''}`} 
                   style={getCardTheme(bentoNewsItems[36], 'transparent').cardStyle} >
                    <div>
                      <div className="font-mono text-[9px] uppercase tracking-widest text-[#D6D3D1] font-bold mb-2" style={getCardTheme(bentoNewsItems[36]).deskStyle}>{bentoNewsItems[36].desk}
                      </div>
                      <h3 className="font-serif text-base md:text-lg leading-snug font-medium hover:text-stone-300 transition-colors ">
                        {bentoNewsItems[36].title}
                      </h3>
                    </div>
                    <div>
                      <p className="font-serif text-xs text-stone-300/90 leading-relaxed font-light mb-3 " style={getCardTheme(bentoNewsItems[36]).briefStyle}>{bentoNewsItems[36].brief}
                      </p>
                      <a href={bentoNewsItems[36].url || '#'} target="_blank" rel="noopener noreferrer" onClick={(e) => { if (isEditMode) { e.preventDefault(); } else { e.stopPropagation(); } }} className="font-sans text-[9px] tracking-editorial uppercase text-stone-400 pt-1.5 border-t border-white/10" style={getCardTheme(bentoNewsItems[36]).sourceStyle}>{bentoNewsItems[36].source}
                      </a>
                    </div>
                  
                  {bentoNewsItems[36].aiProvider && (
                    <span className="absolute bottom-1 right-2 font-mono text-[8px] opacity-40 pointer-events-none select-none">
                      {bentoNewsItems[36].aiProvider.replace('Google ', '').split(' (')[0]}
                    </span>
                  )}</div>
                )}
              </div>

            </div>

          </div>
        </section>
        {/* Footer Reka Bentuk Premium */}
        <footer className="w-full mt-12 pt-10 pb-6 border-t border-stone-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 px-4">
            {/* Logo / Kiri */}
            <div className="flex flex-col justify-start">
              <h2 className="font-serif text-3xl font-bold text-[#802334] tracking-tight">Adjung</h2>
            </div>
            
            {/* Kolum INSTITUTIONAL */}
            <div className="flex flex-col gap-2.5">
              <h3 className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold">Institutional</h3>
              <ul className="flex flex-col gap-1.5 font-sans text-xs text-stone-600 font-semibold flex-start">
                <li className="flex"><button onClick={() => handleFooterLinkClick('editors-notes')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Editor&apos;s Notes</button></li>
                <li className="flex"><button onClick={() => handleFooterLinkClick('notices')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Notices</button></li>
                <li className="flex"><button onClick={() => handleFooterLinkClick('publishing-policies')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Publishing Policies</button></li>
                <li className="flex"><button onClick={() => handleFooterLinkClick('version-history')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Version History</button></li>
              </ul>
            </div>

            {/* Kolum NETWORK */}
            <div className="flex flex-col gap-2.5">
              <h3 className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold">Network</h3>
              <ul className="flex flex-col gap-1.5 font-sans text-xs text-stone-600 font-semibold flex-start">
                <li className="flex"><button onClick={() => handleFooterLinkClick('about')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">About Adjung</button></li>
                <li className="flex"><button onClick={() => handleFooterLinkClick('editorial-board')} className="hover:text-[#802334] transition-colors text-left focus:outline-none cursor-pointer">Editorial Board</button></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-stone-150 pt-6 text-center">
            <p className="font-mono text-[9px] tracking-widest text-stone-400 uppercase font-bold">
              &copy; 2026 Adjung Platform
            </p>
          </div>
        </footer>

      </div>

      {/* Pop-up Modal Penyuntingan Slot Bento */}
      {editingSlotIndex !== null && formConfig && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg border border-stone-200 max-w-xl w-full max-h-[90vh] overflow-y-auto flex flex-col shadow-2xl animate-fade-in">
            <header className="px-6 py-4 border-b border-stone-150 flex justify-between items-center bg-stone-50">
              <div>
                <h3 className="font-serif text-xs md:text-sm font-bold text-[#802334] uppercase tracking-wide">
                  {editingSlotIndex === -1 ? 'Urus Ticker: Terkini di Malaysia' : `Urus Slot ${editingSlotIndex + 1}: ${bentoNewsItems[editingSlotIndex]?.desk || 'Umum'}`}
                </h3>
                <p className="text-[9px] text-stone-500 font-sans mt-0.5 font-bold uppercase tracking-wider">
                  Ubah kandungan manual, warna, atau mod penjanaan.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingSlotIndex(null);
                  setFormConfig(null);
                }}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={18} />
              </button>
            </header>
            
            <form onSubmit={handleSaveSlot} className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-sans">
                
                {/* Mod Kandungan */}
                <div className="flex flex-col gap-1 col-span-2">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Mod Kandungan</label>
                  <select
                    value={formConfig.contentMode}
                    onChange={(e) => setFormConfig({ ...formConfig, contentMode: e.target.value })}
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                  >
                    <option value="Manual">Manual (Kemasukan Sendiri)</option>
                    <option value="AI Generated">AI Generated (Automatik)</option>
                  </select>
                </div>

                {/* MODUS MANUAL */}
                {formConfig.contentMode === 'Manual' && (
                  <>
                    <div className="flex flex-col gap-1 col-span-2">
                      <div className="flex justify-between items-center">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Kandungan Manual (Ikuti Format Template)</label>
                        <span className="text-[8px] text-[#802334] font-sans font-bold">Had aksara dinyatakan di bawah</span>
                      </div>
                      <textarea
                        value={formConfig.manualSummary}
                        onChange={(e) => setFormConfig({ ...formConfig, manualSummary: e.target.value })}
                        rows={12}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs leading-relaxed"
                      />
                      <p className="text-[9px] text-[#802334] font-sans font-bold leading-normal mt-1">
                        {editingSlotIndex === -1 
                          ? '* Nota: Pisahkan setiap berita ticker dengan garisan pemisah tiga sempang (---) di baris baharu.' 
                          : '* Nota: Jika ingin meletakkan 2 atau lebih kandungan berita untuk bertukar secara animasi (carousel/slide), pisahkan setiap blok berita dengan garisan pemisah empat underscores (____).'
                        }
                      </p>
                    </div>

                    {editingSlotIndex !== -1 && (
                      <div className="flex flex-col gap-1 col-span-2">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Gambar Latar Belakang (URL / Fail)</label>
                        <input
                          type="text"
                          value={formConfig.manualImageUrl}
                          onChange={(e) => setFormConfig({ ...formConfig, manualImageUrl: e.target.value })}
                          placeholder="/uploads/... atau URL luar"
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* MODUS AI GENERATED */}
                {formConfig.contentMode === 'AI Generated' && (
                  <>
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pembekal AI (AI Provider)</label>
                      <select
                        value={formConfig.providerId}
                        onChange={(e) => {
                          const p = aiProviders.find(prov => prov.id === e.target.value);
                          setFormConfig({ ...formConfig, providerId: e.target.value, model: p ? p.model : '' });
                        }}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      >
                        <option value="">-- Pilih Pembekal --</option>
                        {aiProviders.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Model AI</label>
                      {formConfig.providerId === 'gemini-1' ? (
                        <select
                          value={formConfig.model || 'gemini-3.5-flash'}
                          onChange={(e) => setFormConfig({ ...formConfig, model: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                        >
                          <option value="gemini-3.5-flash">gemini-3.5-flash</option>
                          <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite</option>
                          <option value="gemini-2.5-flash">gemini-2.5-flash</option>
                          <option value="gemini-2.5-pro">gemini-2.5-pro</option>
                          <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                          <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                        </select>
                      ) : formConfig.providerId === 'openai-1' ? (
                        <select
                          value={formConfig.model || 'gpt-4o'}
                          onChange={(e) => setFormConfig({ ...formConfig, model: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                        >
                          <option value="gpt-4o">gpt-4o</option>
                          <option value="gpt-4o-mini">gpt-4o-mini</option>
                          <option value="o1-mini">o1-mini</option>
                          <option value="o1-preview">o1-preview</option>
                        </select>
                      ) : formConfig.providerId === 'claude-1' ? (
                        <select
                          value={formConfig.model || 'claude-3-5-sonnet-latest'}
                          onChange={(e) => setFormConfig({ ...formConfig, model: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                        >
                          <option value="claude-3-5-sonnet-latest">claude-3-5-sonnet-latest</option>
                          <option value="claude-3-5-haiku-latest">claude-3-5-haiku-latest</option>
                          <option value="claude-3-opus-20240229">claude-3-opus-20240229</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={formConfig.model || ''}
                          onChange={(e) => setFormConfig({ ...formConfig, model: e.target.value })}
                          placeholder="Pilih pembekal di atas"
                          className="w-full px-3 py-2 border border-stone-300 rounded bg-white text-stone-700 font-mono text-xs focus:outline-none focus:border-[#802334]"
                        />
                      )}
                    </div>

                    {editingSlotIndex !== -1 && (
                      <div className="flex flex-col gap-1 col-span-2">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Bidang / Kategori (Desk)</label>
                        <input
                          type="text"
                          value={formConfig.manualDesk}
                          onChange={(e) => setFormConfig({ ...formConfig, manualDesk: e.target.value })}
                          placeholder="Contoh: TEKNOLOGI, EKONOMI, SUKAN..."
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                        />
                        <p className="text-[9px] text-stone-500 font-sans mt-0.5">
                          Tentukan bidang/kategori khusus untuk menyaring penjanaan berita AI dan menetapkan label kategori.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Peraturan Am (Sistem/Global)</label>
                      <textarea
                        value={formConfig.masterPrompt || ''}
                        onChange={(e) => {
                          setFormConfig({ ...formConfig, masterPrompt: e.target.value });
                          setMasterPrompt(e.target.value);
                        }}
                        placeholder="Contoh: Gunakan bahasa Melayu yang baku, elakkan jargon..."
                        rows={4}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs leading-relaxed"
                      />
                      <p className="text-[9px] text-stone-500 font-sans mt-0.5">
                        * Nota: Peraturan am ini selaras secara global bagi semua slot AI Generated yang lain.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Strategi Pencarian</label>
                      <select
                        value={formConfig.searchStrategy}
                        onChange={(e) => setFormConfig({ ...formConfig, searchStrategy: e.target.value })}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                      >
                        <option value="Structured Sources Only">Structured Sources Only (RSS/Atom Feed Sahaja)</option>
                        <option value="Search Only">Search Only (Web Google Search Sahaja)</option>
                        <option value="Structured Sources -> Search Fallback">Structured Sources — Search Fallback (RSS &amp; Search)</option>
                      </select>
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pautan Sumber (sourcesList RSS / Web URL)</label>
                      <input
                        type="text"
                        value={formConfig.sourcesList}
                        onChange={(e) => setFormConfig({ ...formConfig, sourcesList: e.target.value })}
                        placeholder="https://feeds.feedburner.com/... atau URL portal berita"
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                      />
                      <p className="text-[9px] text-stone-500 font-sans mt-0.5">
                        * Nota: Anda boleh memasukkan lebih daripada satu pautan sumber berita (RSS Feed atau URL) dengan memisahkannya menggunakan koma (,), jarak (space), atau baris baru.
                      </p>
                    </div>

                    <div className="flex flex-col gap-1 col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Arahan Khusus Penjanaan (Prompt Teks)</label>
                      <textarea
                        value={formConfig.promptText}
                        onChange={(e) => setFormConfig({ ...formConfig, promptText: e.target.value })}
                        placeholder={editingSlotIndex === -1 ? "Contoh: Fokus kepada berita terkini Malaysia, saringan kesihatan, ekonomi..." : isEditingBarSlot ? "Contoh: Cari dan jana program ilmiah, seminar, atau pesta buku di Selangor." : "Contoh: Fokus kepada berita geopolitik Asia Tenggara..."}
                        rows={4}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs leading-relaxed"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Allowed Content Types</label>
                      {editingSlotIndex === -1 ? (
                        <input
                          type="text"
                          readOnly
                          value="Ticker"
                          className="w-full px-3 py-2 border border-stone-200 rounded bg-stone-50 text-stone-500 font-mono text-xs cursor-not-allowed font-semibold"
                        />
                      ) : isEditingBarSlot ? (
                        <input
                          type="text"
                          readOnly
                          value="Event"
                          className="w-full px-3 py-2 border border-stone-200 rounded bg-stone-50 text-stone-500 font-mono text-xs cursor-not-allowed font-semibold"
                        />
                      ) : (
                        <input
                          type="text"
                          value={formConfig.allowedContentTypes}
                          onChange={(e) => setFormConfig({ ...formConfig, allowedContentTypes: e.target.value })}
                          placeholder="Brief, Essay, dll."
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                        />
                      )}
                    </div>

                    {isEditingBarSlot && (
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Had Tempoh Masa Acara</label>
                        <select
                          value={formConfig.eventExpiryFilter || ''}
                          onChange={(e) => setFormConfig({ ...formConfig, eventExpiryFilter: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                        >
                          <option value="">Tiada Had (Semua Acara)</option>
                          <option value="Seminggu Sebelum Tamat">Seminggu Sebelum Tamat</option>
                          <option value="Sebulan Sebelum Tamat">Sebulan Sebelum Tamat</option>
                        </select>
                      </div>
                    )}

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Kadar Segar Semula (refreshRate)</label>
                      <select
                        value={formConfig.refreshRate}
                        onChange={(e) => {
                          const newRate = e.target.value;
                          setFormConfig({ 
                            ...formConfig, 
                            refreshRate: newRate,
                            refreshHour: formConfig.refreshHour || '00:00',
                            refreshDay: formConfig.refreshDay || 'Isnin'
                          });
                        }}
                        className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                      >
                        <option value="Daily">Setiap Hari (Daily)</option>
                        <option value="Weekly">Setiap Minggu (Weekly)</option>
                      </select>
                    </div>

                    {formConfig.refreshRate === 'Daily' && (
                      <div className="flex flex-col gap-1">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pilih Waktu/Jam</label>
                        <select
                          value={formConfig.refreshHour || '00:00'}
                          onChange={(e) => setFormConfig({ ...formConfig, refreshHour: e.target.value })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                        >
                          {Array.from({ length: 24 }).map((_, h) => {
                            const hh = h.toString().padStart(2, '0') + ':00';
                            return <option key={hh} value={hh}>{hh}</option>;
                          })}
                        </select>
                      </div>
                    )}

                    {formConfig.refreshRate === 'Weekly' && (
                      <>
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pilih Hari</label>
                          <select
                            value={formConfig.refreshDay || 'Isnin'}
                            onChange={(e) => setFormConfig({ ...formConfig, refreshDay: e.target.value })}
                            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                          >
                            {['Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu', 'Ahad'].map(d => (
                              <option key={d} value={d}>{d}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pilih Waktu/Jam</label>
                          <select
                            value={formConfig.refreshHour || '00:00'}
                            onChange={(e) => setFormConfig({ ...formConfig, refreshHour: e.target.value })}
                            className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                          >
                            {Array.from({ length: 24 }).map((_, h) => {
                              const hh = h.toString().padStart(2, '0') + ':00';
                              return <option key={hh} value={hh}>{hh}</option>;
                            })}
                          </select>
                        </div>
                      </>
                    )}

                    <div className="flex flex-col gap-1 col-span-2 mt-2 p-3 bg-stone-50 border border-stone-200 rounded">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Tindakan Segera (Trigger AI)</label>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleRunSlotNow}
                          disabled={isExecutingNow}
                          className={`px-4 py-2 text-xs font-bold text-white rounded transition-colors ${
                            isExecutingNow ? 'bg-stone-400 cursor-not-allowed' : 'bg-[#802334] hover:bg-[#6c1d2c]'
                          }`}
                        >
                          {isExecutingNow ? 'Menjalankan Penjanaan AI...' : 'Aktifkan Segera'}
                        </button>
                        {executingSuccessMessage && (
                          <span className="text-[11px] text-green-600 font-sans font-semibold animate-pulse">
                            ✓ {executingSuccessMessage}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] text-stone-500 font-sans mt-1">
                        Butang ini akan mencetuskan penjanaan AI serta-merta untuk slot ini secara manual. Jadual automasi seterusnya akan tetap mengikut waktu yang ditetapkan di atas.
                      </p>
                    </div>

                    {editingSlotIndex !== -1 && (
                      <div className="flex flex-col gap-1 col-span-2">
                        <label className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold">Jumlah Kandungan Carousel AI (AI Generation Limit)</label>
                        <select
                          value={formConfig.generationLimit || 1}
                          onChange={(e) => setFormConfig({ ...formConfig, generationLimit: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                        >
                          <option value={1}>1 Kandungan (Statik)</option>
                          <option value={2}>2 Kandungan Carousel</option>
                          <option value={3}>3 Kandungan Carousel</option>
                          <option value={4}>4 Kandungan Carousel</option>
                          <option value={5}>5 Kandungan Carousel</option>
                        </select>
                        <p className="text-[9px] text-stone-500 font-sans mt-0.5">
                          Tentukan had maksima kandungan sejarah penjanaan AI terkini yang akan dipaparkan secara berganti-ganti (carousel).
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 col-span-2 mt-4 p-4 bg-stone-50 border border-stone-200 rounded">
                      <label className="font-mono text-[10px] uppercase tracking-wider text-[#802334] font-bold">Sejarah Penjanaan AI (AI Generation History)</label>
                      {aiLogs.length === 0 ? (
                        <p className="text-[10px] text-stone-500 font-sans italic">Tiada rekod log penjanaan AI ditemui untuk slot ini.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left font-sans text-[11px] border-collapse">
                            <thead>
                              <tr className="border-b border-stone-300 text-stone-500 uppercase font-bold text-[9px] tracking-wider">
                                <th className="pb-2">Tarikh / Waktu</th>
                                <th className="pb-2">Status</th>
                                <th className="pb-2">Model</th>
                                <th className="pb-2 text-right">Kos (USD)</th>
                                <th className="pb-2 text-center">Payload</th>
                              </tr>
                            </thead>
                            <tbody>
                              {aiLogs.map((log) => {
                                const costStr = typeof log.estimatedCost === 'number' ? `$${log.estimatedCost.toFixed(5)}` : '$0.00000';
                                const timeStr = new Date(log.createdAt).toLocaleString('ms-MY', { hour12: false });
                                return (
                                  <tr key={log.id} className="border-b border-stone-200 hover:bg-stone-100 transition-colors">
                                    <td className="py-2 text-stone-600 font-mono text-[10px]">{timeStr}</td>
                                    <td className="py-2">
                                      <span className={`px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold uppercase ${
                                        log.status === 'SUCCESS' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                      }`}>
                                        {log.status}
                                      </span>
                                    </td>
                                    <td className="py-2 text-stone-600 font-mono text-[10px]">{log.modelName}</td>
                                    <td className="py-2 text-right text-stone-600 font-mono text-[10px]">{costStr}</td>
                                    <td className="py-2 text-center">
                                      <div className="flex justify-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setActiveLogPayload({ type: 'prompt', content: log.promptText || 'Tiada prompt direkodkan.' })}
                                          className="px-2 py-1 text-[9px] font-bold text-stone-700 bg-white border border-stone-300 rounded hover:bg-stone-50 transition-colors cursor-pointer"
                                        >
                                          Prompt
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setActiveLogPayload({ type: 'response', content: log.responseText || 'Tiada respons direkodkan.' })}
                                          className="px-2 py-1 text-[9px] font-bold text-stone-700 bg-white border border-stone-300 rounded hover:bg-stone-50 transition-colors cursor-pointer"
                                        >
                                          Respons
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* GAYA / STYLES (DITUNJUKKAN KEDUA-DUA MOD) */}
                <div className="border-t border-stone-150 col-span-2 my-2 pt-2">
                  <h4 className="font-sans text-[10px] font-bold text-[#802334] uppercase tracking-wider">Had Aksara, Reka Bentuk &amp; Animasi</h4>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Had Aksara Tajuk (maxTitle)</label>
                  <input
                    type="number"
                    value={formConfig.maxTitle !== undefined && formConfig.maxTitle !== null ? formConfig.maxTitle : ''}
                    onChange={(e) => setFormConfig({ ...formConfig, maxTitle: parseInt(e.target.value) || 0 })}
                    placeholder="Contoh: 70"
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Had Aksara Huraian (maxBrief)</label>
                  <input
                    type="number"
                    value={formConfig.maxBrief !== undefined && formConfig.maxBrief !== null ? formConfig.maxBrief : ''}
                    onChange={(e) => setFormConfig({ ...formConfig, maxBrief: e.target.value === '' ? 0 : (parseInt(e.target.value) || 0) })}
                    placeholder="Contoh: 150 (0 jika tiada)"
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Warna Latar (bgColor)</label>
                  <input
                    type="text"
                    value={formConfig.bgColor}
                    onChange={(e) => setFormConfig({ ...formConfig, bgColor: e.target.value })}
                    placeholder="transparent, #ffffff, #802334..."
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Warna Teks (textColor)</label>
                  <input
                    type="text"
                    value={formConfig.textColor}
                    onChange={(e) => setFormConfig({ ...formConfig, textColor: e.target.value })}
                    placeholder="#1F1F1F, #FDFDFD..."
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-mono text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Selang Masa Carousel (saat)</label>
                  <input
                    type="number"
                    value={formConfig.carouselInterval}
                    onChange={(e) => setFormConfig({ ...formConfig, carouselInterval: parseInt(e.target.value) || 10 })}
                    placeholder="10"
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Kelewatan Mula Carousel (saat)</label>
                  <input
                    type="number"
                    value={formConfig.carouselDelay}
                    onChange={(e) => setFormConfig({ ...formConfig, carouselDelay: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs"
                  />
                </div>

              </div>
              
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-stone-150">
                <button
                  type="button"
                  onClick={() => {
                    setEditingSlotIndex(null);
                    setFormConfig(null);
                  }}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-xs font-semibold cursor-pointer transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSlot}
                  className="px-5 py-2 bg-[#802334] hover:bg-[#6c1d2c] text-white rounded text-xs font-semibold cursor-pointer shadow-sm transition-all disabled:opacity-50"
                >
                  {isSavingSlot ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pop-up Modal untuk Melihat Prompt / Respons AI (AI Payload Auditor) */}
      {activeLogPayload && (
        <div className="fixed inset-0 z-[100] bg-black/75 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-lg border border-stone-250 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in">
            <header className="px-5 py-3 border-b border-stone-150 flex justify-between items-center bg-stone-50">
              <h4 className="font-mono text-xs font-bold text-[#802334] uppercase tracking-wider">
                Paparan {activeLogPayload.type === 'prompt' ? 'Prompt API' : 'Respons Mentah API'}
              </h4>
              <button
                type="button"
                onClick={() => setActiveLogPayload(null)}
                className="text-stone-400 hover:text-stone-600 font-bold font-sans text-xs cursor-pointer"
              >
                Tutup
              </button>
            </header>
            <div className="p-5 overflow-y-auto flex-1 font-mono text-[11px] leading-relaxed bg-stone-900 text-stone-100 select-text whitespace-pre-wrap">
              {activeLogPayload.content}
            </div>
            <footer className="px-5 py-3 border-t border-stone-150 flex justify-between items-center bg-stone-50">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(activeLogPayload.content);
                  alert('Kandungan disalin ke papan klip!');
                }}
                className="px-3 py-1.5 text-[10px] font-bold text-stone-700 bg-white border border-stone-300 rounded hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Salin Kandungan
              </button>
              <button
                type="button"
                onClick={() => setActiveLogPayload(null)}
                className="px-3 py-1.5 text-[10px] font-bold text-white bg-stone-700 rounded hover:bg-stone-850 transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Pop-up Modal Halaman Footer (Tentang/Sidang Ed/dll) */}
      {activeFooterPageKey && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-[#FDFDFD] rounded-lg border border-stone-200 max-w-2xl w-full max-h-[85vh] overflow-y-auto flex flex-col shadow-2xl animate-fade-in">
            <header className="px-6 py-5 border-b border-stone-200 flex justify-between items-center bg-stone-50/50">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-widest text-[#8E8B82] font-bold">
                  {['editors-notes', 'notices', 'publishing-policies', 'version-history'].includes(activeFooterPageKey) ? 'Institutional' : 'Network'}
                </span>
                <h3 className="font-serif text-2xl font-bold text-[#802334] tracking-tight mt-0.5">
                  {isEditingFooterPage ? 'Sunting Halaman' : (footerPageData?.title || 'Kandungan')}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveFooterPageKey(null);
                  setFooterPageData(null);
                  setIsEditingFooterPage(false);
                }}
                className="text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X size={20} />
              </button>
            </header>

            {isEditingFooterPage ? (
              <form onSubmit={handleSaveFooterPage} className="p-6 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Tajuk Halaman</label>
                  <input
                    type="text"
                    value={footerFormTitle}
                    onChange={(e) => setFooterFormTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Kandungan (Teks / Markdown)</label>
                  <textarea
                    value={footerFormContent}
                    onChange={(e) => setFooterFormContent(e.target.value)}
                    rows={12}
                    className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs leading-relaxed"
                    required
                  />
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-stone-150">
                  <button
                    type="button"
                    onClick={() => setIsEditingFooterPage(false)}
                    className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-xs font-semibold cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingFooterPage}
                    className="px-5 py-2 bg-[#802334] hover:bg-[#6c1d2c] text-white rounded text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {isSavingFooterPage ? 'Menyimpan...' : 'Simpan Kandungan'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-6 flex flex-col justify-between flex-grow">
                <div className="font-serif text-sm leading-relaxed text-stone-700 whitespace-pre-wrap flex-grow">
                  {footerPageData?.content ? (
                    footerPageData.content.split('\n\n').map((paragraph: string, idx: number) => {
                      if (paragraph.trim().startsWith('*') || paragraph.trim().startsWith('-')) {
                        const items = paragraph.split('\n').map((li: string) => li.replace(/^[\*\-]\s+/, '').trim());
                        return (
                          <ul key={idx} className="list-disc pl-5 my-3 flex flex-col gap-1.5">
                            {items.map((item: string, liIdx: number) => {
                              const parts = item.split(/\*\*([^*]+)\*\*/g);
                              return (
                                <li key={liIdx}>
                                  {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="text-[#802334] font-bold">{part}</strong> : part)}
                                </li>
                              );
                            })}
                          </ul>
                        );
                      }
                      
                      const parts = paragraph.split(/\*\*([^*]+)\*\*/g);
                      return (
                        <p key={idx} className="mb-4">
                          {parts.map((part, pIdx) => pIdx % 2 === 1 ? <strong key={pIdx} className="text-[#802334] font-bold">{part}</strong> : part)}
                        </p>
                      );
                    })
                  ) : (
                    <div className="py-10 text-center text-stone-400 font-sans text-xs animate-pulse">
                      Memuatkan kandungan...
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-stone-150">
                  <span className="font-sans text-[9px] text-stone-400">
                    {footerPageData?.updatedAt && `Kemaskini Terakhir: ${new Date(footerPageData.updatedAt).toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                  </span>
                  <div className="flex gap-2">
                    {isEditMode && footerPageData && (
                      <button
                        type="button"
                        onClick={() => setIsEditingFooterPage(true)}
                        className="px-4 py-2 border border-stone-300 text-stone-700 hover:bg-stone-50 rounded text-xs font-semibold cursor-pointer"
                      >
                        Sunting Halaman
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveFooterPageKey(null);
                        setFooterPageData(null);
                      }}
                      className="px-5 py-2 bg-[#802334] hover:bg-[#6c1d2c] text-white rounded text-xs font-semibold cursor-pointer shadow-sm"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full-screen Reading Display Overlay */}
      {showNewsOverlay && overlayItem && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-lg transition-all duration-300 animate-fade-in p-6 select-none"
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
          {parsedTickerNewsItems.length > 1 && (
            <button 
              type="button"
              onClick={handlePrevNewsItem}
              className="absolute left-6 top-1/2 -translate-y-1/2 p-3 text-stone-400 hover:text-[#802334] transition cursor-pointer hover:bg-stone-200/50 rounded-full animate-fade-in"
              title="Previous News (Left Arrow)"
            >
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}

          {/* Right Arrow */}
          {parsedTickerNewsItems.length > 1 && (
            <button 
              type="button"
              onClick={handleNextNewsItem}
              className="absolute right-6 top-1/2 -translate-y-1/2 p-3 text-stone-400 hover:text-[#802334] transition cursor-pointer hover:bg-stone-200/50 rounded-full animate-fade-in"
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
                  style={{ color: overlayItem.categoryColor || getDeskAccentColor(overlayItem.desk) }}
                >
                  {overlayItem.desk}
                </div>

                {/* Large Serif Title */}
                <h1 className="font-serif text-3xl md:text-5xl text-stone-900 leading-tight tracking-tight font-medium px-4">
                  {overlayItem.title}
                </h1>

                {/* Brief body */}
                {overlayItem.brief && (
                  <p className="font-serif text-lg md:text-xl text-stone-600 leading-relaxed max-w-xl mx-auto px-4 font-light">
                    {overlayItem.brief}
                  </p>
                )}

                {/* Read Original button */}
                {overlayItem.url && (
                  <div className="pt-4 select-none">
                    <a 
                      href={overlayItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-[#802334] hover:bg-[#631c28] text-white px-6 py-2.5 rounded font-mono text-[10px] uppercase tracking-wider transition shadow-sm"
                    >
                      Baca Berita Asal &rarr;
                    </a>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Navigation Dots */}
          {parsedTickerNewsItems.length > 1 && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 flex justify-center gap-2 select-none">
              {Array.from({ length: Math.min(10, parsedTickerNewsItems.length) }).map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveOverlayIndex(idx);
                  }}
                  className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    idx === (activeOverlayIndex % 10) 
                      ? 'bg-[#802334] w-4' 
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
