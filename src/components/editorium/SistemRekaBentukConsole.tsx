import React, { useState, useEffect } from 'react';
import { BRAND } from '../../config/brand';
import { Tooltip } from '../common/Tooltip';

// Rujukan visual tunggal (warna, tipografi, komponen kongsi). Geometri kad (saiz, had aksara)
// didokumentasikan berasingan di Perlembagaan -- muka ni tak ulang kandungan tu.
//
// Nilai warna & fon TIDAK ditaip semula di sini -- dibaca terus daripada CSS custom properties
// hidup (getComputedStyle atas :root) supaya muka ni automatik betul bila src/index.css berubah,
// sama falsafah dengan Perlembagaan yang import terus daripada GeometryConfig.js. Cuma NAMA
// token (bukan nilai) yang perlu disenaraikan tangan di bawah -- JS tak boleh "temui" nama custom
// property tanpa menghurai CSS mentah.

const COLOR_TOKENS = [
  { varName: '--color-Adjung-maroon', tw: 'bg-Adjung-maroon', usage: 'Aksen jenama utama -- butang, pautan, wordmark, sempadan aktif.' },
  { varName: '--color-Adjung-maroon-dark', tw: 'bg-Adjung-maroon-dark', usage: 'State hover/tekan bagi elemen maroon. Terbitan HSL -10 lightness drpd maroon utama (349deg 57% 32% -> 22%), bukan tekaan tangan.' },
  { varName: '--color-Adjung-cream', tw: 'bg-Adjung-cream', usage: 'Latar halaman (portal awam & Editorium, diselaraskan 2026-07-26).' },
  { varName: '--color-Adjung-dark', tw: 'bg-Adjung-dark', usage: 'Warna teks/ink utama.' },
  { varName: '--color-Adjung-gray-light', tw: 'bg-Adjung-gray-light', usage: 'Neutral cair -- sempadan, latar sekunder.' },
];

// Belum jadi token @theme rasmi -- hex terus dlm komponen berkenaan. Disenaraikan di sini supaya
// kelihatan (bukan bersembunyi), bukan dakwaan yang ia dah "diselaraskan".
const SEMANTIC_COLORS_UNTOKENIZED = [
  { hex: '#b8934a', label: 'Emas/Ochre -- label seksyen dokumentasi', where: 'PerlembagaanConsole.tsx sahaja' },
  { hex: '#3d6b4c', label: 'Hijau -- Toast berjaya (success)', where: 'Toast.tsx' },
  { hex: '#a8241f', label: 'Merah karat -- Toast ralat (error)', where: 'Toast.tsx' },
];

const FONT_TOKENS = [
  { varName: '--font-serif', twClass: 'font-serif', role: 'Tajuk, wordmark, badan artikel', sample: 'Membina Semula Peradaban' },
  { varName: '--font-sans', twClass: 'font-sans', role: 'UI, butang, teks badan Editorium', sample: 'Membina Semula Peradaban' },
  { varName: '--font-mono', twClass: 'font-mono', role: 'Label UPPERCASE bertanda, data, eyebrow seksyen, sitasi', sample: 'MEMBINA SEMULA PERADABAN' },
  { varName: '--font-arabic', twClass: 'font-arabic', role: 'Kandungan skrip Arab', sample: 'بناء الحضارة من جديد' },
  { varName: '--font-signature', twClass: 'font-signature', role: 'Tandatangan penulis', sample: 'Membina Semula Peradaban' },
  { varName: '--font-handwritten', twClass: 'font-handwritten', role: 'Gloss interlinear / nota margin', sample: 'membina semula peradaban' },
  { varName: '--font-arabic-handwritten', twClass: 'font-arabic-handwritten', role: 'Nota margin skrip Arab', sample: 'بناء الحضارة من جديد' },
];

