import React, { useState, useEffect } from 'react';
import { BRAND } from '../../config/brand';
import { Tooltip } from '../common/Tooltip';

// Sistem Reka Bentuk Adjung Brief (Design System Console)
// Pure Cream Surface (#FDFDFD), Hairline Sectioning (1px stone-200), Serif Titles, Inter Labels, Mono for Data Only.

const COLOR_TOKENS = [
  { varName: '--color-Adjung-maroon', tw: 'bg-Adjung-maroon', usage: 'Aksen jenama utama (#802334) — butang, pautan, wordmark, sempadan aktif.' },
  { varName: '--color-Adjung-maroon-dark', tw: 'bg-Adjung-maroon-dark', usage: 'State hover/tekan (#601824). Terbitan HSL lightness -10 daripada maroon utama, bukan tekaan.' },
  { varName: '--color-Adjung-cream', tw: 'bg-Adjung-cream', usage: 'Latar cream halaman (#FDFDFD) — portal awam Frontpage & Editorium.' },
  { varName: '--color-Adjung-dark', tw: 'bg-Adjung-dark', usage: 'Warna teks/ink utama (#111111 / #1F1F1F).' },
  { varName: '--color-Adjung-gray-light', tw: 'bg-Adjung-gray-light', usage: 'Neutral cair — sempadan 1px hairline stone-200, latar sekunder.' },
];

const SEMANTIC_COLORS = [
  { hex: '#b8934a', label: 'Emas/Ochre — nombor & label seksyen dokumentasi', where: 'Perlembagaan & Reka Bentuk' },
  { hex: '#3d6b4c', label: 'Hijau — status kejayaan (success) & Toast', where: 'Toast.tsx / Status badges' },
  { hex: '#a8241f', label: 'Merah karat — status ralat (error) & Toast', where: 'Toast.tsx / Warning badges' },
  { hex: '#E9D8A6', label: 'Parchment — aksen teks di atas latar maroon', where: 'BarCard & Masthead' },
];

const FONT_TOKENS = [
  { varName: '--font-serif', twClass: 'font-serif', role: 'Source Serif 4 — Suara jenama: wordmark, tajuk utama, dan teks artikel', sample: 'Membina Semula Peradaban' },
  { varName: '--font-sans', twClass: 'font-sans', role: 'Inter — Antaramuka: butang, navigasi, dan eyebrow bertanda uppercase', sample: 'MEMBINA SEMULA PERADABAN' },
  { varName: '--font-mono', twClass: 'font-mono', role: 'JetBrains Mono — Data sahaja: nombor slot, tarikh, had aksara, ID rekod', sample: '2026-07-30 · SLOT 01' },
  { varName: '--font-arabic', twClass: 'font-arabic', role: 'Noto Naskh Arabic — Kandungan skrip Arab rasmi', sample: 'بناء الحضارة من جديد' },
  { varName: '--font-signature', twClass: 'font-signature', role: 'Mrs Saint Delafield — Tandatangan penulis / editor', sample: 'Membina Semula Peradaban' },
  { varName: '--font-handwritten', twClass: 'font-handwritten', role: 'Caveat — Gloss interlinear / nota margin', sample: 'membina semula peradaban' },
  { varName: '--font-arabic-handwritten', twClass: 'font-arabic-handwritten', role: 'Playpen Sans Arabic — Nota margin skrip Arab', sample: 'بناء الحضارة من جديد' },
];

const DESIGN_RULES = [
  {
    num: '01',
    title: 'Nisbah & Sempadan (Space Over Boxes)',
    desc: 'Pemisahan seksyen diuruskan oleh garisan 1px hairline stone-300 dan ruang saksama — bukan kad berkotak berasingan atau bayang tebal.'
  },
  {
    num: '02',
    title: 'Istilah Adalah Undang-Undang (SPEC-021)',
    desc: 'Satu konsep, satu istilah. Bidang (terkunci per slot) dan Topik (bebas per item) tidak boleh dipanggil "kategori" atau "tag".'
  },
  {
    num: '03',
    title: 'Nisbah Warna Berjimat (Single Maroon Accent)',
    desc: 'Warna maroon #802334 digunakan sebagai aksen tunggal. Aksesori lain menggunakan rona stone dan cream page #FDFDFD.'
  },
  {
    num: '04',
    title: 'Hujung Lengkung Berstruktur (Radius Contract)',
    desc: '2px untuk lencana, 4px untuk butang/input, 8px untuk kad biasa dan Toast, 12px untuk HERO/MENEGAK.'
  }
];

function readCssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function readFontStack(varName: string): string {
  if (typeof window === 'undefined') return '';
  const probe = document.createElement('div');
  probe.style.fontFamily = `var(${varName})`;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  document.body.appendChild(probe);
  const stack = getComputedStyle(probe).fontFamily;
  document.body.removeChild(probe);
  return stack;
}

