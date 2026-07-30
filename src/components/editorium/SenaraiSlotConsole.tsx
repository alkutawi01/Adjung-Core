import React, { useEffect, useState } from 'react';
import { BidangIcon } from '../common/BidangIcon';
import {
  GEOMETRY_RATIOS, TIER_SLOTS, TIER_LABELS, TIER_LABEL_IS_ENGLISH, tierForSlot,
} from '../../../core/editorial/GeometryConfig.js';

// Senarai Slot (2026-07-30, permintaan pemilik projek) — satu jadual, satu baris satu slot,
// memaparkan segala yang mentakrifkan slot itu.
//
// Ticker (slot -1) dan tier BAR sengaja TIADA di sini: kedua-duanya ada rumah sendiri di Modul
// Khas dan peraturannya berbeza (Bar untuk event, tiada medan huraian; Ticker RSS).
//
// HAD AKSARA dibaca TERUS daripada GeometryConfig — bukan daripada lajur maxTitle/maxBrief dalam
// slots_config. Lajur DB itu salinan lama yang sudah terpesong: 12 slot simpan nombor yang salah
// dan 20 lagi kosong. Jangan sekali-kali papar nombor had daripada DB di sini.
const BAR_SLOTS = new Set(TIER_SLOTS.BAR);
const SLOT_INDEXES = Array.from({ length: 38 }, (_, i) => i).filter(i => !BAR_SLOTS.has(i));

interface SlotRow {
  slotIndex: number;
  manualDesk?: string | null;
  carouselInterval?: number | null;
  carouselDelay?: number | null;
}

interface BidangRow {
  name: string;
  color: string;
  icon: string | null;
  iconSvg: string | null;
}

export const SenaraiSlotConsole: React.FC = () => {
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [bidangList, setBidangList] = useState<BidangRow[]>([]);
  const [usage, setUsage] = useState<{ slotIndex: number; bidang: string; liveCount: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/system/slots').then(r => r.json()).catch(() => []),
      fetch('/api/system/categories/active').then(r => r.json()).catch(() => []),
      fetch('/api/system/categories/slot-usage').then(r => r.json()).catch(() => []),
    ])
      .then(([slotRows, bidangRows, usageRows]) => {
        if (Array.isArray(slotRows)) setSlots(slotRows);
        if (Array.isArray(bidangRows)) setBidangList(bidangRows);
        if (Array.isArray(usageRows)) setUsage(usageRows);
      })
      .finally(() => setLoading(false));
  }, []);

  const bidangFor = (nama: string) =>
    bidangList.find(b => b.name.toLowerCase() === (nama || '').trim().toLowerCase());

  const jumlahKandungan = SLOT_INDEXES.reduce(
    (n, i) => n + (usage.find(u => u.slotIndex === i)?.liveCount || 0), 0
  );

  return (
    <div className="space-y-4 font-sans">
      <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
              Senarai Slot
            </h3>
            <p className="text-stone-500 text-xs">
              {SLOT_INDEXES.length} slot bento — tidak termasuk Ticker dan tier <em>Bar</em>, yang diuruskan di Modul Khas.
              Jumlah {jumlahKandungan} kandungan aktif.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-stone-400 text-xs py-6 text-center">Memuatkan senarai slot...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-100 border-b border-stone-200 font-sans text-[10px] uppercase text-stone-600 font-semibold">
                  <th className="p-2.5">Slot</th>
                  <th className="p-2.5">Bentuk</th>
                  <th className="p-2.5">Bidang</th>
                  <th className="p-2.5">Warna</th>
                  <th className="p-2.5 text-right">Had Tajuk</th>
                  <th className="p-2.5 text-right">Had Huraian</th>
                  <th className="p-2.5">Animasi Transisi</th>
                  <th className="p-2.5 text-right">Kandungan Aktif</th>
                  <th className="p-2.5">Editor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {SLOT_INDEXES.map(i => {
                  const tier = tierForSlot(i) as keyof typeof GEOMETRY_RATIOS;
                  const had = GEOMETRY_RATIOS[tier];
                  const cfg = slots.find(s => s.slotIndex === i);
                  const namaBidang = (usage.find(u => u.slotIndex === i)?.bidang || cfg?.manualDesk || '').trim();
                  const bidang = bidangFor(namaBidang);
                  const live = usage.find(u => u.slotIndex === i)?.liveCount || 0;
                  const selang = cfg?.carouselInterval;
                  const lengah = cfg?.carouselDelay;
                  return (
                    <tr key={i} className="hover:bg-stone-50">
                      <td className="p-2.5 font-mono font-bold text-stone-800">{i + 1}</td>
                      <td className="p-2.5 text-stone-600">
                        {TIER_LABEL_IS_ENGLISH[tier] ? <em>{TIER_LABELS[tier]}</em> : TIER_LABELS[tier]}
                      </td>
                      <td className="p-2.5">
                        {namaBidang ? (
                          <span className="inline-flex items-center gap-1.5 font-semibold" style={{ color: bidang?.color || '#57534e' }}>
                            {bidang && <BidangIcon iconName={bidang.icon} iconSvg={bidang.iconSvg} color={bidang.color} />}
                            {namaBidang}
                          </span>
                        ) : (
                          <span className="text-stone-400 italic">Belum ditetapkan</span>
                        )}
                      </td>
                      <td className="p-2.5">
                        {bidang ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-3.5 h-3.5 rounded-full border border-stone-300" style={{ backgroundColor: bidang.color }} />
                            <span className="font-mono text-[10px] uppercase text-stone-500">{bidang.color}</span>
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono text-stone-700">{had.maxTitleAlone}</td>
                      <td className="p-2.5 text-right font-mono text-stone-700">{had.maxBriefAlone}</td>
                      <td className="p-2.5 text-stone-600">
                        {selang ? (
                          <span className="font-mono text-[10px]">
                            {selang}s{lengah ? ` · lengah ${lengah}s` : ''}
                          </span>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>
                      <td className="p-2.5 text-right font-mono font-bold text-stone-800">{live}</td>
                      <td className="p-2.5 text-stone-400 italic">Belum ditugaskan</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-stone-200 pt-3 space-y-1.5 text-[10px] text-stone-500 leading-relaxed">
          <p>
            <strong className="font-semibold text-stone-700">Had aksara ikut bentuk, bukan ikut slot.</strong>{' '}
            Semua slot yang sama bentuk berkongsi had yang sama — ia datang daripada saiz fizikal kad itu sendiri.
            Tajuk dan huraian pula berkongsi SATU bajet ruang: tajuk panjang mengecilkan ruang huraian, dan sebaliknya.
            Nombor di atas ialah had setiap medan apabila medan satu lagi kosong.
          </p>
          <p>
            <strong className="font-semibold text-stone-700">Lajur Editor masih kosong.</strong>{' '}
            Penugasan editor kepada slot belum wujud dalam sistem — ia kerja seterusnya.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SenaraiSlotConsole;
