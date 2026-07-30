import React, { useState, useEffect } from 'react';
import { FileText, Bell, Archive, Send, ShieldCheck, Globe, Lock, Plus, History, Pin } from 'lucide-react';

interface NoteItem {
  id: number;
  title: string;
  content: string;
  type: 'awam' | 'dalaman';
  category: 'notis' | 'am' | 'khas';
  status: 'aktif' | 'arkib';
  author_name: string;
  is_pinned?: number;
  created_at: string;
}

export const NotaKetuaEditorConsole: React.FC = () => {
  const [subTab, setSubTab] = useState<'borang' | 'notis' | 'am' | 'arkib'>('borang');
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form State
  const [title, setTitle] = useState<string>('');
  const [content, setContent] = useState<string>('');
  const [type, setType] = useState<'awam' | 'dalaman'>('dalaman');
  const [category, setCategory] = useState<'notis' | 'am' | 'khas'>('khas');
  const [successMsg, setSuccessMsg] = useState<string>('');

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/system/editor-notes?status=aktif');
      const data = await res.json();
      if (data.success) {
        setNotes(data.notes || []);
      }
    } catch (err) {
      console.error('Error fetching notes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const [confirmArchiveId, setConfirmArchiveId] = useState<number | null>(null);

  const handleSaveDraft = () => {
    if (!title.trim() && !content.trim()) return;
    localStorage.setItem('editor_note_draft', JSON.stringify({ title, content, type, category, savedAt: new Date().toISOString() }));
    setSuccessMsg('Draf nota berjaya disimpan dalam sesi tempatan.');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  useEffect(() => {
    const savedDraft = localStorage.getItem('editor_note_draft');
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed.title) setTitle(parsed.title);
        if (parsed.content) setContent(parsed.content);
        if (parsed.type) setType(parsed.type);
        if (parsed.category) setCategory(parsed.category);
      } catch {}
    }
  }, []);

  const handleTogglePin = async (id: number, currentPinned: boolean) => {
    try {
      const res = await fetch(`/api/system/editor-notes/${id}/pin`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPinned: !currentPinned }),
      });
      const data = await res.json();
      if (data.success) {
        fetchNotes();
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
    }
  };

  const handleConfirmArchive = async () => {
    if (!confirmArchiveId) return;
    try {
      const res = await fetch(`/api/system/editor-notes/${confirmArchiveId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'arkib' }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`Nota #${confirmArchiveId} telah dipindahkan ke arkib.`);
        setTimeout(() => setSuccessMsg(''), 3000);
        fetchNotes();
      }
    } catch (err) {
      console.error('Error archiving note:', err);
    } finally {
      setConfirmArchiveId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      const res = await fetch('/api/system/editor-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          type,
          category,
          authorName: 'Ketua Editor'
        })
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg('Nota Ketua Editor berjaya diterbitkan!');
        setTitle('');
        setContent('');
        fetchNotes();
        setTimeout(() => setSuccessMsg(''), 3000);
      }
    } catch (err) {
      console.error('Error submitting note:', err);
    }
  };

  const handleArchiveNote = async (id: number) => {
    try {
      const res = await fetch(`/api/system/editor-notes/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'arkib' })
      });
      const data = await res.json();
      if (data.success) {
        fetchNotes();
      }
    } catch (err) {
      console.error('Error archiving note:', err);
    }
  };

  return (
    <div className="space-y-6 font-sans bg-[#FDFDFD] text-[#1F1F1F]">
      {/* Header */}
      <div className="pb-4 border-b border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Konsol Nota Ketua Editor
          </h2>
          <p className="text-xs text-stone-500 font-sans mt-0.5">
            Penerbitan Notis Rasmi, Nota Am Peringatan, dan Nota Khas Editorial.
          </p>
        </div>

        {/* Sub-tab Navigation */}
        <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-lg border border-stone-200 text-xs font-medium">
          <button
            onClick={() => setSubTab('borang')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'borang' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Borang Nota Baharu
          </button>
          <button
            onClick={() => setSubTab('notis')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'notis' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Bell className="w-3.5 h-3.5" /> Notis Rasmi ({notes.filter(n => n.category === 'notis').length})
          </button>
          <button
            onClick={() => setSubTab('am')}
            className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5 ${
              subTab === 'am' ? 'bg-[#802334] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <FileText className="w-3.5 h-3.5" /> Nota Am & Khas ({notes.filter(n => n.category !== 'notis').length})
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-600" /> {successMsg}
        </div>
      )}

      {/* SUBTAB 1: BORANG NOTA BAHARU */}
      {subTab === 'borang' && (
        <form onSubmit={handleSubmit} className="p-5 border border-stone-200 rounded-xl bg-white space-y-4 shadow-xs">
          <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-200 pb-2">
            Borang Penerbitan Nota / Notis Baharu
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-900 mb-1">Tajuk Nota / Notis</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Masukkan tajuk rasmi nota..."
                required
                className="w-full px-3 py-1.5 border border-stone-300 rounded text-xs font-sans focus:outline-none focus:border-[#802334]"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1">Kategori Nota</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded text-xs font-sans focus:outline-none focus:border-[#802334]"
                >
                  <option value="khas">Nota Khas</option>
                  <option value="notis">Notis Rasmi</option>
                  <option value="am">Nota Am Peringatan</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-900 mb-1">Skop Capaian</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className="w-full px-3 py-1.5 border border-stone-300 rounded text-xs font-sans focus:outline-none focus:border-[#802334]"
                >
                  <option value="dalaman">🔒 Dalaman (Editorium sahaja)</option>
                  <option value="awam">🌐 Awam (Papar di Frontpage)</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-stone-900 mb-1">Kandungan Nota</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              placeholder="Tulis arahan, garis panduan, atau makluman rasmi di sini..."
              required
              className="w-full p-3 border border-stone-300 rounded text-xs font-sans focus:outline-none focus:border-[#802334]"
            />
          </div>

          <div className="flex justify-end items-center gap-2 pt-2">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-sans text-xs font-semibold rounded transition-colors flex items-center gap-1.5"
            >
              Simpan Draf
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 bg-[#802334] hover:bg-[#601824] text-white font-sans text-xs font-semibold rounded transition-colors shadow-xs flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Terbitkan Nota
            </button>
          </div>
        </form>
      )}

      {/* SENARAI NOTA (NOTIS & AM) */}
      {(subTab === 'notis' || subTab === 'am') && (
        <div className="space-y-3">
          {loading ? (
            <div className="p-8 text-center font-serif text-stone-500 text-xs">Memuatkan senarai nota...</div>
          ) : notes.filter(n => subTab === 'notis' ? n.category === 'notis' : n.category !== 'notis').length === 0 ? (
            <div className="p-8 text-center font-serif text-stone-500 text-xs border border-stone-200 rounded-xl bg-white">
              Tiada rekod nota bagi kategori ini setakat ini.
            </div>
          ) : (
            notes
              .filter(n => subTab === 'notis' ? n.category === 'notis' : n.category !== 'notis')
              .map(n => (
                <div key={n.id} className={`p-4 border rounded-xl bg-white space-y-2 shadow-xs transition-colors ${n.is_pinned ? 'border-amber-400 bg-amber-50/20' : 'border-stone-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {Boolean(n.is_pinned) && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-amber-400 text-stone-950 flex items-center gap-1">
                          <Pin className="w-3 h-3 fill-current" /> Disemat
                        </span>
                      )}
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        n.type === 'awam' ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-stone-100 text-stone-700 border border-stone-300'
                      }`}>
                        {n.type === 'awam' ? '🌐 Awam' : '🔒 Dalaman'}
                      </span>
                      <h4 className="font-serif font-bold text-sm text-stone-900">{n.title}</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleTogglePin(n.id, Boolean(n.is_pinned))}
                        className={`text-xs flex items-center gap-1 font-mono px-2 py-0.5 rounded border transition-colors ${
                          n.is_pinned ? 'bg-amber-100 text-amber-900 border-amber-300' : 'text-stone-400 hover:text-stone-700 border-stone-200'
                        }`}
                        title={n.is_pinned ? 'Batal sematan' : 'Sematkan di atas'}
                      >
                        <Pin className="w-3 h-3" /> {n.is_pinned ? 'Nyahsemat' : 'Semat'}
                      </button>
                      <button
                        onClick={() => setConfirmArchiveId(n.id)}
                        className="text-stone-400 hover:text-red-700 text-xs flex items-center gap-1 font-mono px-2 py-0.5 rounded border border-stone-200"
                      >
                        <Archive className="w-3.5 h-3.5" /> Arkibkan
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-stone-700 font-sans leading-relaxed whitespace-pre-wrap">{n.content}</p>
                  <div className="font-mono text-[10px] text-stone-400 pt-1 border-t border-stone-100 flex items-center justify-between">
                    <span>Oleh: {n.author_name}</span>
                    <span>Tarikh: {new Date(n.created_at).toLocaleString('ms-MY')}</span>
                  </div>
                </div>
              ))
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL BEFORE ARCHIVING */}
      {confirmArchiveId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fadeIn">
          <div className="bg-white border border-stone-200 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-2xl font-sans">
            <h3 className="font-serif font-bold text-stone-900 text-sm border-b border-stone-200 pb-2">
              Pengesahan Arkib Nota
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Adakah anda pasti mahu memindahkan nota #{confirmArchiveId} ini ke dalam arkib? Nota yang diarkibkan tidak lagi dipaparkan di konsol utama.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmArchiveId(null)}
                className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmArchive}
                className="px-3 py-1.5 bg-[#802334] hover:bg-[#601824] text-white text-xs font-semibold rounded transition-colors"
              >
                Ya, Arkibkan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
