import React, { useCallback, useEffect, useState } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { BadgeCheck, ClipboardPaste, Copy, Pencil, Power, Trash2, Check, SkipForward, TriangleAlert, X } from 'lucide-react';
import { KATEGORI_PETIKAN } from '../../../core/editorial/PetikanConfig.js';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { SectionLabel } from '../common/SectionLabel';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { FormColumn } from '../common/FormColumn';
import { LABEL_BORANG, INPUT_BORANG } from '../common/gayaKongsi';

// Petikan (2026-08-19, spesifikasi Izzat selepas 6 pusingan audit reka bentuk) — kandungan
// editorial sampingan di margin kiri frontpage pada skrin lebar. Lihat core/routes/petikanRoutes.js
// untuk rasional seni bina; ringkasnya: SATU jadual, DUA gerbang berasingan.
//
//   statusSah = 'sah' -> petikan betul-betul wujud dalam karya (semakan MANUSIA thd sumber)
//   aktif = true      -> editor mahu ia disiarkan sekarang
//
// Petikan layak dipapar hanya bila KEDUA-DUANYA benar. Ini sengaja dipisahkan supaya "betul" dan
// "sedang disiarkan" tidak pernah bercampur: petikan boleh disahkan tetapi dinyahaktifkan buat
// sementara, atau aktif tetapi belum lagi disemak (maka belum layak keluar).
//
// PENTING: AI boleh mencari CALON petikan, tetapi AI BUKAN sumber pengesahan. Apa-apa yang
// dimasukkan bermula 'belum_sah' tanpa pengecualian — pelayan tidak menerima statusSah daripada
// borang cipta langsung. Menandakan "sah" ialah tindakan manusia yang berasingan dan disengajakan.
interface Petikan {
  id: string;
  teks: string;
  pengarang: string;
  karya: string;
  rujukan: string;
  bahasa: string;
  kategori: string | null;
  statusSah: 'belum_sah' | 'sah' | 'dipertikai';
  aktif: boolean;
  pautanBuku: string;
  labelPautan: string;
  tarikhMula: string;
  tarikhAkhir: string;
  dibuatOleh: string;
  dibuatPada: string;
  dikemasPada: string;
  kumpulanImport: string;
}

// Sepadan had pelayan (petikanRoutes.js). Petikan marginal MESTI pendek — ruang sebenar cuma
// 180-220px lebar (audit layout 2026-08-19), dan petikan panjang daripada karya terlindung ialah
// risiko hak cipta, bukan sekadar isu reka bentuk.
const HAD_TEKS = 400;
const HAD_PENGARANG = 120;
const HAD_KARYA = 200;

const LABEL_STATUS_SAH: Record<Petikan['statusSah'], string> = {
  belum_sah: 'Belum disemak',
  sah: 'Disahkan',
  dipertikai: 'Dipertikai',
};

