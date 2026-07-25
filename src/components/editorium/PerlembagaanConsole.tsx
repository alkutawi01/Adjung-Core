import React, { useState, useEffect } from 'react';
import { GEOMETRY_RATIOS, TIER_SLOTS } from '../../../core/editorial/GeometryConfig.js';

// Everything under CHART DATA below is read directly from core/editorial/GeometryConfig.js --
// the exact same module server.js imports for validateContentBudget. There is no second copy of
// the numbers here: if that file changes, this page changes with it on the next load.

const TIER_LABELS: Record<string, string> = {
  HERO: 'Hero',
  MENEGAK: 'Menegak',
  STANDARD: 'Standard',
  SEGI_EMPAT_MEDIUM: 'Segi Empat Medium',
  SEGI_EMPAT_SMALL: 'Segi Empat Small',
  KOMPAK: 'Kompak',
  BAR: 'Bar',
  TICKER: 'Ticker',
};

const TIER_ORDER = ['HERO', 'MENEGAK', 'STANDARD', 'SEGI_EMPAT_MEDIUM', 'SEGI_EMPAT_SMALL', 'KOMPAK', 'BAR', 'TICKER'];

interface ChangelogCommit {
  hash: string;
  fullHash: string;
  date: string;
  message: string;
}

const UNIVERSAL_RULES = [
  {
    title: 'Saiz kad tetap. Tiada pengecualian.',
    body: 'Setiap slot ada saiz fizikal tetap ikut tier geometrinya. Kandungan mesti muat dalam saiz itu -- ini dikuatkuasakan di peringkat SIMPAN (server menolak kandungan yang tak muat), bukan diselesaikan lepas fakta dengan CSS clipping atau memotong teks sedia ada.',
  },
  {
    title: 'Tajuk + huraian kongsi SATU bajet ruang.',
    body: 'Bukan dua had berasingan. Formula: tajuk/maxTajukSendiri + huraian/maxHuraianSendiri ≤ 1. Tajuk panjang + huraian pendek boleh muat, dan sebaliknya -- tapi kedua-duanya panjang serentak tak boleh.',
  },
  {
    title: 'Slot sejenis (tier) dilayan 100% sama rata.',
    body: 'Tiada pembaikan/pengecualian khusus untuk satu slot sahaja dalam sesuatu tier. Sebarang peraturan mesti terpakai pada SEMUA slot tier yang sama, termasuk Ticker.',
  },
  {
    title: 'Semakan wajib untuk SETIAP laluan simpan.',
    body: 'Manual paste, batch paste, pipeline AI, dan edit terus (PATCH/POST) semua dikenakan validateContentBudget yang sama -- tiada laluan istimewa yang dikecualikan.',
  },
  {
    title: 'Definisi tier disegerakkan client + server.',
    body: 'GEOMETRY_RATIOS/TIER_SLOTS wujud di core/editorial/GeometryConfig.js dan diimport terus oleh kedua-dua server.js dan FrontpageView.tsx -- satu sumber tunggal, bukan dua salinan berasingan.',
  },
  {
    title: 'Body kandungan editorial ialah tulisan sebenar.',
    body: 'Jangan potong atau tulis-ganti secara mekanikal tanpa kelulusan eksplisit pemilik projek -- itu vandalisme editorial, bukan "fix".',
  },
];

