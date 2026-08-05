import React, { useEffect, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';
import { labelUi } from '../../config/istilah';
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
      <div className="font-semibold text-stone-800">3b. Warna panel &amp; giliran logo</div>
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

const PILIHAN_ARAH_SLOT: { nilai: string; label: string }[] = [
  { nilai: '', label: 'Guna tetapan am' },
  { nilai: 'kanan', label: 'Kanan' },
  { nilai: 'kiri', label: 'Kiri' },
  { nilai: 'atas', label: 'Atas' },
  { nilai: 'bawah', label: 'Bawah' },
];

// Arah animasi PER-SLOT (2026-08-05, permintaan Izzat: "boleh ke nak pilih arah tertentu utk slot
// tertentu sahaja?") — senarai BERASINGAN drpd tetapan am di atas (keputusan Izzat: "senarai
// berasingan... lebih mudah nampak keseluruhan"), simpan ke slots_config.arahOverride PER SLOT
// (bukan slot_am_settings global). '' = guna tetapan am (arahAnimasi di atas), nilai lain =
// override slot tu SAHAJA. Baca/tulis berasingan drpd `draf`/`simpan()` di atas — laluan API
// berbeza (GET/POST /api/system/slots, bukan /api/system/slot-am-settings).
function ArahPerSlotField() {
  const [slotArah, setSlotArah] = useState<Record<number, string>>({});
  const [asal, setAsal] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [berjaya, setBerjaya] = useState<string | null>(null);

  const muat = () => {
    setLoading(true);
    fetch('/api/system/slots')
      .then(r => r.json())
      .then((rows: any[]) => {
        const m: Record<number, string> = {};
        (Array.isArray(rows) ? rows : []).forEach(r => {
          if (r.slotIndex >= 0) m[r.slotIndex] = r.arahOverride || '';
        });
        setSlotArah(m);
        setAsal(m);
      })
      .catch(e => setRalat('Gagal memuatkan arah slot: ' + (e.message || '')))
      .finally(() => setLoading(false));
  };
  useEffect(muat, []);

  const berubah = JSON.stringify(slotArah) !== JSON.stringify(asal);

  const simpan = async () => {
    setMenyimpan(true);
    setRalat(null);
    setBerjaya(null);
    try {
      // Muat SEMULA baris penuh sejurus sebelum tulis (bukan guna baris dimuat semasa mount) —
      // elak tulis-ganti perubahan medan LAIN (kandungan, warna dll) yang mungkin disimpan
      // seseorang lain sementara skrin ni terbuka. Sama corak berjaga-jaga macam
      // agihLengahBertingkat di atas.
      const res = await fetch('/api/system/slots');
      const semua = await res.json();
      if (!Array.isArray(semua)) throw new Error('Gagal membaca senarai slot.');
      const dikemas = semua
        .filter((s: any) => s.slotIndex >= 0)
        .map((s: any) => ({ ...s, arahOverride: slotArah[s.slotIndex] ?? (s.arahOverride || '') }));
      const simpanRes = await fetch('/api/system/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dikemas),
      });
      const data = await simpanRes.json();
      if (!simpanRes.ok) throw new Error(data.error || 'Gagal menyimpan.');
      setBerjaya('Arah slot disimpan.');
      muat();
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyimpan arah slot.');
    } finally {
      setMenyimpan(false);
      setTimeout(() => { setBerjaya(null); setRalat(null); }, 3200);
    }
  };

  if (loading) return <div className="border border-stone-200 rounded p-4 text-xs text-stone-400">Memuatkan arah slot…</div>;

  return (
    <div className="border border-stone-200 rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-stone-800">3e. Arah animasi per-slot</div>
        <button
          type="button"
          disabled={!berubah || menyimpan}
          onClick={simpan}
          className="flex items-center gap-1 px-2.5 py-1 border border-stone-300 rounded text-[11px] font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="w-3 h-3" /> {menyimpan ? 'Menyimpan…' : 'Simpan arah slot'}
        </button>
      </div>
      <p className="text-stone-500 text-[11px] leading-relaxed">
        Override arah Colophon/Sapuan Lajur untuk slot TERTENTU sahaja — mengatasi arah tetapan am
        (3a) khusus slot tu. Kebanyakan slot patut kekal "Guna tetapan am"; override cuma untuk
        kekecualian.
      </p>
      {ralat && <p className="text-red-600 text-[11px] flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {ralat}</p>}
      {berjaya && <p className="text-green-700 text-[11px]">{berjaya}</p>}
      <div className="max-h-64 overflow-y-auto border border-stone-100 rounded divide-y divide-stone-100">
        {Array.from({ length: 38 }, (_, i) => i).map(slotIndex => (
          <div key={slotIndex} className="flex items-center justify-between px-3 py-1.5 text-xs">
            <span className="text-stone-600">
              Slot {slotIndex + 1}{' '}
              <span className="text-stone-400 font-mono text-[10px]">{TIER_LABELS[tierForSlot(slotIndex)] || ''}</span>
            </span>
            <select
              value={slotArah[slotIndex] || ''}
              onChange={e => setSlotArah(p => ({ ...p, [slotIndex]: e.target.value }))}
              className="px-2 py-1 border border-stone-300 rounded font-semibold text-[11px] bg-stone-50"
            >
              {PILIHAN_ARAH_SLOT.map(a => (
                <option key={a.nilai} value={a.nilai}>{a.label}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
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
      className="w-24 px-2 py-1 border border-stone-300 rounded text-right font-mono text-xs focus:outline-none focus:border-[#802334]"
    />
  );

  if (loading || !draf) {
    return <div className="bg-white p-6 rounded-lg border border-stone-200 text-xs text-stone-400 text-center font-sans">Memuatkan tetapan...</div>;
  }

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-5 text-xs">
        <div>
          <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">Tetapan Am Slot</h3>
          <p className="text-stone-500 text-xs">
            Terpakai pada SEMUA slot bento sekali gus — tidak termasuk Ticker dan tier <em>Bar</em>.
          </p>
        </div>

        {ralat && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-800 text-[11px] flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {ralat}
          </div>
        )}
        {berjaya && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-emerald-800 text-[11px]">{berjaya}</div>}

        {/* 1. Putaran carousel */}
        <div className="border border-stone-200 rounded p-4 space-y-2">
          <div className="font-semibold text-stone-800">1. Mula carousel ikut masa akses</div>
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={!!draf.mulaIkutMasa}
              onChange={e => setDraf(p => p ? { ...p, mulaIkutMasa: e.target.checked ? 1 : 0 } : p)}
              className="w-3.5 h-3.5 mt-0.5 rounded border-stone-300 text-[#802334] cursor-pointer"
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
          <button
            type="button"
            onClick={agihLengahBertingkat}
            disabled={mengagih}
            className="px-3 py-1.5 border border-stone-300 rounded font-semibold text-xs bg-stone-50 hover:bg-stone-100 disabled:opacity-50 disabled:cursor-wait"
          >
            {mengagih ? 'Mengagih…' : 'Agih Lengah Bertingkat'}
          </button>
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
          </p>
        </div>

        {/* 3. Jenis animasi */}
        <div className="border border-stone-200 rounded p-4 space-y-2">
          <div className="font-semibold text-stone-800">3. Jenis animasi transisi</div>
          <select
            value={draf.jenisAnimasi}
            onChange={e => setDraf(p => p ? { ...p, jenisAnimasi: e.target.value } : p)}
            className="px-2.5 py-1.5 border border-stone-300 rounded font-semibold text-xs bg-stone-50"
          >
            {(draf.jenisAnimasiPilihan || [{ nilai: 'pudar', label: 'Pudar (1 saat)' }]).map(j => (
              <option key={j.nilai} value={j.nilai}>{j.label}</option>
            ))}
          </select>
          <p className="text-stone-400 text-[10px] leading-relaxed">
            "Pudar" ialah pertukaran lembut tanpa panel. "Colophon" dan "Sapuan Lajur" papar panel warna
            penuh (tetapan 3b di bawah) sekejap semasa carousel bertukar kandungan.
          </p>
        </div>

        {/* 3a. Arah animasi — cuma terpakai untuk Colophon/Sapuan Lajur (panel "Pudar" tiada arah).
            Kekal ditunjukkan walaupun "Pudar" dipilih, sama sebab macam 3b di bawah. */}
        <div className="border border-stone-200 rounded p-4 space-y-2">
          <div className="font-semibold text-stone-800">3a. Arah animasi (Colophon / Sapuan Lajur)</div>
          <select
            value={draf.arahAnimasi}
            onChange={e => setDraf(p => p ? { ...p, arahAnimasi: e.target.value } : p)}
            className="px-2.5 py-1.5 border border-stone-300 rounded font-semibold text-xs bg-stone-50"
          >
            {(draf.arahAnimasiPilihan || [{ nilai: 'kanan', label: 'Kanan (masuk dari kanan, keluar ke kiri)' }]).map(a => (
              <option key={a.nilai} value={a.nilai}>{a.label}</option>
            ))}
          </select>
          <p className="text-stone-400 text-[10px] leading-relaxed">
            Colophon guna arah ni terus. Sapuan Lajur guna arah BERTENTANGAN secara automatik supaya
            dua jenis animasi ni kekal kelihatan berbeza antara satu sama lain.
          </p>
        </div>

        {/* 3b. Logo penaja & warna panel — cuma relevan untuk Colophon/Sapuan Lajur, tapi kekal
            ditunjukkan walaupun "Pudar" dipilih supaya Ketua Editor boleh sediakan dahulu sebelum
            tukar jenis animasi. */}
        <PanelTransisiField draf={draf} setDraf={setDraf} />

        <ArahPerSlotField />

        {/* 3c. Saiz fon Focus View — satu tetapan GLOBAL (bukan per-Bidang/tier), permintaan Izzat
            2026-08-04, supaya semua kandungan dalam Focus View konsisten. */}
        <div className="border border-stone-200 rounded p-4 space-y-3">
          <div className="font-semibold text-stone-800">3c. Saiz fon Focus View</div>
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

        {/* 4. Had aksara medan lain */}
        <div className="border border-stone-200 rounded p-4 space-y-3">
          <div>
            <div className="font-semibold text-stone-800">4. Had aksara medan lain</div>
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

        <div className="border-t border-stone-200 pt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={simpan}
            disabled={!berubah || menyimpan}
            className="bg-[#802334] text-white px-4 py-1.5 rounded font-semibold text-xs disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            <Save className="w-3.5 h-3.5" /> {menyimpan ? 'Menyimpan...' : 'Simpan Tetapan'}
          </button>
          <span className="text-[10px] text-stone-500">{berubah ? 'Ada perubahan belum disimpan' : 'Tiada perubahan'}</span>
        </div>
      </div>
    </div>
  );
};

export default TetapanAmSlotConsole;
