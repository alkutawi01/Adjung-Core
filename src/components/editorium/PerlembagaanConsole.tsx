import React, { useState, useEffect } from 'react';
import { GEOMETRY_RATIOS, TIER_SLOTS, TIER_LABELS, TIER_LABEL_IS_ENGLISH } from '../../../core/editorial/GeometryConfig.js';

// Everything under CHART DATA below is read directly from core/editorial/GeometryConfig.js --
// the exact same module server.js imports for validateContentBudget. There is no second copy of
// the numbers here: if that file changes, this page changes with it on the next load. TIER_LABELS
// / TIER_LABEL_IS_ENGLISH likewise come from there now -- no local copy of tier names either.

// Renders a tier label, condong (italic) whenever GeometryConfig flags it as an unapproved
// English/borrowed word (peraturan: label mesti 100% Bahasa Melayu, Inggeris hanya dibenarkan
// bertulis condong).
const TierLabel: React.FC<{ tier: string }> = ({ tier }) =>
  TIER_LABEL_IS_ENGLISH[tier] ? <em className="italic">{TIER_LABELS[tier]}</em> : <>{TIER_LABELS[tier]}</>;

const TIER_ORDER = ['HERO', 'MENEGAK', 'STANDARD', 'SEGI_EMPAT_MEDIUM', 'SEGI_EMPAT_SMALL', 'KOMPAK', 'BAR', 'TICKER'];

// Real pixel dimensions, MEASURED directly off the live rendered page (getBoundingClientRect on
// an actual card of each tier at desktop width 1280px) -- not derived from col-span/row-span grid
// units. An earlier version of this illustration assumed 1 grid column-width ~= 1 row-height,
// which was wrong: a "row" renders much taller in real pixels than a single column is wide (real
// content/padding stretches height well past the declared min-h-[...] floor). That wrong
// assumption made MENEGAK render near-square here when the real card is genuinely tall (0.47
// width:height ratio measured).
//
// `w`/`h` are always the size of ONE card of that tier -- same basis for every tier, so boxes are
// comparable at a glance. Most tiers occupy their own grid cell 1-slot-per-position, so one box IS
// the whole slot. BAR and KOMPAK are different: in the real layout several of their slots share one
// grid column, stacked with a real CSS gap between them (`units`/`gap`, both measured off the
// wrapper). An earlier version of this illustration measured that whole stacked wrapper as if it
// were a single card and sliced it with thin internal lines -- that made a 2-unit KOMPAK group and
// a 4-unit BAR group look like near-identical shapes, which is wrong on two counts: it hid that a
// single BAR card (84px) is a different height from a single KOMPAK card (135px), and it drew a
// seam-less box where reality is genuinely separate rounded cards with visible gaps between them
// (confirmed against a real frontpage screenshot). `units`/`gap` now render as that many distinct
// stacked boxes instead.
const TIER_SHAPE_PX: Record<string, { w: number; h: number; measured: boolean; units?: number; gap?: number }> = {
  HERO: { w: 1024, h: 225, measured: true },
  MENEGAK: { w: 331, h: 698, measured: true },
  STANDARD: { w: 677, h: 276, measured: true },
  SEGI_EMPAT_MEDIUM: { w: 504, h: 299, measured: true },
  SEGI_EMPAT_SMALL: { w: 331, h: 406, measured: true },
  KOMPAK: { w: 331, h: 135, measured: true, units: 2, gap: 16 },
  BAR: { w: 331, h: 84, measured: true, units: 4, gap: 8 },
  TICKER: { w: 1024, h: 41, measured: true },
};
const SHAPE_SCALE = 1 / 12; // real px -> illustration px

interface ChangelogCommit {
  hash: string;
  fullHash: string;
  date: string;
  message: string;
}

interface UiUxLogEntry {
  time: string;
  summary: string;
  files: string[];
}

