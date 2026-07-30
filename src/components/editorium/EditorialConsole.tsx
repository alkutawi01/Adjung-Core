import React, { useState } from 'react';
import { BookOpen, Sparkles, Sliders, Clock, Type, ShieldCheck, Plus, Trash2 } from 'lucide-react';

export const EditorialConsole: React.FC = () => {
  const [subTab, setSubTab] = useState<'autocondong' | 'glosari' | 'ai_prompts' | 'had_aksara' | 'tempoh'>('autocondong');

  // Autocondong State
  const [terms, setTerms] = useState<string[]>([
    'online', 'digital', 'dashboard', 'database', 'backend', 'frontend', 'server', 'pipeline', 'workflow'
  ]);
  const [newTerm, setNewTerm] = useState<string>('');

  // AI Prompt Templates State
  const [contentPrompt, setContentPrompt] = useState<string>(
    'Tulis ringkasan akademik bernas berasaskan fakta sumber berikut. Pastikan nada bahasa melayu tinggi, formal, dan tidak emosional.'
  );
  const [reviewPrompt, setReviewPrompt] = useState<string>(
    'Semak ejaan, tatabahasa, gaya bahasa akademik, dan format perenggan bagi teks berikut. Laporkan sebarang ralat struktur.'
  );

  const [minDisplayHours, setMinDisplayHours] = useState<number>(24);
  const [savedMessage, setSavedMessage] = useState<string>('');

  const handleAddTerm = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTerm.trim() && !terms.includes(newTerm.trim().toLowerCase())) {
      setTerms([...terms, newTerm.trim().toLowerCase()]);
      setNewTerm('');
    }
  };

  const handleRemoveTerm = (termToRemove: string) => {
    setTerms(terms.filter(t => t !== termToRemove));
  };

  const handleSave = (msg: string) => {
    setSavedMessage(msg);
    setTimeout(() => setSavedMessage(''), 3000);
  };

  return (
    <div className="space-y-6 font-sans bg-[#FDFDFD] text-[#1F1F1F]">
      {/* Header */}
      <div className="pb-4 border-b border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Konsol Polisi & Gaya Bahasa Editorial
          </h2>
          <p className="text-xs text-stone-500 font-sans mt-0.5">
            Kawalan teras untuk istilah autocondong, glosari ejaan, templat penjanaan AI, dan had masa paparan.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex flex-wrap items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-medium">
          <button
            onClick={() => setSubTab('autocondong')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'autocondong' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Type className="w-3.5 h-3.5" /> Autocondong
          </button>
          <button
            onClick={() => setSubTab('glosari')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'glosari' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Glosari & Ejaan
          </button>
          <button
            onClick={() => setSubTab('ai_prompts')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'ai_prompts' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Templat AI
          </button>
          <button
            onClick={() => setSubTab('had_aksara')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'had_aksara' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Had Aksara
          </button>
          <button
            onClick={() => setSubTab('tempoh')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'tempoh' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" /> Tempoh Paparan
          </button>
        </div>
      </div>

      {savedMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> {savedMessage}
        </div>
      )}

      {/* SUBTAB 1: AUTOCONDONG */}
      {subTab === 'autocondong' && (
        <div className="space-y-4">
          <div className="p-5 border border-stone-200 rounded-xl bg-white space-y-4">
            <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-200 pb-2">
              Senarai Perkataan Autocondong (Foreign & Technical Terms)
            </h3>
            <p className="text-xs text-stone-600">
              Perkataan dalam senarai ini secara automatik dicondongkan oleh enjin TypographyRulesEngine apabila muncul pada tajuk atau huraian kandungan bento.
            </p>

            <form onSubmit={handleAddTerm} className="flex gap-2">
              <input
                type="text"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                placeholder="Tambah istilah asing baharu (cth. metadata)..."
                className="flex-1 px-3 py-1.5 border border-stone-300 rounded text-xs font-mono focus:outline-none focus:border-[#802334]"
              />
              <button
                type="submit"
                className="px-4 py-1.5 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold flex items-center gap-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Tambah Istilah
              </button>
            </form>

            <div className="flex flex-wrap gap-2 pt-2">
              {terms.map(t => (
                <span key={t} className="inline-flex items-center gap-1.5 bg-stone-100 border border-stone-300 px-2.5 py-1 rounded text-xs font-mono text-stone-800">
                  <span className="italic">{t}</span>
                  <button onClick={() => handleRemoveTerm(t)} className="text-stone-400 hover:text-rose-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 2: GLOSARI */}
      {subTab === 'glosari' && (
        <div className="space-y-4">
          <div className="p-5 border border-stone-200 rounded-xl bg-white space-y-4">
            <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-200 pb-2">
              Glosari Rasmi & Penyelarasan Ejaan Adjung
            </h3>
            <p className="text-xs text-stone-600">
              Penyelarasan istilah piawai antara Bahasa Melayu Akademik dan ejaan tempatan mengikut Kanun Editorial Adjung Brief.
            </p>
            <div className="border border-stone-200 rounded overflow-hidden">
              <table className="w-full text-left font-sans text-xs">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 font-mono text-[10px] uppercase text-stone-500 font-bold">
                    <th className="p-3">Istilah Asal / Awam</th>
                    <th className="p-3">Ejaan Piawai Adjung</th>
                    <th className="p-3">Catatan Notis</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  <tr>
                    <td className="p-3 font-mono text-stone-600">siber space</td>
                    <td className="p-3 font-bold text-stone-900">ruang siber</td>
                    <td className="p-3 text-stone-500">Kekalkan sebagai 2 patah perkataan</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-mono text-stone-600">e-mel / email</td>
                    <td className="p-3 font-bold text-stone-900">e-mel</td>
                    <td className="p-3 text-stone-500">Guna tanda sempang (-) rasmi Dewan Bahasa</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 3: TEMPLAT AI */}
      {subTab === 'ai_prompts' && (
        <div className="space-y-4">
          <div className="p-5 border border-stone-200 rounded-xl bg-white space-y-4">
            <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-200 pb-2">
              Tetapan Prompt & Templat Penjanaan AI (Gemini Core)
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1">a. Prompt Templat Penjanaan Kandungan</label>
                <textarea
                  value={contentPrompt}
                  onChange={(e) => setContentPrompt(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-stone-300 rounded text-xs font-sans focus:outline-none focus:border-[#802334]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1">b. Prompt Templat Semakan (Ejaan, Tatabahasa, Gaya Bahasa & Format)</label>
                <textarea
                  value={reviewPrompt}
                  onChange={(e) => setReviewPrompt(e.target.value)}
                  rows={3}
                  className="w-full p-3 border border-stone-300 rounded text-xs font-sans focus:outline-none focus:border-[#802334]"
                />
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => handleSave('Templat prompt AI berjaya dikemaskini.')}
                  className="px-4 py-1.5 bg-[#802334] hover:bg-[#601824] text-white font-sans text-xs font-semibold rounded transition-colors shadow-xs"
                >
                  Simpan Templat Prompt AI
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 4: HAD AKSARA */}
      {subTab === 'had_aksara' && (
        <div className="space-y-4">
          <div className="p-5 border border-stone-200 rounded-xl bg-white space-y-4">
            <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-200 pb-2">
              Pengurusan Limpahan Teks & Had Aksara Medan
            </h3>
            <p className="text-xs text-stone-600">
              Had aksara tajuk dan huraian ringkas dikawal oleh Reka Bentuk Geometri Bento. Medan tambahan (Topik & Sumber) dihadkan seperti di bawah.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
              <div className="p-3 border border-stone-200 rounded bg-stone-50/50">
                <div className="font-bold text-xs text-stone-900">Had Aksara Topik</div>
                <div className="font-mono text-sm text-[#802334] font-bold mt-0.5">36 Aksara</div>
              </div>
              <div className="p-3 border border-stone-200 rounded bg-stone-50/50">
                <div className="font-bold text-xs text-stone-900">Had Aksara Sumber Dateline</div>
                <div className="font-mono text-sm text-[#802334] font-bold mt-0.5">45 Aksara</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 5: TEMPOH PAPARAN */}
      {subTab === 'tempoh' && (
        <div className="space-y-4">
          <div className="p-5 border border-stone-200 rounded-xl bg-white space-y-4">
            <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-200 pb-2">
              Tempoh Minimum Paparan Kandungan
            </h3>
            <p className="text-xs text-stone-600">
              Tetapkan tempoh minimum hayat paparan (dalam jam) sebelum kandungan aktif secara automatik dilayakkan untuk diarkibkan.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={minDisplayHours}
                onChange={(e) => setMinDisplayHours(Number(e.target.value))}
                min={1}
                max={168}
                className="w-32 px-3 py-1.5 border border-stone-300 rounded text-xs font-mono focus:outline-none focus:border-[#802334]"
              />
              <span className="text-xs font-medium text-stone-700">Jam (Default: 24 Jam)</span>
            </div>
            <div className="flex justify-end pt-2">
              <button
                onClick={() => handleSave('Tempoh minimum paparan berjaya dikemaskini.')}
                className="px-4 py-1.5 bg-[#802334] hover:bg-[#601824] text-white font-sans text-xs font-semibold rounded transition-colors shadow-xs"
              >
                Simpan Tempoh Paparan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