const BRAND_FIELDS: Array<{ key: keyof typeof BRAND; label: string }> = [
  { key: 'name', label: 'Nama produk' },
  { key: 'shortName', label: 'Nama pendek' },
  { key: 'logoText', label: 'Teks wordmark' },
  { key: 'subLabel', label: 'Label bawah wordmark' },
  { key: 'tagline', label: 'Tagline' },
  { key: 'copyright', label: 'Hak cipta' },
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
    <div className="space-y-8">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200">
        <h2 className="font-serif text-base uppercase tracking-wider text-[#802334] font-bold mb-1">
          Sistem Reka Bentuk Adjung Brief
        </h2>
        <p className="font-sans text-xs text-stone-600 max-w-2xl">
          Rujukan tunggal identiti visual -- jenama, warna, tipografi, komponen kongsi. Nilai di
          bawah dibaca TERUS daripada <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px]">src/index.css</code> dan{' '}
          <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px]">src/config/brand.ts</code> semasa
          muka ni dimuatkan -- bukan salinan tangan. Peraturan geometri kad (saiz slot, had aksara)
          kekal di <span className="font-semibold text-stone-800">Perlembagaan</span>, tak diulang di sini.
        </p>
      </div>

      {/* 01 -- BRAND IDENTITY */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
          01 -- Identiti Jenama
        </span>
        <div className="bg-white p-6 rounded-lg border border-stone-200 shadow-xs">
          <div className="flex flex-col items-center text-center py-4 mb-5 border-b border-stone-150">
            <div className="flex items-center gap-3 mb-1">
              <img src="/adjung-symbol.svg" alt="Simbol Adjung" className="h-11 w-auto" />
              <h1 className="font-serif font-normal tracking-tight text-5xl text-[#802334]">{BRAND.logoText}</h1>
            </div>
            <div className="flex items-center justify-center gap-2.5 mt-2 mb-1">
              <div className="h-[1px] bg-[#b4b4b4] w-10"></div>
              <span className="font-sans text-[10px] tracking-[0.25em] font-semibold text-[#b4b4b4] uppercase">{BRAND.subLabel}</span>
              <div className="h-[1px] bg-[#b4b4b4] w-10"></div>
            </div>
            <p className="font-sans text-[9px] tracking-editorial uppercase text-[#555555] mt-1">{BRAND.tagline}</p>
          </div>
          <table className="w-full text-xs">
            <tbody>
              {BRAND_FIELDS.map(f => (
                <tr key={f.key} className="border-b border-stone-100 last:border-0">
                  <td className="py-1.5 pr-4 font-mono text-[10px] uppercase tracking-wide text-stone-400 w-40">{f.label}</td>
                  <td className="py-1.5 font-sans text-stone-800">{String(BRAND[f.key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-sans text-[10px] text-stone-500 mt-3 italic">
            Simbol (segi empat tegak, nisbah 1:2, sudut 0px) ikut Sistem Identiti Visual Adjung
            v1.0 (Mei 2025) -- <code className="not-italic bg-stone-100 px-1 py-0.5 rounded">public/adjung-symbol.svg</code>.
            Favicon dikemas kini guna simbol ni (bukan lagi segi empat rata tanpa reka bentuk).
          </p>

          {/* Sistem Logo -- 4 versi dibenarkan ikut panduan v1.0 seksyen 12 (Logo System).
              Disusun terus drpd aset sebenar (adjung-symbol.svg + BRAND.logoText), bukan gambar
              statik -- kalau simbol/wordmark berubah, keempat-empat versi ni ikut berubah sekali. */}
          <div className="mt-6 pt-5 border-t border-stone-150">
            <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold block mb-3">
              Sistem Logo -- 4 versi dibenarkan (Panduan v1.0, seksyen 12)
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex flex-col">
                <div className="h-24 rounded-md border border-stone-200 bg-white flex items-center justify-center gap-2 p-3">
                  <img src="/adjung-symbol.svg" alt="" className="h-6 w-auto" />
                  <span className="font-serif text-xl text-[#802334]">{BRAND.logoText}</span>
                </div>
                <span className="font-mono text-[9px] text-stone-500 uppercase tracking-wide mt-1.5 text-center">Utama (Horizontal)</span>
              </div>
              <div className="flex flex-col">
                <div className="h-24 rounded-md border border-stone-200 bg-white flex flex-col items-center justify-center gap-1 p-3">
                  <img src="/adjung-symbol.svg" alt="" className="h-6 w-auto" />
                  <span className="font-serif text-base text-[#802334]">{BRAND.logoText}</span>
                </div>
                <span className="font-mono text-[9px] text-stone-500 uppercase tracking-wide mt-1.5 text-center">Menegak</span>
              </div>
              <div className="flex flex-col">
                <div className="h-24 rounded-md border border-stone-200 bg-white flex items-center justify-center p-3">
                  <img src="/adjung-symbol.svg" alt="" className="h-10 w-auto" />
                </div>
                <span className="font-mono text-[9px] text-stone-500 uppercase tracking-wide mt-1.5 text-center">Ikon (Simbol)</span>
              </div>
              <div className="flex flex-col">
                <div className="h-24 rounded-md border border-stone-200 bg-white flex items-center justify-center gap-2 p-3">
                  <div className="h-6 w-3 bg-stone-900" />
                  <span className="font-serif text-xl text-stone-900">{BRAND.logoText}</span>
                </div>
                <span className="font-mono text-[9px] text-stone-500 uppercase tracking-wide mt-1.5 text-center">Monokrom</span>
              </div>
            </div>
            <p className="font-sans text-[10px] text-stone-500 mt-3 italic">
              Senarai ini disusun drpd imej panduan yang dikongsi Izzat (bukan fail hidup boleh
              dirujuk semula) -- sahkan label tepat kalau ada silap.
            </p>
          </div>
        </div>
      </div>

      {/* 02 -- COLORS */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
          02 -- Warna
        </span>
        <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
            {COLOR_TOKENS.map(t => (
              <Tooltip key={t.varName} text={t.usage}>
                <div className="flex flex-col gap-1.5 cursor-help">
                  <div className="h-14 rounded-md border border-stone-200" style={{ background: `var(${t.varName})` }} />
                  <span className="font-mono text-[9px] text-stone-700 font-bold">{t.varName}</span>
                  <span className="font-mono text-[9px] text-stone-400 uppercase">{colorValues[t.varName] || '...'}</span>
                </div>
              </Tooltip>
            ))}
          </div>

          <div className="pt-4 border-t border-stone-150">
            <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold block mb-2.5">
              Warna semantik -- belum jadi token @theme, hex terus dlm komponen
            </span>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {SEMANTIC_COLORS_UNTOKENIZED.map(c => (
                <div key={c.hex} className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded shrink-0 border border-stone-200" style={{ background: c.hex }} />
                  <div>
                    <div className="font-mono text-[9px] text-stone-700 font-bold">{c.hex}</div>
                    <div className="font-sans text-[10px] text-stone-500 leading-tight">{c.label}</div>
                    <div className="font-mono text-[8px] text-stone-400 mt-0.5">{c.where}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 03 -- TYPOGRAPHY */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
          03 -- Tipografi
        </span>
        <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs space-y-4">
          {FONT_TOKENS.map(f => (
            <div key={f.varName} className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-2 md:gap-4 items-start pb-4 border-b border-stone-100 last:border-0 last:pb-0">
              <div>
                <div className="font-mono text-[10px] text-stone-700 font-bold">{f.varName}</div>
                <div className="font-sans text-[10px] text-stone-500 mt-0.5">{f.role}</div>
              </div>
              <div>
                <p className={`${f.twClass} text-lg text-stone-900`}>{f.sample}</p>
                <p className="font-mono text-[9px] text-stone-400 mt-1 truncate" title={fontStacks[f.varName]}>
                  {fontStacks[f.varName] || '...'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 04 -- COMPONENTS */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
          04 -- Komponen Kongsi
        </span>
        <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs space-y-6">
          <div>
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">Tooltip</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Ganti sepenuhnya atribut <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">title=</code> native
              (32 tempat, digantikan 2026-07-25). Halaman ni sendiri guna Tooltip -- hover atas swatch warna di atas.
            </p>
            <Tooltip text="Contoh tooltip Adjung -- opacity+blur, maroon, tiada border">
              <button className="px-3 py-1.5 bg-[#802334] hover:bg-Adjung-maroon-dark text-white rounded text-xs font-semibold cursor-pointer shadow-sm">
                Hover Saya
              </button>
            </Tooltip>
          </div>

          <div className="pt-5 border-t border-stone-100">
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">Toast</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Notifikasi transien (3 saat). Digubah semula 2026-07-26 drpd palet gelap generik
              kepada latar cream + jalur warna kiri, selari identiti Adjung.
            </p>
            <div className="flex flex-col gap-2 max-w-sm">
              <div className="flex items-center gap-3 p-3.5 rounded-lg shadow-sm border border-l-4 bg-[#FDFDFD] text-[#292524] text-xs leading-relaxed border-stone-200 border-l-[#3d6b4c]">
                <span>Peraturan berjaya ditambah!</span>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-lg shadow-sm border border-l-4 bg-[#FDFDFD] text-[#292524] text-xs leading-relaxed border-stone-200 border-l-[#a8241f]">
                <span>Sila masukkan Nama Peraturan.</span>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-lg shadow-sm border border-l-4 bg-[#FDFDFD] text-[#292524] text-xs leading-relaxed border-stone-200 border-l-[#802334]">
                <span>Peraturan telah dibuang.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SistemRekaBentukConsole;
