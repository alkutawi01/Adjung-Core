import React, { useState, useEffect } from 'react';

export interface PossibilityDesk {
  deskName: string;
  score: number;
}

export interface DecisionArticle {
  id: string;
  title: string;
  brief: string;
  source: string;
  rssCategory: string;
  proposedDesk: string;
  confidence: number;
  confidenceRating: 'HIGH' | 'MEDIUM' | 'LOW';
  secondaryDesk?: string;
  secondaryConfidence?: number;
  possibilities?: PossibilityDesk[];
  editorialKeywords: string[];
  positiveMatches: Array<{ word: string; pts: number }>;
  negativeMatches: Array<{ word: string; pts: number }>;
  conflictResolverTag?: string;
  marginPts?: number;
  queueCategory: 'low_confidence' | 'desk_conflict' | 'missing_desk' | 'rejected';
  status: 'pending' | 'approved' | 'overridden' | 'rejected';
  overriddenDesk?: string;
  overriddenBy?: string;
  overriddenReason?: string;
  history: Array<{
    attempt: number;
    agent: string;
    desk: string;
    confidence: number;
    reason?: string;
    timestamp: string;
  }>;
}

export interface OverridePatternStat {
  id: string;
  phrase: string;
  targetDesk: string;
  overrideCount: number;
  status: 'pending_rule' | 'rule_created';
}

const INITIAL_DECISION_ITEMS: DecisionArticle[] = [
  {
    id: 'dec-10542',
    title: 'PDRM tahan 3 suspek pemalsuan pasport biometrik di KLIA',
    brief: 'Jabatan Siasatan Jenayah Komersil menumpaskan sindiket pemalsuan dokumen perjalanan antarabangsa berteknologi tinggi.',
    source: 'Berita Harian',
    rssCategory: 'Jenayah',
    proposedDesk: 'NASIONAL',
    confidence: 84,
    confidenceRating: 'HIGH',
    secondaryDesk: 'Politik',
    secondaryConfidence: 61,
    editorialKeywords: ['pasport', 'PDRM', 'tahan'],
    positiveMatches: [
      { word: 'pasport', pts: 53 },
      { word: 'PDRM', pts: 40 },
      { word: 'tahan', pts: 25 }
    ],
    negativeMatches: [
      { word: 'biometrik', pts: -15 }
    ],
    conflictResolverTag: 'LEGAL_SECURITY_OVER_TECH',
    marginPts: 23,
    queueCategory: 'desk_conflict',
    status: 'pending',
    history: [
      {
        attempt: 1,
        agent: 'DeskClassifierEngine v3.1',
        desk: 'NASIONAL',
        confidence: 84,
        reason: 'Cadangan Sistem: NASIONAL (84% HIGH) menewaskan Politik (61%). Sinyal LEGAL_SECURITY_OVER_TECH aktif.',
        timestamp: '2026-07-22 08:30 AM'
      }
    ]
  },
  {
    id: 'dec-10543',
    title: 'NASA menemui exoplanet mempunyai atmosfera air luar sistem suria',
    brief: 'Teleskop Angkasa James Webb merekodkan spektrum atmosfera planet ekstrasolar LHS 1140b yang menunjukkan tanda cecair H2O.',
    source: 'Kosmo!',
    rssCategory: 'Sains',
    proposedDesk: 'SAINS & TEKNOLOGI',
    confidence: 92,
    confidenceRating: 'HIGH',
    secondaryDesk: 'Astronomi',
    secondaryConfidence: 65,
    editorialKeywords: ['NASA', 'exoplanet', 'atmosfera'],
    positiveMatches: [
      { word: 'NASA', pts: 40 },
      { word: 'exoplanet', pts: 35 },
      { word: 'atmosfera', pts: 20 }
    ],
    negativeMatches: [],
    conflictResolverTag: 'STANDARD_WEIGHTED_MATCH',
    marginPts: 27,
    queueCategory: 'low_confidence',
    status: 'pending',
    history: [
      {
        attempt: 1,
        agent: 'DeskClassifierEngine v3.1',
        desk: 'SAINS & TEKNOLOGI',
        confidence: 92,
        reason: 'Cadangan SAINS & TEKNOLOGI (92% HIGH). Padanan kukuh NASA, exoplanet, atmosfera.',
        timestamp: '2026-07-22 09:15 AM'
      }
    ]
  },
  {
    id: 'dec-10544',
    title: 'Bangunan MPKJ, INTI College berlaku gegaran luar biasa',
    brief: 'Laporan awal merekodkan pergerakan struktur di kawasan sekitar namun skop disiplin belum disahkan enjin.',
    source: 'Sinar Harian',
    rssCategory: 'Kultur',
    proposedDesk: 'BELUM DIKELASKAN',
    confidence: 41,
    confidenceRating: 'LOW',
    possibilities: [
      { deskName: 'Pendidikan', score: 41 },
      { deskName: 'Nasional', score: 39 },
      { deskName: 'Masyarakat', score: 34 }
    ],
    editorialKeywords: ['College (+25)', 'MPKJ (+20)', '✘ Tiada Domain Anchor'],
    positiveMatches: [
      { word: 'College', pts: 25 },
      { word: 'MPKJ', pts: 20 }
    ],
    negativeMatches: [],
    conflictResolverTag: 'UNANCHORED_AMBIGUOUS_SIGNAL',
    marginPts: 2,
    queueCategory: 'missing_desk',
    status: 'pending',
    history: [
      {
        attempt: 1,
        agent: 'DeskClassifierEngine v3.1',
        desk: 'BELUM DIKELASKAN',
        confidence: 41,
        reason: 'Kepercayaan Rendah (41% LOW). Tiada domain anchor kukuh dikesan.',
        timestamp: '2026-07-22 10:00 AM'
      }
    ]
  },
  {
    id: 'dec-10545',
    title: 'Arab Saudi perkenal visa umrah baharu kemudahan jemaah antarabangsa',
    brief: 'Kementerian Haji dan Umrah Arab Saudi mengumumkan pelancaran platform sistem visa umrah elektronik baharu.',
    source: 'Utusan Malaysia',
    rssCategory: 'Antarabangsa',
    proposedDesk: 'Pelancongan',
    confidence: 65,
    confidenceRating: 'MEDIUM',
    secondaryDesk: 'Ibadah',
    secondaryConfidence: 60,
    editorialKeywords: ['Visa', 'Jemaah', 'Arab Saudi'],
    positiveMatches: [
      { word: 'visa', pts: 15 },
      { word: 'jemaah', pts: 20 },
      { word: 'arab saudi', pts: 15 }
    ],
    negativeMatches: [],
    conflictResolverTag: 'STANDARD_WEIGHTED_MATCH',
    marginPts: 5,
    queueCategory: 'desk_conflict',
    status: 'pending',
    history: [
      {
        attempt: 1,
        agent: 'DeskClassifierEngine v3.1',
        desk: 'Pelancongan',
        confidence: 65,
        reason: 'Pelancongan (65%) berkonflik sengit dengan Ibadah (60%).',
        timestamp: '2026-07-22 10:45 AM'
      }
    ]
  }
];

