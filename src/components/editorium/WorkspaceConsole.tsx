import React, { useState } from 'react';

export const WorkspaceConsole: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'substance' | 'assignments' | 'presentation'>('substance');

  const [formData, setFormData] = useState({
    title: 'Banglo tiga tingkat jadi markas 40 scammer kena serbu',
    brief: 'Polis menyerbu sebuah banglo mewah di Petaling Jaya yang dijadikan pusat operasi penipuan pelaburan dalam talian.',
    longDescription: 'Serbuan dilakukan oleh Jabatan Siasatan Jenayah Komersil merampas 50 telefon bimbit, 20 komputer dan menahan 40 individu.',
    body: 'PETALING JAYA - Sebuah banglo tiga tingkat yang disewa pada kadar RM15,000 sebulan dijadikan pusat panggilan kegiatan scammer serantau...',
    contentType: 'NEWS',
    contentGenre: 'FACTUAL',
    desk: 'SEMASA',
    source: 'Kosmo Online (RSS Direct)',
    collection: 'col_brief_my',
    slotId: 'slot_00_ticker',
    displayFormat: 'brief',
    cardStyle: 'STANDARD_CREAM',
    theme: 'ADJUNG_EDITORIAL'
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-6 space-y-6">
      {/* Workspace Header */}
      <div className="flex flex-wrap justify-between items-center gap-4 border-b border-stone-200 pb-4">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-widest text-[#802334] font-bold">
            📝 RUANG SUNTINGAN SEHENTI (EDITORIAL WORKSPACE CONSOLE)
          </h2>
          <p className="font-serif text-sm text-stone-600">
            Suntingan substansi kandungan, peruntukan slot spatial multi-publication, dan tetapan visual presentation.
          </p>
        </div>
        <button className="bg-[#802334] hover:bg-[#6c1d2c] text-white font-mono text-xs px-4 py-2 rounded font-bold uppercase tracking-wider shadow-sm transition-colors">
          💾 SIMPAN PERUBAHAN
        </button>
      </div>

      {/* 3-Tab Workspace Navigation */}
      <div className="flex border-b border-stone-200 font-mono text-xs">
        <button
          onClick={() => setActiveTab('substance')}
          className={`px-4 py-2.5 font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'substance'
              ? 'border-[#802334] text-[#802334] bg-stone-50'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          📝 1. SUBSTANCE (TEKS & CONTENT CORE)
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2.5 font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'assignments'
              ? 'border-[#802334] text-[#802334] bg-stone-50'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          🚀 2. ASSIGNMENTS (SLOT & PUBLICATION)
        </button>
        <button
          onClick={() => setActiveTab('presentation')}
          className={`px-4 py-2.5 font-bold uppercase tracking-wider transition-colors border-b-2 ${
            activeTab === 'presentation'
              ? 'border-[#802334] text-[#802334] bg-stone-50'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          🎨 3. PRESENTATION (VISUAL & TYPOGRAPHY v2.1)
        </button>
      </div>

      {/* Tab 1: Substance */}
      {activeTab === 'substance' && (
        <div className="space-y-4 font-sans text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="font-sans text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
                CONTENT TYPE
              </label>
              <select
                value={formData.contentType}
                onChange={e => setFormData({ ...formData, contentType: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-2 font-sans text-xs font-semibold"
              >
                <option value="NEWS">NEWS (Berita Ringkas)</option>
                <option value="ARTICLE">ARTICLE (Artikel Umum)</option>
                <option value="ESSAY">ESSAY (Esei Pemikiran)</option>
                <option value="THESIS_SUMMARY">THESIS_SUMMARY (Ringkasan Tesis)</option>
                <option value="BOOK_SUMMARY">BOOK_SUMMARY (Ringkasan Buku)</option>
              </select>
            </div>

            <div>
              <label className="font-sans text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
                CONTENT GENRE
              </label>
              <select
                value={formData.contentGenre}
                onChange={e => setFormData({ ...formData, contentGenre: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-2 font-sans text-xs font-semibold"
              >
                <option value="FACTUAL">FACTUAL (Laporan Fakta)</option>
                <option value="ANALYSIS">ANALYSIS (Analisis Mendalam)</option>
                <option value="OPINION">OPINION (Pandangan Editorial)</option>
                <option value="INTERVIEW">INTERVIEW (Temu Bual)</option>
              </select>
            </div>

            <div>
              <label className="font-sans text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
                DISIPLIN ILMU / DESK
              </label>
              <select
                value={formData.desk}
                onChange={e => setFormData({ ...formData, desk: e.target.value })}
                className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-2 font-sans text-xs font-semibold"
              >
                <option value="SEMASA">SEMASA</option>
                <option value="NASIONAL">NASIONAL</option>
                <option value="EKONOMI">EKONOMI</option>
                <option value="SAINS & TEKNOLOGI">SAINS & TEKNOLOGI</option>
                <option value="KESIHATAN">KESIHATAN</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-sans text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
              TAJUK UTAMA (TITLE)
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-2 font-serif text-sm font-medium"
            />
          </div>

          <div>
            <label className="font-sans text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
              RINGKASAN PENDEK (BRIEF - MAX 250 AKSARA)
            </label>
            <textarea
              rows={3}
              value={formData.brief}
              onChange={e => setFormData({ ...formData, brief: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-2 font-serif text-xs leading-relaxed"
            />
          </div>

          <div>
            <label className="font-sans text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
              DESKRIPSI PANJANG (LONG DESCRIPTION)
            </label>
            <textarea
              rows={4}
              value={formData.longDescription}
              onChange={e => setFormData({ ...formData, longDescription: e.target.value })}
              className="w-full bg-stone-50 border border-stone-300 rounded px-3 py-2 font-serif text-xs leading-relaxed"
            />
          </div>
        </div>
      )}

      {/* Tab 2: Assignments */}
      {activeTab === 'assignments' && (
        <div className="space-y-4 font-sans text-xs">
          <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3">
            <h4 className="font-sans text-xs font-bold text-stone-800 uppercase">
              PERUNTUKAN SALURAN & SLOT SPATIAL (MULTI-PUBLICATION SYNDICATION)
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="font-sans text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
                  KOLEKSI / SALURAN
                </label>
                <select
                  value={formData.collection}
                  onChange={e => setFormData({ ...formData, collection: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-3 py-2 font-sans text-xs font-semibold"
                >
                  <option value="col_brief_my">Adjung Brief Malaysia</option>
                  <option value="col_journal_ai">AI & Cybercrime Digest</option>
                </select>
              </div>

              <div>
                <label className="font-sans text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
                  UNTUKAN SLOT SPATIAL
                </label>
                <select
                  value={formData.slotId}
                  onChange={e => setFormData({ ...formData, slotId: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-3 py-2 font-sans text-xs font-semibold"
                >
                  <option value="slot_00_ticker">Slot 0 (Ticker Bar)</option>
                  <option value="slot_01_hero">Slot 1 (Hero Main Card)</option>
                  <option value="slot_02_feature">Slot 2 (Feature Vertical)</option>
                </select>
              </div>

              <div>
                <label className="font-sans text-[9px] uppercase tracking-wider text-stone-500 font-bold block mb-1">
                  FORMAT PAPARAN
                </label>
                <select
                  value={formData.displayFormat}
                  onChange={e => setFormData({ ...formData, displayFormat: e.target.value })}
                  className="w-full bg-white border border-stone-300 rounded px-3 py-2 font-sans text-xs font-semibold"
                >
                  <option value="brief">Brief Format (Ringkas)</option>
                  <option value="full_view">Full View (Penuh)</option>
                  <option value="teaser">Teaser Only</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Presentation */}
      {activeTab === 'presentation' && (
        <div className="space-y-4 font-sans text-xs">
          <div className="bg-stone-50 p-4 rounded border border-stone-200 space-y-3">
            <h4 className="font-mono text-xs font-bold text-stone-800 uppercase">
              PRATONTON LIVE RENDERING & ENJIN TIPOGRAFI v2.1
            </h4>
            <div className="p-4 bg-white rounded border border-stone-200 space-y-2">
              <span className="font-mono text-[9px] uppercase tracking-widest text-[#802334] font-bold">
                PRATONTON FRONTPAGE
              </span>
              <h3 className="font-serif text-lg font-medium text-stone-900 leading-snug">
                Banglo tiga tingkat jadi markas 40 <em className="not-italic italic text-stone-900 font-serif">scammer</em> kena serbu
              </h3>
              <p className="font-serif text-xs text-stone-600 leading-relaxed">
                {formData.brief}
              </p>
              <div className="font-mono text-[9px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded w-max font-bold">
                ✓ Aturan tipografi v2.1 terpakai: scammer &rarr; senget (italic)
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkspaceConsole;
