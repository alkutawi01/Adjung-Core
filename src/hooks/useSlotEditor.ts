import React, { useState, useEffect, useCallback } from 'react';
import { ceilingForSlot } from '../../core/editorial/GeometryConfig.js';

// Sistem tulis-kandungan Editorium (2026-07-29, permintaan pemilik projek) — MANDIRI sepenuhnya
// daripada FrontpageView.tsx. Editorium dan Frontpage kini dipisah 100%: hook ni ambil datanya
// sendiri terus daripada API (bukan pinjam state FrontpageView), jadi ia boleh dipanggil dalam
// mana-mana komponen (EditoriumView) tanpa navigasi/parameter URL merentas laman. Frontpage
// TIDAK menggunakan hook ni langsung lagi — tiada titik masuk edit pun tinggal di sana.
//
// Sengaja LEBIH RINGKAS daripada handleCardClick/handleSaveSlot asal FrontpageView.tsx:
// sintesis kandungan demo ("Tentang Adjung") dibuang terus — tu wujud dulu untuk pengalaman
// klik-kad-inline di frontpage (borang jangan kosong menakutkan), tapi Editorium ialah alat
// pentadbiran; slot kosong cuma tunjuk borang kosong sebenar, tiada teks contoh diperlukan.
const getLimitsForIndex = (idx: number, config?: any) => {
  const customTitle = config?.maxTitle;
  const customBrief = config?.maxBrief;
  const customBriefLong = config?.maxBriefLong;
  const defaults = ceilingForSlot(idx);
  return {
    maxTitle: (typeof customTitle === 'number' && customTitle > 0) ? customTitle : defaults.maxTitle,
    maxBrief: (typeof customBrief === 'number' && customBrief >= 0) ? customBrief : defaults.maxBrief,
    maxBriefLong: (typeof customBriefLong === 'number' && customBriefLong >= 0) ? customBriefLong : defaults.maxBriefLong,
  };
};