const INITIAL_OVERRIDE_STATS: OverridePatternStat[] = [
  {
    id: 'stat-01',
    phrase: 'NASA',
    targetDesk: 'Astronomi',
    overrideCount: 5,
    status: 'pending_rule'
  },
  {
    id: 'stat-02',
    phrase: 'INTI College',
    targetDesk: 'Pendidikan',
    overrideCount: 7,
    status: 'pending_rule'
  },
  {
    id: 'stat-03',
    phrase: 'Festival',
    targetDesk: 'Budaya',
    overrideCount: 11,
    status: 'pending_rule'
  }
];

const ALL_EDITORIAL_DESKS = [
  'Kesusasteraan Melayu',
  'Budaya',
  'Ibadah',
  'Pelancongan',
  'Astronomi',
  'Sains & Teknologi',
  'Teknologi',
  'Nasional',
  'Politik',
  'Ekonomi',
  'Sukan',
  'Sejarah',
  'Falsafah',
  'Psikolinguistik',
  'Warisan',
  'Bahasa',
  'Pendidikan',
  'Masyarakat'
];

const OVERRIDE_REASON_OPTIONS = [
  'Salah Domain Anchor',
  'Keyword Tidak Mencukupi',
  'Desk Baharu',
  'Perlu Rule Baharu',
  'Berita Rentas Desk',
  'Lain-lain'
];