export const PerlembagaanConsole: React.FC = () => {
  const [commits, setCommits] = useState<ChangelogCommit[]>([]);
  const [changelogUnavailable, setChangelogUnavailable] = useState(false);
  const [loadingLog, setLoadingLog] = useState(true);

  useEffect(() => {
    fetch('/api/system/rules-changelog')
      .then(res => res.json())
      .then(data => {
        setCommits(data.commits || []);
        setChangelogUnavailable(!!data.unavailable);
        setLoadingLog(false);
      })
      .catch(() => {
        setChangelogUnavailable(true);
        setLoadingLog(false);
      });
  }, []);

  const maxBudget = Math.max(...TIER_ORDER.map(t => {
    const r = GEOMETRY_RATIOS[t as keyof typeof GEOMETRY_RATIOS];
    return (r?.maxTitleAlone || 0) + (r?.maxBriefAlone || 0);
  }));

  return (
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200">
        <h2 className="font-serif text-base uppercase tracking-wider text-[#802334] font-bold mb-1">
          Perlembagaan Adjung Brief
        </h2>
        <p className="font-sans text-xs text-stone-600 max-w-2xl">
          Rujukan tunggal peraturan kad bento dan sejarah perubahan padanya. Carta di bawah dibaca
          terus daripada <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px]">core/editorial/GeometryConfig.js</code> --
          jika fail itu berubah, carta ini berubah sekali, automatik. Peraturan bertulis pula
          dikemas kini oleh editor bila-bila seni bina sebenar berubah.
        </p>
      </div>

      {/* UNIVERSAL RULES */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
          01 -- Peraturan Sejagat (Semua Slot, Termasuk Ticker)
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {UNIVERSAL_RULES.map((rule, i) => (
            <div key={i} className="bg-white p-4 rounded-lg border border-stone-200 shadow-xs">
              <div className="flex items-start gap-2">
                <span className="font-mono text-[10px] text-stone-400 font-bold pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">{rule.title}</h3>
                  <p className="font-sans text-xs text-stone-600 leading-relaxed">{rule.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* TIER CHART -- live from GeometryConfig.js */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
          02 -- Carta Pembahagian Slot (Live)
        </span>
        <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs space-y-4">
          {TIER_ORDER.map(tier => {
            const ratio = GEOMETRY_RATIOS[tier as keyof typeof GEOMETRY_RATIOS];
            const slots = tier === 'TICKER' ? null : (TIER_SLOTS as any)[tier];
            const budget = (ratio?.maxTitleAlone || 0) + (ratio?.maxBriefAlone || 0);
            const pct = maxBudget > 0 ? Math.max(6, Math.round((budget / maxBudget) * 100)) : 0;
            return (
              <div key={tier} className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-4 items-start">
                <div>
                  <div className="font-serif text-sm font-bold text-stone-900">{TIER_LABELS[tier]}</div>
                  <div className="font-mono text-[9px] text-stone-400 uppercase">
                    {slots ? `${slots.length} slot` : 'Jalur berasingan'}
                  </div>
                </div>
                <div>
                  <div className="h-6 bg-stone-100 rounded overflow-hidden">
                    <div
                      className="h-full rounded bg-gradient-to-r from-[#5c1926] to-[#802334] flex items-center px-2"
                      style={{ width: `${pct}%` }}
                    >
                      <span className="font-mono text-[9px] text-[#E9D8A6] font-bold whitespace-nowrap">
                        tajuk {ratio?.maxTitleAlone ?? '-'} / huraian {ratio?.maxBriefAlone ?? '-'}
                      </span>
                    </div>
                  </div>
                  {slots && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {slots.map((s: number) => (
                        <span key={s} className="bg-stone-100 text-stone-600 border border-stone-200 rounded px-1.5 py-0.5 font-mono text-[9px]">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* LIVE CHANGE LOG */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
          03 -- Log Perubahan Peraturan (Live, Daripada Git)
        </span>
        <div className="bg-white rounded-lg border border-stone-200 shadow-xs overflow-hidden">
          {loadingLog ? (
            <div className="p-8 text-center font-serif text-stone-500 text-xs">Memuatkan sejarah...</div>
          ) : changelogUnavailable ? (
            <div className="p-8 text-center font-serif text-stone-500 text-xs">
              Sejarah git tidak tersedia dalam persekitaran ini.
            </div>
          ) : commits.length === 0 ? (
            <div className="p-8 text-center font-serif text-stone-500 text-xs">Tiada rekod perubahan setakat ini.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs min-w-[480px]">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 font-mono text-[9px] uppercase text-stone-600 tracking-wider">
                    <th className="p-3 w-24">Rujukan</th>
                    <th className="p-3 w-28">Tarikh</th>
                    <th className="p-3">Perubahan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {commits.map(c => (
                    <tr key={c.fullHash} className="hover:bg-stone-50" title={`git revert ${c.hash} -- untuk batalkan perubahan ini`}>
                      <td className="p-3 font-mono text-[11px] text-stone-500">{c.hash}</td>
                      <td className="p-3 font-mono text-[10px] text-stone-500 whitespace-nowrap">{c.date}</td>
                      <td className="p-3 font-serif text-stone-800">{c.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <p className="font-sans text-[10px] text-stone-400 mt-2">
          Rujukan (cth. <code className="bg-stone-100 px-1 py-0.5 rounded">{commits[0]?.hash || '1a2b3c4'}</code>) boleh diminta untuk dibatalkan (revert) bila-bila masa.
        </p>
      </div>
    </div>
  );
};

export default PerlembagaanConsole;
