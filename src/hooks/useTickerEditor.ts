import React, { useState, useEffect, useCallback } from 'react';
import { ceilingForSlot } from '../../core/editorial/GeometryConfig.js';

// Sama corak getLimitsForIndex() dalam useSlotEditor.ts — kekalkan override tersimpan (kalau
// ada), jatuh balik pada had lalai geometri slot -1 (Ticker/TICKER tier).
const getLimitsForIndex = (config?: any) => {
  const customTitle = config?.maxTitle;
  const customBrief = config?.maxBrief;
  const customBriefLong = config?.maxBriefLong;
  const defaults = ceilingForSlot(-1);
  return {
    maxTitle: (typeof customTitle === 'number' && customTitle > 0) ? customTitle : defaults.maxTitle,
    maxBrief: (typeof customBrief === 'number' && customBrief >= 0) ? customBrief : defaults.maxBrief,
    maxBriefLong: (typeof customBriefLong === 'number' && customBriefLong >= 0) ? customBriefLong : defaults.maxBriefLong,
  };
};

// Hook Editorium-native untuk Ticker (slot -1) — dibina 2026-08-02 (Fasa 7, item terakhir)
// mengikut corak `useSlotEditor.ts` yang sudah terbukti (Tulis Kandungan, slot 0-37 bukan Bar).
// SEBELUM ni Ticker satu-satunya slot yang masih guna sambungan URL "?openTicker=1" ke
// FrontpageView.tsx (modal render di sana, bukan native Editorium) — lihat nota panjang di
// FrontpageView.tsx ~baris 1746 dan EditoriumView.tsx ~baris 393 untuk sejarah penuh.
//
// Mandiri sepenuhnya daripada FrontpageView — ambil data sendiri terus daripada API, boleh
// dipanggil dalam EditoriumView tanpa navigasi rentas-laman. Slot -1 SAHAJA (bukan generik macam
// useSlotEditor) sebab bentuk borang Ticker (mod Manual/RSS Direct, enjin RSS) jauh berbeza
// daripada slot bento biasa.
export function useTickerEditor() {
  const [slotsConfig, setSlotsConfig] = useState<any[]>([]);
  const [formConfig, setFormConfig] = useState<any | null>(null);
  const [isSavingSlot, setIsSavingSlot] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Enjin RSS — state sokongan yang TickerManagementModal perlukan (dipindah terus daripada
  // FrontpageView.tsx, lihat loadRssSources/loadReviewQueue/loadRssStatus di sana).
  const [registeredRssSources, setRegisteredRssSources] = useState<any[]>([]);
  const [reviewQueue, setReviewQueue] = useState<any[]>([]);
  const [rssStatus, setRssStatus] = useState<any>({ activeSourcesCount: 0, totalFetchedCount: 0, autoLiveCount: 0, pendingReviewCount: 0, lastFetchedAt: '' });
  const [adjungDesks, setAdjungDesks] = useState<any[]>([]);

  const fetchSlotsConfig = useCallback(() => {
    return fetch('/api/system/slots')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setSlotsConfig(data); return data; })
      .catch((e) => { console.error('Failed to load slots config:', e); return null; });
  }, []);

  const loadAdjungDesks = useCallback(() => {
    fetch('/api/system/adjung-desks')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setAdjungDesks(data); })
      .catch((e) => console.error('Failed to load Adjung desks:', e));
  }, []);

  const loadRssSources = useCallback(() => {
    fetch('/api/system/rss-sources')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setRegisteredRssSources(data); })
      .catch((e) => console.error('Failed to load RSS sources:', e));
  }, []);

  const loadRssStatus = useCallback(() => {
    fetch('/api/system/ticker/status')
      .then((res) => res.json())
      .then((data) => { if (data && data.success) setRssStatus(data); })
      .catch((e) => console.error('Failed to load RSS status:', e));
  }, []);

  const loadReviewQueue = useCallback(() => {
    fetch('/api/system/ticker/review-queue')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setReviewQueue(data); })
      .catch((e) => console.error('Failed to load review queue:', e));
    loadRssStatus();
  }, [loadRssStatus]);

  const handleOverrideTickerDesk = useCallback(async (itemId: string, newDesk: string) => {
    try {
      const res = await fetch(`/api/system/ticker/override-desk/${itemId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newDesk }),
      });
      const data = await res.json();
      if (data.success) {
        loadReviewQueue();
      }
    } catch (e) {
      console.error('Failed to override ticker desk:', e);
    }
  }, [loadReviewQueue]);

  // Buka borang Ticker — sentiasa slotIndex -1. Sengaja tanpa sintesis kandungan demo, sama
  // falsafah macam openSlotEditor() dalam useSlotEditor.ts: Editorium alat pentadbiran, slot
  // kosong papar borang kosong sebenar.
  const openTickerEditor = useCallback(async () => {
    let segar: any = null;
    // Arahan am (masterPrompt) — medan GLOBAL (system_settings), sama pepijat/pembetulan macam
    // useSlotEditor.ts (Izzat, 2026-08-08): dikodkan keras '' sebelum ni, tab Arahan AI sentiasa
    // papar "Tiada arahan ditetapkan" walau Templat AI dah diisi.
    let masterPromptSegar = '';
    try {
      const [data, resSettings] = await Promise.all([
        fetchSlotsConfig(),
        fetch('/api/db-state'),
      ]);
      if (Array.isArray(data)) {
        segar = data.find((s: any) => s.slotIndex === -1) || null;
      }
      const dataSettings = await resSettings.json();
      masterPromptSegar = dataSettings?.systemSettings?.masterPrompt || '';
    } catch (e) {
      console.error('Failed to refresh ticker config before opening editor:', e);
    }
    const config = segar || slotsConfig.find((s) => s.slotIndex === -1);
    const limits = getLimitsForIndex(config);
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
      manualTitle: 'Berita Terkini',
      manualSummary: config?.manualSummary || '',
      manualSource: '',
      manualUrl: '',
      manualImageUrl: '',
      manualDesk: '',
      activeObjectId: '',
      searchStrategy: config?.searchStrategy || 'Structured Sources Only',
      carouselInterval: config?.carouselInterval || 10,
      carouselDelay: config?.carouselDelay || 0,
      generationLimit: config?.generationLimit || 10,
      maxTitle: limits.maxTitle,
      maxBrief: limits.maxBrief,
      maxBriefLong: limits.maxBriefLong,
      masterPrompt: masterPromptSegar,
      refreshHour: config?.refreshHour || '00:00',
      refreshDay: config?.refreshDay || 'Isnin',
      eventExpiryFilter: '',
      aiPromptTopic: config?.aiPromptTopic || '',
      aiPromptRecency: config?.aiPromptRecency || '1 minggu terkini',
      aiPromptLanguage: config?.aiPromptLanguage || 'Bahasa Melayu',
      aiPromptRegion: config?.aiPromptRegion || 'Global, Malaysia',
      aiPromptSource: config?.aiPromptSource || '',
    });
    loadRssSources();
    loadReviewQueue();
    loadRssStatus();
    loadAdjungDesks();
  }, [fetchSlotsConfig, slotsConfig, loadRssSources, loadReviewQueue, loadRssStatus, loadAdjungDesks]);

  const closeTickerEditor = useCallback(() => {
    setFormConfig(null);
    setSaveError('');
  }, []);

  const handleSaveSlot = useCallback(async (e: React.FormEvent, manualSummaryOverride?: string) => {
    e.preventDefault();
    if (!formConfig) return;
    setIsSavingSlot(true);
    setSaveError('');
    const finalFormConfig = { ...formConfig };
    if (typeof manualSummaryOverride === 'string') {
      finalFormConfig.manualSummary = manualSummaryOverride;
    }
    try {
      const response = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(finalFormConfig),
      });
      const data = await response.json();
      if (data.success) {
        fetchSlotsConfig();
        closeTickerEditor();
      } else {
        setSaveError(data.error || 'Gagal menyimpan slot.');
      }
    } catch (err: any) {
      setSaveError('Ralat menyimpan slot: ' + (err.message || ''));
    } finally {
      setIsSavingSlot(false);
    }
  }, [formConfig, fetchSlotsConfig, closeTickerEditor]);

  return {
    slotsConfig, formConfig, setFormConfig,
    isSavingSlot, saveError,
    registeredRssSources, loadRssSources,
    reviewQueue, loadReviewQueue,
    rssStatus, adjungDesks,
    handleOverrideTickerDesk,
    openTickerEditor, closeTickerEditor, handleSaveSlot,
  };
}
