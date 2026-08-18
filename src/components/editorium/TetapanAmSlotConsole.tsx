import React, { useEffect, useState } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { AlertTriangle, Save } from 'lucide-react';
import { labelUi } from '../../config/istilah';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { Button } from '../common/Button';
import { FormColumn } from '../common/FormColumn';
import { AnimasiPratonton } from './AnimasiPratonton';
import { tierForSlot, TIER_LABELS } from '../../../core/editorial/GeometryConfig.js';
import { muatPindaanMedanLimit } from '../../config/medanLimitOverrides';

// Tetapan Am Slot (2026-07-30, permintaan pemilik projek) — tetapan yang terpakai pada SEMUA slot
// bento sekali gus. Ticker dan tier Bar tiada di sini; kedua-duanya diuruskan di Modul Khas.
//
// Had aksara: 0 bermakna TIADA HAD. Sengaja — sehingga Ketua Editor menetapkan nombor, tiada
// kandungan sedia ada tiba-tiba jadi tak sah.
interface TetapanAm {
  mulaIkutMasa: number;
  hadKandunganSlot: number;
  jenisAnimasi: string;
  arahAnimasi: string;
  animasiAktif: boolean;
  kelajuanAnimasi: number;
  hadHuraianPanjang: number;
  hadSumber: number;
  hadTopik: number;
  hadNotaEditor: number;
  hadHuraianPanjangMin: number;
  hadSumberMin: number;
  hadTopikMin: number;
  hadNotaEditorMin: number;
  warnaPanelTransisi: string;
  nisbahPenajaTransisi: number;
  modWarnaPanel: string;
  focusViewTitleScale: number;
  focusViewBodySize: number;
  susunanCarousel: string;
  // Kolam jenis animasi utk mod jenisAnimasi==='rawak' (2026-08-18, soalan Izzat). Subset SAH
  // jenisAnimasiPilihan (bukan 'rawak' sendiri) — checkbox di bawah, editor pilih sendiri, TIADA
  // default dipaksa selain "semua 4 jenis" bila mod Rawak dipilih julung kali.
  jenisAnimasiRawakPool: string[];
  jenisAnimasiPilihan?: { nilai: string; label: string }[];
  arahAnimasiPilihan?: { nilai: string; label: string }[];
  nisbahPenajaTransisiPilihan?: { nilai: number; label: string }[];
  kelajuanAnimasiPilihan?: { nilai: number; label: string }[];
}

// Saiz fon Focus View (2026-08-04, permintaan Izzat) — SATU tetapan GLOBAL untuk seluruh Focus
// View (bukan per-Bidang/tier). Tangga terhad (bukan input bebas) — elak nilai pelik yang buat
// tajuk/huraian tak muat dalam Focus View; mesti sepadan TITLE_SCALE_SAH/BODY_SIZE_SAH di
// core/routes/slotAmRoutes.js.
const PILIHAN_SAIZ_TAJUK_FOCUS: { nilai: number; label: string }[] = [
  { nilai: 0.85, label: 'Kecil' },
  { nilai: 1, label: 'Sederhana (lalai)' },
  { nilai: 1.15, label: 'Besar' },
  { nilai: 1.3, label: 'Sangat besar' },
];
const PILIHAN_SAIZ_HURAIAN_FOCUS: { nilai: number; label: string }[] = [
  { nilai: 13, label: 'Kecil' },
  { nilai: 15, label: 'Sederhana (lalai)' },
  { nilai: 17, label: 'Besar' },
  { nilai: 19, label: 'Sangat besar' },
];

const MEDAN_HAD: { kunci: keyof TetapanAm; kunciMin: keyof TetapanAm; label: string; nota: string }[] = [
  // Sambung terus ke had geometri sebenar (2026-08-07, permintaan Izzat) — bukan lagi cuma
  // semakan tambahan senyap. Isi nombor di sini = had "Huraian Panjang"/"Topik" yang dipapar di
  // modal Urus Slot (tab Arahan AI) turut berubah sama. Tak termasuk Bar/Ticker (Topik/Huraian
  // Panjang tak wujud untuk tier tu).
  //
  // Had MINIMUM (2026-08-07, permintaan Izzat — "sepatutnya ada juga had minimum... takkan
  // huraian panjang boleh tulis 1 aksara sahaja") — kunciMin, kolum kedua setiap baris.
  { kunci: 'hadHuraianPanjang', kunciMin: 'hadHuraianPanjangMin', label: 'Huraian panjang', nota: 'Teks penuh dalam Focus View. Maksimum turut jadi had geometri sebenar (papar di Tulis Kandungan → Arahan AI), mesti ≥400 aksara, atau 0 untuk kekal 600 (lalai). Minimum berasingan, kosong terus tetap dibenarkan.' },
  { kunci: 'hadSumber', kunciMin: 'hadSumberMin', label: 'Sumber', nota: 'Nama penerbit asal kandungan.' },
  { kunci: 'hadTopik', kunciMin: 'hadTopikMin', label: 'Topik', nota: 'Maksimum turut jadi had geometri sebenar (papar di Tulis Kandungan → Arahan AI), gantikan lalai 25. Ruang eyebrow fizikal kad tetap turut mengehadkan, mana-mana lebih ketat yang menahan.' },
  { kunci: 'hadNotaEditor', kunciMin: 'hadNotaEditorMin', label: 'Nota editor', nota: 'Nota dalaman, tidak dipapar pada kad.' },
];

