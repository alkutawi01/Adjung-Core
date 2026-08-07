import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, AlignLeft } from 'lucide-react';
import { TIER_LABELS, tierForSlot } from '../../../core/editorial/GeometryConfig.js';
import { validateContentBudget } from '../../../core/editorial/ContentBudget.js';
import { BidangIcon } from '../common/BidangIcon';
import { StatusBadge } from '../common/StatusBadge';

// "Draf Saya" (2026-08-01, permintaan pemilik projek) — sebelum ni seorang editor terpaksa membuka
// slot yang dia kendalikan SATU PER SATU untuk mencari draf sendiri, sebab draf tidak pernah
// muncul di Indeks (ia hidup sebagai teks dalam slot masing-masing, bukan sebagai rekod). Konsol
// ni mengumpul kesemuanya di satu tempat, dan klik pada satu baris membuka terus ruang menulis
// slot berkenaan pada draf itu.
//
// Ketua Editor melihat draf DIA SENDIRI sahaja di sini (keputusan pemilik projek) — ini ruang
// kerja peribadi, bukan papan pemantau kerja orang lain.
//
// Metrik, carian/penapis, dan lajur Kelengkapan/Bajet Ruang (2026-08-01) — semak sebelum buka:
// editor boleh nampak SEBELUM klik sama ada draf tu dah cukup lengkap dan akan lulus semakan bajet
// ruang kad, tanpa perlu buka setiap satu. Sengaja TIADA butang Terbit/Padam terus di sini —
// tindakan tu tetap berlaku dalam ruang menulis sebenar (SlotManagerModal), yang satu-satunya
// tempat tahu SEMUA draf lain dalam slot yang sama dan boleh kekalkannya bila menulis-ganti.
// Meniru tindakan tu terus di sini bermakna menulis semula logik multi-draf yang sama — risiko
// tinggi (padam draf lain dalam slot yang sama secara tak sengaja) untuk penjimatan satu klik.
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
  huraianPanjang: string;
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
  const [carian, setCarian] = useState('');
  const [bidangDipilih, setBidangDipilih] = useState('Semua');

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

  const senaraiBidang = useMemo(
    () => ['Semua', ...Array.from(new Set(draf.map((d) => d.bidang).filter(Boolean)))],
    [draf]
  );

  const drafTertapis = useMemo(() => {
    const q = carian.trim().toLowerCase();
    return draf.filter((d) => {
      const cocokBidang = bidangDipilih === 'Semua' || d.bidang === bidangDipilih;
      const cocokCarian = !q
        || d.tajuk.toLowerCase().includes(q)
        || d.huraian.toLowerCase().includes(q)
        || d.topik.toLowerCase().includes(q);
      return cocokBidang && cocokCarian;
    });
  }, [draf, carian, bidangDipilih]);

  const jumlahSlotBerbeza = useMemo(() => new Set(draf.map((d) => d.slotIndex)).size, [draf]);
  const jumlahLulusBajet = useMemo(
    () => draf.filter((d) => validateContentBudget(d.slotIndex, d.tajuk, d.huraian).isValid).length,
    [draf]
  );

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,.04)] border border-stone-200 space-y-4 text-xs">
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

        {/* Metrik ringkas — gambaran keseluruhan sebelum menatal senarai. */}
        {!memuat && draf.length > 0 && (
          <div className="grid grid-cols-3 gap-4 py-3 border-y border-stone-100">
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400 block">Jumlah draf</span>
              <span className="font-serif text-xl font-bold text-stone-900">{draf.length}</span>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400 block">Slot terlibat</span>
              <span className="font-serif text-xl font-bold text-stone-900">{jumlahSlotBerbeza}</span>
            </div>
            <div>
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400 block">Lulus bajet ruang</span>
              <span className="font-serif text-xl font-bold text-stone-900">{jumlahLulusBajet}/{draf.length}</span>
            </div>
          </div>
        )}

        {ralat && (
          <div className="border border-[var(--color-error)] bg-red-50 text-[var(--color-error)] rounded px-3 py-2 text-[11px]">{ralat}</div>
        )}

        {/* Carian + penapis Bidang — hanya berguna bila senarai dah mula panjang, jadi sengaja
            tersembunyi sehingga ada sesuatu untuk ditapis. */}
        {!memuat && draf.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              value={carian}
              onChange={(e) => setCarian(e.target.value)}
              placeholder="Cari tajuk, huraian, atau topik…"
              className="flex-1 min-w-[200px] bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
            />
            {senaraiBidang.length > 2 && (
              <select
                value={bidangDipilih}
                onChange={(e) => setBidangDipilih(e.target.value)}
                className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs cursor-pointer"
              >
                {senaraiBidang.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
          </div>
        )}

        {memuat ? (
          <div className="text-stone-400 text-xs py-6 text-center">Memuatkan draf...</div>
        ) : draf.length === 0 ? (
          <div className="text-stone-400 text-xs py-10 text-center">
            Tiada draf. Draf baharu muncul di sini sebaik anda menyimpannya dalam mana-mana slot.
          </div>
        ) : drafTertapis.length === 0 ? (
          <div className="text-stone-400 text-xs py-10 text-center">
            Tiada draf sepadan dengan carian/penapis semasa.
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs min-w-[860px]">
                <thead>
                  <tr className="border-b border-stone-200 font-mono text-[10px] uppercase tracking-wide text-stone-400" style={{ background: '#F7F5F2' }}>
                    <th className="p-2.5">Slot</th>
                    <th className="p-2.5">Bentuk</th>
                    <th className="p-2.5">Bidang</th>
                    <th className="p-2.5">Topik</th>
                    <th className="p-2.5">Tajuk</th>
                    <th className="p-2.5">Kelengkapan</th>
                    <th className="p-2.5">Bajet Ruang</th>
                    <th className="p-2.5"><span className="sr-only">Tindakan</span></th>
                  </tr>
                </thead>
                <tbody>
                  {drafTertapis.map((d) => {
                    const bidang = bidangFor(d.bidang);
                    const tier = d.tier || (tierForSlot(d.slotIndex) as string);
                    const label = d.tierLabel || TIER_LABELS[tier] || tier;
                    const bajet = validateContentBudget(d.slotIndex, d.tajuk, d.huraian);
                    return (
                      <tr
                        key={`${d.slotIndex}-${d.uuid || d.urutan}`}
                        className="hover:bg-stone-50 cursor-pointer"
                        style={{ borderTop: '1px solid #F0EDE9' }}
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
                        <td className="p-2.5">
                          <div className="flex flex-col gap-0.5">
                            {d.topik ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold" style={{ color: 'var(--color-success)' }}>
                                <Check className="w-2.5 h-2.5 shrink-0" /> Ada topik
                              </span>
                            ) : (
                              <span className="text-[9px] text-stone-400">Tiada topik</span>
                            )}
                            {d.huraianPanjang ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-semibold" style={{ color: 'var(--color-success)' }}>
                                <AlignLeft className="w-2.5 h-2.5 shrink-0" /> Ada huraian panjang
                              </span>
                            ) : (
                              <span className="text-[9px] text-stone-400">Ringkas sahaja</span>
                            )}
                          </div>
                        </td>
                        <td className="p-2.5">
                          {bajet.isValid ? (
                            <StatusBadge tone="success" label="Lulus" />
                          ) : (
                            <span title={bajet.reason} className="cursor-help">
                              <StatusBadge tone="error" label="Lebih had" />
                            </span>
                          )}
                        </td>
                        <td className="p-2.5 text-right">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--color-Adjung-maroon)] font-semibold">Sambung</span>
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
