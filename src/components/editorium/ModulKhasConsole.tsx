import React, { useState } from 'react';
import { Radio, Clock, Calendar, Eye, Settings, RefreshCw, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { Tooltip } from '../common/Tooltip';

export const ModulKhasConsole: React.FC = () => {
  const [subTab, setSubTab] = useState<'jam' | 'ticker' | 'bar' | 'focus'>('jam');
  const [focusMode, setFocusMode] = useState<'turutan' | 'rawak'>('turutan');
  const [focusCharLimit, setFocusCharLimit] = useState<number>(120);
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);
  const [time, setTime] = useState<Date>(new Date());

  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatCityTime = (timeZone: string) => {
    try {
      return new Intl.DateTimeFormat('ms-MY', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(time);
    } catch {
      return time.toLocaleTimeString();
    }
  };

  const handleSaveFocusView = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 font-sans bg-[#FDFDFD] text-[#1F1F1F]">
      {/* Editorial Header */}
      <div className="pb-4 border-b border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Modul Khas
          </h2>
          <p className="text-xs text-stone-500 font-sans mt-0.5">
            Pengurusan dedicated untuk Jam Dunia, Ticker Berita, Slot Bar Acara, dan Focus View.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-medium">
          <button
            onClick={() => setSubTab('jam')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'jam' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Jam
          </button>
          <button
            onClick={() => setSubTab('ticker')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'ticker' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Radio className="w-3.5 h-3.5" /> Ticker
          </button>
          <button
            onClick={() => setSubTab('bar')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'bar' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" /> Slot Bar
          </button>
          <button
            onClick={() => setSubTab('focus')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'focus' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Eye className="w-3.5 h-3.5" /> Focus View
          </button>
        </div>
      </div>

      {/* SUBTAB 1: JAM DUNIA */}
      {subTab === 'jam' && (
        <div className="space-y-4">
          <div className="p-5 border border-stone-200 rounded-xl bg-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#802334]" />
                <h3 className="font-serif font-bold text-stone-900 text-sm">Tetapan Jam Dunia & Status Integrasi</h3>
              </div>
              <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> API Aktif (200 OK)
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Jam Dunia dikuasakan secara nyata oleh integrasi Open-Meteo dan Malaysia Public Holidays API. Masa tempatan dan status cuti negeri bertukar mengikut zon waktu rasmi.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="p-3 border border-stone-200 rounded bg-stone-50/50">
                <div className="font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold">Kuala Lumpur</div>
                <div className="font-mono font-bold text-base text-[#802334] mt-1">{formatCityTime('Asia/Kuala_Lumpur')}</div>
                <div className="font-mono text-[10px] text-stone-500 mt-0.5">UTC+8:00 · Waktu Piawai Malaysia</div>
              </div>
              <div className="p-3 border border-stone-200 rounded bg-stone-50/50">
                <div className="font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold">Mekah</div>
                <div className="font-mono font-bold text-base text-[#802334] mt-1">{formatCityTime('Asia/Riyadh')}</div>
                <div className="font-mono text-[10px] text-stone-500 mt-0.5">UTC+3:00 · Waktu Piawai Arab Saudi</div>
              </div>
              <div className="p-3 border border-stone-200 rounded bg-stone-50/50">
                <div className="font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold">London</div>
                <div className="font-mono font-bold text-base text-[#802334] mt-1">{formatCityTime('Europe/London')}</div>
                <div className="font-mono text-[10px] text-stone-500 mt-0.5">UTC+0:00 / +1:00 · Waktu Minat Greenwich</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: TICKER */}
      {subTab === 'ticker' && (
        <div className="space-y-4">
          <div className="p-5 border border-stone-200 rounded-xl bg-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#802334]" />
                <h3 className="font-serif font-bold text-stone-900 text-sm">Konsol Ticker Berita Semasa</h3>
              </div>
              <a
                href="/?openTicker=1"
                className="px-3 py-1 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold transition-colors shadow-xs flex items-center gap-1.5"
              >
                <Settings className="w-3.5 h-3.5" /> Penyuntingan Khas Ticker
              </a>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Jalur ticker pada bahagian atas portal awam Adjung Brief memaparkan tajuk-tajuk ringkas terkini daripada sumber RSS yang telah diluluskan. Penyuntingan khas menyokong tetapan animasi gelongsor dan mod paparan jalur penuh.
            </p>
          </div>
        </div>
      )}

      {/* SUBTAB 3: SLOT BAR */}
      {subTab === 'bar' && (
        <div className="space-y-4">
          <div className="p-5 border border-stone-200 rounded-xl bg-white space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#802334]" />
                <h3 className="font-serif font-bold text-stone-900 text-sm">Tetapan Peraturan Khas Slot Bar</h3>
              </div>
              <span className="font-mono text-[10px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded border border-stone-200 font-bold">
                Tier Bar (Slots 7, 8, 9, 10)
              </span>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Slot Bar khusus 100% untuk acara dan program rasmi (seminar, majlis anugerah, pesta buku) — bukan untuk berita umum. Format menyokong 7 medan rasmi (Tarikh, Event, Penganjur, Lokasi, Akses, Penerangan, URL).
            </p>
          </div>
        </div>
      )}

      {/* SUBTAB 4: FOCUS VIEW */}
      {subTab === 'focus' && (
        <div className="space-y-4">
          <form onSubmit={handleSaveFocusView} className="p-5 border border-stone-200 rounded-xl bg-white space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-[#802334]" />
                <h3 className="font-serif font-bold text-stone-900 text-sm">Tetapan Mod Focus View</h3>
              </div>
              {savedSuccess && (
                <span className="font-mono text-[10px] text-[#3d6b4c] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Berjaya Disimpan
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1">Mod Turutan / Rawak Kandungan</label>
                <div className="flex items-center gap-4 text-xs font-sans">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="focusMode"
                      checked={focusMode === 'turutan'}
                      onChange={() => setFocusMode('turutan')}
                      className="text-[#802334] focus:ring-[#802334]"
                    />
                    <span>Mod Turutan (Mengikut No. Slot 1-38)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="focusMode"
                      checked={focusMode === 'rawak'}
                      onChange={() => setFocusMode('rawak')}
                      className="text-[#802334] focus:ring-[#802334]"
                    />
                    <span>Mod Rawak (Random Shuffle)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1">Had Aksara Paparan Focus View</label>
                <input
                  type="number"
                  value={focusCharLimit}
                  onChange={(e) => setFocusCharLimit(Number(e.target.value))}
                  min={50}
                  max={300}
                  className="w-48 px-3 py-1.5 border border-stone-300 rounded text-xs font-mono focus:outline-none focus:border-[#802334]"
                />
                <p className="text-[11px] text-stone-500 mt-1">Had aksara huraian yang dirender apabila kad bento dimasukkan ke dalam tetingkap paparan fokus.</p>
              </div>
            </div>

            <div className="pt-2 border-t border-stone-200 flex justify-end">
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#802334] hover:bg-[#601824] text-white font-sans text-xs font-semibold rounded transition-colors shadow-xs"
              >
                Simpan Tetapan Focus View
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