const formatLogTime = (iso: string) => {
  const d = new Date(iso);
  const datePart = d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  const timePart = d.toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  return `${datePart}, ${timePart}`;
};

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
  {
    title: 'Penomboran slot mula dari 1, bukan 0.',
    body: 'Manusia sentiasa nampak "Slot 1", "Slot 2" ... "Slot 38". TIADA "Slot 0" dipaparkan di mana-mana UI. Indeks dalaman kod (0-37) kekal tak berubah -- ini peraturan PAPARAN sahaja, bukan skema data.',
  },
  {
    title: 'Label mesti 100% Bahasa Melayu.',
    body: 'Kalau terpaksa guna Bahasa Inggeris (tiada padanan Melayu yang diluluskan lagi), tulis dengan huruf condong (italic). Lihat carta tier di bawah -- Bar dan Ticker kini bertulis condong kerana sebab ini.',
  },
  {
    title: 'Tinggi kad ikut kandungan, bukan ikut jiran.',
    body: 'Susun atur bento guna flex bersarang (items-start), bukan CSS Grid row auto-placement -- CSS Grid regangkan SEMUA kad sebaris ikut kad paling tinggi walau lepas self-start diguna (sel grid tetap tinggi, cuma kandungan dalam sel yang tak regang, jurang kekal wujud di bawah). Flex tiada kekangan tinggi-sebaris macam itu langsung. Pada saiz skrin TETAP, dua slot tier sama mesti nampak setinggi kandungan sebenar masing-masing, tak kira jiran row-span-2 (atau kelompok Bar) apa yang duduk sebaris dengannya. PENGECUALIAN sah: tinggi boleh berubah ikut SAIZ SKRIN/viewport (responsif) -- bila itu berlaku, ia mesti berubah SERENTAK untuk semua slot dalam baris yang sama, bukan slot demi slot secara berbeza.',
  },
  {
    title: 'Fon tajuk tak boleh lebih kecil daripada fon huraian.',
    body: 'Saiz fon huraian TETAP (14px, inline style yang menewaskan class Tailwind apa pun) di semua kad, manakala saiz fon tajuk berbeza-beza ikut tier/breakpoint (class Tailwind sahaja, tiada paksaan). Sebab tajuk dinamik (panjang & saiz berubah ikut tier) tapi huraian statik, setiap kombinasi tier+breakpoint MESTI disemak: fon tajuk >= 14px pada semua saiz skrin. (Diketahui melanggar setakat ini: kad Kompak guna text-xs [12px] untuk tajuk di bawah breakpoint md -- belum dibetulkan, tunggu arahan.)',
  },
];

