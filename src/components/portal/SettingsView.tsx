import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Entry, SystemSettings } from '../../types';
import { ArrowLeft, Settings, RotateCcw, Check, AlertCircle, Info, Sparkles, Paintbrush, Sliders, Play, Trash2, Plus, Upload } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsViewProps {
  systemSettings: SystemSettings;
  entries: Entry[];
  users: User[];
  onSettingsSave: (newSettingsText: string) => Promise<void>;
}

const COLOR_PRESETS = [
  { name: 'Transparent (Lalai)', hex: 'transparent' },
  { name: 'Adjung Maroon', hex: '#802334' },
  { name: 'Terracotta', hex: '#C95D44' },
  { name: 'Warm Brown', hex: '#7A624E' },
  { name: 'Charcoal Dark', hex: '#1C1917' },
  { name: 'Forest Green', hex: '#1A332B' },
  { name: 'Midnight Navy', hex: '#1C2541' },
  { name: 'Soft Gray', hex: '#6B7280' },
  { name: 'Cream Ivory', hex: '#FAF7F0' }
];

const BORDER_PRESETS = [
  { name: 'Lalai (Slate)', hex: '' },
  { name: 'Gold', hex: '#E9D8A6' },
  { name: 'Crimson', hex: '#C95D44' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Slate Gray', hex: '#4B5563' }
];

const SLOT_LAYOUTS = [
  { index: 0, type: 'LEBAR PENUH', desc: 'Slot Lebar Penuh (Row 1): Had tajuk 115 aksara, ringkasan 240 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 1, type: 'MENEGAK', desc: 'Slot Menegak Kiri (Row 2-3): Had tajuk 72 aksara, ringkasan 145 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 2, type: 'MELINTANG', desc: 'Slot Melintang Kanan Atas (Row 2): Had tajuk 110 aksara, ringkasan 160 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 3, type: 'SEGI EMPAT', desc: 'Slot Segi Empat Kanan Bawah Kiri (Row 3): Had tajuk 85 aksara, ringkasan 80 aksara.', allowed: ['Brief', 'Book', 'Event', 'Sponsor'] },
  { index: 4, type: 'KOMPAK', desc: 'Slot Kompak Kanan Bawah Kanan Atas (Row 3): Had tajuk 75 aksara, tiada ringkasan.', allowed: ['Brief', 'Book'] },
  { index: 5, type: 'KOMPAK', desc: 'Slot Kompak Kanan Bawah Kanan Bawah (Row 3): Had tajuk 75 aksara, tiada ringkasan.', allowed: ['Brief', 'Book'] },
  { index: 6, type: 'MELINTANG', desc: 'Slot Melintang Penuh (Row 4): Had tajuk 110 aksara, ringkasan 160 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 7, type: 'BAR', desc: 'Bar Tipis 1 (Row 5 Column 1): Had tajuk 40 aksara, tiada ringkasan.', allowed: ['Brief'] },
  { index: 8, type: 'BAR', desc: 'Bar Tipis 2 (Row 5 Column 2): Had tajuk 40 aksara, tiada ringkasan.', allowed: ['Brief'] },
  { index: 9, type: 'BAR', desc: 'Bar Tipis 3 (Row 5 Column 3): Had tajuk 40 aksara, tiada ringkasan.', allowed: ['Brief'] },
  { index: 10, type: 'BAR', desc: 'Bar Tipis 4 (Row 5 Column 4): Had tajuk 40 aksara, tiada ringkasan.', allowed: ['Brief'] },
  { index: 11, type: 'SEGI EMPAT', desc: 'Slot Segi Empat Kiri Atas (Row 6): Had tajuk 85 aksara, ringkasan 80 aksara.', allowed: ['Brief', 'Book', 'Event', 'Sponsor'] },
  { index: 12, type: 'MENEGAK', desc: 'Slot Menegak Kiri Bawah (Row 7-8): Had tajuk 72 aksara, ringkasan 145 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 13, type: 'SEPARUH', desc: 'Slot Separuh Kanan Atas Kiri (Row 6): Had tajuk 85 aksara, ringkasan 110 aksara.', allowed: ['Brief', 'Book'] },
  { index: 14, type: 'SEPARUH', desc: 'Slot Separuh Kanan Atas Kanan (Row 6): Had tajuk 85 aksara, ringkasan 110 aksara.', allowed: ['Brief', 'Book'] },
  { index: 15, type: 'MENEGAK', desc: 'Slot Menegak Kanan Kanan (Row 6-7): Had tajuk 72 aksara, ringkasan 145 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 16, type: 'SEGI EMPAT', desc: 'Slot Segi Empat Tengah Kiri (Row 7): Had tajuk 85 aksara, ringkasan 80 aksara.', allowed: ['Brief', 'Book', 'Event', 'Sponsor'] },
  { index: 17, type: 'KOMPAK', desc: 'Slot Kompak Tengah Kanan Atas (Row 7): Had tajuk 75 aksara, tiada ringkasan.', allowed: ['Brief', 'Book'] },
  { index: 18, type: 'KOMPAK', desc: 'Slot Kompak Tengah Kanan Bawah (Row 7): Had tajuk 75 aksara, tiada ringkasan.', allowed: ['Brief', 'Book'] },
  { index: 19, type: 'MELINTANG', desc: 'Slot Melintang Kiri Bawah (Row 8): Had tajuk 110 aksara, ringkasan 160 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 20, type: 'MELINTANG', desc: 'Slot Melintang Kanan Bawah (Row 8): Had tajuk 110 aksara, ringkasan 160 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 21, type: 'BAR', desc: 'Bar Tipis 5 (Row 9 Column 1): Had tajuk 40 aksara, tiada ringkasan.', allowed: ['Brief'] },
  { index: 22, type: 'BAR', desc: 'Bar Tipis 6 (Row 9 Column 2): Had tajuk 40 aksara, tiada ringkasan.', allowed: ['Brief'] },
  { index: 23, type: 'BAR', desc: 'Bar Tipis 7 (Row 9 Column 3): Had tajuk 40 aksara, tiada ringkasan.', allowed: ['Brief'] },
  { index: 24, type: 'BAR', desc: 'Bar Tipis 8 (Row 9 Column 4): Had tajuk 40 aksara, tiada ringkasan.', allowed: ['Brief'] },
  { index: 25, type: 'SEGI EMPAT', desc: 'Slot Segi Empat Kiri (Row 10): Had tajuk 85 aksara, ringkasan 80 aksara.', allowed: ['Brief', 'Book', 'Event', 'Sponsor'] },
  { index: 26, type: 'MENEGAK', desc: 'Slot Menegak Tengah Kiri (Row 10-11): Had tajuk 72 aksara, ringkasan 145 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 27, type: 'SEPARUH', desc: 'Slot Separuh Kanan Atas Kiri (Row 10): Had tajuk 85 aksara, ringkasan 110 aksara.', allowed: ['Brief', 'Book'] },
  { index: 28, type: 'SEPARUH', desc: 'Slot Separuh Kanan Atas Kanan (Row 10): Had tajuk 85 aksara, ringkasan 110 aksara.', allowed: ['Brief', 'Book'] },
  { index: 29, type: 'MENEGAK', desc: 'Slot Menegak Kanan Kiri (Row 10-11): Had tajuk 72 aksara, ringkasan 145 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 30, type: 'SEGI EMPAT', desc: 'Slot Segi Empat Kiri Bawah (Row 11): Had tajuk 85 aksara, ringkasan 80 aksara.', allowed: ['Brief', 'Book', 'Event', 'Sponsor'] },
  { index: 31, type: 'KOMPAK', desc: 'Slot Kompak Kanan Bawah Kiri (Row 11): Had tajuk 75 aksara, tiada ringkasan.', allowed: ['Brief', 'Book'] },
  { index: 32, type: 'KOMPAK', desc: 'Slot Kompak Kanan Bawah Kanan (Row 11): Had tajuk 75 aksara, tiada ringkasan.', allowed: ['Brief', 'Book'] },
  { index: 33, type: 'MELINTANG', desc: 'Slot Melintang Kiri Bawah Sekali (Row 12): Had tajuk 110 aksara, ringkasan 160 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 34, type: 'MELINTANG', desc: 'Slot Melintang Kanan Bawah Sekali (Row 12): Had tajuk 110 aksara, ringkasan 160 aksara.', allowed: ['Brief', 'Book', 'Event'] },
  { index: 35, type: 'SEGI EMPAT', desc: 'Slot Segi Empat Bawah Sekali Kiri (Row 13): Had tajuk 85 aksara, ringkasan 80 aksara.', allowed: ['Brief', 'Book', 'Event', 'Sponsor'] },
  { index: 36, type: 'SEGI EMPAT', desc: 'Slot Segi Empat Bawah Sekali Tengah (Row 13): Had tajuk 85 aksara, ringkasan 80 aksara.', allowed: ['Brief', 'Book', 'Event', 'Sponsor'] },
  { index: 37, type: 'MENEGAK', desc: 'Slot Menegak Bawah Sekali Kanan (Row 12-13): Had tajuk 72 aksara, ringkasan 145 aksara.', allowed: ['Brief', 'Book', 'Event'] }
];

const getRecommendedAspectRatio = (type: string) => {
  switch (type) {
    case 'LEBAR PENUH':
      return 'Lanskap Sangat Lebar (Nisbah 3:1 / 4:1. Cth: 1200x400)';
    case 'MENEGAK':
      return 'Potret / Menegak (Nisbah 1:2 / 9:16. Cth: 600x1200)';
    case 'MELINTANG':
      return 'Lanskap Standard (Nisbah 2:1 / 16:9. Cth: 1200x600)';
    case 'SEGI EMPAT':
      return 'Segi Empat Sama (Nisbah 1:1. Cth: 800x800)';
    case 'KOMPAK':
      return 'Lanskap Kecil (Nisbah 2:1. Cth: 600x300)';
    case 'SEPARUH':
      return 'Lanskap Sederhana (Nisbah 1.5:1 / 4:3. Cth: 900x600)';
    case 'BAR':
      return 'Tidak digalakkan menggunakan gambar (bar terlalu tipis)';
    default:
      return 'Lanskap Standard';
  }
};

const getShapeBadge = (type: string) => {
  let colorClasses = '';
  switch (type) {
    case 'LEBAR PENUH':
      colorClasses = 'bg-red-50 text-red-700 border-red-200';
      break;
    case 'MENEGAK':
      colorClasses = 'bg-blue-50 text-blue-700 border-blue-200';
      break;
    case 'MELINTANG':
      colorClasses = 'bg-amber-50 text-amber-700 border-amber-200';
      break;
    case 'SEGI EMPAT':
      colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
      break;
    case 'KOMPAK':
      colorClasses = 'bg-emerald-50 text-emerald-700 border-emerald-200';
      break;
    case 'BAR':
      colorClasses = 'bg-stone-100 text-stone-700 border-stone-300';
      break;
    case 'SEPARUH':
      colorClasses = 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200';
      break;
    default:
      colorClasses = 'bg-stone-50 text-stone-600 border-stone-200';
  }
  
  return (
    <span className={`px-1.5 py-0.5 text-[7px] rounded border font-semibold tracking-wide uppercase ${colorClasses} whitespace-nowrap`}>
      {type}
    </span>
  );
};

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
      color: finalIsDark ? '#E9D8A6' : '#802334'
    },
    titleStyle: {
      color: finalTextColor
    },
    briefStyle: {
      color: finalIsDark ? 'rgba(253, 253, 253, 0.95)' : '#57534e'
    },
    sourceStyle: {
      color: finalIsDark ? '#d6d3d1' : '#78716c',
      borderColor: finalIsDark ? 'rgba(253, 253, 253, 0.2)' : '#e7e5e4'
    }
  };
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  systemSettings,
  onSettingsSave
}) => {
  const navigate = useNavigate();
  const [activeMenu, setActiveMenu] = useState<'slots' | 'ai'>('slots');
  const [aiTab, setAiTab] = useState<'providers' | 'prompts' | 'logs' | 'translation' | 'cost_center'>('providers');
  const [translationConfigs, setTranslationConfigs] = useState<any[]>([]);
  
  // Dynamic Target Languages
  const [newLangName, setNewLangName] = useState('');
  const [newLangCode, setNewLangCode] = useState('');
  const [newLangProvider, setNewLangProvider] = useState('');

  // AI Cost Center
  const [aiStats, setAiStats] = useState<any>(null);
  const [aiBreakdown, setAiBreakdown] = useState<any>(null);
  const [aiPricing, setAiPricing] = useState<any[]>([]);
  const [editingPricing, setEditingPricing] = useState<any | null>(null);
  
  // Layout and slots state
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(0);
  const [slotsConfig, setSlotsConfig] = useState<any[]>(() => {
    return Array.from({ length: 38 }, (_, i) => ({
      slotIndex: i,
      contentMode: 'Manual',
      providerId: '',
      model: '',
      promptText: '',
      sourcesList: '',
      refreshRate: 'Daily',
      allowedContentTypes: '',
      priority: 'Medium',
      expiresAt: '',
      bgColor: 'transparent',
      borderColor: '',
      textColor: '#1F1F1F',
      manualTitle: '',
      manualSummary: '',
      manualSource: '',
      manualUrl: '',
      manualImageUrl: '',
      activeObjectId: ''
    }));
  });
  const [searchQuery, setSearchQuery] = useState('');
  
  // AI Settings states
  const [providers, setProviders] = useState<any[]>([]);

  const [prompts, setPrompts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  
  // Form states
  const [isSaving, setIsSaving] = useState(false);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);
  
  // Strategy modal/form states
  const [editingStrategy, setEditingStrategy] = useState<any | null>(null);
  const [editingPrompt, setEditingPrompt] = useState<any | null>(null);

  // Load all configurations on mount
  useEffect(() => {
    fetch('/api/system/slots')
      .then(res => res.json())
      .then(data => {
        setSlotsConfig(prev => {
          const newSlots = [...prev];
          if (Array.isArray(data)) {
            data.forEach(dbSlot => {
              const idx = newSlots.findIndex(s => s.slotIndex === dbSlot.slotIndex);
              if (idx !== -1) {
                newSlots[idx] = { ...newSlots[idx], ...dbSlot };
              }
            });
          }
          return newSlots;
        });
      })
      .catch(err => console.error('Failed to load slots config:', err));

    fetch('/api/ai/providers')
      .then(res => res.json())
      .then(data => setProviders(data))
      .catch(err => console.error('Failed to load AI providers:', err));


    fetch('/api/ai/prompts')
      .then(res => res.json())
      .then(data => setPrompts(data))
      .catch(err => console.error('Failed to load prompt templates:', err));

    fetch('/api/ai/logs')
      .then(res => res.json())
      .then(data => setLogs(data))
      .catch(err => console.error('Failed to load pipeline logs:', err));

    fetch('/api/translation/configs')
      .then(res => res.json())
      .then(data => setTranslationConfigs(data))
      .catch(err => console.error('Failed to load translation configs:', err));

    // Initial load for Cost Center statistics
    fetch('/api/system/ai/statistics')
      .then(res => res.json())
      .then(data => setAiStats(data.today))
      .catch(err => console.error('Failed to load AI stats:', err));

    fetch('/api/system/ai/breakdown')
      .then(res => res.json())
      .then(data => setAiBreakdown(data))
      .catch(err => console.error('Failed to load AI breakdown:', err));

    fetch('/api/system/ai/pricing')
      .then(res => res.json())
      .then(data => setAiPricing(data))
      .catch(err => console.error('Failed to load AI pricing:', err));
  }, []);

  const refreshTranslationConfigs = () => {
    fetch('/api/translation/configs')
      .then(res => res.json())
      .then(data => setTranslationConfigs(data))
      .catch(err => console.error('Failed to load translation configs:', err));
  };

  const refreshAiCostCenter = () => {
    fetch('/api/system/ai/statistics')
      .then(res => res.json())
      .then(data => setAiStats(data.today))
      .catch(err => console.error('Failed to load AI stats:', err));

    fetch('/api/system/ai/breakdown')
      .then(res => res.json())
      .then(data => setAiBreakdown(data))
      .catch(err => console.error('Failed to load AI breakdown:', err));

    fetch('/api/system/ai/pricing')
      .then(res => res.json())
      .then(data => setAiPricing(data))
      .catch(err => console.error('Failed to load AI pricing:', err));
  };

  const handleAddLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLangName.trim() || !newLangCode.trim() || !newLangProvider) {
      alert('Sila isi semua ruangan.');
      return;
    }
    const cleanCode = newLangCode.trim().toLowerCase();
    const newConfig = {
      languageCode: cleanCode,
      languageName: newLangName.trim(),
      providerId: newLangProvider,
      isEnabled: 0
    };
    try {
      const res = await fetch('/api/translation/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([newConfig])
      });
      if (res.ok) {
        setNewLangName('');
        setNewLangCode('');
        refreshTranslationConfigs();
      } else {
        alert('Gagal menambah bahasa.');
      }
    } catch (err) {
      console.error(err);
      alert('Ralat semasa menambah bahasa.');
    }
  };

  const handleDeleteLanguage = async (code: string) => {
    if (!confirm(`Adakah anda pasti mahu memadam bahasa ${code}?`)) return;
    try {
      const res = await fetch(`/api/translation/configs/${code}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        refreshTranslationConfigs();
      } else {
        alert('Gagal memadam bahasa.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSavePricing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPricing) return;
    try {
      const res = await fetch('/api/system/ai/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingPricing)
      });
      if (res.ok) {
        setEditingPricing(null);
        refreshAiCostCenter();
      } else {
        alert('Gagal menyimpan harga model.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const refreshLogs = () => {
    fetch('/api/ai/logs')
      .then(res => res.json())
      .then(data => setLogs(data))
      .catch(err => console.error('Failed to refresh logs:', err));
  };

  const handleTestProvider = async (id: string) => {
    setTestingProviderId(id);
    try {
      const res = await fetch('/api/ai/test-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        alert(`Sambungan Berjaya: Status: ${data.status}`);
      } else {
        alert(`Ujian Sambungan Gagal: Kunci API rahsia bagi ${id} tidak ditemui di dalam .env`);
      }
      // Refresh providers
      fetch('/api/ai/providers')
        .then(res => res.json())
        .then(data => setProviders(data));
    } catch (err) {
      console.error(err);
      alert('Sambungan gagal untuk diuji.');
    } finally {
      setTestingProviderId(null);
    }
  };

  const handleSaveTranslationConfigs = async (configsToSave: any[]) => {
    try {
      const res = await fetch('/api/translation/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configsToSave)
      });
      const data = await res.json();
      if (data.success) {
        alert('Konfigurasi terjemahan berjaya disimpan.');
        setTranslationConfigs(configsToSave);
      } else {
        alert('Gagal menyimpan konfigurasi.');
      }
    } catch (err) {
      console.error(err);
      alert('Sambungan gagal untuk menyimpan tetapan.');
    }
  };

  const handleSaveSlotsConfig = async () => {
    setIsSaving(true);
    try {
      // Validate
      const errors: string[] = [];
      slotsConfig.forEach((slot, idx) => {
        if (slot.contentMode === 'Manual' || slot.contentMode === 'Hybrid') {
          if (slot.manualTitle && slot.manualTitle.length > 80) {
            errors.push(`Slot ${idx}: Tajuk melebihi had 80 aksara.`);
          }
          if (slot.manualSummary && slot.manualSummary.length > 250) {
            errors.push(`Slot ${idx}: Ringkasan melebihi had 250 aksara.`);
          }
        }
      });

      if (errors.length > 0) {
        alert('Sila betulkan ralat berikut:\n\n' + errors.slice(0, 5).join('\n'));
        setIsSaving(false);
        return;
      }

      const res = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slotsConfig)
      });

      if (res.ok) {
        // Trigger HMR refresh on Frontpage by updating systemSettings.inTheNewsText
        await onSettingsSave(new Date().toISOString());
        alert('Susun atur slot bento berjaya disimpan.');
        navigate('/');
      } else {
        const errorData = await res.json().catch(() => ({}));
        alert('Gagal menyimpan tetapan slot: ' + (errorData.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Ralat semasa menyimpan.');
    } finally {
      setIsSaving(false);
    }
  };



  const filteredSlots = useMemo(() => {
    return SLOT_LAYOUTS.filter(layout => {
      const q = searchQuery.toLowerCase();
      if (!q) return true;
      const config = slotsConfig.find(s => s.slotIndex === layout.index);
      return (
        (layout.index + 1).toString() === q ||
        (`slot ${layout.index + 1}`).includes(q) ||
        layout.type.toLowerCase().includes(q) ||
        (config?.manualTitle || '').toLowerCase().includes(q)
      );
    });
  }, [searchQuery, slotsConfig]);

  const currentSlotConfig = slotsConfig.find(s => s.slotIndex === selectedSlotIndex) || {
    slotIndex: selectedSlotIndex,
    contentMode: 'Manual',
    strategyId: '',
    bgColor: 'transparent',
    borderColor: '',
    textColor: '#1F1F1F',
    manualTitle: '',
    manualSummary: '',
    manualSource: '',
    manualUrl: '',
    manualImageUrl: '',
    overrideObjectId: ''
  };

  const currentSlotLayout = SLOT_LAYOUTS[selectedSlotIndex] || { type: 'Brief', allowed: ['Brief'] };

  // Simulated active mapping for preview card rendering
  const activePreviewItem = useMemo(() => {
    if (currentSlotConfig.contentMode === 'Disabled') return null;
    
    const item = {
      rawIndex: selectedSlotIndex + 1,
      bgColor: currentSlotConfig.bgColor || 'transparent',
      borderColor: currentSlotConfig.borderColor || '',
      textColor: currentSlotConfig.textColor || '#1F1F1F',
      desk: currentSlotLayout.type,
      title: currentSlotConfig.manualTitle || `Slot ${selectedSlotIndex} Content`,
      brief: currentSlotConfig.manualSummary || 'Summary placeholder...',
      source: currentSlotConfig.manualSource || 'Nature',
      url: currentSlotConfig.manualUrl || '#',
      imageUrl: currentSlotConfig.manualImageUrl || ''
    };

    return item;
  }, [currentSlotConfig, currentSlotLayout, selectedSlotIndex]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-[#1F1F1F] font-sans pb-12">
      {/* Header */}
      <header className="bg-[#802334] text-[#FDFDFD] border-b border-[#6c1d2c] sticky top-0 z-40 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="p-1.5 rounded-full hover:bg-white/10 text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-serif font-semibold text-lg md:text-xl tracking-wide uppercase">
              Editorial Operating System
            </h1>
            <p className="text-[10px] md:text-xs text-stone-200 tracking-wide font-sans mt-0.5">
              Urus susun atur, model kecerdasan buatan, resipi editorial, dan pipeline kandungan Adjung secara bersepadu.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {activeMenu === 'slots' && (
            <button
              onClick={handleSaveSlotsConfig}
              disabled={isSaving}
              className="px-5 py-2 bg-[#FDFDFD] hover:bg-stone-100 text-[#802334] text-xs md:text-sm font-sans font-medium rounded transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check size={16} />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan & Terapkan'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Navigation Menu */}
      <div className="max-w-6xl w-full mx-auto px-4 md:px-6 mt-4 flex border-b border-stone-200">
        <button
          onClick={() => setActiveMenu('slots')}
          className={`py-3 px-6 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
            activeMenu === 'slots' ? 'border-[#802334] text-[#802334]' : 'border-transparent text-stone-500 hover:text-[#802334]'
          }`}
        >
          <Sliders size={16} />
          <span>Urus Bento Slots Layout</span>
        </button>
        <button
          onClick={() => setActiveMenu('ai')}
          className={`py-3 px-6 text-sm font-semibold tracking-wide border-b-2 transition-all flex items-center gap-2 ${
            activeMenu === 'ai' ? 'border-[#802334] text-[#802334]' : 'border-transparent text-stone-500 hover:text-[#802334]'
          }`}
        >
          <Sparkles size={16} />
          <span>AI Orchestrator Settings (SPEC-XXX)</span>
        </button>
      </div>

      <div className="max-w-6xl w-full mx-auto px-4 md:px-6 mt-6">
        {activeMenu === 'slots' ? (
          <div className="flex flex-col md:flex-row gap-6">
            
            {/* Left Column: Bento Slot List */}
            <aside className="w-full md:w-80 flex flex-col border border-stone-200 rounded-lg overflow-hidden shrink-0 bg-stone-50 h-[75vh] shadow-sm">
              <div className="p-3 bg-stone-100 border-b border-stone-200 flex flex-col gap-1.5">
                <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">
                  Carian Bento Slot
                </label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari Slot 1-38, KOTAK, TEGAK..."
                  className="w-full px-2.5 py-1.5 border border-stone-300 rounded text-xs bg-white focus:outline-none focus:border-[#802334]"
                />
              </div>

              <div className="flex-grow overflow-y-auto divide-y divide-stone-200/60">
                {filteredSlots.map((layout) => {
                  const isSelected = selectedSlotIndex === layout.index;
                  const config = slotsConfig.find(s => s.slotIndex === layout.index) || {};
                  
                  return (
                    <button
                      key={layout.index}
                      onClick={() => setSelectedSlotIndex(layout.index)}
                      className={`w-full text-left px-4 py-3 flex flex-col gap-1 transition-all ${
                        isSelected ? 'bg-[#802334]/5 border-l-4 border-[#802334] pl-3' : 'hover:bg-stone-100/80 pl-4'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`font-mono text-[10px] font-bold tracking-wider uppercase shrink-0 ${isSelected ? 'text-[#802334]' : 'text-stone-600'}`}>
                            Slot {layout.index + 1}
                          </span>
                          {getShapeBadge(layout.type)}
                        </div>
                        <span className="text-[8px] bg-stone-200 text-stone-700 px-1 py-0.5 rounded font-mono shrink-0">
                          {config.contentMode || 'Manual'}
                        </span>
                      </div>
                      <span className="text-xs font-serif line-clamp-1 text-stone-500">
                        {config.manualTitle || '(Tiada Tajuk)'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            {/* Right Column: Slot Detail Editor */}
            <section className="flex-grow flex flex-col gap-6 min-w-0">
              <div className="bg-white border border-stone-200 rounded-lg shadow-sm p-6 flex flex-col gap-5">
                <header className="border-b border-stone-100 pb-4">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold">
                    Konfigurasi & Padanan Kandungan &bull; Slot {selectedSlotIndex + 1}
                  </span>
                  <h2 className="font-serif text-lg font-medium text-[#802334] mt-0.5">
                    {currentSlotLayout.desc.split(': ')[0]}
                  </h2>
                  {currentSlotLayout.desc.includes(': ') && (
                    <p className="text-xs text-stone-500 font-sans mt-1">
                      {currentSlotLayout.desc.split(': ')[1]}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-[9px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-mono">
                      Allowed Types: {currentSlotLayout.allowed.join(', ')}
                    </span>
                  </div>
                </header>

                {/* Mod Kandungan Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold">
                    Content Mode (Mod Kandungan)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {['Manual', 'AI Generated', 'Hybrid', 'Disabled'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setSlotsConfig(prev => {
                            return prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, contentMode: mode } : s);
                          });
                        }}
                        className={`py-2 px-3 text-xs border rounded text-center transition-all ${
                          currentSlotConfig.contentMode === mode 
                            ? 'bg-[#802334] text-white border-[#802334] font-medium' 
                            : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AI Config (Only if AI or Hybrid) */}
                {(currentSlotConfig.contentMode === 'AI Generated' || currentSlotConfig.contentMode === 'Hybrid') && (
                  <div className="flex flex-col gap-4 bg-blue-50/50 p-4 border border-blue-100 rounded-lg">
                    <label className="text-xs font-mono uppercase tracking-wider text-blue-800 font-bold flex items-center gap-1">
                      <Sparkles size={12} /> Konfigurasi AI Slot
                    </label>
                    
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase font-bold text-blue-800">AI Provider</label>
                      <select
                        value={currentSlotConfig.providerId || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, providerId: val } : s));
                        }}
                        className="w-full px-2 py-1.5 border border-blue-200 rounded text-xs bg-white text-stone-800"
                      >
                        <option value="">-- Pilih Provider --</option>
                        {providers.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-end">
                        <label className="text-[10px] uppercase font-bold text-blue-800">Prompt Instructions</label>
                        <select
                           onChange={(e) => {
                             const pId = e.target.value;
                             if(pId) {
                               const p = prompts.find(x => x.id === pId);
                               if (p && confirm('Adakah anda mahu menimpa prompt sedia ada dengan templat ini?')) {
                                 setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, promptText: p.templateText } : s));
                               }
                             }
                             e.target.value = ''; // reset
                           }}
                           className="text-[9px] px-1 border border-blue-200 rounded bg-white"
                        >
                          <option value="">Load Template...</option>
                          {prompts.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <textarea
                        rows={4}
                        value={currentSlotConfig.promptText || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, promptText: val } : s));
                        }}
                        placeholder="Tulis arahan kepada AI untuk slot ini..."
                        className="w-full px-2 py-1.5 border border-blue-200 rounded text-xs bg-white font-mono"
                      />
                      <div className="text-[10px] text-stone-500 font-sans mt-1 bg-stone-50 p-2 border border-stone-200 rounded">
                        <span className="font-bold text-[#802334]">Nota Amalan Terbaik:</span> Tulis arahan khusus dalam lingkungan 100 - 2,000 aksara untuk hasil optimum bagi mengelakkan "prompt drift" (AI mengabaikan arahan penting).
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-blue-800">Sumber (Sources)</label>
                        <input
                          type="text"
                          value={currentSlotConfig.sourcesList || ''}
                          onChange={(e) => setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, sourcesList: e.target.value } : s))}
                          placeholder="Cth: Jurnal A, Berita B"
                          className="w-full px-2 py-1.5 border border-blue-200 rounded text-xs bg-white"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] uppercase font-bold text-blue-800">Refresh Rate</label>
                        <select
                          value={currentSlotConfig.refreshRate || 'Daily'}
                          onChange={(e) => setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, refreshRate: e.target.value } : s))}
                          className="w-full px-2 py-1.5 border border-blue-200 rounded text-xs bg-white"
                        >
                          <option value="Hourly">Hourly</option>
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Manual">Manual Only</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* Override Manual Fields (Manual & Hybrid) */}
                {(currentSlotConfig.contentMode === 'Manual' || currentSlotConfig.contentMode === 'Hybrid') && (
                  <div className="flex flex-col gap-4 border-t border-stone-100 pt-4">
                    <span className="font-mono text-xs uppercase tracking-wider text-stone-600 font-bold">
                      Teks Manual / overrides
                    </span>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1 md:col-span-2">
                        <label className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold">
                          Tajuk Slot
                        </label>
                        <input
                          type="text"
                          value={currentSlotConfig.manualTitle || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, manualTitle: val } : s));
                          }}
                          placeholder="Masukkan tajuk bento..."
                          className="w-full px-3 py-2 border border-stone-300 rounded text-sm font-serif"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold">
                          Label Kategori / Desk
                        </label>
                        <input
                          type="text"
                          value={currentSlotConfig.manualDesk || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, manualDesk: val } : s));
                          }}
                          placeholder="Cth: Berita, Falsafah, Sukan..."
                          className="w-full px-3 py-2 border border-stone-300 rounded text-sm bg-white"
                        />
                      </div>
                    </div>

                    {currentSlotLayout.type !== 'BAR' && currentSlotLayout.type !== 'KOMPAK' && (
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold">
                          Ringkasan / Summary
                        </label>
                        <textarea
                          rows={3}
                          value={currentSlotConfig.manualSummary || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, manualSummary: val } : s));
                          }}
                          placeholder="Masukkan ringkasan..."
                          className="w-full px-3 py-2 border border-stone-300 rounded text-sm resize-none"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold">
                          Sumber
                        </label>
                        <input
                          type="text"
                          value={currentSlotConfig.manualSource || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, manualSource: val } : s));
                          }}
                          placeholder="Cth: Nature"
                          className="w-full px-3 py-2 border border-stone-300 rounded text-sm"
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold">
                          Tautan / URL
                        </label>
                        <input
                          type="text"
                          value={currentSlotConfig.manualUrl || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, manualUrl: val } : s));
                          }}
                          placeholder="Cth: https://example.com"
                          className="w-full px-3 py-2 border border-stone-300 rounded text-sm"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 mt-2">
                      <label className="text-xs font-mono uppercase tracking-wider text-stone-500 font-bold flex justify-between items-center">
                        <span>Gambar Latar Belakang</span>
                        <span className="text-[10px] text-stone-400 font-normal normal-case">Pilih fail komputer atau paste URL</span>
                      </label>
                      
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={currentSlotConfig.manualImageUrl || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, manualImageUrl: val } : s));
                          }}
                          placeholder="Masukkan URL gambar atau klik Muat Naik..."
                          className="flex-grow px-3 py-2 border border-stone-300 rounded text-sm bg-white"
                        />
                        
                        <label className="flex items-center gap-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-700 rounded text-xs font-semibold cursor-pointer transition-all whitespace-nowrap">
                          <Upload size={14} />
                          <span>Muat Naik</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              
                              const reader = new FileReader();
                              reader.onload = async (event) => {
                                const fileData = event.target?.result as string;
                                try {
                                  const response = await fetch('/api/media/upload', {
                                    method: 'POST',
                                    headers: {
                                      'Content-Type': 'application/json'
                                    },
                                    body: JSON.stringify({
                                      filename: file.name,
                                      fileData: fileData
                                    })
                                  });
                                  if (!response.ok) throw new Error('Gagal memuat naik fail.');
                                  const data = await response.json();
                                  
                                  setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, manualImageUrl: data.url } : s));
                                } catch (uploadErr) {
                                  console.error(uploadErr);
                                  alert('Gagal memuat naik fail gambar.');
                                }
                              };
                              reader.readAsDataURL(file);
                            }}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <span className="text-[10px] text-stone-400 block mt-0.5">
                        Masukkan pautan URL gambar atau muat naik terus fail daripada komputer anda.
                      </span>
                      <span className="text-[10px] text-[#802334] font-semibold block mt-0.5">
                        Saranan Saiz: {getRecommendedAspectRatio(currentSlotLayout.type)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Styling Section (Except Disabled) */}
                {currentSlotConfig.contentMode !== 'Disabled' && (
                  <div className="pt-4 border-t border-stone-100 flex flex-col gap-4">
                    <span className="font-mono text-xs uppercase tracking-wider text-stone-600 font-bold flex items-center gap-1.5">
                      <Paintbrush size={13} className="text-[#802334]" /> Reka Gaya & Warna
                    </span>

                    {/* Bg Color */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-sans text-stone-500 font-semibold">Warna Latar Belakang (Background Color)</label>
                      <div className="flex flex-wrap gap-2 items-center">
                        {COLOR_PRESETS.map(preset => (
                          <button
                            key={preset.hex}
                            type="button"
                            onClick={() => {
                              setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, bgColor: preset.hex } : s));
                            }}
                            className={`w-7 h-7 rounded-full border transition-all ${
                              (currentSlotConfig.bgColor || 'transparent') === preset.hex 
                                ? 'ring-2 ring-offset-2 ring-[#802334] scale-105' 
                                : 'border-stone-300 hover:scale-105'
                            }`}
                            style={{ backgroundColor: preset.hex === 'transparent' ? '#ffffff' : preset.hex, backgroundImage: preset.hex === 'transparent' ? 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)' : 'none', backgroundSize: '8px 8px' }}
                            title={preset.name}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Border Color */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-sans text-stone-500 font-semibold">Warna Sempadan (Border Color)</label>
                      <div className="flex flex-wrap gap-2">
                        {BORDER_PRESETS.map(preset => (
                          <button
                            key={preset.hex}
                            type="button"
                            onClick={() => {
                              setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, borderColor: preset.hex } : s));
                            }}
                            className={`px-3 py-1 text-xs border rounded transition-all ${
                              (currentSlotConfig.borderColor || '') === preset.hex 
                                ? 'bg-stone-200 font-medium border-stone-500' 
                                : 'bg-white border-stone-300 hover:bg-stone-50'
                            }`}
                          >
                            {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Text Color Toggle */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-sans text-stone-500 font-semibold">Warna Teks Kandungan</label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                          <input
                            type="radio"
                            name="textColor"
                            checked={currentSlotConfig.textColor !== '#1F1F1F'}
                            onChange={() => {
                              setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, textColor: '#FDFDFD' } : s));
                            }}
                            className="accent-[#802334]"
                          />
                          <span>Cerah / Putih (Gelap)</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                          <input
                            type="radio"
                            name="textColor"
                            checked={currentSlotConfig.textColor === '#1F1F1F'}
                            onChange={() => {
                              setSlotsConfig(prev => prev.map(s => s.slotIndex === selectedSlotIndex ? { ...s, textColor: '#1F1F1F' } : s));
                            }}
                            className="accent-[#802334]"
                          />
                          <span>Gelap / Charcoal (Cerah)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Active Layout Preview Card */}
              {activePreviewItem && (
                <div className="bg-[#802334] text-[#FDFDFD] border border-[#802334]/20 rounded-lg p-6 shadow-md flex flex-col gap-4">
                  <span className="font-mono text-[9px] uppercase tracking-widest text-[#E9D8A6] font-bold flex items-center gap-1.5">
                    <Sparkles size={11} /> Pratonton Kad Bento Terpeta
                  </span>
                  
                  <div className="p-6 bg-white rounded-lg border border-stone-200 flex items-center justify-center min-h-[220px]">
                    <div className="w-full max-w-lg">
                      <div
                        className={`rounded-lg p-5 flex flex-col justify-between ${
                          currentSlotLayout.type === 'LEBAR PENUH' ? 'min-h-[160px] md:flex-row items-center gap-6' :
                          currentSlotLayout.type === 'MELINTANG' ? 'min-h-[150px]' :
                          currentSlotLayout.type === 'SEPARUH' ? 'min-h-[150px]' :
                          currentSlotLayout.type === 'MENEGAK' ? 'min-h-[240px]' :
                          currentSlotLayout.type === 'SEGI EMPAT' ? 'min-h-[160px]' :
                          currentSlotLayout.type === 'KOMPAK' ? 'py-3 px-4 min-h-[80px]' :
                          'py-2.5 px-4 min-h-[50px] flex-row justify-between items-center'
                        }`}
                        style={getCardTheme(activePreviewItem, 'transparent').cardStyle}
                      >
                        {currentSlotLayout.type === 'KOMPAK' ? (
                          <div className="flex flex-col gap-1 w-full">
                            <span className="font-mono text-[9px] uppercase tracking-widest opacity-70 font-bold" style={getCardTheme(activePreviewItem).deskStyle}>
                              {activePreviewItem.desk}
                            </span>
                            <h3 className="font-serif text-sm font-medium" style={getCardTheme(activePreviewItem).titleStyle}>
                              {activePreviewItem.title}
                            </h3>
                          </div>
                        ) : currentSlotLayout.type === 'BAR' ? (
                          <>
                            <h3 className="font-serif text-xs font-medium flex-1" style={getCardTheme(activePreviewItem).titleStyle}>
                              {activePreviewItem.title}
                            </h3>
                            <span className="font-mono text-[8px] uppercase tracking-widest font-bold ml-4 opacity-80" style={getCardTheme(activePreviewItem).deskStyle}>
                              {activePreviewItem.desk}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="space-y-2 flex-grow">
                              <div className="font-mono text-[9px] uppercase tracking-widest font-bold opacity-80" style={getCardTheme(activePreviewItem).deskStyle}>
                                {activePreviewItem.desk}
                              </div>
                              <h3 className="font-serif leading-snug font-medium text-base" style={getCardTheme(activePreviewItem).titleStyle}>
                                {activePreviewItem.title}
                              </h3>
                              <p className="font-serif text-xs leading-relaxed font-light opacity-90" style={getCardTheme(activePreviewItem).briefStyle}>
                                {activePreviewItem.brief}
                              </p>
                            </div>
                            <div className="font-sans text-[9px] tracking-editorial uppercase pt-2 border-t border-white/10 mt-3" style={getCardTheme(activePreviewItem).sourceStyle}>
                              {activePreviewItem.source}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : (
          /* AI Settings / AI Orchestrator Main Area */
          <div className="bg-white border border-stone-200 rounded-lg shadow-sm flex flex-col md:flex-row min-h-[70vh]">
            {/* Sub-tab Navigation */}
            <nav className="w-full md:w-56 bg-stone-50 border-r border-stone-200 flex flex-col py-2 shrink-0">
              {(() => {
                const TABS: { id: string, label: string, tab: 'providers' | 'prompts' | 'logs' | 'translation' | 'cost_center' }[] = [
                  { id: 't1', label: 'API Providers', tab: 'providers' },
                  { id: 't3', label: 'Prompt Templates', tab: 'prompts' },
                  { id: 't5', label: 'Terjemahan Multibahasa', tab: 'translation' },
                  { id: 't6', label: 'AI Cost Center', tab: 'cost_center' },
                  { id: 't4', label: 'Logs', tab: 'logs' }
                ];
                return TABS;
              })().map(t => (
                <button
                  key={t.tab}
                  onClick={() => {
                    setAiTab(t.tab as any);
                    if (t.tab === 'cost_center') refreshAiCostCenter();
                    if (t.tab === 'translation') refreshTranslationConfigs();
                  }}
                  className={`text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider transition-all border-l-4 ${
                    aiTab === t.tab 
                      ? 'border-[#802334] text-[#802334] bg-[#802334]/[0.02] font-bold' 
                      : 'border-transparent text-stone-500 hover:bg-stone-100 hover:text-[#802334]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>

            {/* Sub-tab Content Area */}
            <main className="flex-grow p-6 min-w-0">
              {aiTab === 'providers' && (
                <div className="flex flex-col gap-6">
                  <header>
                    <h2 className="font-serif text-base md:text-lg font-bold text-[#802334]">AI Providers Configuration</h2>
                    <p className="text-xs text-stone-500 font-sans mt-0.5">Urus pembekal API teras. Kunci API dibaca secara selamat dari fail .env.</p>
                  </header>

                  <div className="flex flex-col border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-200 bg-stone-50/20">
                    {providers.map(p => (
                      <div key={p.id} className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white">
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-stone-800 flex items-center gap-2">
                            {p.name}
                            <span className={`px-1.5 py-0.5 text-[8px] rounded uppercase font-mono font-bold ${
                              p.status === 'Connected' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {p.status || 'Not Tested'}
                            </span>
                          </h3>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-500 font-mono">
                            <span>Model: {p.model}</span>
                            <span>&bull;</span>
                            <span>Secrets: {p.secretName}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={testingProviderId === p.id}
                            onClick={() => handleTestProvider(p.id)}
                            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded border border-stone-300 text-xs transition-all cursor-pointer font-medium"
                          >
                            {testingProviderId === p.id ? 'Menguji...' : 'Test Connection'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}



              {aiTab === 'prompts' && (
                <div className="flex flex-col gap-6">
                  <header className="flex justify-between items-center">
                    <div>
                      <h2 className="font-serif text-base md:text-lg font-bold text-[#802334]">Prompt Templates</h2>
                      <p className="text-xs text-stone-500 font-sans mt-0.5">Urus templat prompt instruksi kecerdasan buatan.</p>
                    </div>
                  </header>

                  <div className="space-y-4">
                    {prompts.map(pr => (
                      <div key={pr.id} className="p-4 border border-stone-200 rounded-lg bg-stone-50/20 flex flex-col gap-3">
                        <div className="flex justify-between items-center border-b border-stone-100 pb-2">
                          <span className="text-sm font-bold text-[#802334]">{pr.name}</span>
                          <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded font-bold">
                            Versi: {pr.version}
                          </span>
                        </div>
                        <p className="text-xs text-stone-600 font-mono whitespace-pre-wrap leading-relaxed">
                          {pr.templateText}
                        </p>
                        <div className="flex justify-end pt-2">
                          <button
                            onClick={() => setEditingPrompt(pr)}
                            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-xs transition-all font-medium cursor-pointer"
                          >
                            Edit Prompt
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Edit Prompt Form Modal */}
                  {editingPrompt && (
                    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                      <div className="bg-white rounded-lg border border-stone-200 max-w-md w-full p-6 flex flex-col gap-4 shadow-xl">
                        <h3 className="font-serif text-base font-bold text-[#802334]">Edit Prompt Template</h3>
                        
                        <div className="flex flex-col gap-3 text-xs">
                          <div className="flex flex-col gap-1">
                            <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Nama Prompt</label>
                            <input
                              type="text"
                              value={editingPrompt.name}
                              onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none"
                              readOnly
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Versi</label>
                            <input
                              type="text"
                              value={editingPrompt.version}
                              onChange={(e) => setEditingPrompt({ ...editingPrompt, version: e.target.value })}
                              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334]"
                            />
                          </div>

                          <div className="flex flex-col gap-1">
                            <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Template Text</label>
                            <textarea
                              rows={6}
                              value={editingPrompt.templateText}
                              onChange={(e) => setEditingPrompt({ ...editingPrompt, templateText: e.target.value })}
                              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] font-mono leading-relaxed"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            onClick={() => setEditingPrompt(null)}
                            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-xs transition-all font-medium cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            onClick={handleSavePrompt}
                            className="px-3 py-2 bg-[#802334] hover:bg-[#6c1d2c] text-white rounded text-xs transition-all font-medium cursor-pointer"
                          >
                            Simpan Prompt
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {aiTab === 'translation' && (
                <div className="flex flex-col gap-6">
                  <header>
                    <h2 className="font-serif text-base md:text-lg font-bold text-[#802334]">Terjemahan Multibahasa</h2>
                    <p className="text-xs text-stone-500 font-sans mt-0.5">Urus tetapan terjemahan automatik ke pelbagai bahasa sasaran secara dinamik menggunakan enjin AI.</p>
                  </header>

                  {/* Dashboard Statistik Prestasi Token */}
                  {(() => {
                    const statsLog = logs.find((l: any) => l.slotIndex === -1);
                    let stats = { processed: 38, skippedByScheduler: 0, skippedByAiCache: 0, actualAiCalls: 0 };
                    if (statsLog) {
                      const match = statsLog.message.match(/Total: (\d+), Scheduler Skip: (\d+), AI Cache Skip: (\d+), Actual AI calls: (\d+)/);
                      if (match) {
                        stats.processed = parseInt(match[1], 10);
                        stats.skippedByScheduler = parseInt(match[2], 10);
                        stats.skippedByAiCache = parseInt(match[3], 10);
                        stats.actualAiCalls = parseInt(match[4], 10);
                      }
                    }
                    const totalSaved = stats.skippedByScheduler + stats.skippedByAiCache;
                    const tokensSavedVal = totalSaved * 3500;
                    const formattedTokensSaved = tokensSavedVal >= 1000000 
                      ? `${(tokensSavedVal / 1000000).toFixed(2)}M` 
                      : `${(tokensSavedVal / 1000).toFixed(0)}K`;

                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-stone-50 p-4 border border-stone-200 rounded-lg">
                        <div className="flex flex-col p-3 bg-white border border-stone-150 rounded shadow-sm">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400 font-bold">Processed Slots</span>
                          <span className="text-xl font-serif font-bold text-[#802334] mt-1">{stats.processed}</span>
                        </div>
                        <div className="flex flex-col p-3 bg-white border border-stone-150 rounded shadow-sm">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400 font-bold">Scheduler Skip</span>
                          <span className="text-xl font-serif font-bold text-[#802334] mt-1">{stats.skippedByScheduler}</span>
                        </div>
                        <div className="flex flex-col p-3 bg-white border border-stone-150 rounded shadow-sm">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400 font-bold">AI Cache Skip</span>
                          <span className="text-xl font-serif font-bold text-[#802334] mt-1">{stats.skippedByAiCache}</span>
                        </div>
                        <div className="flex flex-col p-3 bg-white border border-stone-150 rounded shadow-sm">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-stone-400 font-bold">Est. Token Saved</span>
                          <span className="text-xl font-serif font-bold text-emerald-600 mt-1">{formattedTokensSaved}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Borang Konfigurasi Bahasa */}
                  <div className="flex flex-col border border-stone-200 rounded-lg overflow-hidden divide-y divide-stone-200 shadow-sm bg-white">
                    {translationConfigs.length === 0 ? (
                      <div className="p-6 text-center text-stone-400">Tiada bahasa sasaran dikonfigurasikan. Tambah bahasa sasaran baharu di bawah.</div>
                    ) : (
                      translationConfigs.map((config) => (
                        <div key={config.languageCode} className="p-4 bg-white hover:bg-stone-50/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={config.isEnabled === 1}
                              onChange={(e) => {
                                const checked = e.target.checked ? 1 : 0;
                                setTranslationConfigs(prev => prev.map(c => c.languageCode === config.languageCode ? { ...c, isEnabled: checked } : c));
                              }}
                              className="h-4 w-4 rounded border-stone-300 text-[#802334] focus:ring-[#802334] cursor-pointer"
                            />
                            <div>
                              <span className="font-serif text-sm font-bold text-stone-850">{config.languageName}</span>
                              <span className="ml-2 text-[10px] font-mono px-1.5 py-0.5 bg-stone-100 text-stone-500 rounded uppercase font-bold">{config.languageCode}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-bold whitespace-nowrap">Model Penterjemah:</label>
                              <select
                                value={config.providerId}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setTranslationConfigs(prev => prev.map(c => c.languageCode === config.languageCode ? { ...c, providerId: val } : c));
                                }}
                                className="px-3 py-1.5 border border-stone-300 rounded text-xs focus:outline-none focus:border-[#802334]"
                              >
                                {providers.map(p => (
                                  <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                                ))}
                              </select>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteLanguage(config.languageCode)}
                              className="px-2 py-1 text-red-650 hover:bg-red-50 rounded border border-red-200 text-[10px] uppercase font-mono font-bold cursor-pointer transition-all"
                            >
                              Buang
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="flex justify-end gap-3 mt-2">
                    <button
                      onClick={() => handleSaveTranslationConfigs(translationConfigs)}
                      className="px-4 py-2 bg-[#802334] hover:bg-[#6c1d2c] text-white rounded text-xs transition-all font-medium cursor-pointer shadow"
                    >
                      Simpan Tetapan Terjemahan
                    </button>
                  </div>

                  {/* Form Tambah Bahasa Sasaran Baharu */}
                  <form onSubmit={handleAddLanguage} className="bg-stone-50 border border-stone-200 rounded-lg p-4 flex flex-col gap-4 mt-4">
                    <h3 className="font-serif text-xs font-bold text-stone-700 uppercase tracking-wider">Tambah Bahasa Sasaran Baharu</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-mono uppercase tracking-wider text-stone-500 font-bold">Nama Bahasa</label>
                        <input
                          type="text"
                          placeholder="Contoh: Perancis"
                          value={newLangName}
                          onChange={(e) => setNewLangName(e.target.value)}
                          className="px-3 py-2 border border-stone-300 rounded text-xs focus:outline-none focus:border-[#802334] bg-white"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-mono uppercase tracking-wider text-stone-500 font-bold">Kod Bahasa (ISO)</label>
                        <input
                          type="text"
                          placeholder="Contoh: fr"
                          value={newLangCode}
                          onChange={(e) => setNewLangCode(e.target.value)}
                          className="px-3 py-2 border border-stone-300 rounded text-xs focus:outline-none focus:border-[#802334] bg-white"
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-1">
                        <label className="text-[9px] font-mono uppercase tracking-wider text-stone-500 font-bold">Model Penterjemah</label>
                        <select
                          value={newLangProvider}
                          onChange={(e) => setNewLangProvider(e.target.value)}
                          className="px-3 py-2 border border-stone-300 rounded text-xs focus:outline-none focus:border-[#802334] bg-white"
                          required
                        >
                          <option value="">Pilih Model...</option>
                          {providers.map(p => (
                            <option key={p.id} value={p.id}>{p.name} ({p.model})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#802334]/10 hover:bg-[#802334]/20 border border-[#802334]/30 text-[#802334] rounded text-xs transition-all font-semibold cursor-pointer shadow-sm"
                      >
                        Tambah Bahasa Sasaran
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {aiTab === 'cost_center' && (
                <div className="flex flex-col gap-6">
                  <header className="flex justify-between items-center">
                    <div>
                      <h2 className="font-serif text-base md:text-lg font-bold text-[#802334]">AI Cost Center</h2>
                      <p className="text-xs text-stone-500 font-sans mt-0.5">Penjejak anggaran kos, latensi dan penjimatan token API AI di Adjung Core.</p>
                    </div>
                    <button
                      onClick={refreshAiCostCenter}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-xs transition-all font-medium cursor-pointer"
                    >
                      Segarkan Metrik
                    </button>
                  </header>

                  {/* Summary Cards Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="flex flex-col p-4 bg-white border border-stone-200 rounded-lg shadow-sm">
                      <span className="text-[9px] uppercase font-mono tracking-wider text-stone-400 font-bold">Today's Estimated Cost</span>
                      <span className="text-xl md:text-2xl font-serif font-bold text-[#802334] mt-1">
                        ${aiStats?.estimatedCost ? aiStats.estimatedCost.toFixed(4) : '0.0000'}
                      </span>
                    </div>
                    <div className="flex flex-col p-4 bg-white border border-stone-200 rounded-lg shadow-sm">
                      <span className="text-[9px] uppercase font-mono tracking-wider text-stone-400 font-bold">Today's AI Calls</span>
                      <span className="text-xl md:text-2xl font-serif font-bold text-[#802334] mt-1">
                        {aiStats?.totalCalls || 0}
                      </span>
                    </div>
                    <div className="flex flex-col p-4 bg-white border border-stone-200 rounded-lg shadow-sm">
                      <span className="text-[9px] uppercase font-mono tracking-wider text-stone-400 font-bold">Today's Tokens</span>
                      <span className="text-xl md:text-2xl font-serif font-bold text-[#802334] mt-1">
                        {((aiStats?.promptTokens || 0) + (aiStats?.completionTokens || 0)).toLocaleString()}
                      </span>
                      <span className="text-[9px] text-stone-450 font-mono mt-0.5">({aiStats?.promptTokens || 0} in, {aiStats?.completionTokens || 0} out)</span>
                    </div>
                    <div className="flex flex-col p-4 bg-white border border-stone-200 rounded-lg shadow-sm">
                      <span className="text-[9px] uppercase font-mono tracking-wider text-stone-400 font-bold">Average Latency</span>
                      <span className="text-xl md:text-2xl font-serif font-bold text-[#802334] mt-1">
                        {aiBreakdown?.latestCalls?.length > 0 
                          ? (aiBreakdown.latestCalls.reduce((acc: any, c: any) => acc + c.latencyMs, 0) / aiBreakdown.latestCalls.length).toFixed(0)
                          : '0'} ms
                      </span>
                    </div>
                  </div>

                  {/* Pipeline Savings Grid */}
                  <div className="flex flex-col gap-3">
                    <h3 className="font-serif text-xs font-bold text-stone-700 uppercase tracking-wider">Today's Pipeline Savings Dashboard</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-emerald-50/40 p-4 border border-emerald-100 rounded-lg">
                      <div className="flex flex-col p-3 bg-white border border-emerald-100 rounded shadow-sm">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-emerald-700 font-bold">Skipped by Scheduler</span>
                        <span className="text-lg font-serif font-bold text-emerald-800 mt-1">{aiStats?.schedulerSkipped || 0}</span>
                      </div>
                      <div className="flex flex-col p-3 bg-white border border-emerald-100 rounded shadow-sm">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-emerald-700 font-bold">Skipped by Source Cache</span>
                        <span className="text-lg font-serif font-bold text-emerald-800 mt-1">{aiStats?.sourceCacheSkipped || 0}</span>
                      </div>
                      <div className="flex flex-col p-3 bg-white border border-emerald-100 rounded shadow-sm">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-emerald-700 font-bold">Skipped by AI Cache</span>
                        <span className="text-lg font-serif font-bold text-emerald-800 mt-1">{aiStats?.aiCacheSkipped || 0}</span>
                      </div>
                      <div className="flex flex-col p-3 bg-white border border-emerald-100 rounded shadow-sm">
                        <span className="text-[9px] uppercase font-mono tracking-wider text-emerald-700 font-bold font-bold">Est. Cost Saved (USD)</span>
                        <span className="text-lg font-serif font-bold text-emerald-600 mt-1">${aiStats?.estimatedCostSaved ? aiStats.estimatedCostSaved.toFixed(4) : '0.0000'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 30 Days History Trend */}
                  {aiBreakdown?.history30Days?.length > 0 && (
                    <div className="flex flex-col gap-3">
                      <h3 className="font-serif text-xs font-bold text-stone-700 uppercase tracking-wider">Last 30 Days Cost Trend ($)</h3>
                      <div className="border border-stone-200 rounded-lg bg-stone-50/20 p-4">
                        <div className="flex items-end justify-between gap-1.5 h-32 pt-4">
                          {aiBreakdown.history30Days.map((day: any, idx: number) => {
                            const maxCost = Math.max(...aiBreakdown.history30Days.map((d: any) => d.cost), 0.01);
                            const heightPct = Math.min(100, (day.cost / maxCost) * 100);
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center group relative cursor-help">
                                <div 
                                  className="w-full bg-[#802334] rounded-t hover:bg-[#6c1d2c] transition-all" 
                                  style={{ height: `${heightPct}%`, minHeight: '4px' }}
                                />
                                <div className="absolute bottom-full mb-2 bg-stone-900 text-white text-[9px] px-2 py-1 rounded shadow opacity-0 group-hover:opacity-100 transition-all pointer-events-none whitespace-nowrap z-10">
                                  {day.date}<br/>Cost: ${day.cost.toFixed(4)}<br/>Calls: {day.calls}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="flex justify-between font-mono text-[8px] uppercase tracking-widest text-stone-400 mt-2 border-t border-stone-200/60 pt-2">
                          <span>{aiBreakdown.history30Days[0]?.date}</span>
                          <span>{aiBreakdown.history30Days[aiBreakdown.history30Days.length - 1]?.date}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Latest AI Calls Table */}
                  <div className="flex flex-col gap-3">
                    <h3 className="font-serif text-xs font-bold text-stone-700 uppercase tracking-wider">Latest 10 AI Calls</h3>
                    <div className="overflow-x-auto border border-stone-200 rounded-lg bg-white shadow-sm">
                      <table className="min-w-full divide-y divide-stone-200 font-sans text-xs">
                        <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[9px] font-bold font-mono">
                          <tr>
                            <th className="px-4 py-3 text-left">Time</th>
                            <th className="px-4 py-3 text-left">Provider</th>
                            <th className="px-4 py-3 text-left">Model</th>
                            <th className="px-4 py-3 text-left">Capability</th>
                            <th className="px-4 py-3 text-center">Tokens</th>
                            <th className="px-4 py-3 text-center">Latency</th>
                            <th className="px-4 py-3 text-right">Cost</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 text-stone-700">
                          {aiBreakdown?.latestCalls?.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-6 text-center text-stone-400 font-sans font-light">Tiada rekod panggilan AI lagi.</td>
                            </tr>
                          ) : (
                            aiBreakdown?.latestCalls?.map((call: any) => (
                              <tr key={call.id} className="hover:bg-stone-50/40">
                                <td className="px-4 py-2.5 font-mono text-[10px] text-stone-500">
                                  {new Date(call.createdAt).toLocaleTimeString()}
                                </td>
                                <td className="px-4 py-2.5 font-bold text-[#802334]">{call.providerId}</td>
                                <td className="px-4 py-2.5 font-mono text-[10px]">{call.modelName}</td>
                                <td className="px-4 py-2.5">
                                  <span className="px-2 py-0.5 text-[9px] font-bold bg-stone-150/60 text-stone-600 rounded uppercase font-mono">
                                    {call.capability}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-center font-mono font-bold text-[10px]">
                                  {call.totalTokens.toLocaleString()}
                                  <span className="text-[9px] font-normal text-stone-400 ml-1">({call.promptTokens} In, {call.completionTokens} Out)</span>
                                </td>
                                <td className="px-4 py-2.5 text-center font-mono">{call.latencyMs}ms</td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold text-stone-900">${call.estimatedCost.toFixed(5)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* AI Model Pricing Configuration Table */}
                  <div className="flex flex-col gap-4 mt-4">
                    <h3 className="font-serif text-xs font-bold text-stone-700 uppercase tracking-wider">AI Model Pricing Configuration (per 1M Token)</h3>
                    <div className="overflow-x-auto border border-stone-200 rounded-lg bg-white shadow-sm">
                      <table className="min-w-full divide-y divide-stone-200 font-sans text-xs">
                        <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider text-[9px] font-bold font-mono">
                          <tr>
                            <th className="px-4 py-3 text-left">Provider</th>
                            <th className="px-4 py-3 text-left">Model Name</th>
                            <th className="px-4 py-3 text-right">Input Price ($)</th>
                            <th className="px-4 py-3 text-right">Output Price ($)</th>
                            <th className="px-4 py-3 text-center">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100 text-stone-700">
                          {aiPricing.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="px-4 py-6 text-center text-stone-400">Tiada data harga model ditemui.</td>
                            </tr>
                          ) : (
                            aiPricing.map((price) => (
                              <tr key={`${price.providerId}-${price.modelName}`} className="hover:bg-stone-50/40">
                                <td className="px-4 py-2.5 font-bold text-[#802334]">{price.providerId}</td>
                                <td className="px-4 py-2.5 font-mono">{price.modelName}</td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold">${price.inputCostPerMillion.toFixed(3)}</td>
                                <td className="px-4 py-2.5 text-right font-mono font-bold">${price.outputCostPerMillion.toFixed(3)}</td>
                                <td className="px-4 py-2.5 text-center">
                                  <button
                                    onClick={() => setEditingPricing(price)}
                                    className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-[10px] uppercase font-bold cursor-pointer transition-all"
                                  >
                                    Sunting
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Edit Pricing Modal */}
                  {editingPricing && (
                    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                      <form onSubmit={handleSavePricing} className="bg-white rounded-lg border border-stone-200 max-w-sm w-full p-6 flex flex-col gap-4 shadow-xl">
                        <h3 className="font-serif text-sm font-bold text-[#802334] uppercase tracking-wide">Sunting Harga Model AI</h3>
                        <div className="flex flex-col gap-3 text-xs">
                          <div className="flex justify-between border-b border-stone-100 pb-2">
                            <span className="font-bold text-stone-500 font-mono text-[10px]">Provider:</span>
                            <span className="font-bold font-mono text-[#802334]">{editingPricing.providerId}</span>
                          </div>
                          <div className="flex justify-between border-b border-stone-100 pb-2">
                            <span className="font-bold text-stone-500 font-mono text-[10px]">Model:</span>
                            <span className="font-mono text-stone-750">{editingPricing.modelName}</span>
                          </div>
                          <div className="flex flex-col gap-1 mt-1">
                            <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Input Price / 1M Tokens ($)</label>
                            <input
                              type="number"
                              step="0.000001"
                              value={editingPricing.inputCostPerMillion}
                              onChange={(e) => setEditingPricing({ ...editingPricing, inputCostPerMillion: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] font-mono bg-white"
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="font-mono text-[9px] uppercase tracking-wider text-stone-500 font-bold">Output Price / 1M Tokens ($)</label>
                            <input
                              type="number"
                              step="0.000001"
                              value={editingPricing.outputCostPerMillion}
                              onChange={(e) => setEditingPricing({ ...editingPricing, outputCostPerMillion: parseFloat(e.target.value) || 0 })}
                              className="w-full px-3 py-2 border border-stone-300 rounded focus:outline-none focus:border-[#802334] font-mono bg-white"
                              required
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2 mt-2">
                          <button
                            type="button"
                            onClick={() => setEditingPricing(null)}
                            className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-xs font-semibold cursor-pointer"
                          >
                            Batal
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-2 bg-[#802334] hover:bg-[#6c1d2c] text-white rounded text-xs font-semibold cursor-pointer shadow-sm"
                          >
                            Simpan
                          </button>
                        </div>
                      </form>
                    </div>
                  )}
                </div>
              )}

              {aiTab === 'logs' && (
                <div className="flex flex-col gap-6">
                  <header className="flex justify-between items-center">
                    <div>
                      <h2 className="font-serif text-base md:text-lg font-bold text-[#802334]">Pipeline Execution Logs</h2>
                      <p className="text-xs text-stone-500 font-sans mt-0.5">Penjejak log masa nyata bagi aliran penjanaan Editorial Objects.</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={refreshLogs}
                        className="px-2.5 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded text-xs transition-all font-medium cursor-pointer"
                      >
                        Sisi Semula
                      </button>
                      <button
                        onClick={() => handleRunPipeline()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs transition-all flex items-center gap-1 font-medium cursor-pointer"
                      >
                        <Play size={12} /> Run All Pipelines
                      </button>
                    </div>
                  </header>

                  <div className="flex flex-col border border-stone-200 rounded-lg overflow-hidden bg-stone-50/20 max-h-[50vh] overflow-y-auto divide-y divide-stone-200 font-mono text-[10px] md:text-xs">
                    {logs.length === 0 ? (
                      <div className="p-6 text-center text-stone-400 font-sans">
                        Tiada log direkodkan lagi.
                      </div>
                    ) : (
                      logs.map(log => (
                        <div key={log.id} className="p-3 bg-white hover:bg-stone-50/30 flex flex-col gap-1 leading-relaxed">
                          <div className="flex justify-between items-center w-full">
                            <span className="text-stone-400 font-bold">{new Date(log.timestamp).toLocaleString()}</span>
                            <div className="flex gap-2">
                              <span className="text-stone-500">Prompt: {log.promptVersion}</span>
                              <span className={`px-1.5 py-0.2 rounded font-bold uppercase ${
                                log.level === 'SUCCESS' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                              }`}>{log.level}</span>
                            </div>
                          </div>
                          <p className="text-stone-700">{log.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
};
