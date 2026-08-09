import React, { useCallback, useEffect, useState } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { X, Pencil } from 'lucide-react';
import { labelUi } from '../../config/istilah';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { SectionLabel } from '../common/SectionLabel';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { FormColumn } from '../common/FormColumn';
import { EditorDialog } from '../common/EditorDialog';
import { Tooltip } from '../common/Tooltip';
import { LABEL_BORANG, INPUT_BORANG, KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';

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
  const [menghantarIstilah, setMenghantarIstilah] = useState(false);
  const [confirmBuangIstilah, setConfirmBuangIstilah] = useState('');

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
    if (!term || menghantarIstilah) return;
    setRalatIstilah('');
    setMenghantarIstilah(true);
    try {
      const res = await fetch('/api/system/adjung-typography-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term, style: 'italic', category: 'foreign_term' }),
      });
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menambah istilah.');
      setIstilahBaharu('');
      muatIstilah();
    } catch (e: any) {
      setRalatIstilah(e.message || 'Gagal menambah istilah.');
    } finally {
      setMenghantarIstilah(false);
    }
  };

  const buangIstilah = async (id: string) => {
    try {
      const res = await fetch(`/api/system/adjung-typography-rules/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal memadam istilah.');
      setIstilah((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setRalatIstilah(e.message || 'Gagal memadam istilah.');
    } finally {
      setConfirmBuangIstilah('');
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
  const [menghantarGlosari, setMenghantarGlosari] = useState(false);
  // Borang "tambah istilah" dalam dialog, bukan terpampang kekal (2026-08-07, arahan Izzat —
  // senarai yang utama; borang muncul hanya semasa mencipta).
  const [dialogGlosari, setDialogGlosari] = useState(false);
  const [confirmBuangGlosari, setConfirmBuangGlosari] = useState('');

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
    if (menghantarGlosari) return;
    setRalatGlosari('');
    setMenghantarGlosari(true);
    try {
      const res = await fetch('/api/system/glosari', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ istilah: gIstilah, maksud: gMaksud }),
      });
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan istilah.');
      setGIstilah(''); setGMaksud('');
      setDialogGlosari(false);
      muatGlosari();
    } catch (err: any) {
      setRalatGlosari(err.message || 'Gagal menyimpan istilah.');
    } finally {
      setMenghantarGlosari(false);
    }
  };

  const buangGlosari = async (id: string) => {
    try {
      const res = await fetch(`/api/system/glosari/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal memadam istilah.');
      setGlosari((prev) => prev.filter((g) => g.id !== id));
    } catch (e: any) {
      setRalatGlosari(e.message || 'Gagal memadam istilah.');
    } finally {
      setConfirmBuangGlosari('');
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
  const [menghantarEjaan, setMenghantarEjaan] = useState(false);
  // Borang "tambah ejaan" dalam dialog, bukan terpampang kekal (2026-08-07, arahan Izzat —
  // senarai yang utama; borang muncul hanya semasa mencipta).
  const [dialogEjaan, setDialogEjaan] = useState(false);
  // null = borang "tambah baharu"; id sedia ada = borang sunting entri tu (2026-08-08, permintaan Izzat).
  const [editEjaanId, setEditEjaanId] = useState<string | null>(null);
  const [confirmBuangEjaan, setConfirmBuangEjaan] = useState('');

  const bukaTambahEjaan = () => {
    setEditEjaanId(null);
    setEBetul(''); setEElakkan(''); setECatatan('');
    setRalatEjaan('');
    setDialogEjaan(true);
  };

  const bukaSuntingEjaan = (x: EntriEjaan) => {
    setEditEjaanId(x.id);
    setEBetul(x.betul); setEElakkan(x.elakkan); setECatatan(x.catatan);
    setRalatEjaan('');
    setDialogEjaan(true);
  };

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
    if (menghantarEjaan) return;
    setRalatEjaan('');
    setMenghantarEjaan(true);
    try {
      const res = await fetch(editEjaanId ? `/api/system/ejaan/${editEjaanId}` : '/api/system/ejaan', {
        method: editEjaanId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ betul: eBetul, elakkan: eElakkan, catatan: eCatatan }),
      });
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan bentuk ejaan.');
      setEBetul(''); setEElakkan(''); setECatatan(''); setEditEjaanId(null);
      setDialogEjaan(false);
      muatEjaan();
    } catch (err: any) {
      setRalatEjaan(err.message || 'Gagal menyimpan bentuk ejaan.');
    } finally {
      setMenghantarEjaan(false);
    }
  };

  const buangEjaan = async (id: string) => {
    try {
      const res = await fetch(`/api/system/ejaan/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal memadam bentuk ejaan.');
      setEjaan((prev) => prev.filter((x) => x.id !== id));
    } catch (e: any) {
      setRalatEjaan(e.message || 'Gagal memadam bentuk ejaan.');
    } finally {
      setConfirmBuangEjaan('');
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

  // POST /api/system/settings kini UPDATE separa berpandukan whitelist di pelayan (2026-08-08,
  // Fasa 3 susulan audit keselamatan ChatGPT P2-01) — hantar CUMA medan yang diubah, medan lain
  // (tajuk frontpage, jam dunia, RBAC) dikekalkan terus di pelayan, tak perlu baca+gabung lagi.
  const simpanAi = async () => {
    setMenyimpanAi(true);
    setRalatAi('');
    try {
      const res = await fetch('/api/system/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masterPrompt, reviewPrompt }),
      });
      const data = await bacaJsonSelamat(res).catch(() => ({}));
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

  // Struktur modul (Pelan 01 Fasa D1): SATU kepala modul di atas, kemudian seksyen bernombor
  // berterusan 01–06 mengikut aliran tab sedia ada. Dahulu enam <h3> setara membuatkan setiap
  // sub-tab kelihatan seperti modul berasingan, sedangkan kesemuanya satu modul Editorial.
  // Susunan tab dan teksnya TIDAK diubah — susunan navigasi ialah keputusan pemilik projek.
  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Editorial"
        huraian="Peraturan bahasa dan templat penjanaan AI: istilah autocondong, glosari pembaca, penyelarasan ejaan, dan templat arahan AI."
      />

      <div className="flex flex-wrap gap-1 border-b border-stone-200 text-xs">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id)}
            className={`px-4 py-2 font-semibold tracking-wide transition-all border-b-2 cursor-pointer ${
              subTab === t.id
                ? 'text-Adjung-maroon border-Adjung-maroon bg-stone-50'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 1. AUTOCONDONG */}
      {subTab === 'autocondong' && (
        <PanelCard className="space-y-4 text-xs">
          <div>
            <SectionLabel>01 — Istilah Autocondong</SectionLabel>
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
              placeholder="Tambah istilah (contoh: machine learning)"
              className={`${INPUT_BORANG} flex-1`}
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={tambahIstilah}
              disabled={menghantarIstilah || !istilahBaharu.trim()}
            >
              {menghantarIstilah ? 'Menambah…' : '+ Tambah'}
            </Button>
          </div>

          {ralatIstilah && <MesejStatus tone="error">{ralatIstilah}</MesejStatus>}

          <div className="flex flex-wrap gap-2">
            {memuatIstilah && <span className="text-stone-400">Memuatkan…</span>}
            {!memuatIstilah && istilah.length === 0 && (
              <KeadaanKosong className="w-full">Senarai masih kosong.</KeadaanKosong>
            )}
            {istilah.map((t) => (
              <span key={t.id} className="bg-stone-100 border border-stone-200 text-stone-800 px-2.5 py-1 rounded flex items-center gap-1.5">
                <span className="italic font-semibold">{t.term}</span>
                {t.status !== 'active' && (
                  <StatusBadge tone="warning" label="Belum Aktif" />
                )}
                {confirmBuangIstilah === t.id ? (
                  <span className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => buangIstilah(t.id)}
                      className="text-[10px] font-bold text-[var(--color-error)] hover:underline cursor-pointer"
                    >
                      Buang?
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmBuangIstilah('')}
                      className="text-[10px] text-stone-500 hover:underline cursor-pointer"
                    >
                      Batal
                    </button>
                  </span>
                ) : (
                  <Tooltip text="Buang istilah">
                    <button
                      type="button"
                      onClick={() => setConfirmBuangIstilah(t.id)}
                      aria-label="Buang istilah"
                      className="text-stone-400 hover:text-[var(--color-error)] cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Tooltip>
                )}
              </span>
            ))}
          </div>

          <p className="text-stone-400 text-[10px] border-t border-stone-200 pt-3 leading-relaxed">
            Untuk skop, bahasa, keutamaan, dan kekecualian setiap peraturan, guna panel Peraturan Tipografi penuh
            di Tetapan Slot (frontpage) — senarai di sini dan di sana ialah data yang sama.
          </p>
        </PanelCard>
      )}

      {/* 2. GLOSARI */}
      {subTab === 'glosari' && (
        <div className="space-y-4">
          {dialogGlosari && (
            <EditorDialog
              tajuk="Tambah Istilah Glosari"
              onTutup={() => { setDialogGlosari(false); setRalatGlosari(''); }}
              saiz="lg"
              tindakan={
                <>
                  <Button variant="secondary" onClick={() => { setDialogGlosari(false); setRalatGlosari(''); }}>
                    Batal
                  </Button>
                  {/* `form=` menyambung butang di kaki dialog kepada borang di dalam `children` —
                      EditorDialog merender tindakan sebagai ADIK-BERADIK kepada children, jadi
                      butang ni berada di luar <form> dan tidak boleh menghantarnya secara tersirat. */}
                  <Button
                    type="submit" form="borang-glosari" variant="primary"
                    disabled={menghantarGlosari || !gIstilah.trim() || !gMaksud.trim()}
                  >
                    {menghantarGlosari ? 'Menambah…' : 'Tambah'}
                  </Button>
                </>
              }
            >
              <form id="borang-glosari" onSubmit={tambahGlosari} className="space-y-4">
                {/* Istilah lebih sempit daripada lajur borang — ia satu perkataan, bukan ayat.
                    Medan yang kelihatan sepanjang textarea di bawahnya memberi isyarat salah
                    tentang berapa panjang yang dijangka. */}
                <FormColumn saiz="sm">
                  <label className="block">
                    <span className={LABEL_BORANG}>Istilah</span>
                    <input
                      type="text" value={gIstilah} onChange={(e) => setGIstilah(e.target.value)}
                      placeholder="contoh: Bidang"
                      className={INPUT_BORANG}
                    />
                  </label>
                </FormColumn>

                {/* Maksud WAJIB (2026-08-07) — dahulu dilabel "(pilihan)", tetapi sejak Glosari
                    bertukar menjadi tooltip pembaca, binaPetaGlosari() (src/components/common/
                    IstilahGlosari.tsx) MELANGKAU terus mana-mana entri tanpa maksud. Entri tanpa
                    maksud tidak melakukan apa-apa langsung — data mati. */}
                <label className="block">
                  <span className={LABEL_BORANG}>Maksud</span>
                  <textarea
                    value={gMaksud} onChange={(e) => setGMaksud(e.target.value)} rows={3}
                    placeholder="Penjelasan ringkas untuk pembaca"
                    className={`${INPUT_BORANG} resize-y`}
                  />
                </label>

                {ralatGlosari && <MesejStatus tone="error">{ralatGlosari}</MesejStatus>}
              </form>
            </EditorDialog>
          )}

          <PanelCard className="space-y-3 text-xs">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionLabel>02 — Glosari ({glosari.length})</SectionLabel>
                <p className="text-stone-500 text-xs max-w-[680px]">
                  Istilah dan maksudnya, dipaparkan kepada pembaca. Kali pertama sesuatu istilah
                  muncul dalam tajuk atau huraian sebuah artikel, istilah itu digaris putus-putus
                  dan maksudnya dipaparkan sebagai tooltip apabila dihover. Untuk bentuk ejaan yang
                  betul berbanding bentuk yang dielakkan, gunakan tab{' '}
                  <strong className="font-semibold">Penyelarasan Ejaan</strong>.
                </p>
              </div>
              <Button variant="primary" onClick={() => setDialogGlosari(true)} className="shrink-0">
                + Tambah Istilah
              </Button>
            </div>
            {memuatGlosari ? (
              <KeadaanMemuat baris={4} />
            ) : glosari.length === 0 ? (
              <KeadaanKosong>Glosari masih kosong.</KeadaanKosong>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={KEPALA_JADUAL}>
                      <th className="p-2.5">Istilah</th>
                      <th className="p-2.5">Maksud</th>
                      <th className="p-2.5"><span className="sr-only">Tindakan</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {glosari.map((g) => (
                      <tr key={g.id} className={`hover:bg-stone-50 ${GARIS_BARIS}`}>
                        <td className="p-2.5 font-semibold text-stone-800">{g.istilah}</td>
                        <td className="p-2.5 text-stone-600">{g.maksud || <span className="text-stone-300">—</span>}</td>
                        <td className="p-2.5 text-right">
                          {confirmBuangGlosari === g.id ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                              <span className="text-[10px] text-stone-500">Buang?</span>
                              <button
                                type="button"
                                onClick={() => buangGlosari(g.id)}
                                className="text-[10px] font-bold text-[var(--color-error)] hover:underline cursor-pointer"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmBuangGlosari('')}
                                className="text-[10px] text-stone-500 hover:underline cursor-pointer"
                              >
                                Batal
                              </button>
                            </span>
                          ) : (
                            <Tooltip text="Buang daripada glosari">
                              <button
                                type="button"
                                onClick={() => setConfirmBuangGlosari(g.id)}
                                aria-label="Buang daripada glosari"
                                className="text-stone-400 hover:text-[var(--color-error)] cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelCard>
        </div>
      )}

      {/* 3. PENYELARASAN EJAAN */}
      {subTab === 'ejaan' && (
        <div className="space-y-4">
          {dialogEjaan && (
            <EditorDialog
              tajuk={editEjaanId ? 'Sunting Bentuk Ejaan' : 'Tambah Bentuk Ejaan'}
              onTutup={() => { setDialogEjaan(false); setEditEjaanId(null); setRalatEjaan(''); }}
              saiz="lg"
              tindakan={
                <>
                  <Button variant="secondary" onClick={() => { setDialogEjaan(false); setEditEjaanId(null); setRalatEjaan(''); }}>
                    Batal
                  </Button>
                  {/* `form=` menyambung butang di kaki dialog kepada borang di dalam `children` —
                      EditorDialog merender tindakan sebagai ADIK-BERADIK kepada children, jadi
                      butang ini berada di luar <form> dan tidak boleh menghantarnya secara tersirat. */}
                  <Button
                    type="submit" form="borang-ejaan" variant="primary"
                    disabled={menghantarEjaan || !eBetul.trim()}
                  >
                    {menghantarEjaan ? 'Menyimpan…' : (editEjaanId ? 'Simpan' : 'Tambah')}
                  </Button>
                </>
              }
            >
              <form id="borang-ejaan" onSubmit={tambahEjaan} className="space-y-4">
                {/* Kedua-dua medan ini satu perkataan sahaja — grid dua lajur dikekalkan, tetapi
                    dihadkan kepada lebar lajur borang pendek supaya ia tidak terbentang. */}
                <FormColumn saiz="md">
                  <div className="grid grid-cols-2 gap-4">
                    <label className="block">
                      <span className={LABEL_BORANG}>Bentuk betul</span>
                      <input
                        type="text" value={eBetul} onChange={(e) => setEBetul(e.target.value)}
                        placeholder="contoh: kerana"
                        className={INPUT_BORANG}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL_BORANG}>Elakkan (pilihan)</span>
                      <input
                        type="text" value={eElakkan} onChange={(e) => setEElakkan(e.target.value)}
                        placeholder="contoh: kerena, krn"
                        className={INPUT_BORANG}
                      />
                    </label>
                  </div>
                </FormColumn>

                <FormColumn saiz="lg">
                  <label className="block">
                    <span className={LABEL_BORANG}>Catatan (pilihan)</span>
                    <textarea
                      value={eCatatan} onChange={(e) => setECatatan(e.target.value)} rows={2}
                      placeholder="Nota ringkas, contoh sumber kesilapan biasa"
                      className={`${INPUT_BORANG} resize-y`}
                    />
                  </label>
                </FormColumn>

                {ralatEjaan && <MesejStatus tone="error">{ralatEjaan}</MesejStatus>}
              </form>
            </EditorDialog>
          )}

          <PanelCard className="space-y-3 text-xs">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SectionLabel>03 — Penyelarasan Ejaan ({ejaan.length})</SectionLabel>
                <p className="text-stone-500 text-xs max-w-[680px]">
                  Bentuk ejaan yang betul berbanding bentuk yang kerap tersilap tulis. Berbeza
                  daripada <strong className="font-semibold">Glosari</strong>, senarai ini rujukan
                  dalaman untuk editor sahaja — ia tidak dipaparkan kepada pembaca.
                </p>
              </div>
              <Button variant="primary" onClick={bukaTambahEjaan} className="shrink-0">
                + Tambah Ejaan
              </Button>
            </div>
            {memuatEjaan ? (
              <KeadaanMemuat baris={4} />
            ) : ejaan.length === 0 ? (
              <KeadaanKosong>Senarai ejaan masih kosong.</KeadaanKosong>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className={KEPALA_JADUAL}>
                      <th className="p-2.5">Bentuk betul</th>
                      <th className="p-2.5">Elakkan</th>
                      <th className="p-2.5">Catatan</th>
                      <th className="p-2.5"><span className="sr-only">Tindakan</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ejaan.map((x) => (
                      <tr key={x.id} className={`hover:bg-stone-50 ${GARIS_BARIS}`}>
                        <td className="p-2.5 font-semibold text-stone-800">{x.betul}</td>
                        <td className="p-2.5 text-stone-500">{x.elakkan || <span className="text-stone-300">—</span>}</td>
                        <td className="p-2.5 text-stone-600">{x.catatan || <span className="text-stone-300">—</span>}</td>
                        <td className="p-2.5 text-right">
                          {confirmBuangEjaan === x.id ? (
                            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                              <span className="text-[10px] text-stone-500">Buang?</span>
                              <button
                                type="button"
                                onClick={() => buangEjaan(x.id)}
                                className="text-[10px] font-bold text-[var(--color-error)] hover:underline cursor-pointer"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmBuangEjaan('')}
                                className="text-[10px] text-stone-500 hover:underline cursor-pointer"
                              >
                                Batal
                              </button>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-2.5">
                              <Tooltip text="Sunting bentuk ejaan">
                                <button
                                  type="button"
                                  onClick={() => bukaSuntingEjaan(x)}
                                  aria-label="Sunting bentuk ejaan"
                                  className="text-stone-400 hover:text-Adjung-maroon cursor-pointer"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                              <Tooltip text="Buang daripada senarai ejaan">
                                <button
                                  type="button"
                                  onClick={() => setConfirmBuangEjaan(x.id)}
                                  aria-label="Buang daripada senarai ejaan"
                                  className="text-stone-400 hover:text-[var(--color-error)] cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </PanelCard>
        </div>
      )}

      {/* 4. TEMPLAT AI */}
      {subTab === 'ai' && (
        <PanelCard className="space-y-4 text-xs">
          <div>
            <SectionLabel>04 — Templat Penjanaan AI</SectionLabel>
            <p className="text-stone-500 text-xs">
              Peraturan am yang dimasukkan ke dalam setiap prompt AI. Templat kandungan di bawah digunakan
              sebagai "Peraturan Am" dalam Tulis Kandungan. Perubahan pada templat ini akan mengubah arahan
              yang digunakan oleh editor semasa menjana kandungan.
            </p>
          </div>

          {memuatAi ? (
            <KeadaanMemuat baris={4} />
          ) : (
            <>
              {/* Borang sunting-di-tempat (bukan borang "tambah item"), jadi ia kekal terpampang —
                  tetapi lebarnya dihadkan supaya textarea tidak terbentang seluruh skrin. */}
              <FormColumn saiz="lg">
                <label className="block">
                  <span className={LABEL_BORANG}>
                    Templat penjanaan kandungan
                  </span>
                  <textarea
                    value={masterPrompt}
                    onChange={(e) => setMasterPrompt(e.target.value)}
                    rows={4}
                    placeholder="Contoh: Gunakan bahasa Melayu baku, elakkan jargon, nada formal dan tidak emosional"
                    className={`${INPUT_BORANG} resize-y`}
                  />
                </label>
              </FormColumn>

              <FormColumn saiz="lg">
                <label className="block">
                  <span className={LABEL_BORANG}>
                    Templat semakan (ejaan, tatabahasa, gaya bahasa, format)
                  </span>
                  <textarea
                    value={reviewPrompt}
                    onChange={(e) => setReviewPrompt(e.target.value)}
                    rows={4}
                    placeholder="Contoh arahan: Semak ejaan, tatabahasa, gaya bahasa akademik dan format perenggan teks berikut."
                    className={`${INPUT_BORANG} resize-y`}
                  />
                  <span className="block mt-1 text-stone-400 text-[10px]">
                    Templat semakan ini disimpan untuk kegunaan kemudian. Ciri semakan AI belum tersedia dalam Editorium.
                  </span>
                </label>
              </FormColumn>

              {ralatAi && <MesejStatus tone="error">{ralatAi}</MesejStatus>}

              <div className="flex items-center justify-end gap-3">
                {mesejAi && <span className="text-[var(--color-success)] text-[11px] font-semibold">{mesejAi}</span>}
                <Button type="button" variant="primary" size="md" onClick={simpanAi} disabled={menyimpanAi}>
                  {menyimpanAi ? 'Menyimpan…' : 'Simpan Templat'}
                </Button>
              </div>
            </>
          )}

          <p className="text-stone-400 text-[10px] border-t border-stone-200 pt-3 leading-relaxed">
            Had aksara setiap kad ditetapkan di Slot → Tier Kad. Had aksara medan lain ditetapkan di
            Slot → Tetapan Am.
            <br />
            Selang masa putaran karusel ditetapkan bagi setiap slot melalui borang Tulis Kandungan.
            Tetapan ini tidak dikendalikan di sini bagi mengelakkan pertindihan konfigurasi.
          </p>
        </PanelCard>
      )}
    </div>
  );
};

export default EditorialConsole;