export const PetikanConsole: React.FC = () => {
  const [senarai, setSenarai] = useState<Petikan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');
  const [tapisan, setTapisan] = useState<'semua' | 'belum_sah' | 'sah'>('semua');

  const [menyunting, setMenyunting] = useState('');
  const [teks, setTeks] = useState('');
  const [pengarang, setPengarang] = useState('');
  const [karya, setKarya] = useState('');
  const [rujukan, setRujukan] = useState('');
  const [bahasa, setBahasa] = useState('ms');
  const [kategori, setKategori] = useState('');
  const [pautanBuku, setPautanBuku] = useState('');
  const [labelPautan, setLabelPautan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralatBorang, setRalatBorang] = useState('');
  const [mesej, setMesej] = useState('');
  const [sahMemadam, setSahMemadam] = useState('');

  // Togol ciri (petikanAktif, Tetapan Am Slot) — dipaparkan DI SINI supaya Ketua Editor boleh
  // hidup/matikan ciri di tempat yang sama dia menguruskan kandungannya, bukan terpaksa mencari
  // di modul tetapan lain. Ia tetap disimpan dalam slot_am_settings (satu sumber kebenaran).
  const [ciriAktif, setCiriAktif] = useState<boolean | null>(null);
  const [menukarTogol, setMenukarTogol] = useState(false);

  // Aliran import AI: editor salin Arahan AI -> muat naik PDF ke chatbot luar -> tampal hasil
  // di sini -> PRATONTON -> baru import. Pratonton sengaja langkah berasingan: import membuta
  // terhadap output AI ialah punca pepijat "teks templat tersiar sebagai kandungan" sebelum ni.
  const [importDibuka, setImportDibuka] = useState(false);
  const [teksTampal, setTeksTampal] = useState('');
  const [pratonton, setPratonton] = useState<null | {
    jumlahDikesan: number; bolehImport: number; pendua: number;
    rekod: any[]; gagal: { blok: number; sebab: string; cuplikan: string }[];
  }>(null);
  const [memprosesImport, setMemprosesImport] = useState(false);

  // Mod Semakan Pantas — satu petikan pada satu masa.
  const [semakanDibuka, setSemakanDibuka] = useState(false);
  const [indeksSemakan, setIndeksSemakan] = useState(0);
  const [teksDisalin, setTeksDisalin] = useState(false);
  const [memprosesSemakan, setMemprosesSemakan] = useState(false);
  const [notaArahan, setNotaArahan] = useState('');

  const muat = useCallback(() => {
    setMemuat(true);
    setRalat('');
    fetch('/api/system/petikan')
      .then(async (res) => {
        const data = await bacaJsonSelamat(res);
        if (!res.ok) throw new Error(data.error || 'Gagal membaca senarai petikan.');
        return data;
      })
      .then((d) => setSenarai(Array.isArray(d) ? d : []))
      .catch((e) => setRalat(e.message || 'Gagal membaca senarai petikan.'))
      .finally(() => setMemuat(false));
  }, []);

  const muatTogol = useCallback(() => {
    fetch('/api/system/slot-am-settings')
      .then(async (res) => (res.ok ? bacaJsonSelamat(res) : null))
      .then((d) => { if (d) setCiriAktif(!!d.petikanAktif); })
      .catch(() => { /* senyap — togol cuma tak dipapar, konsol masih boleh guna */ });
  }, []);

  useEffect(() => { muat(); muatTogol(); }, [muat, muatTogol]);

  const tukarTogolCiri = async () => {
    if (ciriAktif === null) return;
    setMenukarTogol(true);
    try {
      // Baca tetapan SEMASA dahulu, kemudian hantar semula keseluruhannya dengan satu medan
      // ditukar. Endpoint slot-am-settings ialah simpanan PENUH (bukan patch separa), jadi
      // menghantar hanya { petikanAktif } akan mengosongkan semua tetapan lain kepada lalai —
      // pepijat senyap yang akan memusnahkan tetapan animasi/had aksara Ketua Editor.
      const resBaca = await fetch('/api/system/slot-am-settings');
      const semasa = await bacaJsonSelamat(resBaca);
      if (!resBaca.ok) throw new Error(semasa.error || 'Gagal membaca tetapan semasa.');

      const res = await fetch('/api/system/slot-am-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...semasa, petikanAktif: !ciriAktif }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menukar togol.');
      setCiriAktif(!ciriAktif);
      setMesej(!ciriAktif ? 'Ciri Petikan dihidupkan' : 'Ciri Petikan dimatikan');
      setTimeout(() => setMesej(''), 6000);
    } catch (e: any) {
      setRalat(e.message || 'Gagal menukar togol ciri.');
    } finally {
      setMenukarTogol(false);
    }
  };

  const kosongkanBorang = () => {
    setMenyunting('');
    setTeks(''); setPengarang(''); setKarya(''); setRujukan('');
    setBahasa('ms'); setKategori(''); setPautanBuku(''); setLabelPautan('');
    setRalatBorang('');
  };

  const mulaSunting = (p: Petikan) => {
    setMenyunting(p.id);
    setTeks(p.teks); setPengarang(p.pengarang); setKarya(p.karya); setRujukan(p.rujukan);
    setBahasa(p.bahasa); setKategori(p.kategori || ''); setPautanBuku(p.pautanBuku); setLabelPautan(p.labelPautan);
    setRalatBorang('');
  };

  // --- Aliran import AI ---

  const salinArahanAi = async () => {
    try {
      const res = await fetch('/api/system/petikan-arahan-ai');
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menjana Arahan AI.');
      await navigator.clipboard.writeText(data.arahan);
      setNotaArahan('Arahan AI disalin — tampal ke sesi AI bersama fail PDF buku.');
    } catch (e: any) {
      setNotaArahan(e.message || 'Gagal menyalin Arahan AI.');
    }
    setTimeout(() => setNotaArahan(''), 6000);
  };

  const huraiTampalan = async () => {
    setMemprosesImport(true);
    setRalat('');
    try {
      const res = await fetch('/api/system/petikan/hurai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teks: teksTampal }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menghurai teks.');
      setPratonton(data);
    } catch (e: any) {
      setRalat(e.message || 'Gagal menghurai teks.');
    } finally {
      setMemprosesImport(false);
    }
  };

  const sahkanImport = async () => {
    if (!pratonton?.rekod?.length) return;
    setMemprosesImport(true);
    try {
      const res = await fetch('/api/system/petikan/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rekod: pratonton.rekod }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengimport.');
      setMesej(`${data.disimpan} petikan diimport — semuanya BELUM DISEMAK. Sahkan satu per satu terhadap sumber asal.`);
      setTimeout(() => setMesej(''), 10000);
      setTeksTampal(''); setPratonton(null); setImportDibuka(false);
      muat();
    } catch (e: any) {
      setRalat(e.message || 'Gagal mengimport.');
    } finally {
      setMemprosesImport(false);
    }
  };

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setRalatBorang('');
    try {
      const sedangSunting = !!menyunting;
      const res = await fetch(
        sedangSunting ? `/api/system/petikan/${menyunting}` : '/api/system/petikan',
        {
          method: sedangSunting ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teks, pengarang, karya, rujukan, bahasa, kategori: kategori || null, pautanBuku, labelPautan }),
        }
      );
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan petikan.');
      kosongkanBorang();
      setMesej(sedangSunting ? 'Petikan dikemas kini' : 'Petikan ditambah (belum disemak)');
      setTimeout(() => setMesej(''), 6000);
      muat();
    } catch (err: any) {
      setRalatBorang(err.message || 'Gagal menyimpan petikan.');
    } finally {
      setMenyimpan(false);
    }
  };

  const tandaSah = async (id: string, statusSah: Petikan['statusSah']) => {
    try {
      const res = await fetch(`/api/system/petikan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusSah }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini status.');
      muat();
    } catch (err: any) {
      setRalat(err.message || 'Gagal mengemas kini status.');
    }
  };

  const togolAktif = async (id: string, aktif: boolean) => {
    try {
      const res = await fetch(`/api/system/petikan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini petikan.');
      muat();
    } catch (err: any) {
      setRalat(err.message || 'Gagal mengemas kini petikan.');
    }
  };

  const padam = async (id: string) => {
    try {
      const res = await fetch(`/api/system/petikan/${id}`, { method: 'DELETE' });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal memadam petikan.');
      setSahMemadam('');
      muat();
    } catch (err: any) {
      setRalat(err.message || 'Gagal memadam petikan.');
    }
  };

  const senaraiDipapar = senarai.filter((p) =>
    tapisan === 'semua' ? true : tapisan === 'sah' ? p.statusSah === 'sah' : p.statusSah !== 'sah'
  );
  const bilLayakSiar = senarai.filter((p) => p.statusSah === 'sah' && p.aktif).length;

  // =========================================================================
  // MOD SEMAKAN PANTAS
  //
  // Menyemak bermakna MEMBUKA karya asal dan mengesahkan petikan itu benar-benar ada di
  // dalamnya, dengan kata-kata yang tepat. Ia kerja perlahan yang disengajakan. Modul ni cuma
  // membuang geseran di SEKELILING kerja itu (mencari petikan seterusnya, menyalin teks untuk
  // dicari dalam sumber), BUKAN mempercepatkan pertimbangan itu sendiri.
  //
  // SENGAJA TIADA "Sahkan Semua" — arahan eksplisit Izzat. Butang begitu menjadikan pengesahan
  // satu klik untuk keseluruhan kelompok, iaitu tepat kebalikan maksud medan `statusSah`. Kalau
  // ia wujud, ia akan digunakan, dan petikan yang tidak pernah disemak akan disiarkan sebagai
  // "disahkan". Jangan tambah walau ia nampak menjimatkan masa.
  // =========================================================================
  const belumDisemak = senarai.filter((p) => p.statusSah === 'belum_sah');
  const petikanSemakan = belumDisemak[Math.min(indeksSemakan, Math.max(0, belumDisemak.length - 1))] || null;
  /** Petikan lain daripada sesi AI yang SAMA — konteks, bukan sasaran tindakan pukal. */
  const bilSekumpulan = petikanSemakan?.kumpulanImport
    ? senarai.filter((p) => p.kumpulanImport === petikanSemakan.kumpulanImport).length
    : 0;
  const kedudukanKumpulan = petikanSemakan?.kumpulanImport
    ? senarai
        .filter((p) => p.kumpulanImport === petikanSemakan.kumpulanImport)
        .findIndex((p) => p.id === petikanSemakan.id) + 1
    : 0;

  const salinTeksSemakan = async (teksSalin: string) => {
    try {
      await navigator.clipboard.writeText(teksSalin);
      setTeksDisalin(true);
      setTimeout(() => setTeksDisalin(false), 1800);
    } catch {
      setRalat('Pelayar menghalang salinan automatik. Sila salin teks secara manual.');
    }
  };

  /** Menetapkan status DAN memajukan. Indeks TIDAK dinaikkan selepas keputusan dibuat kerana
   *  petikan yang diputuskan keluar daripada senarai `belumDisemak` selepas muat semula — indeks
   *  yang sama sudah menunjuk kepada petikan berikutnya dengan sendirinya. Menaikkannya juga akan
   *  melangkau satu petikan secara senyap. */
  const putuskanSemakan = async (id: string, status: 'sah' | 'dipertikai') => {
    setMemprosesSemakan(true);
    try {
      await tandaSah(id, status);
    } finally {
      setMemprosesSemakan(false);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Petikan"
        huraian="Petikan daripada buku, kitab dan karya bertulis, dipaparkan di margin kiri Frontpage pada skrin lebar. Petikan hanya disiarkan selepas disahkan terhadap sumber asalnya."
      />

      {/* 01 — Togol ciri. Diletak PALING ATAS sengaja: ini injap keselamatan, jadi ia patut jadi
          perkara pertama yang Ketua Editor nampak dan capai, bukan tersembunyi bawah senarai. */}
      <PanelCard className="text-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <SectionLabel>01 — Status Ciri</SectionLabel>
            <p className="text-stone-500 text-xs">
              {ciriAktif === null
                ? 'Memuatkan status…'
                : ciriAktif
                  ? `Ciri Petikan HIDUP. ${bilLayakSiar} petikan layak disiarkan (disahkan + aktif).`
                  : 'Ciri Petikan MATI. Tiada petikan dipaparkan di Frontpage walaupun koleksi sudah ada.'}
            </p>
            <p className="text-stone-400 text-[10px] mt-1">
              Mematikan ciri menghentikan paparan serta-merta tanpa memadam sebarang petikan. Guna ini jika ciri bermasalah.
            </p>
          </div>
          <Button
            variant={ciriAktif ? 'secondary' : 'primary'}
            disabled={ciriAktif === null || menukarTogol}
            onClick={tukarTogolCiri}
            icon={<Power className="w-3 h-3" />}
            className="shrink-0"
          >
            {menukarTogol ? 'Menukar…' : ciriAktif ? 'Matikan Ciri' : 'Hidupkan Ciri'}
          </Button>
        </div>
      </PanelCard>

      {/* 02 — Import daripada sesi AI. Aliran: Salin Arahan -> muat naik PDF ke chatbot luar ->
          tampal hasil -> PRATONTON -> import. Pratonton WAJIB dan tidak boleh dilangkau. */}
      <PanelCard className="text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div className="min-w-0">
            <SectionLabel>02 — Import daripada Sesi AI</SectionLabel>
            <p className="text-stone-500 text-xs">
              Salin Arahan AI, muat naik PDF buku ke sesi AI pilihan anda, kemudian tampal hasilnya di sini.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="secondary" onClick={salinArahanAi} icon={<Copy className="w-3 h-3" />}>
              Salin Arahan AI
            </Button>
            <Button variant={importDibuka ? 'secondary' : 'primary'} onClick={() => setImportDibuka((v) => !v)} icon={<ClipboardPaste className="w-3 h-3" />}>
              {importDibuka ? 'Tutup' : 'Tampal Hasil'}
            </Button>
          </div>
        </div>

        {notaArahan && <MesejStatus tone="info">{notaArahan}</MesejStatus>}

        {importDibuka && (
          <div className="space-y-3 mt-4">
            <textarea
              value={teksTampal} onChange={(e) => { setTeksTampal(e.target.value); setPratonton(null); }}
              rows={8}
              placeholder="Tampal keseluruhan output daripada sesi AI di sini…"
              className={INPUT_BORANG}
            />
            <div className="flex items-center justify-end gap-2">
              <Button variant="secondary" disabled={!teksTampal.trim() || memprosesImport} onClick={huraiTampalan}>
                {memprosesImport ? 'Memproses…' : 'Semak Dahulu'}
              </Button>
            </div>

            {/* Pratonton — editor mesti melihat kiraan dan SEBAB setiap kegagalan sebelum
                apa-apa disimpan. "Sah secara struktur" tidak pernah bermakna "sah terhadap
                sumber"; teks di bawah menyatakannya terus supaya tiada salah anggap. */}
            {pratonton && (
              <div className="border border-stone-200 rounded-lg p-3 space-y-3 bg-stone-50/50">
                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                  <span className="font-mono font-bold text-stone-700">{pratonton.jumlahDikesan} dikesan</span>
                  <span className="text-[var(--color-success)] font-semibold">{pratonton.bolehImport} boleh diimport</span>
                  {pratonton.pendua > 0 && <span className="text-stone-500">{pratonton.pendua} sudah wujud</span>}
                  {pratonton.gagal.length > 0 && <span className="text-[var(--color-error)] font-semibold">{pratonton.gagal.length} ditolak</span>}
                </div>

                {pratonton.gagal.length > 0 && (
                  <ul className="list-none m-0 p-0 space-y-1">
                    {pratonton.gagal.map((g, i) => (
                      <li key={i} className="text-[11px] text-[var(--color-error)]">
                        <span className="font-mono">Blok {g.blok}:</span> {g.sebab}
                        {g.cuplikan && <span className="text-stone-400"> — “{g.cuplikan}…”</span>}
                      </li>
                    ))}
                  </ul>
                )}

                {pratonton.rekod.some((r: any) => r.amaran) && (
                  <ul className="list-none m-0 p-0 space-y-1">
                    {pratonton.rekod.filter((r: any) => r.amaran).map((r: any, i: number) => (
                      <li key={i} className="text-[11px] text-amber-700">{r.pengarang}: {r.amaran}</li>
                    ))}
                  </ul>
                )}

                {pratonton.bolehImport > 0 && (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-stone-500 text-[10px]">
                      Semua akan masuk sebagai <strong>Belum disemak</strong>. Format yang betul tidak bermakna petikan sudah disahkan terhadap sumber.
                    </span>
                    <Button variant="primary" disabled={memprosesImport} onClick={sahkanImport} className="shrink-0">
                      {memprosesImport ? 'Mengimport…' : `Import ${pratonton.bolehImport} Petikan`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </PanelCard>

      {/* 03 — Borang tambah/sunting. */}
      <PanelCard className="text-xs">
        <form onSubmit={hantar} className="space-y-4">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <SectionLabel>03 — {menyunting ? 'Sunting Petikan' : 'Tambah Petikan'}</SectionLabel>
              <p className="text-stone-500 text-xs">
                Petikan baharu sentiasa bermula sebagai <strong>Belum disemak</strong>. Ia perlu disahkan terhadap sumber sebelum layak disiarkan.
              </p>
            </div>
            {menyunting && <Button variant="secondary" onClick={kosongkanBorang}>Batal Sunting</Button>}
          </div>

          <FormColumn saiz="md" className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className={`${LABEL_BORANG} flex justify-between`}>
                <span>Teks Petikan</span>
                <span className={teks.length > HAD_TEKS ? 'text-[var(--color-error)]' : 'text-stone-400'}>{teks.length}/{HAD_TEKS}</span>
              </span>
              <textarea
                value={teks} onChange={(e) => setTeks(e.target.value)} rows={4}
                placeholder="Salin petikan TEPAT seperti dalam karya asal. Jangan parafrasa atau memperindah."
                className={INPUT_BORANG}
              />
              <span className="text-stone-400 text-[10px]">
                Mesti verbatim daripada karya. Petikan yang diubah walau sedikit bukan lagi petikan.
              </span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className={`${LABEL_BORANG} flex justify-between`}>
                  <span>Pengarang</span>
                  <span className={pengarang.length > HAD_PENGARANG ? 'text-[var(--color-error)]' : 'text-stone-400'}>{pengarang.length}/{HAD_PENGARANG}</span>
                </span>
                <input type="text" value={pengarang} onChange={(e) => setPengarang(e.target.value)} placeholder="Nama pengarang" className={INPUT_BORANG} />
              </label>

              <label className="flex flex-col gap-1">
                <span className={`${LABEL_BORANG} flex justify-between`}>
                  <span>Judul Karya</span>
                  <span className={karya.length > HAD_KARYA ? 'text-[var(--color-error)]' : 'text-stone-400'}>{karya.length}/{HAD_KARYA}</span>
                </span>
                <input type="text" value={karya} onChange={(e) => setKarya(e.target.value)} placeholder="Judul buku/kitab" className={INPUT_BORANG} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Rujukan (pilihan)</span>
                <input type="text" value={rujukan} onChange={(e) => setRujukan(e.target.value)} placeholder="cth: Bab 3, hlm. 47" className={INPUT_BORANG} />
              </label>

              <label className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Bahasa</span>
                <select value={bahasa} onChange={(e) => setBahasa(e.target.value)} className={`${INPUT_BORANG} cursor-pointer`}>
                  <option value="ms">Bahasa Melayu</option>
                  <option value="en">Inggeris</option>
                  <option value="ar">Arab</option>
                </select>
              </label>
            </div>

            {/* Kategori — WAJIB untuk disiarkan. Ia bukan "Bidang" Adjung dan tidak dipapar
                kepada pembaca; fungsinya semata-mata memastikan dua petikan bidang sama tidak
                muncul berturut-turut. Petikan tanpa kategori TIDAK akan disiarkan (gerbang di
                pelayan), jadi teks bantuan di bawah menyatakannya terus supaya tiada kejutan. */}
            <label className="flex flex-col gap-1">
              <span className={LABEL_BORANG}>Kategori</span>
              <select value={kategori} onChange={(e) => setKategori(e.target.value)} className={`${INPUT_BORANG} cursor-pointer`}>
                <option value="">— Belum ditetapkan —</option>
                {KATEGORI_PETIKAN.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              <span className="text-stone-400 text-[10px]">
                Wajib untuk disiarkan. Digunakan supaya dua petikan kategori sama tidak muncul berturut-turut. Tidak dipaparkan kepada pembaca.
              </span>
            </label>

            {/* Pautan buku Adjung (keputusan Izzat: masuk V1). Sengaja SEKUNDER dan halus —
                tujuannya penemuan karya, bukan jualan. Lihat prinsip "PETIKAN MENARIK -> SIAPA
                MENULIS -> DARIPADA BUKU APA" dalam pelan. */}
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Pautan Buku (pilihan)</span>
                <input type="text" value={pautanBuku} onChange={(e) => setPautanBuku(e.target.value)} placeholder="/books/... atau https://" className={INPUT_BORANG} />
              </label>

              <label className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Label Pautan (pilihan)</span>
                <input type="text" value={labelPautan} onChange={(e) => setLabelPautan(e.target.value)} placeholder="cth: Terbitan Adjung" className={INPUT_BORANG} />
              </label>
            </div>

            {ralatBorang && <MesejStatus tone="error">{ralatBorang}</MesejStatus>}

            <div className="flex items-center justify-end gap-3 pt-1">
              {mesej && <span className="text-[var(--color-success)] text-[11px] font-semibold">{mesej}</span>}
              <Button
                type="submit" variant="primary"
                disabled={menyimpan || !teks.trim() || !pengarang.trim() || !karya.trim()
                  || teks.length > HAD_TEKS || pengarang.length > HAD_PENGARANG || karya.length > HAD_KARYA}
              >
                {menyimpan ? 'Menyimpan…' : menyunting ? 'Simpan Perubahan' : 'Tambah Petikan'}
              </Button>
            </div>
          </FormColumn>
        </form>
      </PanelCard>

      {/* 04 — Mod Semakan Pantas. Panel ni KEKAL dipaparkan walaupun baris semakan kosong —
          menyembunyikannya membuatkan nombor seksyen melompat 03 ke 05, dan seksyen dirujuk
          mengikut nombor. Bila tiada apa-apa menunggu, ia menjadi keadaan kosong yang tenang. */}
      <PanelCard className="space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <SectionLabel>04 — Mod Semakan Pantas</SectionLabel>
            <p className="text-stone-500 text-xs">
              {belumDisemak.length > 0
                ? `${belumDisemak.length} petikan menunggu semakan terhadap sumber asalnya.`
                : 'Tiada petikan menunggu semakan.'}
            </p>
          </div>
          {belumDisemak.length > 0 && (
            <Button
              variant={semakanDibuka ? 'secondary' : 'primary'}
              size="sm"
              onClick={() => { setSemakanDibuka(!semakanDibuka); setIndeksSemakan(0); }}
            >
              {semakanDibuka ? 'Tutup mod semakan' : 'Mula semak'}
            </Button>
          )}
        </div>

        {belumDisemak.length === 0 && (
          <KeadaanKosong>
            Setiap petikan dalam koleksi sudah diputuskan. Petikan baharu daripada sesi AI akan
            muncul di sini untuk disemak.
          </KeadaanKosong>
        )}

          {semakanDibuka && petikanSemakan && (
            <div className="border border-Adjung-line rounded p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">
                  {indeksSemakan + 1} daripada {belumDisemak.length}
                </span>
                {petikanSemakan.kategori ? (
                  <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
                    {petikanSemakan.kategori}
                  </span>
                ) : (
                  <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-amber-700">
                    Kategori perlu diisi
                  </span>
                )}
                {/* Konteks kelompok — memberitahu penyemak petikan ni datang daripada sesi AI yang
                    sama seperti beberapa yang lain, supaya kesilapan berkelompok lebih mudah
                    dikesan. Ia MAKLUMAT, bukan pemilihan: tiada tindakan pukal di sini. */}
                {bilSekumpulan > 1 && (
                  <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-Adjung-maroon">
                    Sesi AI sama · petikan {kedudukanKumpulan} drpd {bilSekumpulan}
                  </span>
                )}
              </div>

              <blockquote className="font-serif text-base text-stone-900 leading-relaxed border-l-2 border-stone-300 pl-4">
                “{petikanSemakan.teks}”
              </blockquote>

              <div className="text-stone-600 text-xs">
                <span className="font-semibold">{petikanSemakan.pengarang}</span>
                {petikanSemakan.karya && <span> · {petikanSemakan.karya}</span>}
                {petikanSemakan.rujukan && <span> · {petikanSemakan.rujukan}</span>}
                {petikanSemakan.pautanBuku && (
                  <>
                    {' · '}
                    <a
                      href={petikanSemakan.pautanBuku}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-Adjung-maroon underline underline-offset-2"
                    >
                      {petikanSemakan.labelPautan || 'Buka pautan buku'}
                    </a>
                  </>
                )}
              </div>

              <p className="text-stone-500 text-[11px] leading-relaxed">
                Buka karya asal dan cari teks ini. Tandakan <strong>Disahkan</strong> hanya
                apabila awak sudah melihatnya sendiri dalam sumber. AI boleh mencari calon
                petikan, tetapi AI bukan sumber pengesahan.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-Adjung-line">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => salinTeksSemakan(petikanSemakan.teks)}
                  className="mt-3"
                >
                  {teksDisalin ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {teksDisalin ? 'Disalin' : 'Salin teks'}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={memprosesSemakan}
                  onClick={() => putuskanSemakan(petikanSemakan.id, 'sah')}
                  className="mt-3"
                >
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Disahkan
                </Button>
                <Button
                  variant="bahaya"
                  size="sm"
                  disabled={memprosesSemakan}
                  onClick={() => putuskanSemakan(petikanSemakan.id, 'dipertikai')}
                  className="mt-3"
                >
                  <TriangleAlert className="w-3.5 h-3.5" />
                  Dipertikai
                </Button>
                {/* Langkau memajukan indeks TANPA menulis apa-apa — penyemak yang tidak pasti
                    patut boleh beredar tanpa terpaksa membuat keputusan palsu. */}
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={indeksSemakan >= belumDisemak.length - 1}
                  onClick={() => setIndeksSemakan((i) => i + 1)}
                  className="mt-3"
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  Langkau
                </Button>
                {indeksSemakan > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setIndeksSemakan((i) => i - 1)} className="mt-3">
                    Sebelum
                  </Button>
                )}
              </div>
            </div>
          )}
      </PanelCard>

      {/* 05 — Senarai koleksi. Kekal SENARAI, bukan jadual: petikan ialah kandungan yang perlu
          DIBACA untuk dinilai, bukan data lajur untuk diimbas. */}
      <PanelCard className="space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <SectionLabel>05 — Koleksi Petikan</SectionLabel>
            <p className="text-stone-500 text-xs">
              {senarai.length} petikan dalam koleksi · {bilLayakSiar} layak disiarkan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['semua', 'belum_sah', 'sah'] as const).map((t) => (
              <Button key={t} variant={tapisan === t ? 'primary' : 'secondary'} size="sm" onClick={() => setTapisan(t)}>
                {t === 'semua' ? 'Semua' : t === 'sah' ? 'Disahkan' : 'Belum Disemak'}
              </Button>
            ))}
          </div>
        </div>

        {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}

        {memuat ? (
          <KeadaanMemuat baris={4} />
        ) : senaraiDipapar.length === 0 ? (
          <KeadaanKosong>
            {senarai.length === 0
              ? 'Tiada petikan lagi. Tambah petikan pertama menggunakan borang di atas.'
              : 'Tiada petikan dalam tapisan ini.'}
          </KeadaanKosong>
        ) : (
          <ul className="list-none m-0 p-0 divide-y divide-Adjung-line">
            {senaraiDipapar.map((p) => (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {/* Nada warna ikut MAKNA, bukan hiasan: hanya 'sah' yang hijau kerana hanya
                          itu bermakna petikan sudah disemak terhadap sumber. 'dipertikai' merah
                          (perlu tindakan), 'belum_sah' neutral (belum diproses, bukan kegagalan). */}
                      <StatusBadge
                        tone={p.statusSah === 'sah' ? 'success' : p.statusSah === 'dipertikai' ? 'error' : 'neutral'}
                        label={LABEL_STATUS_SAH[p.statusSah]}
                      />
                      {!p.aktif && (
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">Dinyahaktifkan</span>
                      )}
                      {/* Kategori hilang = petikan TIDAK akan disiarkan walaupun sudah disahkan
                          dan aktif. Ditonjolkan amber (perlu tindakan) supaya keadaan ni tidak
                          senyap — editor patut nampak sebab petikannya tak muncul. */}
                      {p.kategori ? (
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">{p.kategori}</span>
                      ) : (
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-amber-700">Kategori perlu diisi</span>
                      )}
                      {p.pautanBuku && (
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-Adjung-maroon">
                          {p.labelPautan || 'Ada pautan buku'}
                        </span>
                      )}
                    </div>
                    <p className="font-serif text-sm text-stone-900 leading-snug">“{p.teks}”</p>
                    <p className="text-stone-500 text-[11px] mt-1">
                      {p.pengarang} · {p.karya}{p.rujukan ? ` · ${p.rujukan}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {p.statusSah !== 'sah' && (
                      <Tooltip text="Tanda sudah disemak terhadap sumber">
                        <button
                          type="button" onClick={() => tandaSah(p.id, 'sah')}
                          aria-label="Tandakan disahkan"
                          className="p-1.5 text-stone-500 hover:text-[var(--color-success)] cursor-pointer"
                        >
                          <BadgeCheck className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip text="Sunting">
                      <button
                        type="button" onClick={() => mulaSunting(p)}
                        aria-label="Sunting" className="p-1.5 text-stone-500 hover:text-Adjung-maroon cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip text={p.aktif ? 'Nyahaktifkan (sembunyi tanpa padam)' : 'Aktifkan semula'}>
                      <button
                        type="button" onClick={() => togolAktif(p.id, !p.aktif)}
                        aria-label={p.aktif ? 'Nyahaktifkan' : 'Aktifkan'}
                        className={`p-1.5 cursor-pointer ${p.aktif ? 'text-stone-500 hover:text-Adjung-maroon' : 'text-stone-300 hover:text-Adjung-maroon'}`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip text="Padam">
                      <button
                        type="button" onClick={() => setSahMemadam(p.id)}
                        aria-label="Padam" className="p-1.5 text-stone-500 hover:text-[var(--color-error)] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* Pengesahan padam sebaris (bukan window.confirm) — corak sama seperti konsol lain
                    dalam Editorium. Petikan boleh dipadam bersih kerana ia kutipan karya orang
                    lain, bukan terbitan Adjung; peraturan "arkib, jangan padam" tidak terpakai. */}
                {sahMemadam === p.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 bg-[#802334]/5 p-2 rounded">
                    <span className="text-[11px] text-stone-700">Padam petikan ini terus? Tidak boleh dibuat asal.</span>
                    <Button variant="bahaya" size="sm" onClick={() => padam(p.id)}>Ya, padam</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSahMemadam('')}>Batal</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  );
};
