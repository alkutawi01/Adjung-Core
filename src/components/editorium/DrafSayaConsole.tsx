import React, { useCallback, useEffect, useState } from 'react';
import { TIER_LABELS, tierForSlot } from '../../../core/editorial/GeometryConfig.js';
import { BidangIcon } from '../common/BidangIcon';

// "Draf Saya" (2026-08-01, permintaan pemilik projek) — sebelum ni seorang editor terpaksa membuka
// slot yang dia kendalikan SATU PER SATU untuk mencari draf sendiri, sebab draf tidak pernah
// muncul di Indeks (ia hidup sebagai teks dalam slot masing-masing, bukan sebagai rekod). Konsol
// ni mengumpul kesemuanya di satu tempat, dan klik pada satu baris membuka terus ruang menulis
// slot berkenaan pada draf itu.
//
// Ketua Editor melihat draf DIA SENDIRI sahaja di sini (keputusan pemilik projek) — ini ruang
// kerja peribadi, bukan papan pemantau kerja orang lain.
interface Draf {
  slotIndex: number;
  urutan: number;
  tier: string;
  tierLabel: string;
  bidang: string;
  uuid: string;
  tajuk: string;
  topik: string;
  huraian: string;
  penulis: string;
  milik: 'nama' | 'slot';
}

interface Bidang { name: string; color: string; icon: string | null; iconSvg: string | null }

interface DrafSayaConsoleProps {
  editorId: string;
  editorName: string;
  // Buka ruang menulis slot berkenaan (useSlotEditor.openSlotEditor) — draf disunting di tempat
  // asalnya, bukan disalin ke borang berasingan yang kemudian boleh terpesong daripada slot.
  onBukaDraf: (slotIndex: number, uuid: string) => void;
  // Dinaikkan oleh EditoriumView setiap kali ruang menulis ditutup — senarai di sini dibaca semula
  // supaya draf yang baru disimpan (atau baru diterbitkan, jadi bukan draf lagi) terus tepat,
  // tanpa editor perlu menekan "Muat Semula" sendiri.
  versi?: number;
}

// Tier Bar & Ticker guna label Inggeris condong (istilah diluluskan, lihat src/config/istilah.ts).
const TIER_LABEL_IS_ENGLISH: Record<string, boolean> = { BAR: true, TICKER: true };

export const DrafSayaConsole: React.FC<DrafSayaConsoleProps> = ({ editorId, editorName, onBukaDraf, versi = 0 }) => {
  const [draf, setDraf] = useState<Draf[]>([]);
  const [bidangList, setBidangList] = useState<Bidang[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');

  const muatDraf = useCallback(() => {
    setMemuat(true);
    setRalat('');
    const q = new URLSearchParams({ penulis: editorName || '', editorId: editorId || '' });
    fetch(`/api/system/drafts?${q.toString()}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal membaca senarai draf.');
        return data;
      })
      .then((data) => setDraf(Array.isArray(data) ? data : []))
      .catch((e) => setRalat(e.message || 'Gagal membaca senarai draf.'))
      .finally(() => setMemuat(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorId, editorName, versi]);

  useEffect(() => { muatDraf(); }, [muatDraf]);

  useEffect(() => {
    fetch('/api/system/categories/active')
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setBidangList(data); })
      .catch(() => { /* senarai Bidang hanya untuk warna/ikon — kegagalan tak menghalang senarai draf */ });
  }, []);

  const bidangFor = (nama: string) =>
    bidangList.find((b) => b.name.toLowerCase() === (nama || '').trim().toLowerCase());

  const jumlahIkutSlot = draf.filter((d) => d.milik === 'slot').length;

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">Draf Saya</h3>
            <p className="text-stone-500 text-xs">
              Semua draf yang belum diterbitkan, dikumpulkan daripada setiap slot. Klik satu baris untuk menyambung menulis.
            </p>
          </div>
          <button
            type="button"
            onClick={muatDraf}
            className="px-3 py-1.5 border border-stone-300 rounded text-[11px] font-semibold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            Muat Semula
          </button>
        </div>

        {ralat && (
          <div className="border border-red-200 bg-red-50 text-red-800 rounded px-3 py-2 text-[11px]">{ralat}</div>
        )}

        {memuat ? (
          <div className="text-stone-400 text-xs py-6 text-center">Memuatkan draf...</div>
        ) : draf.length === 0 ? (
          <div className="text-stone-400 text-xs py-10 text-center">
            Tiada draf. Draf baharu muncul di sini sebaik anda menyimpannya dalam mana-mana slot.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 font-sans text-[10px] uppercase text-stone-600 font-semibold">
                    <th className="p-2.5">Slot</th>
                    <th className="p-2.5">Bentuk</th>
                    <th className="p-2.5">Bidang</th>
                    <th className="p-2.5">Topik</th>
                    <th className="p-2.5">Tajuk</th>
                    <th className="p-2.5"><span className="sr-only">Tindakan</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {draf.map((d) => {
                    const bidang = bidangFor(d.bidang);
                    const tier = d.tier || (tierForSlot(d.slotIndex) as string);
                    const label = d.tierLabel || TIER_LABELS[tier] || tier;
                    return (
                      <tr
                        key={`${d.slotIndex}-${d.uuid || d.urutan}`}
                        className="hover:bg-stone-50 cursor-pointer"
                        onClick={() => onBukaDraf(d.slotIndex, d.uuid)}
                      >
                        <td className="p-2.5 font-mono font-bold text-stone-800">{d.slotIndex + 1}</td>
                        <td className="p-2.5 text-stone-600">
                          {TIER_LABEL_IS_ENGLISH[tier] ? <em>{label}</em> : label}
                        </td>
                        <td className="p-2.5">
                          {d.bidang ? (
                            <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: bidang?.color || '#57534e' }}>
                              {bidang && <BidangIcon iconName={bidang.icon} iconSvg={bidang.iconSvg} color={bidang.color} />}
                              {d.bidang}
                            </span>
                          ) : (
                            <span className="text-stone-400 italic">Belum ditetapkan</span>
                          )}
                        </td>
                        <td className="p-2.5 text-stone-600">
                          {d.topik || <span className="text-stone-400">—</span>}
                        </td>
                        <td className="p-2.5 text-stone-800 max-w-md">
                          {d.tajuk
                            ? <span className="font-serif text-[13px] leading-snug">{d.tajuk}</span>
                            : <span className="text-stone-400 italic">Draf kosong (belum bertajuk)</span>}
                          {d.milik === 'slot' && (
                            <span className="ml-2 align-middle font-sans text-[9px] uppercase tracking-wider text-stone-400 border border-stone-200 rounded px-1.5 py-0.5">
                              Ikut slot
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          <span className="font-sans text-[10px] uppercase tracking-wider text-[#802334] font-semibold">Sambung</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {jumlahIkutSlot > 0 && (
              <p className="text-stone-400 text-[10px] leading-relaxed">
                Draf bertanda <span className="uppercase tracking-wider">Ikut slot</span> dibuat sebelum sistem mula mencatat
                nama penulis. Ia dipaparkan di sini kerana anda ditugaskan mengendalikan slot berkenaan, bukan kerana
                sistem tahu andalah yang menulisnya.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DrafSayaConsole;
