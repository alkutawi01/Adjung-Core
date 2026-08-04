import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Save, Upload, X } from 'lucide-react';
import { labelUi } from '../../config/istilah';

// Tetapan Am Slot (2026-07-30, permintaan pemilik projek) — tetapan yang terpakai pada SEMUA slot
// bento sekali gus. Ticker dan tier Bar tiada di sini; kedua-duanya diuruskan di Modul Khas.
//
// Had aksara: 0 bermakna TIADA HAD. Sengaja — sehingga Ketua Editor menetapkan nombor, tiada
// kandungan sedia ada tiba-tiba jadi tak sah.
interface TetapanAm {
  mulaIkutMasa: number;
  hadKandunganSlot: number;
  jenisAnimasi: string;
  hadHuraianPanjang: number;
  hadSumber: number;
  hadTopik: number;
  hadNotaEditor: number;
  logoPenaja: string;
  warnaPanelTransisi: string;
  jenisAnimasiPilihan?: { nilai: string; label: string }[];
}

const MEDAN_HAD: { kunci: keyof TetapanAm; label: string; nota: string }[] = [
  { kunci: 'hadHuraianPanjang', label: 'Huraian panjang', nota: 'Teks penuh dalam Focus View.' },
  { kunci: 'hadSumber', label: 'Sumber', nota: 'Nama penerbit asal kandungan.' },
  { kunci: 'hadTopik', label: 'Topik', nota: 'Ruang eyebrow kad masih mengehadkan Topik ikut bentuk kad; yang mana lebih ketat, itu yang menahan.' },
  { kunci: 'hadNotaEditor', label: 'Nota editor', nota: 'Nota dalaman, tidak dipapar pada kad.' },
];

const HAD_SAIZ_LOGO_BYTES = 5 * 1024 * 1024; // 5MB — sepadan had server (core/routes/mediaRoutes.js)

// Logo penaja + warna panel animasi (2026-08-04) — satu logo GLOBAL dipaparkan di tengah panel
// Colophon/Sapuan Lajur, gantikan adjung-symbol.svg lama yang tak kelihatan (sama warna dgn
// latar). Muat naik guna /api/media/upload sedia ada (corak sama ImageField di
// SlotManagerModal.tsx/BarSlotManagerModal.tsx — komponen berasingan sengaja, elak
// gandingan-silang fail Editorium/portal untuk satu medan kecil ni).
function PanelPenajaField({ draf, setDraf }: { draf: TetapanAm; setDraf: React.Dispatch<React.SetStateAction<TetapanAm | null>> }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [memuatNaik, setMemuatNaik] = useState(false);
  const [nota, setNota] = useState('');

  const muatNaikLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setNota('Jenis fail tidak dibenarkan — guna imej sahaja.');
      setTimeout(() => setNota(''), 2400);
      return;
    }
    if (file.size > HAD_SAIZ_LOGO_BYTES) {
      setNota('Fail terlalu besar (had 5MB).');
      setTimeout(() => setNota(''), 2400);
      return;
    }
    setMemuatNaik(true);
    try {
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Gagal baca fail'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileData }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Muat naik gagal');
      setDraf(p => p ? { ...p, logoPenaja: data.url } : p);
      setNota('Dimuat naik — jangan lupa tekan Simpan Tetapan.');
    } catch (e: any) {
      setNota(e.message || 'Muat naik gagal — cuba lagi.');
    } finally {
      setMemuatNaik(false);
      setTimeout(() => setNota(''), 3200);
    }
  };

  return (
    <div className="border border-stone-200 rounded p-4 space-y-3">
      <div className="font-semibold text-stone-800">3b. Logo penaja &amp; warna panel animasi</div>
      <p className="text-stone-500 text-[11px] leading-relaxed">
        Logo TUNGGAL dipaparkan di tengah panel semasa animasi Colophon/Sapuan Lajur berlaku
        (kekal walaupun "Pudar" dipilih — cuma tak dipaparkan sehingga jenis lain diaktifkan).
        Pastikan logo kontra dengan warna panel di bawah (cth logo putih pada panel gelap).
      </p>
      <div className="flex items-center gap-3">
        <div
          className="w-20 h-14 rounded border border-stone-300 flex items-center justify-center shrink-0 overflow-hidden"
          style={{ backgroundColor: draf.warnaPanelTransisi }}
        >
          {draf.logoPenaja ? (
            <img src={draf.logoPenaja} alt="Pratonton logo penaja" className="max-w-[85%] max-h-[85%] object-contain" />
          ) : (
            <span className="text-[9px] text-white/60 font-mono">Tiada logo</span>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={memuatNaik}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-2.5 py-1 border border-stone-300 rounded text-[11px] font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
            >
              <Upload className="w-3 h-3" /> {memuatNaik ? 'Memuat naik…' : 'Muat naik logo'}
            </button>
            {draf.logoPenaja && (
              <button
                type="button"
                onClick={() => setDraf(p => p ? { ...p, logoPenaja: '' } : p)}
                className="flex items-center gap-1 px-2 py-1 border border-stone-200 rounded text-[11px] text-stone-500 hover:bg-stone-50 cursor-pointer"
              >
                <X className="w-3 h-3" /> Buang
              </button>
            )}
            <input
              ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) muatNaikLogo(f); e.target.value = ''; }}
            />
          </div>
          {nota && <span className="text-[10px] text-stone-500">{nota}</span>}
        </div>
      </div>
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

        {/* 3b. Logo penaja & warna panel — cuma relevan untuk Colophon/Sapuan Lajur, tapi kekal
            ditunjukkan walaupun "Pudar" dipilih supaya Ketua Editor boleh sediakan dahulu sebelum
            tukar jenis animasi. */}
        <PanelPenajaField draf={draf} setDraf={setDraf} />

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