export const SistemRekaBentukConsole: React.FC = () => {
  const [colorValues, setColorValues] = useState<Record<string, string>>({});
  const [fontStacks, setFontStacks] = useState<Record<string, string>>({});

  useEffect(() => {
    const colors: Record<string, string> = {};
    COLOR_TOKENS.forEach(t => { colors[t.varName] = readCssVar(t.varName); });
    setColorValues(colors);

    const fonts: Record<string, string> = {};
    FONT_TOKENS.forEach(f => { fonts[f.varName] = readFontStack(f.varName); });
    setFontStacks(fonts);
  }, []);

  return (
    <div className="space-y-6 font-sans bg-[#FDFDFD] text-[#1F1F1F]">
      {/* Editorial Header Banner — Flat Cream, Hairline Divider (Matching DrafSayaConsole) */}
      <div className="pb-4 border-b border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-serif font-bold text-stone-900">
            Sistem Reka Bentuk Adjung Brief
          </h2>
          <p className="text-xs text-stone-500 font-sans mt-0.5 max-w-2xl">
            Spesifikasi rasmi identiti visual portal majalah akademik Adjung Brief. Rujukan tunggal warna, tipografi, peraturan istilah, dan komponen antaramuka Editorium.
          </p>
        </div>
        <span className="font-mono text-[10px] text-stone-500 bg-stone-100 px-2.5 py-1 rounded border border-stone-200 shrink-0">
          v1.2 Canonical
        </span>
      </div>

      {/* 01 — BRAND IDENTITY & MASTHEAD LOCK-UP */}
      <div className="space-y-4 pb-6 border-b border-stone-200">

        {/* Masthead Lock-Up Demonstration */}
        <div className="flex flex-col items-center text-center py-6 border-y border-stone-200 bg-stone-50/40">
          <div className="flex items-center gap-3 mb-1">
            <img src="/adjung-symbol.svg" alt="Simbol Adjung" className="h-10 w-auto" />
            <h1 className="font-serif font-normal tracking-tight text-5xl text-[#802334]">{BRAND.logoText}</h1>
          </div>
          <div className="flex items-center justify-center gap-2.5 mt-2 mb-1">
            <div className="h-[1px] bg-[#b4b4b4] w-12"></div>
            <span className="font-sans text-[10px] tracking-[0.25em] font-semibold text-[#b4b4b4] uppercase">{BRAND.subLabel}</span>
            <div className="h-[1px] bg-[#b4b4b4] w-12"></div>
          </div>
          <p className="font-sans text-[9px] tracking-widest uppercase text-stone-600 font-semibold mt-1">{BRAND.tagline}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs pt-2">
          <div className="space-y-1 font-sans text-stone-800">
            <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-bold block mb-1.5">Syarikat Induk & Produk</span>
            <div><strong>Syarikat:</strong> Adjung Corporation</div>
            <div><strong>Portal Utama:</strong> Adjung Brief</div>
            <div><strong>Produk Sampingan:</strong> Adjung Platform</div>
            <div><strong>Hak Cipta:</strong> {BRAND.copyright}</div>
          </div>

          <div className="space-y-1 font-sans text-stone-800">
            <span className="font-mono text-[10px] uppercase tracking-wider text-stone-400 font-bold block mb-1.5">Temperamen Reka Bentuk</span>
            <p className="text-stone-700 leading-relaxed text-[11px]">
              Akademik, elegan, teratur, tenang, dan premium. Latar cream page (#FDFDFD), garisan hairline 1px, dan aksen maroon tunggal. Tiada elemen kasual, bising, atau mengikut gaya perhiasan trend sementara.
            </p>
          </div>
        </div>
      </div>

      {/* 02 — COLOUR PALETTE */}
      <div className="space-y-4 pb-6 border-b border-stone-200">

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {COLOR_TOKENS.map(t => (
            <Tooltip key={t.varName} text={t.usage}>
              <div className="flex flex-col gap-1.5 cursor-help">
                <div className="h-14 rounded border border-stone-200 shadow-xs" style={{ background: `var(${t.varName})` }} />
                <span className="font-mono text-[9px] text-stone-700 font-bold">{t.varName}</span>
                <span className="font-mono text-[9px] text-stone-400 uppercase">{colorValues[t.varName] || '...'}</span>
              </div>
            </Tooltip>
          ))}
        </div>

        <div className="pt-3">
          <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold block mb-2.5">
            Warna Semantik Rasmi (Semantic Colors)
          </span>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {SEMANTIC_COLORS.map(c => (
              <div key={c.hex} className="flex items-start gap-2.5 p-2 rounded border border-stone-200 bg-stone-50/50">
                <div className="h-7 w-7 rounded shrink-0 border border-stone-300 shadow-xs" style={{ background: c.hex }} />
                <div>
                  <div className="font-mono text-[9px] text-stone-900 font-bold">{c.hex}</div>
                  <div className="font-sans text-[10px] text-stone-600 leading-tight mt-0.5">{c.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 03 — TYPOGRAPHY */}
      <div className="space-y-4 pb-6 border-b border-stone-200">

        <div className="space-y-4">
          {FONT_TOKENS.map(f => (
            <div key={f.varName} className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2 md:gap-4 items-start pb-3 border-b border-stone-150 last:border-0 last:pb-0">
              <div>
                <div className="font-mono text-[10px] text-stone-800 font-bold">{f.varName}</div>
                <div className="font-sans text-[10px] text-stone-500 mt-0.5">{f.role}</div>
              </div>
              <div>
                <p className={`${f.twClass} text-lg text-stone-900`}>{f.sample}</p>
                <p className="font-mono text-[9px] text-stone-400 mt-0.5 truncate" title={fontStacks[f.varName]}>
                  {fontStacks[f.varName] || '...'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 04 — DESIGN SYSTEM PRINCIPLES */}
      <div className="space-y-4">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DESIGN_RULES.map(r => (
            <div key={r.num} className="p-4 rounded-lg border border-stone-200 bg-stone-50/40 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-[#802334] font-bold bg-[#802334]/10 px-1.5 py-0.5 rounded">
                  {r.num}
                </span>
                <h4 className="font-serif text-sm font-bold text-stone-900">{r.title}</h4>
              </div>
              <p className="font-sans text-xs text-stone-600 leading-relaxed">
                {r.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SistemRekaBentukConsole;
