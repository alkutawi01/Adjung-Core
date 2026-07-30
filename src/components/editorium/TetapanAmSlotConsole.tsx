import React, { useEffect, useState } from 'react';
import { AlertTriangle, Save } from 'lucide-react';

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
  jenisAnimasiPilihan?: { nilai: string; label: string }[];
}

const MEDAN_HAD: { kunci: keyof TetapanAm; label: string; nota: string }[] = [
  { kunci: 'hadHuraianPanjang', label: 'Huraian panjang', nota: 'Teks penuh dalam Focus View.' },
  { kunci: 'hadSumber', label: 'Sumber', nota: 'Nama penerbit asal kandungan.' },
  { kunci: 'hadTopik', label: 'Topik', nota: 'Ruang eyebrow kad masih mengehadkan Topik ikut bentuk kad; yang mana lebih ketat, itu yang menahan.' },
  { kunci: 'hadNotaEditor', label: 'Nota editor', nota: 'Nota dalaman, tidak dipapar pada kad.' },
];

export const TetapanAmSlotConsole: React.FC = () => {
  const [draf, setDraf] = useState<TetapanAm | null>(null);
  const [asal, setAsal] = useState<TetapanAm | null>(null);
  const [loading, setLoading] = useState(true);
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralat, setRalat] = useState<string | null>(null);
  const [berjaya, setBerjaya] = useState<string | null>(null);

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
      setBerjaya('Tetapan disimpan dan berkuat kuasa serta-merta.');
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
            Setakat ini satu sahaja jenis yang benar-benar wujud dalam kod. Senarai ini akan bertambah apabila
            animasi lain dibina — tiada pilihan ditawarkan di sini sebelum ia berfungsi.
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
