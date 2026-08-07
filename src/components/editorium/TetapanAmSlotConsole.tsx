import React, { useEffect, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { labelUi } from '../../config/istilah';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { Button } from '../common/Button';
import { tierForSlot, TIER_LABELS } from '../../../core/editorial/GeometryConfig.js';

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
  warnaPanelTransisi: string;
  nisbahPenajaTransisi: number;
  focusViewTitleScale: number;
  focusViewBodySize: number;
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

const MEDAN_HAD: { kunci: keyof TetapanAm; label: string; nota: string }[] = [
  { kunci: 'hadHuraianPanjang', label: 'Huraian panjang', nota: 'Teks penuh dalam Focus View.' },
  { kunci: 'hadSumber', label: 'Sumber', nota: 'Nama penerbit asal kandungan.' },
  { kunci: 'hadTopik', label: 'Topik', nota: 'Ruang eyebrow kad masih mengehadkan Topik ikut bentuk kad; yang mana lebih ketat, itu yang menahan.' },
  { kunci: 'hadNotaEditor', label: 'Nota editor', nota: 'Nota dalaman, tidak dipapar pada kad.' },
];

// Warna panel + nisbah logo Adjung:penaja (2026-08-05, gantikan logo TUNGGAL manual Fasa 7 —
// panel kini papar wordmark Adjung SENDIRI secara lalai, bergilir dengan logo penaja SEBENAR
// (jadual `sponsors`, medan "Tayang semasa transisi" di Urus Penaja) ikut nisbah di bawah).
function PanelTransisiField({ draf, setDraf }: { draf: TetapanAm; setDraf: React.Dispatch<React.SetStateAction<TetapanAm | null>> }) {
  return (
    <div className="border border-stone-200 rounded p-4 space-y-3">
      <div className="font-semibold text-stone-800">3d. Warna panel &amp; giliran logo</div>
      <p className="text-stone-500 text-[11px] leading-relaxed">
        Panel semasa animasi Colophon/Sapuan Lajur papar logo Adjung sendiri secara lalai (kekal
        walaupun "Pudar" dipilih — cuma tak dipaparkan sehingga jenis lain diaktifkan). Tanda
        penaja "Tayang semasa transisi" di Urus Penaja supaya ia layak masuk giliran.
      </p>
      <label className="flex items-center gap-2">
        <span className="font-semibold text-stone-700 text-[11px]">Warna panel</span>
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
          className="px-2.5 py-1.5 border border-stone-300 rounded font-semibold text-xs bg-stone-50"
        >
          {(draf.nisbahPenajaTransisiPilihan || [{ nilai: 0, label: 'Logo Adjung sahaja (tiada logo penaja)' }]).map(n => (
            <option key={n.nilai} value={n.nilai}>{n.label}</option>
          ))}
        </select>
      </label>
      <p className="text-stone-400 text-[10px] leading-relaxed">
        Berbilang penaja layak (tayangSemasaTransisi) berputar round-robin — setiap giliran
        "penaja" dalam nisbah papar penaja SETERUSNYA dalam senarai, bukan penaja yang sama
        berulang. Tiada penaja layak = kembali papar logo Adjung sahaja, panel tak pernah kosong.
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
    const asal = benarkanSelfPublish;
    setBenarkanSelfPublish(nilaiBaharu); // optimistik, dipulihkan kalau gagal
    try {
      const res = await fetch('/api/system/editor-publish-policy', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benarkanSelfPublish: nilaiBaharu }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
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
        <p className="text-stone-400 text-[11px]">Memuatkan…</p>
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
      <p className="text-stone-400 text-[10px] leading-relaxed">
        Bila dinyahtanda, SEMUA kandungan Editor (bukan Ketua Editor/Penolong) kekal Menunggu
        sehingga diluluskan secara manual di Kandungan → Indeks — tak kira kandungan tu pernah
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
      const semua = await res.json();
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
      .catch(e => setRalat('Gagal memuatkan tetapan: ' + (e.message || '')))
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      setBerjaya(labelUi('toast.tetapan_am_disimpan'));
      muat();
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
      className="w-24 px-2 py-1 border border-stone-300 rounded text-right font-mono text-xs focus:outline-none focus:border-Adjung-maroon"
    />
  );

  if (loading || !draf) {
    return (
      <PanelCard className="font-sans">
        <KeadaanKosong>Memuatkan tetapan...</KeadaanKosong>
      </PanelCard>
    );
  }

  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Tetapan Am Slot"
        huraian={<>Terpakai pada SEMUA slot bento sekali gus — tidak termasuk Ticker dan tier <em>Bar</em>.</>}
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
              Kandungan mana yang muncul dahulu ditentukan oleh jam semasa pembaca melawat — pelawat pada 9.01
              dan 9.05 pagi tidak melihat kandungan yang sama. Bila dimatikan, setiap lawatan sentiasa bermula
              pada kandungan pertama.
            </span>
          </label>
        </div>

        {/* 1b. Agih lengah bertingkat */}
        <div className="border border-stone-200 rounded p-4 space-y-2">
          <div className="font-semibold text-stone-800">1b. Agih lengah carousel bertingkat</div>
          <p className="text-stone-500 text-[11px] leading-relaxed">
            Klik untuk agih Slot 1 → lengah 0 saat, Slot 2 → 1 saat, Slot 3 → 2 saat, dan
            seterusnya — supaya carousel bertukar SATU-SATU merentasi masa (bukan semua serentak),
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
            Had ini menahan kandungan BAHARU sahaja — slot yang sudah melebihi had tidak dikosongkan sendiri.
            Had ni turut kawal <strong>bila kandungan Menunggu boleh jadi Aktif</strong> (2026-08-06) —
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
              <strong className="font-semibold">3. Animasi transisi aktif</strong> — bila
              dinyahtanda, SEMUA slot carousel guna pertukaran pudar ringkas (kelakuan asal),
              tak kira jenis animasi dipilih di sini atau di Senarai Slot per-slot.
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold text-stone-800 text-[11px]">3a. Jenis animasi lalai</span>
              <select
                value={draf.jenisAnimasi}
                onChange={e => setDraf(p => p ? { ...p, jenisAnimasi: e.target.value } : p)}
                disabled={!draf.animasiAktif}
                className="px-2.5 py-1.5 border border-stone-300 rounded font-semibold text-xs bg-stone-50 disabled:opacity-40"
              >
                {(draf.jenisAnimasiPilihan || [{ nilai: 'pudar', label: 'Pudar (1 saat)' }]).map(j => (
                  <option key={j.nilai} value={j.nilai}>{j.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="font-semibold text-stone-800 text-[11px]">3b. Arah animasi lalai</span>
              <select
                value={draf.arahAnimasi}
                onChange={e => setDraf(p => p ? { ...p, arahAnimasi: e.target.value } : p)}
                disabled={!draf.animasiAktif}
                className="px-2.5 py-1.5 border border-stone-300 rounded font-semibold text-xs bg-stone-50 disabled:opacity-40"
              >
                {(draf.arahAnimasiPilihan || [{ nilai: 'kanan', label: 'Kanan (masuk dari kanan, keluar ke kiri)' }]).map(a => (
                  <option key={a.nilai} value={a.nilai}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-stone-400 text-[10px] leading-relaxed">
            "Lalai" = dipakai slot yang TAK override jenis/arah sendiri. Override per-slot kini di{' '}
            <strong className="font-semibold">Senarai Slot → Tetapan Kad</strong> (bukan di sini).
          </p>

          {/* 3c. Kelajuan — baharu, permintaan eksplisit Izzat ("tetapan am seperti kelajuan"). */}
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
              Terpakai pada Colophon, Sapuan Lajur dan Gerak Susun sama rata.
            </p>
          </div>

          {/* 3d. Logo penaja & warna panel — cuma relevan untuk Colophon/Sapuan Lajur/Gerak Susun,
              tapi kekal ditunjukkan walaupun "Pudar" dipilih supaya Ketua Editor boleh sediakan
              dahulu sebelum tukar jenis animasi. */}
          <PanelTransisiField draf={draf} setDraf={setDraf} />
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
                className="px-2.5 py-1.5 border border-stone-300 rounded font-semibold text-xs bg-stone-50"
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
                className="px-2.5 py-1.5 border border-stone-300 rounded font-semibold text-xs bg-stone-50"
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
              Tajuk dan huraian ringkas tiada di sini — kedua-duanya dikawal oleh ruang fizikal kad, di sub-menu
              <strong className="font-semibold"> Tier Kad</strong>. Medan di bawah tidak dipapar pada muka kad,
              jadi hadnya dasar editorial, bukan geometri.
            </p>
          </div>
          <div className="space-y-2">
            {MEDAN_HAD.map(m => (
              <div key={m.kunci} className="flex items-start gap-3">
                {nombor(m.kunci)}
                <div className="pt-1">
                  <div className="font-semibold text-stone-700">{m.label}</div>
                  <div className="text-stone-400 text-[10px] leading-relaxed">{m.nota}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-stone-400 text-[10px]"><strong className="font-semibold">0 = tiada had.</strong> Kandungan sedia ada tidak disemak semula — had hanya menahan simpanan baharu.</p>
        </div>

        <div className="border-t border-Adjung-line pt-3 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={simpan}
            disabled={!berubah || menyimpan}
            icon={<Save className="w-3.5 h-3.5" />}
          >
            {menyimpan ? 'Menyimpan...' : 'Simpan Tetapan'}
          </Button>
          <span className="text-[10px] text-stone-500">{berubah ? 'Ada perubahan belum disimpan' : 'Tiada perubahan'}</span>
        </div>
      </PanelCard>
    </div>
  );
};

export default TetapanAmSlotConsole;
