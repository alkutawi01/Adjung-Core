import React, { useState, useEffect } from 'react';
import { BRAND } from '../../config/brand';
import { Tooltip } from '../common/Tooltip';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { SectionLabel } from '../common/SectionLabel';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { Button } from '../common/Button';
import { LABEL_BORANG, INPUT_BORANG, KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';

// Rujukan visual tunggal (warna, tipografi, komponen kongsi). Geometri kad (saiz, had aksara)
// didokumentasikan berasingan di Perlembagaan — muka ni tak ulang kandungan tu.
//
// Nilai warna & fon TIDAK ditaip semula di sini — dibaca terus daripada CSS custom properties
// hidup (getComputedStyle atas :root) supaya muka ni automatik betul bila src/index.css berubah,
// sama falsafah dengan Perlembagaan yang import terus daripada GeometryConfig.js. Cuma NAMA
// token (bukan nilai) yang perlu disenaraikan tangan di bawah — JS tak boleh "temui" nama custom
// property tanpa menghurai CSS mentah.

const COLOR_TOKENS = [
  { varName: '--color-Adjung-maroon', tw: 'bg-Adjung-maroon', usage: 'Aksen jenama utama — butang, pautan, wordmark, sempadan aktif.' },
  { varName: '--color-Adjung-maroon-dark', tw: 'bg-Adjung-maroon-dark', usage: 'State hover/tekan bagi elemen maroon. Terbitan HSL -10 lightness drpd maroon utama (349deg 57% 32% -> 22%), bukan tekaan tangan.' },
  { varName: '--color-Adjung-cream', tw: 'bg-Adjung-cream', usage: 'Latar halaman (portal awam & Editorium, diselaraskan 2026-07-26).' },
  { varName: '--color-Adjung-dark', tw: 'bg-Adjung-dark', usage: 'Warna teks/ink utama.' },
  { varName: '--color-Adjung-gray-light', tw: 'bg-Adjung-gray-light', usage: 'Neutral cair — sempadan, latar sekunder.' },
  { varName: '--color-Adjung-paper', tw: 'bg-Adjung-paper', usage: 'Latar kertas — kepala jadual Editorium (KEPALA_JADUAL). Ditambah 2026-08-07 bagi menggantikan hex sebaris #F7F5F2.' },
  { varName: '--color-Adjung-line', tw: 'border-Adjung-line', usage: 'Garis pemisah baris jadual (GARIS_BARIS). Ditambah 2026-08-07 bagi menggantikan hex sebaris #F0EDE9.' },
];

// Belum jadi token @theme rasmi — hex terus dlm komponen berkenaan. Disenaraikan di sini supaya
// kelihatan (bukan bersembunyi), bukan dakwaan yang ia dah "diselaraskan".
const SEMANTIC_COLORS_UNTOKENIZED = [
  { hex: '#b8934a', label: 'Emas/Ochre — label seksyen dokumentasi', where: 'PerlembagaanConsole.tsx sahaja' },
  { hex: '#3d6b4c', label: 'Hijau — Toast berjaya (success)', where: 'Toast.tsx' },
  { hex: '#a8241f', label: 'Merah karat — Toast ralat (error)', where: 'Toast.tsx' },
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
      <ModulTajuk
        tajuk="Sistem Reka Bentuk Adjung Brief"
        huraian={
          <span className="block max-w-2xl">
            Rujukan tunggal identiti visual — jenama, warna, tipografi, komponen kongsi. Nilai di
            bawah dibaca TERUS daripada <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px]">src/index.css</code> dan{' '}
            <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px]">src/config/brand.ts</code> semasa
            muka ni dimuatkan — bukan salinan tangan. Peraturan geometri kad (saiz slot, had aksara)
            kekal di <span className="font-semibold text-stone-800">Perlembagaan</span>, tak diulang di sini.
          </span>
        }
      />

      {/* 01 — BRAND IDENTITY */}
      <div>
        <SectionLabel>
          01 — Identiti Jenama
        </SectionLabel>
        <PanelCard>
          <div className="flex flex-col items-center text-center py-4 mb-5 border-b border-stone-150">
            <div className="flex items-center gap-3 mb-1">
              <img src="/adjung-symbol.svg" alt="Simbol Adjung" className="h-11 w-auto" />
              <h1 className="font-serif font-normal tracking-tight text-5xl text-Adjung-maroon">{BRAND.logoText}</h1>
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
            v1.0 (Mei 2025) — <code className="not-italic bg-stone-100 px-1 py-0.5 rounded">public/adjung-symbol.svg</code>.
            Favicon dikemas kini guna simbol ni (bukan lagi segi empat rata tanpa reka bentuk).
          </p>

          {/* Sistem Logo — 4 versi dibenarkan ikut panduan v1.0 seksyen 12 (Logo System).
              Disusun terus drpd aset sebenar (adjung-symbol.svg + BRAND.logoText), bukan gambar
              statik — kalau simbol/wordmark berubah, keempat-empat versi ni ikut berubah sekali. */}
          <div className="mt-6 pt-5 border-t border-stone-150">
            <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold block mb-3">
              Sistem Logo — 4 versi dibenarkan (Panduan v1.0, seksyen 12)
            </span>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex flex-col">
                <div className="h-24 rounded-lg border border-stone-200 bg-white flex items-center justify-center gap-2 p-3">
                  <img src="/adjung-symbol.svg" alt="" className="h-6 w-auto" />
                  <span className="font-serif text-xl text-Adjung-maroon">{BRAND.logoText}</span>
                </div>
                <span className="font-mono text-[9px] text-stone-500 uppercase tracking-wide mt-1.5 text-center">Utama (Horizontal)</span>
              </div>
              <div className="flex flex-col">
                <div className="h-24 rounded-lg border border-stone-200 bg-white flex flex-col items-center justify-center gap-1 p-3">
                  <img src="/adjung-symbol.svg" alt="" className="h-6 w-auto" />
                  <span className="font-serif text-base text-Adjung-maroon">{BRAND.logoText}</span>
                </div>
                <span className="font-mono text-[9px] text-stone-500 uppercase tracking-wide mt-1.5 text-center">Menegak</span>
              </div>
              <div className="flex flex-col">
                <div className="h-24 rounded-lg border border-stone-200 bg-white flex items-center justify-center p-3">
                  <img src="/adjung-symbol.svg" alt="" className="h-10 w-auto" />
                </div>
                <span className="font-mono text-[9px] text-stone-500 uppercase tracking-wide mt-1.5 text-center">Ikon (Simbol)</span>
              </div>
              <div className="flex flex-col">
                <div className="h-24 rounded-lg border border-stone-200 bg-white flex items-center justify-center gap-2 p-3">
                  <div className="h-6 w-3 bg-stone-900" />
                  <span className="font-serif text-xl text-stone-900">{BRAND.logoText}</span>
                </div>
                <span className="font-mono text-[9px] text-stone-500 uppercase tracking-wide mt-1.5 text-center">Monokrom</span>
              </div>
            </div>
            <p className="font-sans text-[10px] text-stone-500 mt-3 italic">
              Senarai ini disusun drpd imej panduan yang dikongsi Izzat (bukan fail hidup boleh
              dirujuk semula) — sahkan label tepat kalau ada silap.
            </p>
          </div>
        </PanelCard>
      </div>

      {/* 02 — COLORS */}
      <div>
        <SectionLabel>
          02 — Warna
        </SectionLabel>
        <PanelCard padding="p-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
            {COLOR_TOKENS.map(t => (
              <Tooltip key={t.varName} text={t.usage}>
                <div className="flex flex-col gap-1.5 cursor-help">
                  <div className="h-14 rounded-lg border border-stone-200" style={{ background: `var(${t.varName})` }} />
                  <span className="font-mono text-[9px] text-stone-700 font-bold">{t.varName}</span>
                  <span className="font-mono text-[9px] text-stone-400 uppercase">{colorValues[t.varName] || '...'}</span>
                </div>
              </Tooltip>
            ))}
          </div>

          <div className="pt-4 border-t border-stone-150">
            <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold block mb-2.5">
              Warna semantik — belum jadi token @theme, hex terus dlm komponen
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
        </PanelCard>
      </div>

      {/* 03 — TYPOGRAPHY */}
      <div>
        <SectionLabel>
          03 — Tipografi
        </SectionLabel>
        <PanelCard padding="p-6" className="space-y-4">
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
        </PanelCard>
      </div>

      {/* 04 — COMPONENTS */}
      <div>
        <SectionLabel>
          04 — Komponen Kongsi
        </SectionLabel>
        <PanelCard padding="p-6" className="space-y-6">
          <div>
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">Tooltip</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Ganti sepenuhnya atribut <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">title=</code> native
              (32 tempat, digantikan 2026-07-25). Halaman ni sendiri guna Tooltip — hover atas swatch warna di atas.
            </p>
            <Tooltip text="Contoh tooltip Adjung — opacity+blur, maroon, tiada border">
              <Button>Hover Saya</Button>
            </Tooltip>
          </div>

          <div className="pt-5 border-t border-stone-100">
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">Toast</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Notifikasi transien (3 saat). Digubah semula 2026-07-26 drpd palet gelap generik
              kepada latar cream + jalur warna kiri, selari identiti Adjung.
            </p>
            <div className="flex flex-col gap-2 max-w-sm">
              <div className="flex items-center gap-3 p-3.5 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,.08)] border border-l-4 bg-Adjung-cream text-stone-800 text-xs leading-relaxed border-stone-200 border-l-[var(--color-success)]">
                <span>Peraturan berjaya ditambah!</span>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,.08)] border border-l-4 bg-Adjung-cream text-stone-800 text-xs leading-relaxed border-stone-200 border-l-[var(--color-error)]">
                <span>Sila masukkan Nama Peraturan.</span>
              </div>
              <div className="flex items-center gap-3 p-3.5 rounded-lg shadow-[0_4px_16px_rgba(0,0,0,.08)] border border-l-4 bg-Adjung-cream text-stone-800 text-xs leading-relaxed border-stone-200 border-l-Adjung-maroon">
                <span>Peraturan telah dibuang.</span>
              </div>
            </div>
          </div>
        </PanelCard>
      </div>

      {/* 05 — KOMPONEN & PEMALAR EDITORIUM (Pelan 01 Fasa A, 2026-08-07). Seksyen ni sengaja
          memaparkan komponen SEBENAR (bukan gambar rajah), jadi apabila komponen kongsi berubah,
          contoh di bawah turut berubah dengan sendirinya. */}
      <div>
        <SectionLabel>05 — Komponen &amp; Pemalar Editorium</SectionLabel>
        <PanelCard padding="p-6" className="space-y-6">
          <p className="font-sans text-xs text-stone-600 leading-relaxed">
            Komponen di bawah ialah rangka piawai setiap modul Editorium. Peraturannya mudah:
            modul TIDAK menulis gaya kad, tajuk, ralat, atau keadaan kosong sendiri lagi — semuanya
            diimport daripada <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">src/components/common/</code>.
            Apabila sesuatu corak perlu berubah, ia diubah sekali di situ, bukan 16 kali.
          </p>

          <div className="pt-5 border-t border-stone-100">
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">ModulTajuk</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Kepala modul piawai — tajuk serif-maroon, huraian pilihan, dan slot tindakan di hujung
              kanan. Kepala setiap muka Editorium (termasuk muka ni) ialah komponen ni.
            </p>
            <ModulTajuk
              tajuk="Tajuk Modul"
              huraian="Satu ayat pendek menerangkan fungsi modul."
              tindakan={<Button variant="secondary" size="sm">Muat Semula</Button>}
            />
          </div>

          <div className="pt-5 border-t border-stone-100">
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">PanelCard</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Kad panel tunggal: satu radius, satu sempadan, satu bayang. Padding{' '}
              <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">p-6</code> (lalai),{' '}
              <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">p-4</code> untuk kad
              rujukan padat, dan <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">p-0</code> untuk
              kad yang membalut jadual (memerlukan sudut terpotong kemas).
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <PanelCard padding="p-4"><span className="font-sans text-xs text-stone-600">padding="p-4"</span></PanelCard>
              <PanelCard><span className="font-sans text-xs text-stone-600">padding lalai "p-6"</span></PanelCard>
            </div>
          </div>

          <div className="pt-5 border-t border-stone-100">
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">SectionLabel</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Label seksyen bernombor (<code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">01 —</code>,{' '}
              <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">02 —</code>) yang memecahkan modul
              berbilang fungsi. Setiap tajuk seksyen dalam muka ni menggunakannya.
            </p>
            <SectionLabel>01 — Contoh Label Seksyen</SectionLabel>
          </div>

          <div className="pt-5 border-t border-stone-100">
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">MesejStatus</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Kotak mesej ralat/kejayaan/neutral. Menggantikan tiga merah berlainan yang dahulunya
              membawa maksud sama — kini satu token semantik sahaja.
            </p>
            <div className="flex flex-col gap-2 max-w-sm">
              <MesejStatus tone="error">Kandungan melebihi bajet ruang kad.</MesejStatus>
              <MesejStatus tone="success">Tetapan berjaya disimpan.</MesejStatus>
              <MesejStatus tone="neutral">Matriks disimpan, belum dikuatkuasakan.</MesejStatus>
            </div>
          </div>

          <div className="pt-5 border-t border-stone-100">
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">KeadaanKosong</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Nada tunggal bagi senarai kosong. Keadaan kosong bukan ralat, jadi ia kecil dan tenang —
              bukan blok besar berwarna.
            </p>
            <PanelCard padding="p-0"><KeadaanKosong>Tiada rekod setakat ini.</KeadaanKosong></PanelCard>
          </div>

          <div className="pt-5 border-t border-stone-100">
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">Button — empat varian</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Varian <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">bahaya</code> ditambah
              2026-08-07 untuk tindakan yang tidak boleh dibatalkan (padam, tamatkan akaun) — ia WAJIB
              berpasangan dengan pengesahan dua langkah, bukan sekadar warna merah. Dua saiz sahaja:{' '}
              <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">sm</code> dan{' '}
              <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">md</code>.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary">Utama</Button>
              <Button variant="secondary">Sekunder</Button>
              <Button variant="ghost">Telus</Button>
              <Button variant="bahaya">Padam</Button>
            </div>
          </div>

          <div className="pt-5 border-t border-stone-100">
            <div className="font-serif text-sm font-bold text-stone-900 mb-1">Pemalar gayaKongsi</div>
            <p className="font-sans text-xs text-stone-600 mb-2.5">
              Corak yang terlalu kecil untuk dijadikan komponen penuh, tetapi tetap tidak boleh
              ditulis semula oleh setiap modul. Diimport daripada{' '}
              <code className="bg-stone-100 px-1 py-0.5 rounded text-[10px]">common/gayaKongsi.ts</code>.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className={LABEL_BORANG}>LABEL_BORANG</label>
                <input className={INPUT_BORANG} defaultValue="INPUT_BORANG — fokus maroon" readOnly />
              </div>
            </div>
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className={`${KEPALA_JADUAL} border-b border-Adjung-line`}>
                  <th className="p-2.5">KEPALA_JADUAL</th>
                  <th className="p-2.5">Latar token --color-Adjung-paper</th>
                </tr>
              </thead>
              <tbody>
                <tr className={GARIS_BARIS}>
                  <td className="p-2.5 text-stone-700">GARIS_BARIS</td>
                  <td className="p-2.5 text-stone-500">Sempadan token --color-Adjung-line</td>
                </tr>
                <tr className={GARIS_BARIS}>
                  <td className="p-2.5 text-stone-700">GARIS_BARIS</td>
                  <td className="p-2.5 text-stone-500">Baris kedua, jarak sama</td>
                </tr>
              </tbody>
            </table>
          </div>
        </PanelCard>
      </div>
    </div>
  );
};

export default SistemRekaBentukConsole;