// editorName (2026-07-29, permintaan pemilik projek): nama editor SEBENAR yang log masuk semasa
// sesi ni — dihantar terus dalam setiap POST /api/system/slots (slot.editorName), server.js
// (syncManualObjectsForSlot) simpan ke attribute 'editorName' setiap kandungan diterbitkan.
// Berasingan daripada createdBy (token laluan-kod, bukan identiti orang) — lihat Indeks (tapisan
// "Editor" baharu). Kosong = tiada sesi log masuk (kandungan sedia ada sebelum ciri ni pun kosong).
export function useSlotEditor(editorName?: string) {
  const [slotsConfig, setSlotsConfig] = useState<any[]>([]);
  const [activeBidangList, setActiveBidangList] = useState<{ name: string; color: string; icon: string | null; iconSvg: string | null }[]>([]);
  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [formConfig, setFormConfig] = useState<any>(null);
  const [showSlotPicker, setShowSlotPicker] = useState(false);
  const [isSavingSlot, setIsSavingSlot] = useState(false);
  const [saveError, setSaveError] = useState('');
  // Konflik penyuntingan serentak (2026-08-07, Audit UI/UX Editorium §F3) — true khusus apabila
  // pelayan menolak simpan dengan 409 (slotsConfigRoutes.js POST /slots) kerana slot ni sudah
  // disimpan orang lain sejak dibuka. Berasingan daripada saveError am supaya pemanggil boleh
  // papar butang "Salin draf saya ke papan klip" HANYA pada kes ni — editor tak perlu menaip
  // semula draf secara manual selepas muat semula slot.
  const [saveErrorIsConflict, setSaveErrorIsConflict] = useState(false);

  const fetchSlotsConfig = useCallback(() => {
    fetch('/api/system/slots')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setSlotsConfig(data); })
      .catch((e) => console.error('Failed to load slots config:', e));
  }, []);

  const fetchActiveBidangList = useCallback(() => {
    fetch('/api/system/categories/active')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setActiveBidangList(data.map((c: any) => ({ name: c.name, color: c.color, icon: c.icon || null, iconSvg: c.iconSvg || null })));
        }
      })
      .catch((e) => console.error('Failed to load active Bidang list:', e));
  }, []);

  useEffect(() => {
    fetchSlotsConfig();
    fetchActiveBidangList();
  }, [fetchSlotsConfig, fetchActiveBidangList]);

  // Buka borang kosong/sedia ada untuk SATU slot (dipanggil selepas editor pilih daripada
  // pemilih slot). Tiada sintesis demo — slot kosong terus tunjuk medan kosong sebenar.
  const openSlotEditor = useCallback(async (idx: number) => {
    // Ambil konfigurasi TERKINI slot ni dahulu, bukan terus guna `slotsConfig` dalam ingatan:
    // senarai itu dimuatkan sekali sahaja semasa Editorium dibuka, jadi draf yang disimpan
    // selepas itu (oleh tab lain, atau oleh editor lain yang berkongsi slot) tidak akan kelihatan
    // dan boleh ditimpa semula pada simpan berikutnya. Kalau panggilan gagal, jatuh balik pada
    // salinan dalam ingatan — lebih baik borang lama daripada borang kosong.
    let segar: any = null;
    try {
      const res = await fetch('/api/system/slots');
      const data = await res.json();
      if (Array.isArray(data)) {
        setSlotsConfig(data);
        segar = data.find((s: any) => s.slotIndex === idx) || null;
      }
    } catch (e) {
      console.error('Failed to refresh slot config before opening editor:', e);
    }
    const config = segar || slotsConfig.find((s) => s.slotIndex === idx);
    const limits = getLimitsForIndex(idx, config);
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
      manualTitle: '',
      manualSummary: config?.manualSummary || '',
      isDemoContent: false,
      manualSource: '',
      manualUrl: '#',
      manualImageUrl: config?.manualImageUrl || '',
      manualDesk: config?.manualDesk || '',
      activeObjectId: config?.activeObjectId || '',
      searchStrategy: config?.searchStrategy || 'Structured Sources Only',
      carouselInterval: config?.carouselInterval || 10,
      carouselDelay: config?.carouselDelay || 0,
      generationLimit: config?.generationLimit || 10,
      maxTitle: config?.maxTitle !== undefined && config?.maxTitle !== null ? config.maxTitle : limits.maxTitle,
      maxBrief: config?.maxBrief !== undefined && config?.maxBrief !== null ? config.maxBrief : limits.maxBrief,
      maxBriefLong: config?.maxBriefLong !== undefined && config?.maxBriefLong !== null ? config.maxBriefLong : limits.maxBriefLong,
      masterPrompt: '',
      refreshHour: config?.refreshHour || '00:00',
      refreshDay: config?.refreshDay || 'Isnin',
      eventExpiryFilter: config?.eventExpiryFilter || '',
      aiPromptTopic: config?.aiPromptTopic || '',
      aiPromptRecency: config?.aiPromptRecency || '1 minggu',
      aiPromptLanguage: config?.aiPromptLanguage || 'Bahasa Melayu',
      aiPromptRegion: config?.aiPromptRegion || 'Global, Malaysia',
      aiPromptSource: config?.aiPromptSource || '',
      genMode: config?.genMode || 'bebas',
      // Kawalan serentak (Fasa 6) — token versi ringkas: nilai `updatedAt` yang DIBACA semasa
      // buka slot ni, dihantar semula bila simpan supaya server boleh kesan jika seseorang lain
      // sudah simpan slot yang sama sejak itu (lihat slotsConfigRoutes.js POST /slots).
      updatedAt: config?.updatedAt || null,
    });
    setEditingSlotIndex(idx);
    setShowSlotPicker(false);
  }, [slotsConfig]);

  const closeSlotEditor = useCallback(() => {
    setEditingSlotIndex(null);
    setFormConfig(null);
    setSaveError('');
    setSaveErrorIsConflict(false);
  }, []);

  // Salin draf semasa (belum disimpan) ke papan klip sebagai teks boleh baca — dipanggil oleh
  // butang di sebelah mesej konflik 409 supaya editor boleh tampal semula selepas muat semula
  // slot, bukan menaip semula dari ingatan (Audit §F3). Pulangkan boolean kejayaan.
  const salinDrafKePapanKlip = useCallback(async () => {
    if (!formConfig) return false;
    const teks = [
      `Slot: ${formConfig.slotIndex + 1}`,
      `Tajuk: ${formConfig.manualTitle || ''}`,
      `Huraian ringkas: ${formConfig.manualSummary || ''}`,
      `Bidang: ${formConfig.manualDesk || ''}`,
      `Sumber: ${formConfig.manualSource || ''}`,
      `URL: ${formConfig.manualUrl || ''}`,
      `Imej: ${formConfig.manualImageUrl || ''}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(teks);
      return true;
    } catch (e) {
      console.error('Gagal menyalin draf ke papan klip:', e);
      return false;
    }
  }, [formConfig]);

  // opts.closeOnSuccess (2026-07-29, permintaan pemilik projek) — lalai true untuk Simpan
  // keseluruhan modal (kelakuan asal, tak berubah). Butang "Terbit" SATU kandungan (di
  // SlotManagerModal.tsx) hantar false di sini: ia terbitkan SATU kandungan terus ke Indeks
  // tanpa tutup modal, supaya editor terus di ruang draf untuk kandungan lain dalam giliran.
  // Pulangkan boolean kejayaan supaya pemanggil (butang Terbit) tahu bila selamat buang
  // kandungan itu daripada senarai draf tempatan.
  const handleSaveSlot = useCallback(async (e: React.FormEvent, manualSummaryOverride?: string, opts?: { closeOnSuccess?: boolean }) => {
    e.preventDefault();
    if (!formConfig) return false;
    const closeOnSuccess = opts?.closeOnSuccess !== false;
    setIsSavingSlot(true);
    setSaveError('');
    setSaveErrorIsConflict(false);
    const finalFormConfig = { ...formConfig, editorName: editorName || '' };
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
        if (closeOnSuccess) closeSlotEditor();
        return true;
      } else {
        setSaveError(data.error || 'Gagal menyimpan slot.');
        setSaveErrorIsConflict(response.status === 409);
        return false;
      }
    } catch (err: any) {
      setSaveError('Ralat menyimpan slot: ' + (err.message || ''));
      setSaveErrorIsConflict(false);
      return false;
    } finally {
      setIsSavingSlot(false);
    }
  }, [formConfig, fetchSlotsConfig, closeSlotEditor, editorName]);

  return {
    slotsConfig, activeBidangList,
    editingSlotIndex, formConfig, setFormConfig,
    showSlotPicker, setShowSlotPicker,
    isSavingSlot, saveError, saveErrorIsConflict,
    openSlotEditor, closeSlotEditor, handleSaveSlot,
    salinDrafKePapanKlip,
  };
}