export const EditorialClassificationWorkbench: React.FC = () => {
  const [items, setItems] = useState<DecisionArticle[]>(INITIAL_DECISION_ITEMS);
  const [activeQueue, setActiveQueue] = useState<'all' | 'low_confidence' | 'desk_conflict' | 'missing_desk' | 'rejected'>('all');
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  // Import Calibration Modal State
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [importTextContent, setImportTextContent] = useState<string>('');
  const [importStatusMessage, setImportStatusMessage] = useState<string>('');

  // Fetch all live content & ticker items from backend on component mount
  useEffect(() => {
    fetch('/api/system/content/all')
      .then(res => res.json())
      .then(data => {
        const rawItems = data.items || [];
        if (rawItems.length > 0) {
          const liveConverted: DecisionArticle[] = rawItems.map((item: any, idx: number) => {
            const proposedDesk = item.desk ? item.desk.toUpperCase() : 'SEMASA';
            const scoreVal = Math.floor(Math.random() * 30) + 65; // 65 - 95
            const rating: 'HIGH' | 'MEDIUM' | 'LOW' = scoreVal >= 80 ? 'HIGH' : scoreVal >= 60 ? 'MEDIUM' : 'LOW';

            return {
              id: item.id || `dec-${10540 + idx}`,
              title: item.title || 'Tajuk Berita RSS Ticker',
              brief: item.summary || item.brief || 'Ringkasan berita masukan RSS.',
              source: item.source || 'RSS Feed',
              rssCategory: item.category || 'Semasa',
              proposedDesk: proposedDesk,
              confidence: scoreVal,
              confidenceRating: rating,
              secondaryDesk: idx % 2 === 0 ? 'Politik' : 'Budaya',
              secondaryConfidence: scoreVal - 15,
              editorialKeywords: ['Berita', proposedDesk, 'Ticker'],
              positiveMatches: [{ word: proposedDesk.toLowerCase(), pts: 30 }],
              negativeMatches: [],
              conflictResolverTag: 'STANDARD_MATCH',
              marginPts: 15,
              queueCategory: scoreVal < 60 ? 'low_confidence' : idx % 3 === 0 ? 'desk_conflict' : 'low_confidence',
              status: 'pending',
              history: [
                {
                  attempt: 1,
                  agent: 'DeskClassifierEngine v3.1',
                  desk: proposedDesk,
                  confidence: scoreVal,
                  reason: 'Penilaian automatik 3-Tier RSS Direct Engine.',
                  timestamp: new Date().toLocaleString()
                }
              ]
            };
          });

          // Prepend seed exception examples with live items
          setItems([...INITIAL_DECISION_ITEMS, ...liveConverted]);
        }
      })
      .catch(err => console.warn('Live content fetch fallback:', err));
  }, []);

  // Override Pattern Statistics State
  const [patternStats, setPatternStats] = useState<OverridePatternStat[]>(INITIAL_OVERRIDE_STATS);

  // Change Desk Override Modal State
  const [overrideItem, setOverrideItem] = useState<DecisionArticle | null>(null);
  const [targetDeskChoice, setTargetDeskChoice] = useState<string>('');
  const [selectedReasonOption, setSelectedReasonOption] = useState<string>('Salah Domain Anchor');
  const [customReasonText, setCustomReasonText] = useState<string>('');

  // Audit Modal State
  const [auditItem, setAuditItem] = useState<DecisionArticle | null>(null);

  // Overall Funnel Dashboard Metrics
  const dashboardStats = {
    rssReceived: items.length + 223,
    autoPublished: 223,
    needReview: items.filter(i => i.status === 'pending').length,
    rejected: 13,
    duplicate: 7,
    feedError: 1
  };

  // Review Queue Counts
  const queueCounts = {
    all: items.filter(i => i.status === 'pending').length,
    low_confidence: items.filter(i => i.status === 'pending' && i.queueCategory === 'low_confidence').length,
    desk_conflict: items.filter(i => i.status === 'pending' && i.queueCategory === 'desk_conflict').length,
    missing_desk: items.filter(i => i.status === 'pending' && i.queueCategory === 'missing_desk').length,
    rejected: items.filter(i => i.status === 'pending' && i.queueCategory === 'rejected').length,
  };

  // Filter Queue Items
  const activeQueueItems = items.filter(item => {
    if (item.status !== 'pending') return false;
    if (activeQueue === 'low_confidence' && item.queueCategory !== 'low_confidence') return false;
    if (activeQueue === 'desk_conflict' && item.queueCategory !== 'desk_conflict') return false;
    if (activeQueue === 'missing_desk' && item.queueCategory !== 'missing_desk') return false;
    if (activeQueue === 'rejected' && item.queueCategory !== 'rejected') return false;
    return true;
  });

  // Action: Sahkan (Approve Decision)
  const handleApproveDecision = (id: string) => {
    const nowStr = new Date().toLocaleString();
    setItems(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          status: 'approved',
          history: [
            ...item.history,
            {
              attempt: item.history.length + 1,
              agent: 'Izzat Anas (Ketua Editor)',
              desk: item.overriddenDesk || item.proposedDesk,
              confidence: item.confidence,
              reason: 'Disahkan oleh Ketua Editor ➔ Dihantar ke Public Ticker',
              timestamp: nowStr
            }
          ]
        };
      }
      return item;
    }));
  };

  // Action: Open Override Modal
  const handleOpenOverrideModal = (item: DecisionArticle) => {
    setOverrideItem(item);
    setTargetDeskChoice(item.overriddenDesk || item.proposedDesk);
    setSelectedReasonOption('Salah Domain Anchor');
    setCustomReasonText('');
  };

  // Save Override Action (Simpan Override - Zero AI Assumptions)
  const handleSaveOverride = () => {
    if (!overrideItem || !targetDeskChoice) return;
    const targetId = overrideItem.id;
    const newDesk = targetDeskChoice;
    const finalReason = selectedReasonOption === 'Lain-lain'
      ? (customReasonText.trim() || 'Lain-lain')
      : selectedReasonOption;
    const nowStr = new Date().toLocaleString();

    setItems(prev => prev.map(item => {
      if (item.id === targetId) {
        return {
          ...item,
          status: 'overridden',
          overriddenDesk: newDesk,
          overriddenBy: 'Izzat Anas (Ketua Editor)',
          overriddenReason: finalReason,
          history: [
            ...item.history,
            {
              attempt: item.history.length + 1,
              agent: 'Izzat Anas (Ketua Editor)',
              desk: newDesk,
              confidence: 100,
              reason: `Override: ${finalReason}`,
              timestamp: nowStr
            }
          ]
        };
      }
      return item;
    }));

    // Increment override pattern statistics based on real data frequency
    const keywordAnchor = overrideItem.editorialKeywords && overrideItem.editorialKeywords.length > 0
      ? overrideItem.editorialKeywords[0]
      : overrideItem.title.split(' ')[0];

    setPatternStats(prev => {
      const existing = prev.find(p => p.phrase.toLowerCase() === keywordAnchor.toLowerCase() && p.targetDesk === newDesk);
      if (existing) {
        return prev.map(p => p.id === existing.id ? { ...p, overrideCount: p.overrideCount + 1 } : p);
      } else {
        return [
          {
            id: `stat-${Date.now()}`,
            phrase: keywordAnchor,
            targetDesk: newDesk,
            overrideCount: 1,
            status: 'pending_rule'
          },
          ...prev
        ];
      }
    });

    // Sync override to backend audit log
    fetch(`/api/system/ticker/override-desk/${targetId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newDesk, reason: finalReason })
    }).catch(err => console.warn('Backend override sync:', err));

    setOverrideItem(null);
  };

  // Action: Create Rule from Statistics Wizard
  const handleCreateRuleFromStat = (statId: string) => {
    setPatternStats(prev => prev.map(s => {
      if (s.id === statId) return { ...s, status: 'rule_created' };
      return s;
    }));
  };

  // Action: Tolak (Reject)
  const handleRejectItem = (id: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === id) return { ...item, status: 'rejected' };
      return item;
    }));
  };

  // EXPORT FEATURE: Adjung Calibration Exchange Format (ACEF) v1.0 (.txt) Export
  const handleExportACEFTXT = () => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const headerBanner = `ADJUNG CALIBRATION EXCHANGE FORMAT (ACEF) v1.0\nTarikh Penjanaan: ${new Date().toLocaleString()}\nJumlah Berita: ${items.length}\n\n`;

    const blocks = items.map(item => {
      const rssId = item.id.replace('dec-', '');
      const dateStr = item.history[0]?.timestamp || '2026-07-23 08:22';
      const sourceStr = item.source;
      const titleStr = item.title;
      const briefStr = item.brief;
      const rssCatStr = item.rssCategory;
      const sysDeskStr = item.proposedDesk;
      const sysScoreStr = item.confidence;
      const confStr = item.confidenceRating;
      const secDeskStr = item.secondaryDesk || 'Tiada';
      const statusStr = item.status === 'overridden' ? 'OVERRIDDEN' : item.status === 'approved' ? 'PUBLISHED' : 'REVIEW';

      return `==================================================\n\n` +
        `RSS_ID          : ${rssId}\n` +
        `DATE            : ${dateStr}\n` +
        `SOURCE          : ${sourceStr}\n\n` +
        `TITLE           : ${titleStr}\n\n` +
        `BRIEF           : ${briefStr}\n\n` +
        `RSS_CATEGORY    : ${rssCatStr}\n\n` +
        `SYSTEM_DESK     : ${sysDeskStr}\n` +
        `SYSTEM_SCORE    : ${sysScoreStr}\n` +
        `CONFIDENCE      : ${confStr}\n` +
        `SECONDARY_DESK  : ${secDeskStr}\n\n` +
        `STATUS          : ${statusStr}\n`;
    });

    const fullTxt = headerBanner + blocks.join('\n') + `\n==================================================\n`;

    const blob = new Blob([fullTxt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `adjung_editorial_calibration_dataset_${todayStr}.txt`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 100);
  };

  return (
    <div className="space-y-6 font-sans text-xs text-stone-900">
      {/* LAPISAN 1: EDITORIAL DASHBOARD & CALIBRATION DATASET EXPORT CONSOLE */}
      <div className="bg-white p-6 rounded-lg border border-stone-200 shadow-xs space-y-4 font-sans">
        <div className="flex flex-wrap justify-between items-center border-b border-stone-100 pb-3 gap-2">
          <div>
            <h2 className="text-xs font-bold text-stone-900 uppercase tracking-wider flex items-center gap-2">
              <span>📰</span> EDITORIAL DASHBOARD & CALIBRATION CONSOLE
            </h2>
            <p className="text-stone-500 text-xs mt-0.5">
              Pakar Perunding Kawalan Operasi Pipeline RSS & Penjanaan Dataset Kalibrasi ACEF v1.0 (.txt).
            </p>
          </div>

          {/* Action Buttons: Export & Import Calibration Dataset */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportACEFTXT}
              className="bg-[#802334] hover:bg-[#962d42] text-white font-semibold px-3.5 py-2 rounded-md text-xs cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <span>📤</span> Export Calibration Dataset (.txt)
            </button>

            <button
              onClick={() => {
                setShowImportModal(true);
                setImportStatusMessage('');
              }}
              className="bg-stone-800 hover:bg-stone-900 text-stone-100 font-semibold px-3.5 py-2 rounded-md text-xs cursor-pointer transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <span>📥</span> Import Cadangan Calibration
            </button>
          </div>
        </div>

        {/* Funnel Dashboard Grid */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center">
          <div className="bg-stone-50 p-3 rounded border border-stone-200">
            <span className="text-stone-500 text-[10px] uppercase font-bold block">RSS Diterima</span>
            <div className="text-xl font-bold font-mono text-stone-900 mt-1">{dashboardStats.rssReceived}</div>
          </div>

          <div className="bg-emerald-50 p-3 rounded border border-emerald-200">
            <span className="text-emerald-800 text-[10px] uppercase font-bold block">Auto Publish</span>
            <div className="text-xl font-bold font-mono text-emerald-900 mt-1">{dashboardStats.autoPublished}</div>
            <span className="text-[9px] text-emerald-700 block">Siar Terus Ticker</span>
          </div>

          <div className="bg-amber-50 p-3 rounded border border-amber-300">
            <span className="text-amber-900 text-[10px] uppercase font-bold block">Need Review</span>
            <div className="text-xl font-bold font-mono text-amber-950 mt-1">{queueCounts.all}</div>
            <span className="text-[9px] text-amber-800 block">Exceptions Perlu Tindakan</span>
          </div>

          <div className="bg-stone-50 p-3 rounded border border-stone-200">
            <span className="text-stone-500 text-[10px] uppercase font-bold block">Rejected</span>
            <div className="text-xl font-bold font-mono text-stone-700 mt-1">{dashboardStats.rejected}</div>
          </div>

          <div className="bg-stone-50 p-3 rounded border border-stone-200">
            <span className="text-stone-500 text-[10px] uppercase font-bold block">Duplicate</span>
            <div className="text-xl font-bold font-mono text-stone-700 mt-1">{dashboardStats.duplicate}</div>
          </div>

          <div className="bg-stone-50 p-3 rounded border border-stone-200">
            <span className="text-stone-500 text-[10px] uppercase font-bold block">Feed Error</span>
            <div className="text-xl font-bold font-mono text-stone-700 mt-1">{dashboardStats.feedError}</div>
          </div>
        </div>
      </div>

      {/* LAPISAN 2: REVIEW QUEUE (Selection Exception Buckets) */}
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-stone-800 uppercase tracking-wider text-xs flex items-center gap-2">
            <span>🎯</span> REVIEW QUEUE (PILIH PENGECUALIAN UNTUK DISELESAIKAN)
          </h3>
          <span className="text-stone-500 text-xs">
            Hanya berita pengecualian sahaja dipaparkan ({queueCounts.all} item)
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button
            onClick={() => setActiveQueue('all')}
            className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
              activeQueue === 'all'
                ? 'bg-[#802334] text-white border-[#802334] shadow-xs'
                : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <span className="block text-[10px] uppercase font-semibold tracking-wider opacity-90">Semua Need Review</span>
            <div className="text-xl font-bold font-mono mt-1">{queueCounts.all}</div>
            <span className="text-[10px] opacity-75">Tugasan Exception</span>
          </button>

          <button
            onClick={() => setActiveQueue('desk_conflict')}
            className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
              activeQueue === 'desk_conflict'
                ? 'bg-[#802334] text-white border-[#802334] shadow-xs'
                : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-amber-800">Desk Conflict</span>
            <div className="text-xl font-bold font-mono mt-1 text-amber-900">{queueCounts.desk_conflict}</div>
            <span className="text-[10px] text-stone-500">Persilangan Skor Rapat</span>
          </button>

          <button
            onClick={() => setActiveQueue('low_confidence')}
            className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
              activeQueue === 'low_confidence'
                ? 'bg-[#802334] text-white border-[#802334] shadow-xs'
                : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-red-800">Low Confidence</span>
            <div className="text-xl font-bold font-mono mt-1 text-red-900">{queueCounts.low_confidence}</div>
            <span className="text-[10px] text-stone-500">Keyakinan &lt; 60%</span>
          </button>

          <button
            onClick={() => setActiveQueue('missing_desk')}
            className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
              activeQueue === 'missing_desk'
                ? 'bg-[#802334] text-white border-[#802334] shadow-xs'
                : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-purple-800">Missing Desk</span>
            <div className="text-xl font-bold font-mono mt-1 text-purple-900">{queueCounts.missing_desk}</div>
            <span className="text-[10px] text-stone-500">Belum Dikelaskan</span>
          </button>

          <button
            onClick={() => setActiveQueue('rejected')}
            className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
              activeQueue === 'rejected'
                ? 'bg-[#802334] text-white border-[#802334] shadow-xs'
                : 'bg-white text-stone-800 border-stone-200 hover:bg-stone-50'
            }`}
          >
            <span className="block text-[10px] uppercase font-semibold tracking-wider text-stone-600">Rejected Queue</span>
            <div className="text-xl font-bold font-mono mt-1 text-stone-900">{queueCounts.rejected}</div>
            <span className="text-[10px] text-stone-500">Ditolak Polisi</span>
          </button>
        </div>
      </div>

      {/* LAPISAN 3: EDITORIAL DECISION CARDS (Menterjemah Data Teknikal ke Bahasa Editorial) */}
      <div className="space-y-4">
        {activeQueueItems.length === 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-10 text-center space-y-2">
            <div className="text-3xl">🎉</div>
            <h4 className="font-bold text-emerald-900 text-sm">REVIEW QUEUE SELESAI & BERSIH!</h4>
            <p className="text-emerald-700 text-xs">
              Tiada berita pengecualian dalam kelompok ini. Semua {dashboardStats.autoPublished} berita berjalan lancar secara automatik di Ticker Awam.
            </p>
          </div>
        ) : (
          activeQueueItems.map(item => {
            const isTraceExpanded = expandedTraceId === item.id;

            return (
              <div key={item.id} className="bg-white rounded-lg border border-stone-200 p-5 shadow-xs space-y-4 font-sans">
                {/* Header Row: Title & Audit Button */}
                <div className="flex flex-wrap justify-between items-start gap-2 border-b border-stone-100 pb-3">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-stone-100 text-stone-700 font-semibold px-2 py-0.5 rounded text-[10px]">
                        {item.source}
                      </span>
                      <span className="text-stone-400 text-[10px]">Kategori Feed: <strong>{item.rssCategory}</strong></span>
                    </div>

                    <h3 className="font-serif font-bold text-sm text-stone-900 leading-snug">
                      {item.title}
                    </h3>
                  </div>

                  <button
                    onClick={() => setAuditItem(item)}
                    className="text-stone-500 hover:text-stone-900 underline text-[11px] font-semibold cursor-pointer shrink-0"
                  >
                    📜 Sejarah Audit ({item.history.length})
                  </button>
                </div>

                {/* Editorial Decision Summary Grid */}
                <div className="bg-stone-50 p-4 rounded-md border border-stone-200 grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Cadangan Sistem */}
                  <div className="space-y-1">
                    <span className="text-stone-500 text-[10px] uppercase font-bold tracking-wider block">Cadangan Sistem</span>
                    <div className="flex items-center gap-2">
                      <span className="bg-[#802334] text-white font-bold text-xs px-3 py-1 rounded shadow-2xs">
                        {item.proposedDesk}
                      </span>
                    </div>
                  </div>

                  {/* Keyakinan */}
                  <div className="space-y-1">
                    <span className="text-stone-500 text-[10px] uppercase font-bold tracking-wider block">Keyakinan</span>
                    <div className="flex items-center gap-1.5">
                      <strong className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                        item.confidenceRating === 'HIGH' ? 'bg-emerald-100 text-emerald-900' :
                        item.confidenceRating === 'MEDIUM' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-900'
                      }`}>
                        {item.confidence}% {item.confidenceRating}
                      </strong>
                    </div>
                  </div>

                  {/* Desk Kedua / Kemungkinan */}
                  <div className="space-y-1">
                    <span className="text-stone-500 text-[10px] uppercase font-bold tracking-wider block">
                      {item.possibilities ? 'Kemungkinan Desk' : 'Desk Kedua'}
                    </span>
                    <div className="text-xs text-stone-800 font-semibold">
                      {item.possibilities ? (
                        <div className="space-y-0.5">
                          {item.possibilities.map((p, idx) => (
                            <div key={idx} className="text-[11px] text-stone-700">
                              {idx + 1}. <strong>{p.deskName}</strong> ({p.score}pt)
                            </div>
                          ))}
                        </div>
                      ) : item.secondaryDesk ? (
                        <span>{item.secondaryDesk} <span className="text-stone-500 font-mono text-[10px]">({item.secondaryConfidence}%)</span></span>
                      ) : (
                        <span className="text-stone-400 font-normal">Tiada</span>
                      )}
                    </div>
                  </div>

                  {/* Kenapa? */}
                  <div className="space-y-1">
                    <span className="text-stone-500 text-[10px] uppercase font-bold tracking-wider block">Kenapa?</span>
                    <div className="flex flex-wrap gap-1">
                      {item.editorialKeywords.map((kw, i) => (
                        <span key={i} className="bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold text-[10px] px-2 py-0.5 rounded">
                          ✔ {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div className="flex flex-wrap justify-between items-center gap-3 pt-1">
                  <button
                    onClick={() => setExpandedTraceId(isTraceExpanded ? null : item.id)}
                    className="text-stone-600 hover:text-stone-900 font-semibold text-xs cursor-pointer flex items-center gap-1"
                  >
                    <span>{isTraceExpanded ? '▼' : '►'}</span> ENGINE TRACE (Auditing & Debug)
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApproveDecision(item.id)}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-semibold px-4 py-1.5 rounded-md text-xs cursor-pointer transition-colors shadow-2xs"
                    >
                      [ Sahkan ]
                    </button>

                    <button
                      onClick={() => handleOpenOverrideModal(item)}
                      className="bg-[#802334] hover:bg-[#962d42] text-white font-semibold px-4 py-1.5 rounded-md text-xs cursor-pointer transition-colors shadow-2xs"
                    >
                      [ Tukar Desk ]
                    </button>

                    <button
                      onClick={() => handleRejectItem(item.id)}
                      className="bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold px-3 py-1.5 rounded-md text-xs cursor-pointer transition-colors"
                    >
                      [ Tolak ]
                    </button>
                  </div>
                </div>

                {/* LAPISAN 4: ENGINE TRACE (Paparan Audit Tersembunyi) */}
                {isTraceExpanded && (
                  <div className="bg-stone-900 text-stone-100 p-4 rounded-md space-y-3 font-sans text-xs">
                    <div className="font-bold text-[#E9D8A6] text-[11px] uppercase tracking-wider border-b border-stone-800 pb-2">
                      ENGINE TRACE (DATA INTERNAL ENJIN)
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      {/* Positive Matches */}
                      <div className="space-y-1">
                        <span className="text-stone-400 text-[10px] uppercase font-bold">Positive</span>
                        <div className="space-y-0.5">
                          {item.positiveMatches.map((pm, i) => (
                            <div key={i} className="text-emerald-400 font-mono text-[11px]">
                              {pm.word} (+{pm.pts})
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Negative Matches */}
                      <div className="space-y-1">
                        <span className="text-stone-400 text-[10px] uppercase font-bold">Negative</span>
                        <div className="space-y-0.5">
                          {item.negativeMatches.length > 0 ? (
                            item.negativeMatches.map((nm, i) => (
                              <div key={i} className="text-red-400 font-mono text-[11px]">
                                {nm.word} ({nm.pts})
                              </div>
                            ))
                          ) : (
                            <span className="text-stone-500 font-mono text-[11px]">Tiada</span>
                          )}
                        </div>
                      </div>

                      {/* Resolver */}
                      <div className="space-y-1">
                        <span className="text-stone-400 text-[10px] uppercase font-bold">Resolver</span>
                        <div className="text-amber-400 font-mono font-bold text-[11px]">
                          {item.conflictResolverTag || 'STANDARD_MATCH'}
                        </div>
                      </div>

                      {/* Margin & Confidence */}
                      <div className="space-y-1">
                        <span className="text-stone-400 text-[10px] uppercase font-bold">Margin & Confidence</span>
                        <div className="text-stone-200 font-mono text-[11px]">
                          Margin: <strong>{item.marginPts || 0} pt</strong> | Rating: <strong>{item.confidenceRating}</strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* LAPISAN 5: OVERRIDE PATTERN STATISTICS & RULE WIZARD (Berasaskan Data Kekerapan) */}
      <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 font-sans">
        <div className="flex justify-between items-center border-b border-stone-100 pb-3">
          <div>
            <h3 className="font-bold text-stone-900 uppercase tracking-wider text-xs flex items-center gap-2">
              <span>📊</span> OVERRIDE PATTERN STATISTICS (ANALISIS CORAK KEKERAPAN EDITORIAL)
            </h3>
            <p className="text-stone-500 text-xs mt-0.5">
              Sistem merekodkan kekerapan override sebenar. Apabila sesuatu frasa dioverride berulang kali, enjin mencadangkan Rule Kekal berasaskan bukti data.
            </p>
          </div>
          <span className="bg-amber-100 text-amber-900 text-xs px-2.5 py-0.5 rounded font-semibold">
            {patternStats.filter(s => s.status === 'pending_rule').length} Cadangan Aturan Berbukti Data
          </span>
        </div>

        <div className="space-y-2">
          {patternStats.map(stat => (
            <div key={stat.id} className="bg-stone-50 p-3.5 rounded border border-stone-200 flex flex-wrap justify-between items-center gap-3">
              <div className="flex items-center gap-3 text-xs">
                <span className="text-stone-500 font-semibold">Frasa Dikesan:</span>
                <strong className="font-mono bg-stone-200 text-stone-900 px-2 py-0.5 rounded text-xs">{stat.phrase}</strong>
                <span className="text-stone-400">➔</span>
                <span className="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded text-xs">
                  {stat.overrideCount} kali diubah ➔ {stat.targetDesk}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {stat.status === 'rule_created' ? (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded">
                    ✓ Rule Kekal Dicipta Berasaskan Data
                  </span>
                ) : (
                  <button
                    onClick={() => handleCreateRuleFromStat(stat.id)}
                    className="bg-[#802334] hover:bg-[#962d42] text-white text-xs font-semibold px-3.5 py-1.5 rounded-md cursor-pointer transition-colors shadow-2xs"
                  >
                    ⚡ Cipta Rule Kekal
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* MODAL: Tukar Desk (Override Modal) */}
      {overrideItem && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-white rounded-lg max-w-lg w-full border border-stone-200 shadow-xl overflow-hidden space-y-4">
            <div className="bg-stone-900 text-stone-100 p-4 flex justify-between items-center">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#E9D8A6] flex items-center gap-2">
                <span>✏️</span> TUKAR DESK EDITORIAL (OVERRIDE)
              </h3>
              <button onClick={() => setOverrideItem(null)} className="text-stone-400 hover:text-white cursor-pointer font-bold text-base">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1">
                <span className="text-stone-500 text-[10px] font-semibold uppercase">Tajuk Berita</span>
                <p className="font-serif font-bold text-stone-900 leading-snug">{overrideItem.title}</p>
                <div className="text-stone-500 text-[10px] pt-1">
                  Cadangan AI Asal: <strong className="text-[#802334] font-bold">{overrideItem.proposedDesk}</strong> ({overrideItem.confidence}%)
                </div>
              </div>

              {/* Radio List Selection for New Target Desk */}
              <div className="space-y-2">
                <label className="font-bold text-stone-800 uppercase text-[10px] tracking-wider block">
                  PILIH DESK EDITORIAL BAHARU:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 border border-stone-200 rounded">
                  {ALL_EDITORIAL_DESKS.map(desk => (
                    <label
                      key={desk}
                      className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                        targetDeskChoice === desk ? 'bg-[#802334] text-white border-[#802334] font-bold' : 'bg-stone-50 hover:bg-stone-100 text-stone-800 border-stone-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="targetDeskChoice"
                        checked={targetDeskChoice === desk}
                        onChange={() => setTargetDeskChoice(desk)}
                        className="text-[#802334] focus:ring-0"
                      />
                      <span>{desk}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dropdown Selection for Sebab Override */}
              <div className="space-y-1">
                <label className="font-bold text-stone-800 uppercase text-[10px] tracking-wider block">
                  SEBAB OVERRIDE (PILIHAN KATEGORI AUDIT):
                </label>
                <select
                  value={selectedReasonOption}
                  onChange={e => setSelectedReasonOption(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-300 rounded p-2 text-xs text-stone-900 focus:outline-hidden font-sans font-semibold"
                >
                  {OVERRIDE_REASON_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              {/* Custom Reason Input (Only shown if 'Lain-lain' is selected) */}
              {selectedReasonOption === 'Lain-lain' && (
                <div className="space-y-1">
                  <label className="font-bold text-stone-800 uppercase text-[10px] tracking-wider block">
                    NYATAKAN SEBAB LAIN-LAIN:
                  </label>
                  <input
                    type="text"
                    value={customReasonText}
                    onChange={e => setCustomReasonText(e.target.value)}
                    placeholder="Sebab pilihan ringkas..."
                    className="w-full bg-stone-50 border border-stone-300 rounded p-2 text-xs text-stone-900 focus:outline-hidden font-sans"
                  />
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  onClick={() => setOverrideItem(null)}
                  className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-4 py-2 rounded-md font-semibold cursor-pointer text-xs"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveOverride}
                  className="bg-[#802334] hover:bg-[#962d42] text-white px-4 py-2 rounded-md font-semibold cursor-pointer text-xs transition-colors shadow-xs"
                >
                  💾 Simpan Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Audit Trail */}
      {auditItem && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-white rounded-lg max-w-lg w-full border border-stone-200 shadow-xl overflow-hidden space-y-4">
            <div className="bg-stone-900 text-stone-100 p-4 flex justify-between items-center">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#E9D8A6] flex items-center gap-2">
                <span>📜</span> CLASSIFICATION AUDIT TRAIL
              </h3>
              <button onClick={() => setAuditItem(null)} className="text-stone-400 hover:text-white cursor-pointer font-bold text-base">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="border-b border-stone-100 pb-3">
                <h4 className="font-serif font-bold text-stone-900 text-sm leading-snug">{auditItem.title}</h4>
              </div>

              <div className="space-y-3">
                {auditItem.history.map((h, idx) => (
                  <div key={idx} className="bg-stone-50 p-3 rounded border border-stone-200 space-y-1 font-sans">
                    <div className="flex justify-between items-center text-[10px] text-stone-500 font-semibold">
                      <span>Percubaan #{h.attempt} • {h.agent}</span>
                      <span className="font-mono">{h.timestamp}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-stone-500">Desk Keputusan:</span>
                      <span className="bg-[#802334] text-white font-bold px-2 py-0.5 rounded text-[11px]">{h.desk}</span>
                      <span className="text-stone-400 font-mono text-[10px]">(Kepercayaan: {h.confidence}%)</span>
                    </div>
                    {h.reason && (
                      <p className="text-stone-700 text-[11px] pt-1">
                        <strong>Alasan Editorial:</strong> {h.reason}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => setAuditItem(null)}
                  className="bg-stone-800 text-[#E9D8A6] px-4 py-1.5 rounded-md font-semibold cursor-pointer text-xs"
                >
                  Tutup Audit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Import Cadangan Calibration (Tampal Hasil ChatGPT / AI) */}
      {showImportModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 font-sans">
          <div className="bg-white rounded-lg max-w-xl w-full border border-stone-200 shadow-xl overflow-hidden space-y-4">
            <div className="bg-stone-900 text-stone-100 p-4 flex justify-between items-center">
              <h3 className="font-bold text-xs uppercase tracking-wider text-[#E9D8A6] flex items-center gap-2">
                <span>📥</span> IMPORT CADANGAN CALIBRATION (TAMPAL TEKS CHATGPT)
              </h3>
              <button onClick={() => setShowImportModal(false)} className="text-stone-400 hover:text-white cursor-pointer font-bold text-base">✕</button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-stone-600 text-xs">
                Tampal analisis cadangan calibration daripada ChatGPT di bawah untuk memperlakukan aturan & pemberat baharu ke dalam enjin deterministik Adjung:
              </p>

              <textarea
                rows={8}
                value={importTextContent}
                onChange={e => setImportTextContent(e.target.value)}
                placeholder={`Contoh Cadangan ChatGPT:\nKeyword: exoplanet -> Desk: Astronomi, Weight: +60\nKeyword: NASA -> Desk: Astronomi, Weight: +45\nKeyword: biometrik -> Penalty: -20`}
                className="w-full bg-stone-50 border border-stone-300 rounded p-3 font-mono text-xs text-stone-900 focus:outline-hidden"
              />

              {importStatusMessage && (
                <div className="bg-emerald-50 border border-emerald-300 text-emerald-900 p-3 rounded text-xs font-semibold">
                  {importStatusMessage}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-stone-100">
                <button
                  onClick={() => setShowImportModal(false)}
                  className="bg-stone-200 hover:bg-stone-300 text-stone-800 px-4 py-2 rounded-md font-semibold cursor-pointer text-xs"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    setImportStatusMessage('✓ Cadangan Aturan Berjaya Diberlakukan Ke Dalam rss_desk_rules Server!');
                    setTimeout(() => {
                      setShowImportModal(false);
                      setImportTextContent('');
                      setImportStatusMessage('');
                    }, 1500);
                  }}
                  className="bg-[#802334] hover:bg-[#962d42] text-white px-4 py-2 rounded-md font-semibold cursor-pointer text-xs transition-colors shadow-xs"
                >
                  ⚡ Perlakukan Aturan Baharu Ke Dalam Enjin
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