export const PerlembagaanConsole: React.FC = () => {
  const [commits, setCommits] = useState<ChangelogCommit[]>([]);
  const [changelogUnavailable, setChangelogUnavailable] = useState(false);
  const [loadingLog, setLoadingLog] = useState(true);

  const [uiUxEntries, setUiUxEntries] = useState<UiUxLogEntry[]>([]);
  const [uiUxUnavailable, setUiUxUnavailable] = useState(false);
  const [loadingUiUxLog, setLoadingUiUxLog] = useState(true);

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

    fetch('/api/system/ui-ux-changelog')
      .then(res => res.json())
      .then(data => {
        setUiUxEntries(data.entries || []);
        setUiUxUnavailable(!!data.unavailable);
        setLoadingUiUxLog(false);
      })
      .catch(() => {
        setUiUxUnavailable(true);
        setLoadingUiUxLog(false);
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
          02 -- Carta Pembahagian Slot (<em className="italic">Live</em>)
        </span>

        {/* Shape gallery: real MEASURED pixel proportions (getBoundingClientRect on the live page
            at 1280px width), to scale, side by side -- not derived from grid units (that
            approach was tried first and produced a wrong, near-square MENEGAK box; see the
            TIER_SHAPE_PX comment above for what happened and why). */}
        <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs mb-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold mb-3">
            Bentuk sebenar (diukur terus dari kad hidup, skala 1:{Math.round(1 / SHAPE_SCALE)})
          </div>
          <div className="flex flex-wrap items-end gap-6">
            {TIER_ORDER.map(tier => {
              const shape = TIER_SHAPE_PX[tier];
              const boxW = Math.max(shape.w * SHAPE_SCALE, 4);
              const boxH = Math.max(shape.h * SHAPE_SCALE, 4);
              const unitBox = (key: React.Key) => (
                <div
                  key={key}
                  className={`border-2 bg-[#f3e9d2] rounded-sm ${shape.measured ? 'border-[#802334]' : 'border-[#802334]/40 border-dashed'}`}
                  style={{ width: boxW, height: boxH }}
                  title={shape.measured ? 'Diukur terus dari kad sebenar' : 'Dianggar -- tiada kandungan sebenar untuk diukur ketika ini'}
                />
              );
              return (
                <div key={tier} className="flex flex-col items-center gap-1.5">
                  {shape.units ? (
                    <div className="flex flex-col" style={{ gap: Math.max((shape.gap || 0) * SHAPE_SCALE, 1) }}>
                      {Array.from({ length: shape.units }).map((_, i) => unitBox(i))}
                    </div>
                  ) : unitBox('single')}
                  <span className="font-mono text-[9px] text-stone-600 font-bold text-center leading-tight max-w-[70px]">
                    <TierLabel tier={tier} />{!shape.measured && ' *'}
                  </span>
                  {shape.units && (
                    <span className="font-mono text-[7px] text-stone-400 text-center leading-tight">
                      1 kad = {Math.round(shape.h)}px, {shape.units}× bertindan
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs space-y-4">
          {TIER_ORDER.map(tier => {
            const ratio = GEOMETRY_RATIOS[tier as keyof typeof GEOMETRY_RATIOS];
            const slots = tier === 'TICKER' ? null : (TIER_SLOTS as any)[tier];
            const budget = (ratio?.maxTitleAlone || 0) + (ratio?.maxBriefAlone || 0);
            const pct = maxBudget > 0 ? Math.max(6, Math.round((budget / maxBudget) * 100)) : 0;
            return (
              <div key={tier} className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-2 md:gap-4 items-start">
                <div>
                  <div className="font-serif text-sm font-bold text-stone-900"><TierLabel tier={tier} /></div>
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
                          {s + 1}
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

      {/* PERATURAN KHAS SLOT BAR -- diekstrak & disahkan terus daripada kod semasa (server.js,
          BarCard.tsx, EventDateValidator.js), bukan disalin buta daripada spesifikasi lama. Ditulis
          selepas siasatan mendalam mendapati beberapa medan (organizer/location/access) pernah
          dihurai betul tapi gugur senyap sebelum sampai ke pangkalan data -- jurang itu dah
          dibetulkan dulu sebelum peraturan ini ditulis, supaya apa yang tertulis di sini sentiasa
          padan dengan apa yang benar-benar berlaku, bukan spesifikasi angan-angan. */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
          03 -- Peraturan Khas Slot Bar
        </span>
        <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs space-y-4">
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Fungsi</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Slot Bar 100% untuk acara/program (seminar, pesta buku, majlis anugerah, dll.) --
              BUKAN untuk berita. Pipeline AI (<code className="bg-stone-100 px-1 rounded text-[11px]">EditorialPipeline.js</code>) dihadkan kepada kandungan acara sahaja untuk tier ini.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Format input manual (7 medan rasmi)</h3>
            <pre className="bg-stone-100 border border-stone-200 rounded p-3 font-mono text-[10px] text-stone-700 leading-relaxed overflow-x-auto">{`Tarikh:
Event:
Penganjur:
Lokasi:
Akses:
Penerangan:
URL:`}</pre>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Pemetaan paparan pada kad (baris atas)</h3>
            <ul className="font-sans text-xs text-stone-600 leading-relaxed list-disc pl-4 space-y-1">
              <li><strong>Kiri atas</strong> (teks amber): medan <code className="bg-stone-100 px-1 rounded text-[11px]">Tarikh</code>. Jika kosong → nama desk (cth. "ADJUNG EDITORIAL") sebagai jatuh balik.</li>
              <li><strong>Kanan atas</strong> (lencana): akronim daripada <code className="bg-stone-100 px-1 rounded text-[11px]">Penganjur</code> SAHAJA bila medan itu diisi terus. Jika <code className="bg-stone-100 px-1 rounded text-[11px]">Penganjur</code> kosong → jatuh balik kepada lencana status <code className="bg-stone-100 px-1 rounded text-[11px]">Akses</code>.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Ekstrak akronim Penganjur</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Ikut urutan: (1) teks dalam kurungan -- cth. <em className="italic">"Dewan Bahasa dan Pustaka (DBP)"</em> → "DBP"; (2) kamus akronim rasmi (DBP, PPAS, PNM, KPM, DBKL, ITBM, MAIS, JAIS, JAKIM, UM, UKM, UPM, USM, UiTM, UIAM, YWI) bila nama penuh ditaip tanpa kurungan; (3) input yang sedia pendek (≤2 patah perkataan / ≤10 aksara) dikekalkan terus; (4) jika tiada padanan, bina akronim daripada huruf pertama setiap perkataan utama. Sebab: lencana terlalu kecil untuk nama penuh.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Medan Akses</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Hanya 2 nilai sah: <em className="italic">Terbuka</em> / <em className="italic">Tertutup</em>. Dipaparkan sebagai lencana jatuh balik SAHAJA bila <code className="bg-stone-100 px-1 rounded text-[11px]">Penganjur</code> tiada -- bukan dipaparkan serentak dengan lencana Penganjur.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Medan Penerangan</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Huraian tambahan pilihan, disimpan penuh tapi <strong>TIDAK dipaparkan pada kad</strong> --
              disediakan untuk ciri akordion (panel kembang) akan datang, belum dibina. Tiada had aksara
              dikuatkuasakan setakat ini (tiada panel sebenar untuk diukur) -- sama prinsip dengan
              <code className="bg-stone-100 px-1 rounded text-[11px] mx-1">briefLong</code>
              tier lain sebelum ciri spotlight dibina.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Skim warna (Adjung theme sahaja)</h3>
            <ul className="font-sans text-xs text-stone-600 leading-relaxed list-disc pl-4 space-y-1">
              <li>Lencana <strong>Penganjur</strong>: putih krim glassmorphism -- <code className="bg-stone-100 px-1 rounded text-[11px]">bg-white/15 text-white border-white/30</code>.</li>
              <li>Lencana <strong>Akses: Terbuka</strong>: emas Adjung -- <code className="bg-stone-100 px-1 rounded text-[11px]">bg-amber-400/20 text-amber-300 border-amber-300/30</code>.</li>
              <li>Lencana <strong>Akses: Tertutup</strong>: marun gelap -- <code className="bg-stone-100 px-1 rounded text-[11px]">bg-rose-950/60 text-rose-300 border-rose-500/40</code>.</li>
              <li>Prinsip am: lencana Penganjur dan lencana Akses TIDAK BOLEH kongsi warna -- fungsi semantik berbeza (entiti vs status).</li>
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Jaminan pipeline (wajib, setiap laluan simpan Bar)</h3>
            <ul className="font-sans text-xs text-stone-600 leading-relaxed list-disc pl-4 space-y-1">
              <li>Kunci atribut <code className="bg-stone-100 px-1 rounded text-[11px]">organizer</code>, <code className="bg-stone-100 px-1 rounded text-[11px]">location</code>, <code className="bg-stone-100 px-1 rounded text-[11px]">access</code>, <code className="bg-stone-100 px-1 rounded text-[11px]">penerangan</code> mesti didaftar dalam <code className="bg-stone-100 px-1 rounded text-[11px]">editorial_attributes</code> sebelum disimpan (FK constraint -- kalau tidak, INSERT gagal senyap).</li>
              <li>Laluan simpan (<code className="bg-stone-100 px-1 rounded text-[11px]">syncManualObjectsForSlot</code>) mesti tulis kesemua 4 medan ke <code className="bg-stone-100 px-1 rounded text-[11px]">editorial_attribute_values</code>.</li>
              <li>Laluan baca (<code className="bg-stone-100 px-1 rounded text-[11px]">resolveSlotContent</code>, KEDUA-DUA laluan -- blob mentah belum-dimigrasi DAN baris DB sebenar) mesti ekstrak semula kesemua 4 medan.</li>
              <li>Parser teks (<code className="bg-stone-100 px-1 rounded text-[11px]">Penganjur:</code>/<code className="bg-stone-100 px-1 rounded text-[11px]">Lokasi:</code>/<code className="bg-stone-100 px-1 rounded text-[11px]">Akses:</code>/<code className="bg-stone-100 px-1 rounded text-[11px]">Penerangan:</code>) case-insensitive.</li>
              <li>4 slot Bar dalam satu kumpulan (Slot 8,9,10,11 / Slot 22,23,24,25) setiap satu SLOT BERASINGAN dengan kandungan sendiri -- bukan satu carousel dikongsi bersama.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Label "PROGRAM-PROGRAM BERMANFAAT"</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Label menegak khas untuk kelompok slot Bar sahaja (bukan tier lain). Kedudukannya
              (kiri/kanan) bergantung kepada lokasi fizikal kelompok slot Bar dalam grid -- bukan
              kedudukan tetap. Label ini sudah wujud dalam kod sedia ada dan diterima seadanya; tiada
              perubahan kod diperlukan untuknya.
            </p>
          </div>
        </div>
      </div>

      {/* LIVE CHANGE LOG */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
          04 -- Log Perubahan Peraturan (<em className="italic">Live</em>, Daripada Git)
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

      {/* LIVE UI/UX CHANGE LOG -- separate from section 03: this one is written the instant a
          UI/UX-affecting change lands (scripts/log-ui-change.mjs), not deferred to commit time,
          and carries a full jam:minit:saat timestamp, not just a date. */}
      <div>
        <span className="font-mono text-[10px] uppercase tracking-widest text-[#b8934a] font-bold block mb-3">
          05 -- Log Perubahan UI/UX (<em className="italic">Live</em>, Masa Sebenar)
        </span>
        <div className="bg-white rounded-lg border border-stone-200 shadow-xs overflow-hidden">
          {loadingUiUxLog ? (
            <div className="p-8 text-center font-serif text-stone-500 text-xs">Memuatkan log...</div>
          ) : uiUxUnavailable ? (
            <div className="p-8 text-center font-serif text-stone-500 text-xs">Log UI/UX tidak tersedia.</div>
          ) : uiUxEntries.length === 0 ? (
            <div className="p-8 text-center font-serif text-stone-500 text-xs">Tiada rekod perubahan UI/UX setakat ini.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs min-w-[480px]">
                <thead>
                  <tr className="bg-stone-100 border-b border-stone-200 font-mono text-[9px] uppercase text-stone-600 tracking-wider">
                    <th className="p-3 w-40">Masa</th>
                    <th className="p-3">Perubahan</th>
                    <th className="p-3 w-56">Fail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {uiUxEntries.map((e, i) => (
                    <tr key={i} className="hover:bg-stone-50">
                      <td className="p-3 font-mono text-[10px] text-stone-500 whitespace-nowrap">{formatLogTime(e.time)}</td>
                      <td className="p-3 font-serif text-stone-800">{e.summary}</td>
                      <td className="p-3 font-mono text-[9px] text-stone-500">{e.files.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerlembagaanConsole;