// Warna panel + nisbah logo Adjung:penaja (2026-08-05, gantikan logo TUNGGAL manual Fasa 7 —
// panel kini papar wordmark Adjung SENDIRI secara lalai, bergilir dengan logo penaja SEBENAR
// (jadual `sponsors`, medan "Tayang semasa transisi" di Urus Penaja) ikut nisbah di bawah).
function PanelTransisiField({ draf, setDraf }: { draf: TetapanAm; setDraf: React.Dispatch<React.SetStateAction<TetapanAm | null>> }) {
  // Senarai slot yang ada warna panel SENDIRI (2026-08-16, permintaan Izzat: "sepatutnya setiap
  // slot ada pilihan ini... cuba semak" — semasa siasat, disahkan override per-slot MEMANG sudah
  // wujud sejak Pelan 03, cuma tiada UI global tunjuk mana yang "lari" drpd seragam). Dibaca
  // terus drpd /api/system/slots (SELECT * FROM slots_config, sudah termasuk warnaPanelOverride)
  // — laluan baca-sahaja sedia ada, tiada endpoint baharu. Kekal dipaparkan walau mod = 'seragam'
  // (override tu TAK dipadam, cuma tak dibaca — Ketua Editor patut nampak ia masih "sedia" untuk
  // bila mod ditukar semula ke 'pelbagai').
  const [slotWarnaSendiri, setSlotWarnaSendiri] = useState<{ slotIndex: number; warna: string }[]>([]);
  useEffect(() => {
    let dibatal = false;
    fetch('/api/system/slots')
      .then(r => (r.ok ? r.json() : []))
      .then((rows: any[]) => {
        if (dibatal || !Array.isArray(rows)) return;
        const senarai = rows
          .filter(r => r && typeof r.warnaPanelOverride === 'string' && /^#[0-9a-fA-F]{6}$/.test(r.warnaPanelOverride))
          .map(r => ({ slotIndex: Number(r.slotIndex), warna: r.warnaPanelOverride }))
          .sort((a, b) => a.slotIndex - b.slotIndex);
        setSlotWarnaSendiri(senarai);
      })
      .catch(() => { /* senarai ni cuma maklumat tambahan — kegagalan tak halang panel dibuka */ });
    return () => { dibatal = true; };
  }, []);

  return (
    <div className="border border-stone-200 rounded p-4 space-y-3">
      <div className="font-semibold text-stone-800">3d. Warna panel &amp; giliran logo</div>
      {/* Ayat ni dahulu rosak: kurungan tak seimbang ("(kekal walaupun "Pudar" dipilih (cuma tak
          dipaparkan...)." — dua buka, satu tutup) dan petikan berganda bersarang dalam ayat.
          Ditulis semula sebagai dua ayat penuh (2026-08-16, audit Izzat). */}
      <p className="text-stone-500 text-[11px] leading-relaxed">
        Panel semasa animasi Colophon, Sapuan Lajur dan Gerak Susun memaparkan logo Adjung sendiri
        secara lalai. Tetapan ni kekal walaupun jenis animasi ialah <em>Pudar</em> &mdash; cuma
        panelnya tidak dipaparkan sehingga salah satu jenis di atas digunakan, jadi Ketua Editor
        boleh menyediakannya lebih awal. Tandakan penaja <strong className="font-semibold">Tayang
        semasa transisi</strong> di Urus Penaja supaya ia layak masuk giliran.
      </p>

      {/* Mod Warna Panel (2026-08-16, keputusan Izzat: "warna panel pula ada dua jenis: 1.
          seragam ... 2. pelbagai") — Seragam ABAIKAN semua override per-slot (tak dipadam, boleh
          patah balik), Pelbagai ialah kelakuan sedia ada. Diletak SEBELUM medan warna am supaya
          Ketua Editor nampak KONTEKS dahulu (adakah warna di bawah ni terpakai serantau atau
          setiap slot ada hak veto) sebelum ubah nilainya. */}
      <div>
        <span className="font-semibold text-stone-700 text-[11px] block mb-1">Mod Warna Panel</span>
        <div className="inline-flex border border-stone-300 rounded overflow-hidden w-fit">
          {([
            { nilai: 'pelbagai', label: 'Pelbagai' },
            { nilai: 'seragam', label: 'Seragam' },
          ] as const).map((m, i) => (
            <button
              key={m.nilai} type="button"
              onClick={() => setDraf(p => p ? { ...p, modWarnaPanel: m.nilai } : p)}
              className={`px-3 py-1.5 font-sans text-[11px] font-semibold cursor-pointer transition-colors ${i ? 'border-l border-stone-300' : ''} ${draf.modWarnaPanel === m.nilai ? 'bg-Adjung-maroon text-white' : 'bg-transparent text-stone-600'}`}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-stone-400 text-[10px] mt-1.5 leading-relaxed">
          {draf.modWarnaPanel === 'seragam'
            ? 'Seragam — semua slot guna warna panel am di bawah, walaupun sesetengah slot ada warna sendiri tersimpan (Senarai Slot → Tetapan Kad). Warna sendiri itu TAK dipadam, cuma tak terpakai buat masa ini.'
            : 'Pelbagai — slot yang ditetapkan warna sendiri (Senarai Slot → Tetapan Kad) guna warna itu; slot lain jatuh balik ke warna am di bawah.'}
        </p>
        {slotWarnaSendiri.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {slotWarnaSendiri.map(s => (
              <span
                key={s.slotIndex}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono ${draf.modWarnaPanel === 'seragam' ? 'border-stone-200 text-stone-400' : 'border-stone-300 text-stone-600'}`}
                title={draf.modWarnaPanel === 'seragam' ? 'Tak terpakai buat masa ini (mod Seragam)' : 'Guna warna sendiri'}
              >
                <span className="w-2.5 h-2.5 rounded-full border border-stone-300" style={{ backgroundColor: s.warna }} />
                Slot {s.slotIndex + 1}
              </span>
            ))}
          </div>
        )}
      </div>

      <label className="flex items-center gap-2">
        <span className="font-semibold text-stone-700 text-[11px]">Warna panel am</span>
        <input
          type="color"
          value={draf.warnaPanelTransisi}
          onChange={e => setDraf(p => p ? { ...p, warnaPanelTransisi: e.target.value } : p)}
          className="w-10 h-7 border border-stone-300 rounded cursor-pointer"
        />
        <span className="font-mono text-[11px] text-stone-500">{draf.warnaPanelTransisi}</span>
      </label>
      <label className="flex items-center gap-2 text-xs text-stone-600">
        <span className="font-semibold text-stone-700 text-[11px]">Nisbah Adjung : penaja</span>
        <select
          value={draf.nisbahPenajaTransisi}
          onChange={e => setDraf(p => p ? { ...p, nisbahPenajaTransisi: Number(e.target.value) } : p)}
          className="px-2.5 py-[calc(6px*var(--ed-kepadatan,1))] border border-stone-300 rounded font-semibold text-xs bg-stone-50 focus:outline-none focus:border-Adjung-maroon focus:bg-white transition-colors"
        >
          {(draf.nisbahPenajaTransisiPilihan || [{ nilai: 0, label: 'Logo Adjung sahaja (tiada logo penaja)' }]).map(n => (
            <option key={n.nilai} value={n.nilai}>{n.label}</option>
          ))}
        </select>
      </label>
      {/* Nama medan dalaman `tayangSemasaTransisi` dibuang drpd teks pengguna (2026-08-16, audit
          Izzat) — editor tak pernah nampak nama medan kod, cuma label UI sebenar. Sama kelas
          pepijat macam kod status mentah dalam Log Audit dahulu ("bahasa rojak"). */}
      <p className="text-stone-400 text-[10px] leading-relaxed">
        Jika lebih daripada satu penaja layak, giliran mereka berputar bergilir-gilir: setiap
        giliran &ldquo;penaja&rdquo; dalam nisbah memaparkan penaja seterusnya dalam senarai, bukan
        penaja yang sama berulang kali. Jika tiada penaja layak, panel kembali memaparkan logo
        Adjung sahaja &mdash; ia tidak pernah kosong.
      </p>
    </div>
  );
}

// Dasar Terbit Sendiri Editor (2026-08-06, permintaan Izzat) — "editor boleh terus publish, tp
// benda ni boleh diubah oleh ketua editor... guna rbac, benarkan ketua editor sahaja yg boleh
// tukar polisi ni". Guna kunci RBAC SEDIA ADA (`publish`, peranan Editor) sebagai sumber
// kebenaran — laluan `GET/PATCH /system/editor-publish-policy` (systemRoutes.js) dibuka khusus
// untuk kunci `manageEditorial` (Ketua Editor/Penolong), BUKAN `manageSettings` (Pentadbir-sahaja,
// borang Kawalan Akses penuh) — supaya Ketua Editor boleh tukar SATU togol ni sendiri tanpa
// perlu akses seluruh matriks RBAC yang sensitif. Komponen berasingan (bukan sebahagian `draf`
// TetapanAm) — laluan API dan kunci kebenaran berbeza sepenuhnya drpd tetapan lain di skrin ni.
function DasarTerbitSendiriField() {
  const [benarkanSelfPublish, setBenarkanSelfPublish] = useState<boolean | null>(null);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  // Maklum balas kejayaan (2026-08-08, Izzat: "byk tempat yg ada kotak tick... takde butang atau
  // makluman sama ada aktif/nyahaktif tu berjaya atau tak") — togol auto-simpan ni SEBELUM ni cuma
  // papar RALAT bila gagal, senyap sepenuhnya bila berjaya. Kotak tercentang/nyahtanda sendiri
  // bukan bukti cukup — itu keadaan OPTIMISTIK, ditulis SEBELUM permintaan server pun bermula.
  const [berjaya, setBerjaya] = useState<string | null>(null);

  // 2026-08-07 (Audit §D6) — muatDasar() ditakrif berasingan supaya boleh dipanggil semula
  // daripada butang "Cuba Lagi" dalam MesejStatus, bukan hanya sekali semasa lekapan.
  const muatDasar = () => {
    setRalat(null);
    fetch('/api/system/editor-publish-policy')
      .then(r => r.json())
      .then(d => setBenarkanSelfPublish(!!d.benarkanSelfPublish))
      .catch(() => setRalat('Gagal memuatkan dasar terbit sendiri.'));
  };

  useEffect(muatDasar, []);

  const tukar = async (nilaiBaharu: boolean) => {
    setMenyimpan(true);
    setRalat(null);
    setBerjaya(null);
    const asal = benarkanSelfPublish;
    setBenarkanSelfPublish(nilaiBaharu); // optimistik, dipulihkan kalau gagal
    try {
      const res = await fetch('/api/system/editor-publish-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benarkanSelfPublish: nilaiBaharu }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      setBerjaya(nilaiBaharu ? 'Dasar disimpan. Editor kini boleh terbit sendiri.' : 'Dasar disimpan. Editor kini perlu kelulusan.');
      setTimeout(() => setBerjaya(null), 4000);
    } catch (e: any) {
      setBenarkanSelfPublish(asal);
      setRalat(e.message || 'Gagal menyimpan dasar terbit sendiri.');
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <div className="border border-stone-200 rounded p-4 space-y-2">
      <div className="font-semibold text-stone-800">2a. Dasar Terbit Sendiri Editor</div>
      {benarkanSelfPublish === null ? (
        <KeadaanMemuat baris={1} className="py-0" />
      ) : (
        <label className="flex items-center gap-2.5 cursor-pointer w-fit">
          <input
            type="checkbox"
            checked={benarkanSelfPublish}
            disabled={menyimpan}
            onChange={e => tukar(e.target.checked)}
            className="w-4 h-4 rounded border-stone-300 text-Adjung-maroon cursor-pointer disabled:cursor-wait"
          />
          <span className="text-stone-700">
            Benarkan Editor luluskan kandungan sendiri (tanpa tunggu Ketua Editor/Penolong)
          </span>
        </label>
      )}
      {ralat && <MesejStatus tone="error" onCubaLagi={muatDasar}>{ralat}</MesejStatus>}
      {berjaya && <MesejStatus tone="success">{berjaya}</MesejStatus>}
      <p className="text-stone-400 text-[10px] leading-relaxed">
        Bila dinyahtanda, SEMUA kandungan Editor (bukan Ketua Editor/Penolong) kekal Menunggu
        sehingga diluluskan secara manual di Kandungan → Indeks, tak kira kandungan tu pernah
        ditolak atau tidak. Kandungan yang pernah ditolak sekali sentiasa perlu kelulusan Ketua
        Editor/Penolong, tak kira tetapan ni (lihat Panduan → 01).
      </p>
    </div>
  );
}

export const TetapanAmSlotConsole: React.FC = () => {
  const [draf, setDraf] = useState<TetapanAm | null>(null);
  const [asal, setAsal] = useState<TetapanAm | null>(null);
  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [berjaya, setBerjaya] = useState<string | null>(null);
  const [mengagih, setMengagih] = useState(false);

  // Agih lengah carousel bertingkat (2026-08-04, permintaan Izzat) — "kalau ada 30 slot carousel,
  // setiap saat ada SATU yang bertukar, so 30 slot ambil 30 saat utk semua bertukar sekali" —
  // slot ke-N (0-based) dapat carouselDelay = N saat. Baca SEMUA slot dulu (kekalkan setiap medan
  // lain tak berubah — POST /api/system/slots INSERT OR REPLACE PENUH setiap baris, hantar objek
  // separuh akan PADAM medan lain secara senyap), ubah carouselDelay sahaja, tulis balik.
  const agihLengahBertingkat = async () => {
    setMengagih(true);
    setRalat(null);
    setBerjaya(null);
    try {
      const res = await fetch('/api/system/slots');
      const semua = await bacaJsonSelamat(res);
      if (!Array.isArray(semua)) throw new Error('Gagal membaca senarai slot.');
      // Ticker (slotIndex -1) tiada carousel — langkau, jangan sentuh.
      const dikemas = semua
        .filter((s: any) => s.slotIndex >= 0)
        .map((s: any) => ({ ...s, carouselDelay: s.slotIndex }));
      const simpan = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dikemas),
      });
      const data = await simpan.json();
      if (!simpan.ok) throw new Error(data.error || 'Gagal menyimpan.');
      setBerjaya(`Lengah diagih: Slot 1 = 0 saat, Slot ${dikemas.length} = ${dikemas.length - 1} saat.`);
    } catch (e: any) {
      setRalat(e.message || 'Gagal mengagih lengah carousel.');
    } finally {
      setMengagih(false);
    }
  };

  const muat = () => {
    setLoading(true);
    fetch('/api/system/slot-am-settings')
      .then(r => r.json())
      .then(d => { setDraf(d); setAsal(d); })
      .catch(() => setRalat('Gagal memuatkan tetapan. Cuba lagi.'))
      .finally(() => setLoading(false));
  };

  useEffect(muat, []);

  const berubah = draf && asal && JSON.stringify(draf) !== JSON.stringify(asal);

  const simpan = async () => {
    if (!draf) return;
    setMenyimpan(true);
    setRalat(null);
    setBerjaya(null);
    try {
      const res = await fetch('/api/system/slot-am-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draf),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      setBerjaya(labelUi('toast.tetapan_am_disimpan'));
      muat();
      // Suap masuk salinan browser serta-merta (2026-08-08) — kalau tidak, meter had dalam
      // modal Urus Slot papar nilai lama sehingga muat semula penuh. Lihat medanLimitOverrides.ts.
      muatPindaanMedanLimit();
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyimpan.');
    } finally {
      setMenyimpan(false);
    }
  };

  const nombor = (kunci: keyof TetapanAm) => (
    <input
      type="number"
      min={0}
      value={String(draf?.[kunci] ?? 0)}
      onChange={e => setDraf(p => p ? { ...p, [kunci]: Number(e.target.value) } : p)}
      className="w-24 px-2 py-[calc(4px*var(--ed-kepadatan,1))] border border-stone-300 rounded text-right font-mono text-xs focus:outline-none focus:border-Adjung-maroon focus:bg-white transition-colors"
    />
  );

  if (loading || !draf) {
    return (
      <PanelCard className="font-sans">
        <KeadaanMemuat baris={5} />
      </PanelCard>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Tetapan Am Slot"
        huraian={<>Terpakai pada SEMUA slot bento sekali gus, tidak termasuk Ticker dan tier <em>Bar</em>.</>}
      />

      <PanelCard className="space-y-5 text-xs">
        {ralat && (
          <MesejStatus tone="error" className="flex items-start gap-1.5" onCubaLagi={muat}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {ralat}
          </MesejStatus>
        )}
        {berjaya && <MesejStatus tone="success">{berjaya}</MesejStatus>}

        {/* 1. Putaran carousel */}
        <div className="border border-stone-200 rounded p-4 space-y-2">
          <div className="font-semibold text-stone-800">1. Mula carousel ikut masa akses</div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!draf.mulaIkutMasa}
              onChange={e => setDraf(p => p ? { ...p, mulaIkutMasa: e.target.checked ? 1 : 0 } : p)}
              className="w-3.5 h-3.5 mt-0.5 rounded border-stone-300 text-Adjung-maroon cursor-pointer"
            />
            <span className="text-stone-600 leading-relaxed">
              Kandungan mana yang muncul dahulu ditentukan oleh jam semasa pembaca melawat: pelawat pada 9.01
              dan 9.05 pagi tidak melihat kandungan yang sama. Bila dimatikan, setiap lawatan sentiasa bermula
              pada kandungan pertama.
            </span>
          </label>
        </div>

        {/* 1c. Susunan kandungan carousel (2026-08-16, permintaan Izzat: "utk slot yg ada lebih
            1 kandungan, boleh ke susunannya dari paling baharu ke paling lama?" + susulan
            "benarkan editor pilih sendiri... begini atau rawak"). Berasingan drpd 1 di atas —
            "Mula ikut masa akses" tentukan KEDUDUKAN MULA dlm senarai (offset ikut jam
            pelawat), tetapan ni tentukan SUSUNAN SENARAI itu sendiri. */}
        <div className="border border-stone-200 rounded p-4 space-y-2">
          <div className="font-semibold text-stone-800">1c. Susunan kandungan carousel</div>
          <p className="text-stone-500 text-[11px] leading-relaxed">
            Bagi slot yang ada lebih daripada satu kandungan (carousel), susunan senarai
            sebelum ia mula berputar.
          </p>
          <select
            value={draf.susunanCarousel}
            onChange={e => setDraf(p => p ? { ...p, susunanCarousel: e.target.value } : p)}
            className="bg-white border border-stone-300 rounded px-2.5 py-1.5 font-sans text-xs focus:outline-none focus:border-Adjung-maroon"
          >
            <option value="terbaharu">Terbaharu dahulu</option>
            <option value="rawak">Rawak (acak setiap muat halaman)</option>
          </select>
          <p className="text-stone-400 text-[10px] leading-relaxed">
            <strong className="font-semibold">Terbaharu dahulu</strong>: kandungan yang disiar/
            dikemaskini paling baharu muncul dahulu. <strong className="font-semibold">Rawak</strong>:
            susunan diacak semula setiap kali pembaca memuat/muat semula halaman.
          </p>
        </div>

        {/* 1b. Agih lengah bertingkat */}
        <div className="border border-stone-200 rounded p-4 space-y-2">
          <div className="font-semibold text-stone-800">1b. Agih lengah carousel bertingkat</div>
          <p className="text-stone-500 text-[11px] leading-relaxed">
            Klik untuk agih Slot 1 → lengah 0 saat, Slot 2 → 1 saat, Slot 3 → 2 saat, dan
            seterusnya, supaya carousel bertukar SATU-SATU merentasi masa (bukan semua serentak),
            tanpa perlu laras setiap slot satu-satu di "Tetapan Kad". Boleh diklik semula bila-bila
            untuk agih semula; laras individu selepas itu (Senarai Slot → Tetapan Kad) tetap
            berfungsi seperti biasa.
          </p>
          <Button variant="secondary" onClick={agihLengahBertingkat} disabled={mengagih}>
            {mengagih ? 'Mengagih…' : 'Agih Lengah Bertingkat'}
          </Button>
        </div>

        {/* 2. Had bilangan kandungan */}
        <div className="border border-stone-200 rounded p-4 space-y-2">
          <div className="font-semibold text-stone-800">2. Had maksimum bilangan kandungan seslot</div>
          <div className="flex items-center gap-3">
            {nombor('hadKandunganSlot')}
            <span className="text-stone-500">kandungan · <strong className="font-semibold">0 = tiada had</strong></span>
          </div>
          <p className="text-stone-400 text-[10px] leading-relaxed">
            Dikira daripada kandungan yang masih hidup sahaja; kandungan arkib tidak mengambil ruang.
            Had ini menahan kandungan BAHARU sahaja; slot yang sudah melebihi had tidak dikosongkan sendiri.
            Had ni turut kawal <strong>bila kandungan Menunggu boleh jadi Aktif</strong> (2026-08-06);
            kalau slot dah penuh dengan kandungan Aktif sedia ada, kandungan yang cuba diluluskan
            kekal Menunggu (ditanda "tunggu slot kosong") dan naik taraf AUTOMATIK sebaik ada
            ruang, tanpa perlu keputusan manusia kedua.
          </p>
        </div>

        <DasarTerbitSendiriField />

        {/* SESEKSYEN ANIMASI (3-3d) — DIRESTRUKTUR 2026-08-07, permintaan Izzat eksplisit: "modul
            Slot-Tetapan Am hanya untuk mengaktifkan atau menyahaktifkan pilihan animasi serta
            menetapkan tetapan am seperti kelajuan dan sebagainya... jangan campur adukkan tetapan
            animasi dengan tetapan lain dalam tetapan am, susah nak faham." Jenis+arah PER-SLOT
            (dahulu 3a + senarai 38-slot "ArahPerSlotField" di sini) DIPINDAH ke Senarai Slot →
            Tetapan Kad (SenaraiSlotConsole.tsx) — konteks per-slot lebih sesuai di situ, bukan
            senarai panjang berasingan di sini. Tinggal di sini: togol aktif/nyahaktif (baharu),
            jenis/arah LALAI (dipakai slot yang tak override), kelajuan (baharu), warna panel. */}
        <div className="border-2 border-Adjung-maroon/20 rounded p-4 space-y-4 bg-Adjung-paper">
          <div className="font-bold text-stone-800 text-[13px]">Animasi Transisi Carousel</div>

          {/* 3. Togol aktif/nyahaktif — permintaan eksplisit Izzat, mesti WUJUD berasingan drpd
              jenis animasi (dahulu "Pudar" jadi proksi tak langsung utk "off", tiada togol tegas). */}
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={!!draf.animasiAktif}
              onChange={e => setDraf(p => p ? { ...p, animasiAktif: e.target.checked } : p)}
              className="w-3.5 h-3.5 mt-0.5 rounded border-stone-300 text-Adjung-maroon cursor-pointer"
            />
            <span className="text-stone-700">
              <strong className="font-semibold">3. Animasi transisi aktif</strong>: bila
              dinyahtanda, SEMUA slot carousel guna pertukaran pudar ringkas (kelakuan asal),
              tak kira jenis animasi dipilih di sini atau di Senarai Slot per-slot.
            </span>
          </label>

          {/* Dua-dua select ni anak `flex-col`, jadi ia meregang penuh separuh lebar halaman.
              Satu-satunya kawalan dalam fail ni yang benar-benar terlalu lebar — yang lain sudah
              bersaiz kandungan (`w-fit`, `w-24`) atau memang kawalan sebaris padat. */}
          <FormColumn saiz="md">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold text-stone-800 text-[11px]">3a. Jenis animasi lalai</span>
              <select
                value={draf.jenisAnimasi}
                onChange={e => setDraf(p => p ? { ...p, jenisAnimasi: e.target.value } : p)}
                disabled={!draf.animasiAktif}
                className="px-2.5 py-[calc(6px*var(--ed-kepadatan,1))] border border-stone-300 rounded font-semibold text-xs bg-stone-50 focus:outline-none focus:border-Adjung-maroon focus:bg-white transition-colors disabled:opacity-40"
              >
                {(draf.jenisAnimasiPilihan || [{ nilai: 'pudar', label: 'Pudar (1 saat)' }]).map(j => (
                  <option key={j.nilai} value={j.nilai}>{j.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold text-stone-800 text-[11px]">3b. Arah animasi lalai</span>
              {/* Pudar TIADA arah (peralihan opacity semata-mata, tiada transform/panel) — dahulu
                  dropdown ni tetap aktif dgn nilai tersimpan yang tak buat apa-apa, editor kena
                  teka sendiri. Kini medan tunjuk keadaan SEBENAR: teks statik bila Pudar dipilih
                  (2026-08-16, keputusan Izzat: "pudar adalah sebahagian daripada animasi. cuma,
                  disebabkan tiada arah, maka ketika pilih pudar, 3.b menunjukkan: tidak
                  berkaitan"). Nilai `arahAnimasi` TAK disentuh langsung — pulih automatik bila
                  jenis ditukar semula ke Colophon/Sapuan Lajur/Gerak Susun. */}
              {draf.jenisAnimasi === 'pudar' ? (
                <div className="px-2.5 py-[calc(6px*var(--ed-kepadatan,1))] border border-stone-200 rounded text-xs bg-stone-100 text-stone-400 italic">
                  Tidak berkaitan — Pudar tiada arah
                </div>
              ) : (
                <>
                  <select
                    value={draf.arahAnimasi}
                    onChange={e => setDraf(p => p ? { ...p, arahAnimasi: e.target.value } : p)}
                    disabled={!draf.animasiAktif}
                    className="px-2.5 py-[calc(6px*var(--ed-kepadatan,1))] border border-stone-300 rounded font-semibold text-xs bg-stone-50 focus:outline-none focus:border-Adjung-maroon focus:bg-white transition-colors disabled:opacity-40"
                  >
                    {(draf.arahAnimasiPilihan || [{ nilai: 'kanan', label: 'Kanan (masuk dari kanan, keluar ke kiri)' }]).map(a => (
                      <option key={a.nilai} value={a.nilai}>{a.label}</option>
                    ))}
                  </select>
                  {/* Gerak Susun sokong mendatar SAHAJA (nota spesifikasi, slotAmRoutes.js baris
                      ~66-70). Kod render pukal apa-apa selain 'kiri' sebagai kanan
                      (FrontpageView.tsx: `arahEfektif !== 'kiri'`), jadi Atas/Bawah untuk Gerak
                      Susun senyap-senyap berkelakuan macam Kanan (2026-08-16, audit Izzat). */}
                  {draf.jenisAnimasi === 'gerak_susun' && (
                    <span className="text-stone-400 text-[10px] leading-relaxed">
                      Gerak Susun mendatar sahaja &mdash; Atas/Bawah dibaca sebagai Kanan.
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          </FormColumn>
          <p className="text-stone-400 text-[10px] leading-relaxed">
            &ldquo;Lalai&rdquo; = dipakai slot yang tidak menetapkan jenis/arah sendiri. Tetapan
            per-slot kini di <strong className="font-semibold">Senarai Slot → Tetapan Kad</strong>
            {' '}(bukan di sini).
          </p>

          {/* 3a-i. Kolam mod Rawak (2026-08-18, soalan Izzat: "boleh buat rawak jenis animasi
              setiap pusingan tak?") — papar HANYA bila "Rawak" dipilih di 3a. Editor pilih SENDIRI
              jenis mana masuk kolam (keputusan Izzat eksplisit: "jangan jadikan ini sebagai
              default... biarkan ia jadi pilihan Ketua Editor") — bukan senarai dikunci Claude. */}
          {draf.jenisAnimasi === 'rawak' && (
            <div className="border border-stone-200 rounded p-3 space-y-2 bg-stone-50">
              <span className="font-semibold text-stone-800 text-[11px] block">
                Kolam jenis untuk mod Rawak
              </span>
              <p className="text-stone-400 text-[10px] leading-relaxed">
                Setiap kali carousel slot bertukar kandungan, SATU jenis dipilih rawak drpd
                senarai ditanda di bawah. Sekurang-kurangnya satu mesti kekal ditanda.
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {(draf.jenisAnimasiPilihan || []).filter(j => j.nilai !== 'rawak').map(j => {
                  const ditanda = draf.jenisAnimasiRawakPool.includes(j.nilai);
                  return (
                    <label key={j.nilai} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ditanda}
                        onChange={e => setDraf(p => {
                          if (!p) return p;
                          const kolamBaharu = e.target.checked
                            ? [...p.jenisAnimasiRawakPool, j.nilai]
                            : p.jenisAnimasiRawakPool.filter(v => v !== j.nilai);
                          // Sekat nyahtanda checkbox TERAKHIR — client-side guard, elak kolam
                          // kosong terus di UI (server pun sah semula, tapi lebih baik editor
                          // nampak keadaan tak sah tu MUSTAHIL berlaku langsung).
                          if (kolamBaharu.length === 0) return p;
                          return { ...p, jenisAnimasiRawakPool: kolamBaharu };
                        })}
                        disabled={!draf.animasiAktif}
                        className="w-3.5 h-3.5 rounded border-stone-300 text-Adjung-maroon cursor-pointer disabled:opacity-40"
                      />
                      <span className="text-stone-700 text-xs">{j.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3c. Kelajuan — baharu, permintaan eksplisit Izzat ("tetapan am seperti kelajuan").
              Terpakai pada SEMUA jenis termasuk Pudar (2026-08-16, keputusan Izzat: "kelajuan
              animasi juga sepatutnya ada. pudar sepatutnya boleh dilaraskan masa atau
              tempohnya") — satu medan kongsi, bukan dua kawalan berasingan. Izzat sedar dan
              terima ini bermakna slot Pudar sedia ada TERUS ikut nilai kelajuan semasa (cth
              1.5x) sebaik disimpan, bukan kekal 1 saat macam dahulu. */}
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-stone-800 text-[11px]">3c. Kelajuan animasi</span>
            <select
              value={draf.kelajuanAnimasi}
              onChange={e => setDraf(p => p ? { ...p, kelajuanAnimasi: Number(e.target.value) } : p)}
              disabled={!draf.animasiAktif}
              className="w-fit px-2.5 py-1.5 border border-stone-300 rounded font-semibold text-xs bg-stone-50 disabled:opacity-40"
            >
              {(draf.kelajuanAnimasiPilihan || [{ nilai: 1, label: 'Sederhana (lalai)' }]).map(k => (
                <option key={k.nilai} value={k.nilai}>{k.label}</option>
              ))}
            </select>
            <p className="text-stone-400 text-[10px] leading-relaxed">
              Terpakai pada Pudar, Colophon, Sapuan Lajur dan Gerak Susun sama rata.
            </p>
          </div>

          {/* 3d. Logo penaja & warna panel — cuma relevan untuk Colophon/Sapuan Lajur/Gerak Susun,
              tapi kekal ditunjukkan walaupun "Pudar" dipilih supaya Ketua Editor boleh sediakan
              dahulu sebelum tukar jenis animasi. */}
          <PanelTransisiField draf={draf} setDraf={setDraf} />

          {/* Pratonton — permintaan Izzat eksplisit ("sila buat pratonton supaya editor nampak
              mcm mana bentuk dan rupa animasi tersebut termasuk dengan 3d [warna panel]").
              Diletak PALING BAWAH, selepas 3a-3d, supaya papar kesan GABUNGAN kesemua tetapan
              lalai di atas serentak — bukan pratonton per-medan berasingan. */}
          <div className="border border-stone-200 rounded p-3">
            <span className="font-semibold text-stone-800 text-[11px] block mb-2">Pratonton</span>
            {/* jenis paksa 'pudar' bila togol 3 mati — sama peraturan tepat FrontpageView.tsx
                (`jenisEfektif = animasiAktif ? ... : 'pudar'`), supaya pratonton jujur bila
                Ketua Editor sedang uji tetapan dgn animasi dinyahaktifkan. Mod Rawak: hantar
                FUNGSI (bukan literal) — AnimasiPratonton panggil ia semula pada SETIAP klik
                "Main", cerminan jujur tingkah laku sebenar carousel (jenis berbeza tiap
                pusingan). Kolam kosong (mustahil di UI, guard checkbox di atas) jatuh balik ke
                senarai penuh — konsisten pengesahan pelayan (slotAmRoutes.js). */}
            <AnimasiPratonton
              jenis={
                !draf.animasiAktif
                  ? 'pudar'
                  : draf.jenisAnimasi === 'rawak'
                    ? () => {
                        const kolam = draf.jenisAnimasiRawakPool.length
                          ? draf.jenisAnimasiRawakPool
                          : ['pudar', 'colophon', 'sapuan_lajur', 'gerak_susun'];
                        return kolam[Math.floor(Math.random() * kolam.length)];
                      }
                    : draf.jenisAnimasi
              }
              arah={draf.arahAnimasi}
              kelajuan={draf.kelajuanAnimasi}
              warnaPanel={draf.warnaPanelTransisi}
            />
          </div>
        </div>

        {/* 4. Saiz fon Focus View — satu tetapan GLOBAL (bukan per-Bidang/tier), permintaan Izzat
            2026-08-04, supaya semua kandungan dalam Focus View konsisten. Dinomborkan semula
            drpd "3c" (2026-08-07) — bukan sebahagian seksyen animasi di atas, tak sepatutnya
            bernombor macam ia bersambung terus drpd 3a/3b/3c animasi. */}
        <div className="border border-stone-200 rounded p-4 space-y-3">
          <div className="font-semibold text-stone-800">4. Saiz fon Focus View</div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-stone-600">
              Tajuk
              <select
                value={draf.focusViewTitleScale}
                onChange={e => setDraf(p => p ? { ...p, focusViewTitleScale: Number(e.target.value) } : p)}
                className="px-2.5 py-[calc(6px*var(--ed-kepadatan,1))] border border-stone-300 rounded font-semibold text-xs bg-stone-50 focus:outline-none focus:border-Adjung-maroon focus:bg-white transition-colors"
              >
                {PILIHAN_SAIZ_TAJUK_FOCUS.map(o => (
                  <option key={o.nilai} value={o.nilai}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 text-xs text-stone-600">
              Huraian
              <select
                value={draf.focusViewBodySize}
                onChange={e => setDraf(p => p ? { ...p, focusViewBodySize: Number(e.target.value) } : p)}
                className="px-2.5 py-[calc(6px*var(--ed-kepadatan,1))] border border-stone-300 rounded font-semibold text-xs bg-stone-50 focus:outline-none focus:border-Adjung-maroon focus:bg-white transition-colors"
              >
                {PILIHAN_SAIZ_HURAIAN_FOCUS.map(o => (
                  <option key={o.nilai} value={o.nilai}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-stone-400 text-[10px] leading-relaxed">
            Terpakai pada tajuk dan huraian dalam Focus View sahaja (bukan kad bento). Tajuk masih
            mengecil sendiri untuk tajuk yang sangat panjang; tetapan ini darab tangga saiz sedia ada.
          </p>
        </div>

        {/* 5. Had aksara medan lain */}
        <div className="border border-stone-200 rounded p-4 space-y-3">
          <div>
            <div className="font-semibold text-stone-800">5. Had aksara medan lain</div>
            <p className="text-stone-500 text-[11px] leading-relaxed mt-0.5">
              Tajuk dan huraian ringkas tiada di sini; kedua-duanya dikawal oleh ruang fizikal kad, di sub-menu
              <strong className="font-semibold"> Tier Kad</strong>. Medan di bawah tidak dipapar pada muka kad,
              jadi hadnya dasar editorial, bukan geometri.
            </p>
          </div>
          <div className="space-y-2">
            {MEDAN_HAD.map(m => (
              <div key={m.kunci} className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5">
                  {nombor(m.kunciMin)}
                  <span className="text-stone-400 text-[9px] uppercase tracking-wide">Min</span>
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  {nombor(m.kunci)}
                  <span className="text-stone-400 text-[9px] uppercase tracking-wide">Maks</span>
                </div>
                <div className="pt-1">
                  <div className="font-semibold text-stone-700">{m.label}</div>
                  <div className="text-stone-400 text-[10px] leading-relaxed">{m.nota}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-stone-400 text-[10px]"><strong className="font-semibold">0 = tiada had.</strong> Kandungan sedia ada tidak disemak semula. Had hanya menahan simpanan baharu.</p>
        </div>

        <div className="border-t border-Adjung-line pt-3 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={simpan}
            disabled={!berubah || menyimpan}
            icon={<Save className="w-3.5 h-3.5" />}
          >
            {menyimpan ? 'Menyimpan…' : 'Simpan Tetapan'}
          </Button>
          <span className="text-[10px] text-stone-500">{berubah ? 'Ada perubahan belum disimpan' : 'Tiada perubahan'}</span>
        </div>
      </PanelCard>
    </div>
  );
};

export default TetapanAmSlotConsole;
