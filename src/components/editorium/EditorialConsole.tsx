import React, { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { labelUi } from '../../config/istilah';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';

// Konsol Editorial (2026-08-01, spesifikasi pemilik projek) — peraturan BAHASA dan penjanaan AI,
// berasingan daripada Tetapan (tetapan sistem) dan Slot (geometri kad).
//
// Setiap kawalan di sini menulis ke pangkalan data sebenar. Kalau sesuatu perkara dalam spesifikasi
// sudah ada rumah di tempat lain (had aksara di Tier Kad, selang masa carousel di borang Urus Slot), ia
// DIRUJUK ke sana, bukan disalin jadi kawalan kedua — dua kawalan untuk satu nilai bermakna
// dua-duanya akhirnya bercanggah.
type SubTab = 'autocondong' | 'glosari' | 'ejaan' | 'ai';

interface Istilah { id: string; term: string; status: string }
interface EntriGlosari { id: string; istilah: string; elakkan: string; maksud: string }
interface EntriEjaan { id: string; betul: string; elakkan: string; catatan: string }

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'autocondong', label: '1. Autocondong' },
  { id: 'glosari', label: '2. Glosari' },
  { id: 'ejaan', label: '3. Penyelarasan Ejaan' },
  { id: 'ai', label: '4. Templat AI' },
];

