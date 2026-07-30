import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, RefreshCw, Plus, Trash2, Check, AlertTriangle, ShieldCheck, Zap, Save, Settings, ChevronDown, ChevronUp, Tag, Ban } from 'lucide-react';
import { SystemSettings } from '../../types';
import { Tooltip } from '../common/Tooltip';

interface TickerManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  formConfig: any;
  setFormConfig: React.Dispatch<React.SetStateAction<any>>;
  slotsConfig: any[];
  handleSaveSlot: (e: React.FormEvent) => Promise<void>;
  registeredRssSources: any[];
  loadRssSources: () => void;
  reviewQueue: any[];
  loadReviewQueue: () => void;
  rssStatus: any;
  adjungDesks: any[];
  addToast: (type: 'success' | 'error' | 'info', msg: string) => void;
  validateContentBudget: (slotIdx: number, title: string, brief: string) => { isValid: boolean; reason?: string };
  handleOverrideTickerDesk: (itemId: string, newDesk: string) => Promise<void>;
}

export const TickerManagementModal: React.FC<TickerManagementModalProps> = React.memo(({
  isOpen,
  onClose,
  formConfig,
  setFormConfig,
  slotsConfig,
  handleSaveSlot,
  registeredRssSources,
  loadRssSources,
  reviewQueue,
  loadReviewQueue,
  rssStatus,
  adjungDesks,
  addToast,
  validateContentBudget,
  handleOverrideTickerDesk
}) => {
  if (!isOpen || !formConfig) return null;

  // Local Form States
  const [newRssName, setNewRssName] = useState('');
  const [newRssUrl, setNewRssUrl] = useState('');
  const [newRssTrust, setNewRssTrust] = useState(90);
  const [newRssCategory, setNewRssCategory] = useState('SEMASA');

  const [rssAutoLiveThreshold, setRssAutoLiveThreshold] = useState<number>(80);
  const [rssReviewThreshold, setRssReviewThreshold] = useState<number>(60);
  const [rssPriorityKeywords, setRssPriorityKeywords] = useState<string>('');
  const [rssBlockedKeywords, setRssBlockedKeywords] = useState<string>('');
  const [rssPriorityBonus, setRssPriorityBonus] = useState<number>(10);
  const [rssBlockedPenalty, setRssBlockedPenalty] = useState<number>(20);
  const [rssMaxNewsAgeHours, setRssMaxNewsAgeHours] = useState<number>(48);
  const [tickerMaxItems, setTickerMaxItems] = useState<number>(20);

  const [openScoreAccordionId, setOpenScoreAccordionId] = useState<string | null>(null);

  // Individual Loading States
  const [isFetchingRss, setIsFetchingRss] = useState(false);
  const [isAddingRss, setIsAddingRss] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});

  const [blockedCategories, setBlockedCategories] = useState<{ id: string; categoryName: string }[]>([]);
  const [newBlockedCatInput, setNewBlockedCatInput] = useState<string>('');

  const loadBlockedCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/system/rss-blocked-categories');
      const data = await res.json();
      if (Array.isArray(data)) setBlockedCategories(data);
    } catch (e) {}
  }, []);

  const handleAddBlockedCategory = async (catName: string) => {
    const trimmed = (catName || '').trim();
    if (!trimmed) return;
    try {
      const res = await fetch('/api/system/rss-blocked-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryName: trimmed })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Tag Kategori XML '${trimmed}' berjaya disekat!`);
        setNewBlockedCatInput('');
        loadBlockedCategories();
        loadReviewQueue();
      } else {
        addToast('error', data.error || 'Gagal menyekat tag kategori.');
      }
    } catch (e) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    }
  };

  const handleDeleteBlockedCategory = async (id: string, name: string) => {
    try {
      const res = await fetch(`/api/system/rss-blocked-categories/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('info', `Tag Kategori XML '${name}' dibuang daripada senarai sekat.`);
        loadBlockedCategories();
      }
    } catch (e) {}
  };

  // 1. Fetch Editorial Settings on Mount
  useEffect(() => {
    fetch('/api/system/rss-settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          if (data.autoLiveThreshold) setRssAutoLiveThreshold(data.autoLiveThreshold);
          if (data.reviewThreshold) setRssReviewThreshold(data.reviewThreshold);
          if (data.priorityKeywords !== undefined) setRssPriorityKeywords(data.priorityKeywords);
          if (data.blockedKeywords !== undefined) setRssBlockedKeywords(data.blockedKeywords);
          if (data.priorityBonus) setRssPriorityBonus(data.priorityBonus);
          if (data.blockedPenalty) setRssBlockedPenalty(data.blockedPenalty);
          if (data.maxNewsAgeHours !== undefined) setRssMaxNewsAgeHours(data.maxNewsAgeHours);
          if (data.tickerMaxItems !== undefined) setTickerMaxItems(data.tickerMaxItems);
        }
      })
      .catch(() => {});
    loadBlockedCategories();
  }, [loadBlockedCategories]);

  // 2. Memoized Manual Block Status List
  const manualBlocks = useMemo(() => {
    return (formConfig.manualSummary || '').split('____').filter((b: string) => b.trim().length > 0);
  }, [formConfig.manualSummary]);

  const blockStatusList = useMemo(() => {
    if (formConfig.contentMode !== 'Manual' || manualBlocks.length === 0) return [];
    
    return manualBlocks.map((block: string, bIdx: number) => {
      const titleMatch = block.match(/Tajuk:\s*(?:\([^)]*\))?\s*([^\n]+)/i);
      const briefMatch = block.match(/Huraian ringkas:\s*(?:\([^)]*\))?\s*([^\n]+)/i);
      const title = titleMatch ? titleMatch[1].trim() : '';
      const brief = briefMatch ? briefMatch[1].trim() : '';
      
      const check = (title || brief) 
        ? validateContentBudget(-1, title, brief) 
        : { isValid: true };

      return {
        index: bIdx + 1,
        isValid: check.isValid,
        reason: check.reason,
        titleSnippet: title ? (title.length > 25 ? title.substring(0, 25) + '...' : title) : `Artikel #${bIdx + 1}`
      };
    });
  }, [formConfig.contentMode, manualBlocks, validateContentBudget]);

  const passedCount = useMemo(() => blockStatusList.filter(b => b.isValid).length, [blockStatusList]);
  const failedCount = useMemo(() => blockStatusList.filter(b => !b.isValid).length, [blockStatusList]);

  // Memoized Live Slot Mode
  const liveSlotConfig = useMemo(() => slotsConfig.find((s) => s.slotIndex === -1), [slotsConfig]);
  const liveMode = useMemo(() => liveSlotConfig ? (liveSlotConfig.contentMode || 'Manual') : 'Manual', [liveSlotConfig]);

  // 3. Scroll Helper
  const scrollToBlockInTextarea = (blockIndex: number) => {
    const textarea = document.getElementById('manualSummaryTextareaModal') as HTMLTextAreaElement;
    if (!textarea) return;
    const text = textarea.value;
    const blocks = text.split('____');
    let charPos = 0;
    for (let i = 0; i < Math.min(blockIndex - 1, blocks.length); i++) {
      charPos += blocks[i].length + 4;
    }
    textarea.focus();
    textarea.setSelectionRange(charPos, charPos + (blocks[blockIndex - 1] || '').length);
    const lineHeight = 18;
    const linesBefore = text.substring(0, charPos).split('\n').length;
    textarea.scrollTop = Math.max(0, (linesBefore - 2) * lineHeight);
  };

  // 4. Action Handlers with Spinners
  const handleFetchDirectRss = async () => {
    setIsFetchingRss(true);
    try {
      const res = await fetch('/api/system/ticker/fetch-direct', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Suapan RSS berjaya diserap! (${data.autoLiveCount} Auto Aktif, ${data.pendingReviewCount} Menunggu Semakan)`);
        loadReviewQueue();
      } else {
        addToast('error', data.error || 'Gagal menyerap RSS Direct.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan RSS Direct.');
    } finally {
      setIsFetchingRss(false);
    }
  };

  const handleAddRssSource = async () => {
    if (!newRssName.trim() || !newRssUrl.trim()) {
      addToast('error', 'Sila isi Nama Sumber dan URL RSS!');
      return;
    }
    setIsAddingRss(true);
    try {
      const res = await fetch('/api/system/rss-sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceName: newRssName,
          rssUrl: newRssUrl,
          language: 'ms-MY',
          trustScore: Number(newRssTrust) || 90,
          categoryMapping: newRssCategory,
          enabled: 1
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', `Sumber RSS '${newRssName}' berjaya didaftarkan!`);
        setNewRssName('');
        setNewRssUrl('');
        loadRssSources();
      } else {
        addToast('error', data.error || 'Gagal mendaftar sumber RSS.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan RSS.');
    } finally {
      setIsAddingRss(false);
    }
  };

  const handleDeleteRssSource = async (sourceId: string, sourceName: string) => {
    try {
      const res = await fetch(`/api/system/rss-sources/${sourceId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast('info', `Sumber RSS '${sourceName}' telah dibuang.`);
        loadRssSources();
      } else {
        addToast('error', data.error || 'Gagal membuang sumber RSS.');
      }
    } catch (err) {
      addToast('error', 'Gagal membuang sumber RSS.');
    }
  };

  const handleSaveRssEditorialSettings = async () => {
    setIsSavingSettings(true);
    try {
      const res = await fetch('/api/system/rss-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          autoLiveThreshold: rssAutoLiveThreshold,
          reviewThreshold: rssReviewThreshold,
          priorityKeywords: rssPriorityKeywords,
          blockedKeywords: rssBlockedKeywords,
          priorityBonus: rssPriorityBonus,
          blockedPenalty: rssBlockedPenalty,
          maxNewsAgeHours: rssMaxNewsAgeHours,
          tickerMaxItems: tickerMaxItems
        })
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'Tetapan & Peraturan Editorial RSS berjaya disimpan!');
      } else {
        addToast('error', data.error || 'Gagal menyimpan tetapan.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleReviewAction = async (itemId: string, action: 'approve' | 'reject') => {
    setActionLoadingMap(prev => ({ ...prev, [itemId]: true }));
    try {
      const res = await fetch('/api/system/ticker/review-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, action })
      });
      const data = await res.json();
      if (data.success) {
        addToast(action === 'approve' ? 'success' : 'info', action === 'approve' ? 'Artikel diluluskan ke Ticker!' : 'Artikel ditolak.');
        loadReviewQueue();
      } else {
        addToast('error', data.error || 'Gagal memproses keputusan.');
      }
    } catch (err) {
      addToast('error', 'Gagal menyambung ke pelayan.');
    } finally {
      setActionLoadingMap(prev => ({ ...prev, [itemId]: false }));
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div 
        className="relative max-w-2xl w-full bg-white rounded-lg shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in"
        style={{ contain: 'paint' }}
      >
        {/* Header - Adjung Maroon Brand */}
        <header className="px-6 py-4 border-b border-stone-200 flex justify-between items-center bg-[#FAF7F0] shrink-0">
          <div>
            <h3 className="font-serif text-sm md:text-base font-bold text-[#802334] uppercase tracking-wide flex items-center gap-2">
              <Settings size={16} className="text-[#802334]" />
              Urus Ticker: Berita Terkini
            </h3>
            <p className="text-[10px] text-stone-500 font-sans mt-0.5 font-bold uppercase tracking-wider">
              Konfigurasi Enjin RSS, Kawalan Editorial, & Kelulusan Berita
            </p>
          </div>
          <Tooltip text="Tutup Panel">
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-stone-400 hover:text-[#802334] transition cursor-pointer rounded-full hover:bg-stone-200/60"
            >
              <X size={20} />
            </button>
          </Tooltip>
        </header>

        {/* Scrollable Body Container with contain: paint */}
        <div className="overflow-y-auto p-6 space-y-6 flex-1 text-xs font-sans overscroll-contain">
          
          {/* Mod Live Status & Compliance Bar */}
          <div className="bg-[#F9F8F6] p-3.5 rounded-md border border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs select-none">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-[9px] uppercase tracking-widest text-stone-500 font-extrabold">
                MOD LIVE:
              </span>
              <span className="px-2.5 py-0.5 rounded text-[9px] font-mono font-extrabold uppercase tracking-widest bg-[#802334] text-white border border-[#601824]">
                {(liveMode || 'Manual').toUpperCase()}
              </span>

              <span className="text-stone-300 mx-1">•</span>

              <span className="font-mono text-[9px] uppercase tracking-widest text-stone-500 font-extrabold">
                BORANG:
              </span>
              <span className="px-2.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest bg-stone-100 text-stone-700 border border-stone-300">
                {(formConfig.contentMode || 'Manual').toUpperCase()}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {failedCount > 0 ? (
                <span className="px-2.5 py-0.5 rounded text-[9px] font-mono font-bold bg-[#802334]/10 text-[#802334] border border-[#802334]/30 uppercase tracking-wider animate-pulse flex items-center gap-1">
                  <AlertTriangle size={11} /> {failedCount} GAGAL HAD AKSARA
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 uppercase tracking-wider flex items-center gap-1">
                  <ShieldCheck size={11} /> 100% MEMATUHI HAD
                </span>
              )}
            </div>
          </div>

          {/* Interactive Numbered Content Chips */}
          {formConfig.contentMode === 'Manual' && blockStatusList.length > 0 && (
            <div className="bg-[#F9F8F6] p-3.5 rounded-md border border-stone-200 space-y-2 select-none">
              <div className="flex justify-between items-center text-[9px] font-mono font-extrabold uppercase text-stone-500 tracking-widest">
                <span>PILIH MUKA KANDUNGAN (KLIK NOMBOR UNTUK SUNTING):</span>
                <span>{passedCount}/{blockStatusList.length} LULUS</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {blockStatusList.map((item) => (
                  <Tooltip key={item.index} text={item.reason || `${item.titleSnippet} - Mematuhi Had Aksara`}>
                    <button
                      type="button"
                      onClick={() => scrollToBlockInTextarea(item.index)}
                      className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer border ${
                        item.isValid
                          ? 'bg-white hover:bg-stone-100 text-stone-800 border-stone-300 hover:border-[#802334]/50'
                          : 'bg-[#802334]/10 hover:bg-[#802334]/20 text-[#802334] border-[#802334]/40 animate-pulse'
                      }`}
                    >
                      <span className="font-extrabold">#{item.index}</span>
                      <span>{item.isValid ? <Check className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}</span>
                      <span className="font-sans text-[9px] font-medium truncate max-w-[120px]">{item.titleSnippet}</span>
                    </button>
                  </Tooltip>
                ))}
              </div>
            </div>
          )}

          {/* Main Form */}
          <form onSubmit={handleSaveSlot} className="space-y-5">
            {/* Mod Kandungan Select */}
            <div className="flex flex-col gap-1.5">
              <label className="font-mono text-[9px] uppercase tracking-wider text-stone-600 font-bold">Mod Kandungan Ticker</label>
              <select
                value={formConfig.contentMode}
                onChange={(e) => setFormConfig({ ...formConfig, contentMode: e.target.value })}
                className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
              >
                <option value="Manual">Manual</option>
                <option value="RSS Direct">Suapan RSS</option>
              </select>
            </div>

            {/* RSS DIRECT SECTION */}
            {formConfig.contentMode === 'RSS Direct' && (
              <div className="space-y-5 pt-3 border-t border-stone-200">
                {/* RSS Engine Overview */}
                <div className="bg-[#F9F8F6] p-4 rounded-md border border-stone-200 space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h4 className="font-mono text-xs font-bold uppercase text-[#802334] tracking-wider flex items-center gap-1.5">
                        <Zap size={14} className="text-[#802334]" />
                        ENJIN PENYERAPAN RSS DIRECT (TANPA API AI)
                      </h4>
                      <p className="font-sans text-[10px] text-stone-500 mt-0.5">
                        Menyerap terus berita RSS/Atom Feed, menapis bahasa ms-MY, dan mengira skor wajaran editorial.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleFetchDirectRss}
                      disabled={isFetchingRss}
                      className="px-4 py-2 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-mono font-bold uppercase tracking-wider transition cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <RefreshCw size={12} className={isFetchingRss ? "animate-spin" : ""} />
                      {isFetchingRss ? 'Menyerap RSS...' : 'Serap RSS Sekarang'}
                    </button>
                  </div>

                  {/* Status Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 text-center select-none font-mono">
                    <div className="bg-white p-2.5 rounded border border-stone-200">
                      <div className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Sumber Aktif</div>
                      <div className="text-sm font-bold text-stone-800">{registeredRssSources.filter(s => s.enabled).length || 1}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-stone-200">
                      <div className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Item Ditemui</div>
                      <div className="text-sm font-bold text-stone-800">{rssStatus.totalFetchedCount || 0}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-stone-200">
                      <div className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Auto Aktif</div>
                      <div className="text-sm font-bold text-emerald-700">{rssStatus.autoLiveCount || 0}</div>
                    </div>
                    <div className="bg-white p-2.5 rounded border border-stone-200">
                      <div className="text-[9px] uppercase tracking-widest text-stone-400 font-bold">Menunggu Review</div>
                      <div className="text-sm font-bold text-amber-700">{rssStatus.pendingReviewCount || reviewQueue.length}</div>
                    </div>
                  </div>
                </div>

                {/* Add RSS Source Form */}
                <div className="bg-white p-4 rounded-md border border-stone-200 space-y-3">
                  <h5 className="font-mono text-xs font-bold uppercase text-[#802334] tracking-wider flex items-center gap-1.5">
                    <Plus size={13} />
                    DAFTAR PAUTAN RSS FEED BAHARU
                  </h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Nama Sumber (Agensi / Portal)</label>
                      <input
                        type="text"
                        placeholder="cth: Bernama / Utusan Malaysia"
                        value={newRssName}
                        onChange={(e) => setNewRssName(e.target.value)}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334] font-sans text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Pautan URL RSS / Atom Feed</label>
                      <input
                        type="url"
                        placeholder="https://www.bernama.com/bm/rss/news.php"
                        value={newRssUrl}
                        onChange={(e) => setNewRssUrl(e.target.value)}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334] font-mono text-xs"
                      />
                    </div>

                    <div className="flex flex-col gap-1 md:col-span-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Trust Score (0 - 100)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={newRssTrust}
                        onChange={(e) => setNewRssTrust(Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334] font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleAddRssSource}
                      disabled={isAddingRss}
                      className="px-4 py-2 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-mono font-bold uppercase tracking-wider cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isAddingRss ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
                      {isAddingRss ? 'Menyimpan...' : 'Simpan & Daftarkan Pautan RSS'}
                    </button>
                  </div>

                  {/* Registered RSS List */}
                  {registeredRssSources.length > 0 && (
                    <div className="pt-3 border-t border-stone-150 space-y-2">
                      <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold block">
                        Senarai Sumber RSS Berdaftar ({registeredRssSources.length} Sumber):
                      </label>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {registeredRssSources.map((src) => (
                          <div key={src.id} className="p-2.5 bg-stone-50 rounded border border-stone-200 flex justify-between items-center text-xs font-mono gap-2">
                            <div className="min-w-0 flex-1 truncate">
                              <span className="font-bold text-stone-800">{src.sourceName}</span>
                              <span className="text-[10px] text-stone-500 ml-2">Trust: {src.trustScore}/100</span>
                              <div className="text-[10px] text-stone-400 truncate">{src.rssUrl}</div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[9px] font-bold uppercase">
                                Aktif
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteRssSource(src.id, src.sourceName)}
                                className="px-2 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded text-[9px] font-bold uppercase cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 size={10} /> Buang
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Dynamic Editorial Settings */}
                  <div className="pt-3 border-t border-stone-200 space-y-3">
                    <h5 className="font-mono text-xs font-bold uppercase text-[#802334] tracking-wider flex items-center gap-1.5">
                      <Settings size={13} /> TETAPAN & PERATURAN EDITORIAL RSS
                    </h5>
                    <p className="font-sans text-[11px] text-stone-500 leading-normal">
                      Laras ambang skor automatik, senarai kata kunci keutamaan, dan kata kunci yang disekat mengikut kriteria meja editorial anda.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase tracking-wider text-stone-600 font-bold">Ambang Skor Auto Aktif (Min. Skor)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={rssAutoLiveThreshold}
                          onChange={(e) => setRssAutoLiveThreshold(Number(e.target.value))}
                          className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334]"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] uppercase tracking-wider text-stone-600 font-bold">Ambang Skor Review Queue (Min. Skor)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={rssReviewThreshold}
                          onChange={(e) => setRssReviewThreshold(Number(e.target.value))}
                          className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334]"
                        />
                      </div>

                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">Had Maksimum Berita Live (Ranking Skor Tertinggi)</label>
                        <select
                          value={tickerMaxItems}
                          onChange={(e) => setTickerMaxItems(Number(e.target.value))}
                          className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                        >
                          <option value={10}>10 Berita Teratas</option>
                          <option value={20}>20 Berita Teratas</option>
                          <option value={30}>30 Berita Teratas</option>
                          <option value={50}>50 Berita Teratas</option>
                          <option value={100}>100 Berita Teratas</option>
                        </select>
                        <span className="text-[9px] text-stone-400 font-sans">
                          Hanya berita yang mendapat ranking markah skor tertinggi disiarkan secara terus ke Ticker Laman Utama.
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[9px] uppercase tracking-wider text-[#802334] font-bold">Had Usia Berita</label>
                        <select
                          value={rssMaxNewsAgeHours}
                          onChange={(e) => setRssMaxNewsAgeHours(Number(e.target.value))}
                          className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334] bg-white font-sans text-xs font-semibold"
                        >
                          <option value={24}>24 Jam Terakhir (Berita Hari Ini)</option>
                          <option value={48}>48 Jam Terakhir (2 Hari)</option>
                          <option value={72}>72 Jam Terakhir (3 Hari)</option>
                          <option value={168}>7 Hari Terakhir (Seminggu)</option>
                          <option value={0}>Tiada Had (Semua Usia Berita)</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[9px] uppercase tracking-wider text-stone-600 font-bold">Kata Kunci Keutamaan (+Bonus Skor)</label>
                        <input
                          type="text"
                          placeholder="dasar, belanjawan, ekonomi, pendidikan, menteri, kerajaan"
                          value={rssPriorityKeywords}
                          onChange={(e) => setRssPriorityKeywords(e.target.value)}
                          className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334]"
                        />
                      </div>

                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-[9px] uppercase tracking-wider text-stone-600 font-bold">Kata Kunci Diharamkan / Sensasi (-Penalti Skor)</label>
                        <input
                          type="text"
                          placeholder="gempar, viral, panas, terbongkar"
                          value={rssBlockedKeywords}
                          onChange={(e) => setRssBlockedKeywords(e.target.value)}
                          className="px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334]"
                        />
                      </div>
                    </div>

                    {/* Kawalan Kategori XML RSS Tersekat (RSS Tag Filtering Engine) */}
                    <div className="pt-3 border-t border-stone-200 space-y-3">
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div>
                          <h6 className="font-mono text-xs font-bold uppercase text-[#802334] tracking-wider flex items-center gap-1.5">
                            <Tag size={13} /> KAWALAN KATEGORI XML RSS TERSEKAT ({blockedCategories.length} TAG TERSEKAT)
                          </h6>
                          <p className="font-sans text-[10px] text-stone-500 mt-0.5">
                            Menyaring & menyekat berita mengikut tag kategori mentah daripada sumber RSS (cth: Hiburan, Sukan, Gosip).
                          </p>
                        </div>
                      </div>

                      {/* Borang Tambah Tag Tersekat */}
                      <div className="flex gap-2 items-center bg-[#F9F8F6] p-2.5 rounded border border-stone-200">
                        <input
                          type="text"
                          placeholder="cth: Hiburan / Sukan / Gosip / Keningau"
                          value={newBlockedCatInput}
                          onChange={(e) => setNewBlockedCatInput(e.target.value)}
                          className="flex-1 px-3 py-1.5 border border-stone-300 rounded focus:outline-none focus:border-[#802334] font-mono text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddBlockedCategory(newBlockedCatInput)}
                          className="px-3 py-1.5 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-mono font-bold uppercase tracking-wider cursor-pointer shadow-xs whitespace-nowrap"
                        >
                          + Sekat Tag Ini
                        </button>
                      </div>

                      {/* Senarai Tag Tersekat */}
                      {blockedCategories.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 p-2.5 bg-stone-50 rounded border border-stone-200 max-h-36 overflow-y-auto">
                          {blockedCategories.map((cat) => (
                            <span
                              key={cat.id}
                              className="px-2 py-1 bg-white border border-stone-300 text-stone-800 rounded font-mono text-[10px] font-bold flex items-center gap-1.5 shadow-2xs"
                            >
                              <span className="text-[#802334] flex items-center gap-1">
                                <Tag className="w-3 h-3" /> {cat.categoryName}
                              </span>
                              <Tooltip text="Buka Sekatan Tag Ini">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBlockedCategory(cat.id, cat.categoryName)}
                                  className="text-stone-400 hover:text-rose-700 cursor-pointer font-bold ml-1"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </Tooltip>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="p-2 text-center text-stone-400 font-mono text-[10px]">
                          Tiada tag kategori XML RSS yang disekat secara aktif.
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end pt-1">
                      <button
                        type="button"
                        onClick={handleSaveRssEditorialSettings}
                        disabled={isSavingSettings}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-mono font-bold uppercase tracking-wider cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1.5"
                      >
                        {isSavingSettings ? <RefreshCw size={12} className="animate-spin" /> : <Save size={12} />}
                        {isSavingSettings ? 'Menyimpan...' : 'Simpan Tetapan Editorial Dinamik'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Review Queue List */}
                <div className="bg-white p-4 rounded-md border border-stone-200 space-y-3">
                  <div className="flex justify-between items-center flex-wrap gap-2">
                    <h5 className="font-mono text-xs font-bold uppercase text-stone-700 tracking-wider">
                      EDITOR REVIEW QUEUE (SKOR 60 - 89)
                    </h5>
                    <button
                      type="button"
                      onClick={loadReviewQueue}
                      className="text-[10px] font-mono uppercase text-[#802334] hover:underline cursor-pointer flex items-center gap-1"
                    >
                      <RefreshCw size={10} /> Muat Semula Queue
                    </button>
                  </div>

                  {reviewQueue.length > 0 ? (
                    <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                      {reviewQueue.map((item) => {
                        let bd: any = null;
                        try {
                          bd = typeof item.scoreBreakdown === 'string' ? JSON.parse(item.scoreBreakdown) : item.scoreBreakdown;
                        } catch (e) {
                          bd = null;
                        }
                        const isExpanded = openScoreAccordionId === item.id;
                        const isLoading = actionLoadingMap[item.id] || false;
                        const rawTag = item.rawCategory || item.category || 'TIADA TAG';

                        return (
                          <div key={item.id} className="p-3 bg-[#F9F8F6] rounded border border-stone-200 space-y-2">
                            <div className="flex flex-col sm:flex-row justify-between items-start gap-3">
                              <div className="space-y-1 min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-[9px] font-bold uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
                                    Skor {item.score}/100 ({item.decision || 'EDITOR_REVIEW'})
                                  </span>
                                  <span className="font-mono text-[9px] text-stone-500 font-bold uppercase">
                                    {item.source}
                                  </span>
                                  <span className="font-mono text-[9px] font-bold uppercase text-[#802334] bg-white px-2 py-0.5 rounded border border-stone-200">
                                    DESK: BERITA SEMASA
                                  </span>

                                  {/* TAG ASAL RSS XML BADGE */}
                                  <span className="font-mono text-[9px] font-bold uppercase text-stone-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                    TAG ASAL: {rawTag}
                                  </span>

                                  {/* Quick Block Tag Button */}
                                  {rawTag && rawTag !== 'TIADA TAG' && rawTag !== 'SEMASA' && (
                                    <Tooltip text={`Sekat semua berita dengan tag '${rawTag}'`}>
                                      <button
                                        type="button"
                                        onClick={() => handleAddBlockedCategory(rawTag)}
                                        className="font-mono text-[8px] font-bold uppercase px-1.5 py-0.5 bg-rose-100 hover:bg-rose-200 text-rose-800 rounded transition cursor-pointer flex items-center gap-1 border border-rose-300"
                                      >
                                        <Ban className="w-3 h-3" /> Sekat Tag '{rawTag}'
                                      </button>
                                    </Tooltip>
                                  )}
                                </div>
                                <h6 className="font-serif text-xs font-bold text-stone-900 leading-snug">
                                  {item.title}
                                </h6>
                                {item.formattedBrief && (
                                  <p className="font-sans text-[11px] text-stone-600 leading-relaxed bg-white p-2 rounded border border-stone-150">
                                    {item.formattedBrief}
                                  </p>
                                )}
                              </div>

                              <div className="flex flex-wrap sm:flex-col items-end gap-1.5 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-200">
                                <div className="flex items-center gap-1 flex-wrap">
                                  <a
                                    href={item.originalUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 text-[9px] font-mono uppercase bg-stone-100 hover:bg-stone-200 text-stone-700 rounded border border-stone-300 whitespace-nowrap"
                                  >
                                    Buka Pautan
                                  </a>
                                  <button
                                    type="button"
                                    onClick={() => handleReviewAction(item.id, 'approve')}
                                    disabled={isLoading}
                                    className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <Check size={11} /> Lulus
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleReviewAction(item.id, 'reject')}
                                    disabled={isLoading}
                                    className="px-2.5 py-1 text-[9px] font-mono font-bold uppercase bg-rose-600 hover:bg-rose-700 text-white rounded cursor-pointer shadow-xs disabled:opacity-50 flex items-center gap-1"
                                  >
                                    <X size={11} /> Tolak
                                  </button>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setOpenScoreAccordionId(isExpanded ? null : item.id)}
                                  className="text-[9px] font-mono uppercase text-[#802334] hover:underline cursor-pointer flex items-center gap-1 mt-1"
                                >
                                  {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                                  {isExpanded ? 'Sembunyi Skor' : 'Lihat Skor'}
                                </button>
                              </div>
                            </div>

                            {/* Accordion Breakdown */}
                            {isExpanded && bd && (
                              <div className="pt-2 border-t border-stone-200 grid grid-cols-2 md:grid-cols-5 gap-1.5 font-mono text-[9px] bg-white p-2.5 rounded">
                                <div>
                                  <span className="text-stone-400 block uppercase">Kepercayaan Sumber</span>
                                  <span className="font-bold text-stone-800">+{bd.sourceTrust || 80}</span>
                                </div>
                                <div>
                                  <span className="text-stone-400 block uppercase">Padanan Bahasa</span>
                                  <span className="font-bold text-emerald-700">+{bd.languageMatch || 10}</span>
                                </div>
                                <div>
                                  <span className="text-stone-400 block uppercase">Padanan Kategori</span>
                                  <span className="font-bold text-emerald-700">+{bd.categoryMatch || 0}</span>
                                </div>
                                <div>
                                  <span className="text-stone-400 block uppercase">Kesan Kata Kunci</span>
                                  <span className={`font-bold ${bd.keywordImpact < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                                    {bd.keywordImpact >= 0 ? `+${bd.keywordImpact}` : bd.keywordImpact}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-stone-400 block uppercase">Jumlah Skor</span>
                                  <span className="font-bold text-[#802334]">{bd.totalScore || item.score}/100</span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-stone-400 font-sans text-xs select-none">
                      Tiada artikel dalam Giliran Semakan.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* MANUAL MODE SECTION */}
            {formConfig.contentMode === 'Manual' && (
              <div className="space-y-4 pt-3 border-t border-stone-200">
                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[9px] uppercase tracking-wider text-stone-600 font-bold">
                    Kandungan Manual Ticker (Gunakan ____ untuk memisahkan item):
                  </label>
                  <textarea
                    id="manualSummaryTextareaModal"
                    rows={8}
                    value={formConfig.manualSummary || ''}
                    onChange={(e) => setFormConfig({ ...formConfig, manualSummary: e.target.value })}
                    className="w-full p-3 border border-stone-300 rounded font-mono text-xs focus:outline-none focus:border-[#802334] bg-white leading-relaxed"
                    placeholder={`Desk: SEMASA\nTajuk: GAPENA Abadikan Tarikh Kelahiran Usman Awang Sebagai Hari Puisi\nHuraian ringkas: Gabungan Persatuan Penulis Nasional Malaysia meluluskan resolusi rasmi.\nSource: Utusan Malaysia\nUrl: https://www.utusan.com.my/berita/1`}
                  />
                </div>
              </div>
            )}

            {/* Modal Actions Footer */}
            <div className="flex justify-end gap-3 pt-4 border-t border-stone-200 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-stone-300 text-stone-700 rounded text-xs font-mono font-bold uppercase tracking-wider hover:bg-stone-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-mono font-bold uppercase tracking-wider shadow-sm cursor-pointer flex items-center gap-1.5"
              >
                <Save size={13} /> Simpan Kandungan Ticker
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
});