export const EditorialConsole: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('autocondong');

  // ── Autocondong ──────────────────────────────────────────────────────────────
  // Menggunakan jadual adjung_typography_rules yang SAMA seperti panel Peraturan Tipografi penuh
  // (Tetapan Slot di frontpage) — bukan senarai berasingan, supaya kedua-dua tempat tak boleh
  // terpesong antara satu sama lain.
  const [istilah, setIstilah] = useState<Istilah[]>([]);
  const [memuatIstilah, setMemuatIstilah] = useState(true);
  const [istilahBaharu, setIstilahBaharu] = useState('');
  const [ralatIstilah, setRalatIstilah] = useState('');

  const muatIstilah = useCallback(() => {
    setMemuatIstilah(true);
    fetch('/api/system/adjung-typography-rules')
      .then((r) => r.json())
      .then((rules) => setIstilah(
        (rules || [])
          .filter((r: any) => r.style === 'italic')
          .map((r: any) => ({ id: r.id, term: r.term, status: r.status || 'active' }))
      ))
      .catch(() => setRalatIstilah('Gagal membaca senarai istilah.'))
      .finally(() => setMemuatIstilah(false));
  }, []);

  const tambahIstilah = async () => {
    const term = istilahBaharu.trim().toLowerCase();
    if (!term) return;
    setRalatIstilah('');
    try {
      const res = await fetch('/api/system/adjung-typography-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, style: 'italic', category: 'foreign_term' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menambah istilah.');
      setIstilahBaharu('');
      muatIstilah();
    } catch (e: any) {
      setRalatIstilah(e.message || 'Gagal menambah istilah.');
    }
  };

  const buangIstilah = async (id: string) => {
    try {
      const res = await fetch(`/api/system/adjung-typography-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal memadam istilah.');
      setIstilah((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setRalatIstilah(e.message || 'Gagal memadam istilah.');
    }
  };

  // ── Glosari ──────────────────────────────────────────────────────────────────
  // Rujukan definisi istilah sahaja (dipisahkan daripada Penyelarasan Ejaan di bawah, 2026-08-02
  // Fasa 8 — sebelum ni bergabung dalam satu jadual/borang walaupun dua tujuan berbeza).
  const [glosari, setGlosari] = useState<EntriGlosari[]>([]);
  const [memuatGlosari, setMemuatGlosari] = useState(true);
  const [gIstilah, setGIstilah] = useState('');
  const [gMaksud, setGMaksud] = useState('');
  const [ralatGlosari, setRalatGlosari] = useState('');

  const muatGlosari = useCallback(() => {
    setMemuatGlosari(true);
    fetch('/api/system/glosari')
      .then((r) => r.json())
      .then((d) => setGlosari(Array.isArray(d) ? d : []))
      .catch(() => setRalatGlosari('Gagal membaca glosari.'))
      .finally(() => setMemuatGlosari(false));
  }, []);

  const tambahGlosari = async (e: React.FormEvent) => {
    e.preventDefault();
    setRalatGlosari('');
    try {
      const res = await fetch('/api/system/glosari', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ istilah: gIstilah, maksud: gMaksud }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan istilah.');
      setGIstilah(''); setGMaksud('');
      muatGlosari();
    } catch (err: any) {
      setRalatGlosari(err.message || 'Gagal menyimpan istilah.');
    }
  };

  const buangGlosari = async (id: string) => {
    try {
      const res = await fetch(`/api/system/glosari/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal memadam istilah.');
      setGlosari((prev) => prev.filter((g) => g.id !== id));
    } catch (e: any) {
      setRalatGlosari(e.message || 'Gagal memadam istilah.');
    }
  };

  // ── Penyelarasan Ejaan ───────────────────────────────────────────────────────
  // Pasangan bentuk betul vs bentuk dielakkan (jadual ejaan_piawai, berasingan daripada glosari_istilah).
  const [ejaan, setEjaan] = useState<EntriEjaan[]>([]);
  const [memuatEjaan, setMemuatEjaan] = useState(true);
  const [eBetul, setEBetul] = useState('');
  const [eElakkan, setEElakkan] = useState('');
  const [eCatatan, setECatatan] = useState('');
  const [ralatEjaan, setRalatEjaan] = useState('');

  const muatEjaan = useCallback(() => {
    setMemuatEjaan(true);
    fetch('/api/system/ejaan')
      .then((r) => r.json())
      .then((d) => setEjaan(Array.isArray(d) ? d : []))
      .catch(() => setRalatEjaan('Gagal membaca senarai ejaan.'))
      .finally(() => setMemuatEjaan(false));
  }, []);

  const tambahEjaan = async (e: React.FormEvent) => {
    e.preventDefault();
    setRalatEjaan('');
    try {
      const res = await fetch('/api/system/ejaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betul: eBetul, elakkan: eElakkan, catatan: eCatatan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan bentuk ejaan.');
      setEBetul(''); setEElakkan(''); setECatatan('');
      muatEjaan();
    } catch (err: any) {
      setRalatEjaan(err.message || 'Gagal menyimpan bentuk ejaan.');
    }
  };

  const buangEjaan = async (id: string) => {
    try {
      const res = await fetch(`/api/system/ejaan/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal memadam bentuk ejaan.');
      setEjaan((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setRalatEjaan(e.message || 'Gagal memadam bentuk ejaan.');
    }
  };

  // ── Templat AI ───────────────────────────────────────────────────────────────
  // masterPrompt (penjanaan kandungan) sudah wujud dan DIBACA oleh pembina prompt di Urus Slot —
  // menyuntingnya di sini mengubah prompt sebenar yang editor salin, bukan salinan berasingan.
  // reviewPrompt (semakan: ejaan/tatabahasa/gaya/format) lajur baharu untuk tujuan sama.
  const [masterPrompt, setMasterPrompt] = useState('');
  const [reviewPrompt, setReviewPrompt] = useState('');
  const [memuatAi, setMemuatAi] = useState(true);
  const [menyimpanAi, setMenyimpanAi] = useState(false);
  const [ralatAi, setRalatAi] = useState('');
  const [mesejAi, setMesejAi] = useState('');

  const muatAi = useCallback(() => {
    setMemuatAi(true);
    fetch('/api/db-state')
      .then((r) => r.json())
      .then((d) => {
        const s = d.systemSettings || {};
        setMasterPrompt(s.masterPrompt || '');
        setReviewPrompt(s.reviewPrompt || '');
      })
      .catch(() => setRalatAi('Gagal membaca templat AI.'))
      .finally(() => setMemuatAi(false));
  }, []);

  // system_settings disimpan sebagai INSERT OR REPLACE penuh di pelayan — baca baris semasa dan
  // gabungkan medan yang diubah sahaja, atau tetapan lain (tajuk frontpage, jam dunia, RBAC)
  // terpadam senyap.
  const simpanAi = async () => {
    setMenyimpanAi(true);
    setRalatAi('');
    try {
      const semasa = await fetch('/api/db-state').then((r) => r.json());
      const gabung = { ...(semasa.systemSettings || {}), masterPrompt, reviewPrompt };
      const res = await fetch('/api/system/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gabung),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan templat AI.');
      setMesejAi(labelUi('toast.templat_ai_disimpan'));
      setTimeout(() => setMesejAi(''), 2400);
    } catch (e: any) {
      setRalatAi(e.message || 'Gagal menyimpan templat AI.');
    } finally {
      setMenyimpanAi(false);
    }
  };

  useEffect(() => {
    if (subTab === 'autocondong') muatIstilah();
    if (subTab === 'glosari') muatGlosari();
    if (subTab === 'ejaan') muatEjaan();
    if (subTab === 'ai') muatAi();
  }, [subTab, muatIstilah, muatGlosari, muatEjaan, muatAi]);

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-wrap gap-1 border-b border-stone-200 text-xs">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 font-semibold tracking-wide transition-all border-b-2 cursor-pointer ${
              subTab === t.id
                ? 'text-[var(--color-Adjung-maroon)] bg-stone-50'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
            style={subTab === t.id ? { borderColor: 'var(--color-Adjung-maroon)' } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. AUTOCONDONG */}
      {subTab === 'autocondong' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
          <div>
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">Istilah Autocondong</h3>
            <p className="text-stone-500 text-xs">
              Perkataan di sini dicondongkan secara automatik semasa paparan. Ia mengubah PAPARAN sahaja —
              kandungan editorial yang tersimpan tidak pernah disentuh.
            </p>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={istilahBaharu}
              onChange={(e) => setIstilahBaharu(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); tambahIstilah(); } }}
              placeholder="Tambah istilah (contoh: machine learning)…"
              className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs flex-1"
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={tambahIstilah}
              disabled={!istilahBaharu.trim()}
            >
              + Tambah
            </Button>
          </div>

          {ralatIstilah && (
            <p className="text-[var(--color-error)] bg-[color-mix(in_srgb,var(--color-error)_8%,white)] border border-[color-mix(in_srgb,var(--color-error)_35%,white)] rounded px-3 py-2 text-[11px]">{ralatIstilah}</p>
          )}

          <div className="flex flex-wrap gap-2">
            {memuatIstilah && <span className="text-stone-400">Memuatkan…</span>}
            {!memuatIstilah && istilah.length === 0 && <span className="text-stone-400 italic">Senarai masih kosong.</span>}
            {istilah.map((t) => (
              <span key={t.id} className="bg-stone-100 border border-stone-200 text-stone-800 px-2.5 py-1 rounded flex items-center gap-1.5">
                <span className="italic font-semibold">{t.term}</span>
                {t.status !== 'active' && (
                  <StatusBadge tone="warning" label="Belum Aktif" />
                )}
                <button
                  type="button"
                  onClick={() => buangIstilah(t.id)}
                  className="text-stone-400 hover:text-[var(--color-error)] cursor-pointer"
                  title="Buang istilah"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>

          <p className="text-stone-400 text-[10px] border-t border-stone-200 pt-3 leading-relaxed">
            Untuk skop, bahasa, keutamaan, dan kekecualian setiap peraturan, guna panel Peraturan Tipografi penuh
            di Tetapan Slot (frontpage) — senarai di sini dan di sana ialah data yang sama.
          </p>
        </div>
      )}

      {/* 2. GLOSARI */}
      {subTab === 'glosari' && (
        <div className="space-y-4">
          <form onSubmit={tambahGlosari} className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
            <div>
              <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">Glosari</h3>
              <p className="text-stone-500 text-xs">
                Senarai rujukan istilah dan maksud/nota penggunaannya untuk editor menulis manual. Ia rujukan
                pasif sahaja — sistem tidak sesekali menulis-ganti kandungan sedia ada berdasarkan senarai ni.
                Untuk bentuk ejaan betul vs dielakkan, guna tab <strong className="font-semibold">Penyelarasan Ejaan</strong>.
              </p>
            </div>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Istilah</span>
              <input
                type="text" value={gIstilah} onChange={(e) => setGIstilah(e.target.value)}
                placeholder="contoh: Bidang"
                className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Maksud / nota penggunaan (pilihan)</span>
              <textarea
                value={gMaksud} onChange={(e) => setGMaksud(e.target.value)} rows={2}
                placeholder="Penjelasan ringkas istilah ni, atau bila ia digunakan…"
                className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs resize-y"
              />
            </label>

            {ralatGlosari && (
              <p className="text-[var(--color-error)] bg-[color-mix(in_srgb,var(--color-error)_8%,white)] border border-[color-mix(in_srgb,var(--color-error)_35%,white)] rounded px-3 py-2 text-[11px]">{ralatGlosari}</p>
            )}

            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="md" disabled={!gIstilah.trim()}>
                + Tambah ke Glosari
              </Button>
            </div>
          </form>

          <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-3 text-xs">
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
              Senarai Glosari ({glosari.length})
            </h3>
            {memuatGlosari ? (
              <p className="text-stone-400 py-6 text-center">Memuatkan glosari…</p>
            ) : glosari.length === 0 ? (
              <p className="text-stone-400 py-10 text-center">Glosari masih kosong.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-200 font-sans text-[10px] uppercase text-stone-600 font-semibold">
                      <th className="p-2.5">Istilah</th>
                      <th className="p-2.5">Maksud</th>
                      <th className="p-2.5"><span className="sr-only">Tindakan</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {glosari.map((g) => (
                      <tr key={g.id} className="hover:bg-stone-50">
                        <td className="p-2.5 font-semibold text-stone-800">{g.istilah}</td>
                        <td className="p-2.5 text-stone-600">{g.maksud || <span className="text-stone-300">—</span>}</td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => buangGlosari(g.id)}
                            className="text-stone-400 hover:text-[var(--color-error)] cursor-pointer"
                            title="Buang daripada glosari"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. PENYELARASAN EJAAN */}
      {subTab === 'ejaan' && (
        <div className="space-y-4">
          <form onSubmit={tambahEjaan} className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
            <div>
              <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">Penyelarasan Ejaan</h3>
              <p className="text-stone-500 text-xs">
                Senarai rujukan bentuk ejaan yang betul berbanding bentuk yang kerap tersilap tulis/dielakkan.
                Ia rujukan pasif untuk editor — sistem tidak sesekali menulis-ganti kandungan sedia ada
                berdasarkan senarai ni.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Bentuk betul</span>
                <input
                  type="text" value={eBetul} onChange={(e) => setEBetul(e.target.value)}
                  placeholder="contoh: kerana"
                  className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Elakkan (pilihan)</span>
                <input
                  type="text" value={eElakkan} onChange={(e) => setEElakkan(e.target.value)}
                  placeholder="contoh: kerena, krn"
                  className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
                />
              </label>
            </div>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Catatan (pilihan)</span>
              <textarea
                value={eCatatan} onChange={(e) => setECatatan(e.target.value)} rows={2}
                placeholder="Nota ringkas, contoh sumber kesilapan biasa…"
                className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs resize-y"
              />
            </label>

            {ralatEjaan && (
              <p className="text-[var(--color-error)] bg-[color-mix(in_srgb,var(--color-error)_8%,white)] border border-[color-mix(in_srgb,var(--color-error)_35%,white)] rounded px-3 py-2 text-[11px]">{ralatEjaan}</p>
            )}

            <div className="flex justify-end">
              <Button type="submit" variant="primary" size="md" disabled={!eBetul.trim()}>
                + Tambah ke Senarai Ejaan
              </Button>
            </div>
          </form>

          <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-3 text-xs">
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
              Senarai Ejaan ({ejaan.length})
            </h3>
            {memuatEjaan ? (
              <p className="text-stone-400 py-6 text-center">Memuatkan senarai ejaan…</p>
            ) : ejaan.length === 0 ? (
              <p className="text-stone-400 py-10 text-center">Senarai ejaan masih kosong.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-100 border-b border-stone-200 font-sans text-[10px] uppercase text-stone-600 font-semibold">
                      <th className="p-2.5">Bentuk betul</th>
                      <th className="p-2.5">Elakkan</th>
                      <th className="p-2.5">Catatan</th>
                      <th className="p-2.5"><span className="sr-only">Tindakan</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {ejaan.map((x) => (
                      <tr key={x.id} className="hover:bg-stone-50">
                        <td className="p-2.5 font-semibold text-stone-800">{x.betul}</td>
                        <td className="p-2.5 text-stone-500">{x.elakkan || <span className="text-stone-300">—</span>}</td>
                        <td className="p-2.5 text-stone-600">{x.catatan || <span className="text-stone-300">—</span>}</td>
                        <td className="p-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => buangEjaan(x.id)}
                            className="text-stone-400 hover:text-[var(--color-error)] cursor-pointer"
                            title="Buang daripada senarai ejaan"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. TEMPLAT AI */}
      {subTab === 'ai' && (
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
          <div>
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">Templat Penjanaan AI</h3>
            <p className="text-stone-500 text-xs">
              Peraturan am yang dimasukkan ke dalam setiap prompt AI. Templat kandungan di bawah ialah yang
              SAMA dipapar sebagai "Peraturan Am" dalam Urus Slot — menyuntingnya di sini mengubah prompt
              sebenar yang editor salin.
            </p>
          </div>

          {memuatAi ? (
            <p className="text-stone-400 py-6 text-center">Memuatkan templat…</p>
          ) : (
            <>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
                  Templat penjanaan kandungan
                </span>
                <textarea
                  value={masterPrompt}
                  onChange={(e) => setMasterPrompt(e.target.value)}
                  rows={4}
                  placeholder="Contoh: Gunakan bahasa Melayu baku, elakkan jargon, nada formal dan tidak emosional…"
                  className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs resize-y"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
                  Templat semakan (ejaan, tatabahasa, gaya bahasa, format)
                </span>
                <textarea
                  value={reviewPrompt}
                  onChange={(e) => setReviewPrompt(e.target.value)}
                  rows={4}
                  placeholder="Contoh: Semak ejaan, tatabahasa, gaya bahasa akademik dan format perenggan teks berikut…"
                  className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs resize-y"
                />
                <span className="text-stone-400 text-[10px]">
                  Templat semakan disimpan tetapi belum disambungkan ke mana-mana butang semakan — belum ada
                  alur kerja semakan AI dalam Editorium setakat ini.
                </span>
              </label>

              {ralatAi && (
                <p className="text-[var(--color-error)] bg-[color-mix(in_srgb,var(--color-error)_8%,white)] border border-[color-mix(in_srgb,var(--color-error)_35%,white)] rounded px-3 py-2 text-[11px]">{ralatAi}</p>
              )}

              <div className="flex items-center justify-end gap-3">
                {mesejAi && <span className="text-[var(--color-success)] text-[11px] font-semibold">{mesejAi}</span>}
                <Button type="button" variant="primary" size="md" onClick={simpanAi} disabled={menyimpanAi}>
                  {menyimpanAi ? 'Menyimpan…' : 'Simpan Templat'}
                </Button>
              </div>
            </>
          )}

          <p className="text-stone-400 text-[10px] border-t border-stone-200 pt-3 leading-relaxed">
            Had aksara setiap tier kad diuruskan di Slot → Tier Kad; had aksara medan lain diuruskan di
            Slot → Tetapan Am. Selang masa putaran carousel (tempoh setiap kandungan dipaparkan sebelum
            beralih) ditetapkan per-slot di borang Urus Slot (frontpage), bukan di sini atau di Tetapan Am —
            ia sengaja tiada di sini supaya satu nilai tak ada dua tempat yang boleh bercanggah.
          </p>
        </div>
      )}
    </div>
  );
};

export default EditorialConsole;
