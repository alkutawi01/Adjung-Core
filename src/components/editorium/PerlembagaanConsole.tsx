import React, { useState, useEffect } from 'react';
import { GEOMETRY_RATIOS, ratiosForTier, TIER_SLOTS, TIER_LABELS, TIER_LABEL_IS_ENGLISH } from '../../../core/editorial/GeometryConfig.js';
import { Tooltip } from '../common/Tooltip';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { SectionLabel } from '../common/SectionLabel';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';

// Everything under CHART DATA below is read directly from core/editorial/GeometryConfig.js --
// the exact same module server.js imports for validateContentBudget. There is no second copy of
// the numbers here: if that file changes, this page changes with it on the next load. TIER_LABELS
// / TIER_LABEL_IS_ENGLISH likewise come from there now — no local copy of tier names either.

// Renders a tier label, condong (italic) whenever GeometryConfig flags it as an unapproved
// English/borrowed word (peraturan: label mesti 100% Bahasa Melayu, Inggeris hanya dibenarkan
// bertulis condong).
const TierLabel: React.FC<{ tier: string }> = ({ tier }) =>
  TIER_LABEL_IS_ENGLISH[tier] ? <em className="italic">{TIER_LABELS[tier]}</em> : <>{TIER_LABELS[tier]}</>;

const TIER_ORDER = ['HERO', 'MENEGAK', 'STANDARD', 'SEGI_EMPAT_MEDIUM', 'SEGI_EMPAT_SMALL', 'KOMPAK', 'BAR', 'TICKER'];

// Real pixel dimensions, MEASURED directly off the live rendered page (getBoundingClientRect on
// an actual card of each tier at desktop width 1280px) — not derived from col-span/row-span grid
// units. An earlier version of this illustration assumed 1 grid column-width ~= 1 row-height,
// which was wrong: a "row" renders much taller in real pixels than a single column is wide (real
// content/padding stretches height well past the declared min-h-[...] floor). That wrong
// assumption made MENEGAK render near-square here when the real card is genuinely tall (0.47
// width:height ratio measured).
//
// `w`/`h` are always the size of ONE card of that tier — same basis for every tier, so boxes are
// comparable at a glance. Most tiers occupy their own grid cell 1-slot-per-position, so one box IS
// the whole slot. BAR and KOMPAK are different: in the real layout several of their slots share one
// grid column, stacked with a real CSS gap between them (`units`/`gap`, both measured off the
// wrapper). An earlier version of this illustration measured that whole stacked wrapper as if it
// were a single card and sliced it with thin internal lines — that made a 2-unit KOMPAK group and
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
    body: <>Setiap slot ada saiz fizikal tetap ikut tier geometrinya. Kandungan mesti muat dalam saiz itu. Ini dikuatkuasakan di peringkat SIMPAN (server menolak kandungan yang tak muat), bukan diselesaikan lepas fakta dengan CSS <em className="italic">clipping</em> atau memotong teks sedia ada.</>,
  },
  {
    title: 'Tajuk dan huraian berkongsi SATU bajet ruang.',
    body: 'Bukan dua had berasingan. Formula: tajuk/maxTajukSendiri + huraian/maxHuraianSendiri ≤ 1. Tajuk panjang dan huraian pendek boleh muat, dan sebaliknya, tapi kedua-duanya panjang serentak tak boleh.',
  },
  {
    title: 'Semua slot dalam tier yang sama dilayan secara seragam.',
    body: 'Tiada pembaikan/pengecualian khusus untuk satu slot sahaja dalam sesuatu tier. Sebarang peraturan mesti terpakai pada SEMUA slot tier yang sama, termasuk Ticker.',
  },
  {
    title: 'Semakan diwajibkan bagi SEMUA laluan simpan.',
    body: <>Manual paste, batch paste, <em className="italic">pipeline</em> AI, dan edit terus (PATCH/POST) semua dikenakan validateContentBudget yang sama. Tiada laluan istimewa yang dikecualikan.</>,
  },
  {
    title: <>Definisi tier disegerakkan antara <em className="italic">client</em> dan <em className="italic">server</em>.</>,
    body: 'GEOMETRY_RATIOS/TIER_SLOTS wujud di core/editorial/GeometryConfig.js dan diimport terus oleh kedua-dua server.js dan FrontpageView.tsx, satu sumber tunggal, bukan dua salinan berasingan.',
  },
  {
    title: 'Isi kandungan editorial ialah tulisan sebenar.',
    body: <>Jangan potong atau tulis-ganti secara mekanikal tanpa kelulusan eksplisit pemilik projek. Itu vandalisme editorial, bukan <em className="italic">"fix"</em>.</>,
  },
  {
    title: 'Penomboran slot bermula daripada 1, bukan 0.',
    body: 'Manusia sentiasa nampak "Slot 1", "Slot 2" ... "Slot 38". TIADA "Slot 0" dipaparkan di mana-mana UI. Indeks dalaman kod (0-37) kekal tak berubah. Ini peraturan PAPARAN sahaja, bukan skema data.',
  },
  {
    title: 'Label mesti 100% Bahasa Melayu.',
    body: <>Kalau terpaksa guna Bahasa Inggeris (tiada padanan Melayu yang diluluskan lagi), tulis dengan huruf condong (<em className="italic">italic</em>). Lihat carta tier di bawah: Bar dan Ticker kini bertulis condong kerana sebab ini.</>,
  },
  {
    title: 'Fon tajuk tak boleh lebih kecil daripada fon huraian.',
    body: <>Saiz fon huraian tetap pada 14px (inline style yang mengatasi mana-mana class Tailwind) di semua kad, manakala saiz fon tajuk berbeza-beza ikut tier dan <em className="italic">breakpoint</em> (class Tailwind sahaja, tiada paksaan). Oleh sebab tajuk bersifat dinamik (panjang & saiz berubah ikut tier) tapi huraian bersifat tetap, setiap kombinasi tier dan breakpoint MESTI disemak: fon tajuk {'>='} 14px pada semua saiz skrin. (Diketahui melanggar setakat ini: kad Kompak guna text-xs [12px] untuk tajuk di bawah breakpoint md, belum dibetulkan, tunggu arahan.)</>,
  },
  {
    title: 'Akordion Bar: kad kekal statik, panel dipaparkan secara berasingan di bawahnya.',
    body: <>Klik kad Bar (maroon) di luar Mod Sunting membuka/tutup panel Penerangan sebagai ELEMEN BAHARU selepas kad tu. Kad Bar itu sendiri TIDAK diubah langsung (tiada saiz/rupa berbeza apabila terbuka). Hanya SATU kad boleh terbuka pada satu masa PER KLUSTER (4 kad); klik kad lain dalam kluster yang sama tutup yang sebelum, buka yang baharu. Dua kad yang berkongsi baris <em className="italic">grid</em> dengan kluster Bar (row-span-2 menegak + satu lagi) WAJIB kekal statik (tinggi/kedudukan tak berubah) walaupun kluster Bar membesar, dikuatkuasakan melalui height-lock JS (ukur tinggi semula jadi sebelum terbuka, bekukan nilai tu semasa terbuka), BUKAN ubah struktur <em className="italic">grid</em> (lihat peraturan "jangan ubah grid bento"). Medan Penerangan dihadkan 460 aksara (core/editorial/GeometryConfig.js MAX_PENERANGAN_CHARS, dikuatkuasakan server.js syncManualObjectsForSlot), diukur empirik daripada lebar panel sebenar.</>,
  },
  {
    title: 'Senarai kandungan berskala besar wajib berkelompok (dipaginasi).',
    body: 'Mana-mana paparan yang berpotensi memuatkan kandungan dalam jumlah besar (Indeks, Semakan Kandungan) mesti menghadkan bilangan rekod yang diproses/dipaparkan serentak pada satu had tetap (100 rekod sehalaman), bukan memuatkan dan me-render kesemua rekod sekali gus tanpa had, tidak kira berapa banyak kandungan wujud dalam sistem.',
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
    // ratiosForTier: papar had yang BERKUAT KUASA (termasuk pindaan Tier Kad), bukan lalai.
    const r = ratiosForTier(t);
    return (r?.maxTitleAlone || 0) + (r?.maxBriefAlone || 0);
  }));

  return (
    <div className="space-y-8">
      <ModulTajuk
        tajuk="Perlembagaan Adjung Brief"
        huraian={
          <span className="block max-w-2xl">
            Rujukan tunggal bagi peraturan kad bento serta sejarah perubahannya. Carta di bawah dijana
            terus daripada <code className="bg-stone-100 px-1 py-0.5 rounded text-[11px]">core/editorial/GeometryConfig.js</code> —
            apabila fail itu berubah, carta ini turut dikemas kini secara automatik. Peraturan bertulis
            pula dikemas kini oleh editor setiap kali seni bina sebenar berubah.
          </span>
        }
      />

      {/* UNIVERSAL RULES */}
      <div>
        <SectionLabel>
          01 — Peraturan Sejagat (Semua Slot, Termasuk Ticker)
        </SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {UNIVERSAL_RULES.map((rule, i) => (
            <PanelCard key={i} padding="p-4">
              <div className="flex items-start gap-2">
                <span className="font-mono text-[10px] text-stone-400 font-bold pt-0.5">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">{rule.title}</h3>
                  <p className="font-sans text-xs text-stone-600 leading-relaxed">{rule.body}</p>
                </div>
              </div>
            </PanelCard>
          ))}
        </div>
      </div>

      {/* TIER CHART — live from GeometryConfig.js */}
      <div>
        <SectionLabel>
          02 — Carta Pembahagian Slot (Masa Nyata)
        </SectionLabel>

        {/* Shape gallery: real MEASURED pixel proportions (getBoundingClientRect on the live page
            at 1280px width), to scale, side by side — not derived from grid units (that
            approach was tried first and produced a wrong, near-square MENEGAK box; see the
            TIER_SHAPE_PX comment above for what happened and why). */}
        <PanelCard padding="p-6" className="mb-3">
          <div className="font-mono text-[9px] uppercase tracking-widest text-stone-400 font-bold mb-3">
            Bentuk sebenar (diukur terus daripada kad sebenar, skala 1:{Math.round(1 / SHAPE_SCALE)})
          </div>
          <div className="flex flex-wrap items-end gap-6">
            {TIER_ORDER.map(tier => {
              const shape = TIER_SHAPE_PX[tier];
              const boxW = Math.max(shape.w * SHAPE_SCALE, 4);
              const boxH = Math.max(shape.h * SHAPE_SCALE, 4);
              const unitBox = (key: React.Key) => (
                <Tooltip key={key} text={shape.measured ? 'Diukur terus dari kad sebenar' : 'Dianggar, tiada kandungan sebenar untuk diukur ketika ini'}>
                  <div
                    className={`border-2 bg-[#f3e9d2] rounded ${shape.measured ? 'border-Adjung-maroon' : 'border-Adjung-maroon/40 border-dashed'}`}
                    style={{ width: boxW, height: boxH }}
                  />
                </Tooltip>
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
        </PanelCard>

        <PanelCard padding="p-6" className="space-y-4">
          {TIER_ORDER.map(tier => {
            const ratio = ratiosForTier(tier);
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
                      className="h-full rounded bg-gradient-to-r from-[#5c1926] to-Adjung-maroon flex items-center px-2"
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
        </PanelCard>
      </div>

      {/* BIDANG & TOPIK — rujuk core/editorial/ContentBudget.js validateBidangTopik(). Bidang
          ialah konsep "Kategori"/desk sedia ada, kini terkunci kepada satu nilai tetap per slot;
          Topik ialah medan bebas-had per-kandungan yang mewarisi warna Bidang induknya. */}
      <div>
        <SectionLabel>
          03 — Bidang &amp; Topik
        </SectionLabel>
        <PanelCard padding="p-6" className="space-y-4">
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Fungsi</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Setiap slot (selain Ticker dan tier <TierLabel tier="BAR" />) terkunci kepada SATU
              Bidang tetap — semua kandungan dalam slot tu (termasuk semua item carousel) mesti
              dalam Bidang yang sama. Topik ialah medan per-kandungan yang boleh berbeza-beza
              dalam slot yang sama asalkan masih dalam Bidang terkunci tu. Contoh:
              Bidang <span className="font-mono text-[11px] bg-stone-100 px-1 rounded">Ekonomi</span> tetap
              untuk seluruh slot, tapi Topik kandungan boleh{' '}
              <span className="font-mono text-[11px] bg-stone-100 px-1 rounded">Kewangan</span>,{' '}
              <span className="font-mono text-[11px] bg-stone-100 px-1 rounded">Perbankan</span>, dll.
              Warna Topik mewarisi warna Bidang induknya (tiada storan warna berasingan). Topik
              tiada had aksara tetap sendiri, tapi berkongsi SATU baris eyebrow kad dengan
              Bidang ("Bidang | Topik", lihat "Label kad" di bawah) — gabungan yang terlalu
              panjang untuk tier kad itu ditolak semasa simpan (<code className="bg-stone-100 px-1 rounded text-[11px]">validateBidangTopik()</code>).
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Label kad</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Dipaparkan sebagai <span className="font-mono text-[11px] bg-stone-100 px-1 rounded">Bidang | Topik</span> (cth:{' '}
              <span className="font-mono text-[11px] bg-stone-100 px-1 rounded">Ekonomi | Perbankan</span>).
              Kandungan lama yang belum mempunyai Topik hanya memaparkan Bidang — tiada <em className="italic">backfill</em> automatik.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Format tampal-manual (10 medan standard)</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed mb-2">
              Format kanonikal yang dijana/dihurai oleh <code className="bg-stone-100 px-1 rounded text-[11px]">core/editorial/ManualBlockFormat.js</code> —
              digunakan oleh butang "Tampal"/"Masukkan" di Tulis Kandungan. <span className="font-mono text-[11px] bg-stone-100 px-1 rounded">UUID:</span> pilihan
              (dijana automatik jika kosong); baki medan boleh dibiar kosong tapi baris labelnya kekal.
            </p>
            <pre className="bg-stone-100 border border-stone-200 rounded p-3 font-mono text-[10px] text-stone-700 leading-relaxed overflow-x-auto">{`UUID:
Tajuk:
Topik:
Huraian ringkas:
Huraian panjang:
Sumber:
URL:
Tarikh sumber:
Imej:
Nota:`}</pre>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Wajib untuk baharu/edit</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Topik diwajibkan untuk kandungan BAHARU atau kandungan sedia ada yang tajuk/huraiannya
              diedit — disahkan di peringkat simpan (<code className="bg-stone-100 px-1 rounded text-[11px]">validateBidangTopik()</code>),
              sama macam bajet aksara. Kandungan lama tanpa Topik kekal tidak disentuh, tiada
              migrasi diperlukan; tindakan status-sahaja (Lulus/Tolak/Arkib) pada kandungan lama
              TIDAK disekat oleh peraturan ni. Terpakai untuk mod Manual DAN AI Generated (<em className="italic">prompt</em> AI
              turut memaparkan baris <span className="font-mono text-[11px] bg-stone-100 px-1 rounded">Bidang:</span> /{' '}
              <span className="font-mono text-[11px] bg-stone-100 px-1 rounded">Topik:</span> secara eksplisit).
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Pertukaran Bidang slot</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Bidang slot boleh ditukar pada bila-bila masa dari Tetapan Slot — tiada kunci keras.
              Pertukaran ni HANYA mempengaruhi kandungan baharu yang diterbitkan selepas perubahan;
              kandungan lama dalam slot tu kekal dengan Bidang yang dah tersimpan, tidak berubah
              retroaktif.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Pengecualian</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Ticker dan tier <TierLabel tier="BAR" /> dikecualikan sepenuhnya daripada ciri ni —
              tiada Bidang terkunci, tiada Topik, label kad tidak berubah.
            </p>
          </div>
        </PanelCard>
      </div>

      {/* PERATURAN KHAS SLOT BAR — diekstrak & disahkan terus daripada kod semasa (server.js,
          BarCard.tsx, EventDateValidator.js), bukan disalin buta daripada spesifikasi lama. Ditulis
          selepas siasatan mendalam mendapati beberapa medan (organizer/location/access) pernah
          dihurai betul tapi gugur senyap sebelum sampai ke pangkalan data — jurang itu dah
          dibetulkan dulu sebelum peraturan ini ditulis, supaya apa yang tertulis di sini sentiasa
          padan dengan apa yang benar-benar berlaku, bukan spesifikasi angan-angan. */}
      <div>
        <SectionLabel>
          04 — Peraturan Khas Slot Bar
        </SectionLabel>
        <PanelCard padding="p-6" className="space-y-4">
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Fungsi</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Slot Bar 100% untuk acara/program (seminar, pesta buku, majlis anugerah, dll.) —
              BUKAN untuk berita. <em className="italic">Pipeline</em> AI (<code className="bg-stone-100 px-1 rounded text-[11px]">EditorialPipeline.js</code>) dihadkan kepada kandungan acara sahaja untuk tier ini.
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
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Pemetaan paparan kad (baris atas)</h3>
            <ul className="font-sans text-xs text-stone-600 leading-relaxed list-disc pl-4 space-y-1">
              <li><strong>Kiri atas</strong> (teks amber): medan <code className="bg-stone-100 px-1 rounded text-[11px]">Tarikh</code>. Jika kosong → nama desk (cth. "ADJUNG EDITORIAL") sebagai jatuh balik.</li>
              <li><strong>Kanan atas</strong> (lencana): akronim daripada <code className="bg-stone-100 px-1 rounded text-[11px]">Penganjur</code> SAHAJA apabila medan itu diisi terus. Jika <code className="bg-stone-100 px-1 rounded text-[11px]">Penganjur</code> kosong → jatuh balik kepada lencana status <code className="bg-stone-100 px-1 rounded text-[11px]">Akses</code>.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Penjanaan akronim Penganjur</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Ikut urutan: (1) teks dalam kurungan — cth. <em className="italic">"Dewan Bahasa dan Pustaka (DBP)"</em> → "DBP"; (2) kamus akronim rasmi (DBP, PPAS, PNM, KPM, DBKL, ITBM, MAIS, JAIS, JAKIM, UM, UKM, UPM, USM, UiTM, UIAM, YWI) apabila nama penuh ditaip tanpa kurungan; (3) input yang sedia pendek (≤2 patah perkataan / ≤10 aksara) dikekalkan terus; (4) jika tiada padanan, bina akronim daripada huruf pertama setiap perkataan utama. Sebab: lencana terlalu kecil untuk nama penuh.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Medan Akses</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Hanya 2 nilai sah: <em className="italic">Terbuka</em> / <em className="italic">Tertutup</em>. Dipaparkan sebagai lencana jatuh balik SAHAJA apabila <code className="bg-stone-100 px-1 rounded text-[11px]">Penganjur</code> tiada — bukan dipaparkan serentak dengan lencana Penganjur.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Medan Penerangan</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Huraian tambahan pilihan, disimpan sepenuhnya tetapi <strong>TIDAK dipaparkan pada kad</strong> —
              disediakan untuk ciri akordion (panel boleh dikembangkan) akan datang, belum dibina. Tiada had aksara
              dikuatkuasakan setakat ini (tiada panel sebenar untuk diukur) — sama prinsip dengan
              <code className="bg-stone-100 px-1 rounded text-[11px] mx-1">briefLong</code>
              tier lain sebelum ciri spotlight dibina.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Skim warna (<em className="italic">theme</em> Adjung sahaja)</h3>
            <ul className="font-sans text-xs text-stone-600 leading-relaxed list-disc pl-4 space-y-1">
              <li>Lencana <strong>Penganjur</strong>: putih krim <em className="italic">glassmorphism</em>, kod <code className="bg-stone-100 px-1 rounded text-[11px]">bg-white/15 text-white border-white/30</code>.</li>
              <li>Lencana <strong>Akses: Terbuka</strong>: emas Adjung, kod <code className="bg-stone-100 px-1 rounded text-[11px]">bg-amber-400/20 text-amber-300 border-amber-300/30</code>.</li>
              <li>Lencana <strong>Akses: Tertutup</strong>: marun gelap, kod <code className="bg-stone-100 px-1 rounded text-[11px]">bg-rose-950/60 text-rose-300 border-rose-500/40</code>.</li>
              <li>Prinsip am: lencana Penganjur dan lencana Akses TIDAK BOLEH kongsi warna. Fungsi semantik berbeza (entiti vs status).</li>
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Jaminan <em className="italic">Pipeline</em> (wajib, setiap laluan simpan Bar)</h3>
            <ul className="font-sans text-xs text-stone-600 leading-relaxed list-disc pl-4 space-y-1">
              <li>Kunci atribut <code className="bg-stone-100 px-1 rounded text-[11px]">organizer</code>, <code className="bg-stone-100 px-1 rounded text-[11px]">location</code>, <code className="bg-stone-100 px-1 rounded text-[11px]">access</code>, <code className="bg-stone-100 px-1 rounded text-[11px]">penerangan</code> mesti didaftar dalam <code className="bg-stone-100 px-1 rounded text-[11px]">editorial_attributes</code> sebelum disimpan (FK constraint, kalau tidak INSERT gagal senyap).</li>
              <li>Laluan simpan (<code className="bg-stone-100 px-1 rounded text-[11px]">syncManualObjectsForSlot</code>) mesti tulis kesemua 4 medan ke <code className="bg-stone-100 px-1 rounded text-[11px]">editorial_attribute_values</code>.</li>
              <li>Laluan baca (<code className="bg-stone-100 px-1 rounded text-[11px]">resolveSlotContent</code>, KEDUA-DUA laluan, blob mentah belum-dimigrasi DAN baris DB sebenar) mesti ekstrak semula kesemua 4 medan.</li>
              <li>Parser teks (<code className="bg-stone-100 px-1 rounded text-[11px]">Penganjur:</code>/<code className="bg-stone-100 px-1 rounded text-[11px]">Lokasi:</code>/<code className="bg-stone-100 px-1 rounded text-[11px]">Akses:</code>/<code className="bg-stone-100 px-1 rounded text-[11px]">Penerangan:</code>) case-insensitive.</li>
              <li>4 slot Bar dalam satu kumpulan (Slot 8,9,10,11 / Slot 22,23,24,25) setiap satu SLOT BERASINGAN dengan kandungan sendiri, bukan satu carousel dikongsi bersama.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Label "PROGRAM-PROGRAM BERMANFAAT"</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Label menegak khas untuk kelompok slot Bar sahaja (bukan tier lain). Kedudukannya
              (kiri/kanan) bergantung kepada lokasi fizikal kelompok slot Bar dalam <em className="italic">grid</em>.
              Kedudukan ini bukan tetap. Label ini sudah wujud dalam kod sedia ada dan diterima seadanya;
              tiada perubahan kod diperlukan untuknya.
            </p>
          </div>
        </PanelCard>
      </div>

      {/* ALUR KERJA DRAF/TERBIT — diekstrak & disahkan terus daripada kod semasa (SlotManagerModal.tsx,
          useSlotEditor.ts, server.js syncManualObjectsForSlot, IndeksConsole.tsx). */}
      <div>
        <SectionLabel>
          05 — Alur Kerja Draf/Terbit
        </SectionLabel>
        <PanelCard padding="p-6" className="space-y-4">
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Modal "Tulis Kandungan" ialah ruang draf peribadi sahaja</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Draf disimpan sebagai teks dalam <code className="bg-stone-100 px-1 rounded text-[11px]">slots_config.manualSummary</code> —
              TIDAK pernah wujud sebagai baris <code className="bg-stone-100 px-1 rounded text-[11px]">editorial_objects</code> sehingga
              diterbitkan. Modal ni tidak sesekali memaparkan kandungan Live/Pending sedia ada — hanya draf yang belum diterbitkan.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Dua tindakan berasingan bagi setiap kandungan draf</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              <strong>"Simpan sebagai draf"</strong> — simpan senarai draf semasa ke pangkalan data,
              modal kekal terbuka, tiada pengesahan bajet/Topik dikuatkuasakan (kerja belum siap).{' '}
              <strong>"Terbit sekarang"</strong> — aksi segera (bukan togol status): kandungan disahkan
              penuh (bajet ruang kad dan Bidang/Topik), terus dicipta sebagai rekod Indeks rasmi, dan
              serta-merta keluar daripada senarai draf modal.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Kandungan diterbitkan mendarat sebagai Pending, bukan Live</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Menunggu kelulusan Ketua Editor di Indeks (atau auto-terbit, sistem itu belum wujud) —
              KECUALI slot Bar, yang kekal guna status yang dihurai terus daripada teks (lihat "04 —
              Peraturan Khas Slot Bar", tidak terjejas oleh alur kerja ni).
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">"Tolak" di Indeks memulangkan kandungan jadi draf semula</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              BUKAN sekadar menukar status kepada Rejected. Rekod Indeks lama diarkibkan (jejak audit),
              dan kandungan penuh disalin balik sebagai blok draf ke slot asal — kandungan tu hilang
              terus daripada Indeks dan muncul semula, boleh disunting, dalam modal Tulis Kandungan.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Indeks tidak pernah memaparkan status "Draf"</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Draf ialah ruang kerja peribadi editor sahaja — tak pernah punya baris rekod editorial,
              jadi tak sesekali muncul dalam senarai/tapisan Indeks walau apa jua keadaan.
            </p>
          </div>
        </PanelCard>
      </div>

      {/* NAMA EDITOR & KAWALAN AKSES — diekstrak & disahkan terus daripada kod semasa
          (useSlotEditor.ts, server.js, IndeksConsole.tsx, TetapanConsole.tsx). */}
      <div>
        <SectionLabel>
          06 — Nama Editor &amp; Kawalan Akses
        </SectionLabel>
        <PanelCard padding="p-6" className="space-y-4">
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Nama editor sebenar dicatat semasa Terbit</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Setiap kandungan yang diterbitkan mencatat nama editor yang log masuk semasa itu
              (atribut <code className="bg-stone-100 px-1 rounded text-[11px]">editorName</code>) — berasingan
              daripada Kaedah (cara kandungan dicipta: Manual/AI Generated/RSS Direct, yang jawab
              "macam mana dicipta", bukan "siapa"). Kandungan sedia ada sebelum ciri ni wujud kekal
              kosong (papar "Tidak diketahui" — jujur tentang jurang data, bukan nama direka).
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Empat peranan editorial</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Pentadbir, Ketua Editor, Penolong Ketua Editor, dan Editor — dikawal melalui matriks
              "Kawalan Akses" di Tetapan (Ketua Editor sahaja boleh menanda/membatalkan kebenaran).
              Ketua Editor ialah peranan pentadbir tak boleh diubah suai (<em className="italic">immutable</em>) —
              kuasa tadbir urus utamanya (lihat semua/sunting semua/urus tetapan/urus Kawalan Akses)
              tidak boleh ditarik semula daripada akaun sendiri.
            </p>
          </div>
          <div>
            <h3 className="font-serif text-sm font-bold text-stone-900 mb-1">Matriks disimpan, belum dikuatkuasakan</h3>
            <p className="font-sans text-xs text-stone-600 leading-relaxed">
              Kebenaran yang ditanda di Kawalan Akses disimpan betul-betul ke pangkalan data, tapi
              BELUM dikuatkuasakan di mana-mana bahagian sistem sebenar — semua semakan akses semasa
              (Indeks, Direktori, Tetapan sendiri) terus banding peranan dengan Ketua Editor secara
              tegar dalam kod, tanpa rujuk matriks ni langsung. Ini KIV sehingga arahan lanjut.
            </p>
          </div>
        </PanelCard>
      </div>

      {/* LIVE CHANGE LOG */}
      <div>
        <SectionLabel>
          07 — Log Perubahan Peraturan (Masa Nyata, Daripada Git)
        </SectionLabel>
        <PanelCard padding="p-0">
          {loadingLog ? (
            <KeadaanKosong>Memuatkan sejarah…</KeadaanKosong>
          ) : changelogUnavailable ? (
            <KeadaanKosong>Sejarah git tidak tersedia dalam persekitaran ini.</KeadaanKosong>
          ) : commits.length === 0 ? (
            <KeadaanKosong>Tiada rekod perubahan setakat ini.</KeadaanKosong>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs min-w-[480px]">
                <thead>
                  <tr className={`${KEPALA_JADUAL} border-b border-Adjung-line`}>
                    <th className="p-3 w-24">Rujukan</th>
                    <th className="p-3 w-28">Tarikh</th>
                    <th className="p-3">Perubahan</th>
                  </tr>
                </thead>
                <tbody>
                  {commits.map(c => (
                    <Tooltip key={c.fullHash} text={`git revert ${c.hash}, untuk batalkan perubahan ini`}>
                      <tr className={`hover:bg-stone-50 ${GARIS_BARIS}`}>
                        <td className="p-3 font-mono text-[11px] text-stone-500">{c.hash}</td>
                        <td className="p-3 font-mono text-[10px] text-stone-500 whitespace-nowrap">{c.date}</td>
                        <td className="p-3 font-serif text-stone-800">{c.message}</td>
                      </tr>
                    </Tooltip>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelCard>
        <p className="font-sans text-[10px] text-stone-400 mt-2">
          Rujukan (cth. <code className="bg-stone-100 px-1 py-0.5 rounded">{commits[0]?.hash || '1a2b3c4'}</code>) boleh diminta untuk dibatalkan (revert) bila-bila masa.
        </p>
      </div>

      {/* LIVE UI/UX CHANGE LOG — separate from section 03: this one is written the instant a
          UI/UX-affecting change lands (scripts/log-ui-change.mjs), not deferred to commit time,
          and carries a full jam:minit:saat timestamp, not just a date. */}
      <div>
        <SectionLabel>
          08 — Log Perubahan UI/UX (Masa Nyata)
        </SectionLabel>
        <PanelCard padding="p-0">
          {loadingUiUxLog ? (
            <KeadaanKosong>Memuatkan log…</KeadaanKosong>
          ) : uiUxUnavailable ? (
            <KeadaanKosong>Log UI/UX tidak tersedia.</KeadaanKosong>
          ) : uiUxEntries.length === 0 ? (
            <KeadaanKosong>Tiada rekod perubahan UI/UX setakat ini.</KeadaanKosong>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs min-w-[480px]">
                <thead>
                  <tr className={`${KEPALA_JADUAL} border-b border-Adjung-line`}>
                    <th className="p-3 w-40">Masa</th>
                    <th className="p-3">Perubahan</th>
                    <th className="p-3 w-56">Fail</th>
                  </tr>
                </thead>
                <tbody>
                  {uiUxEntries.map((e, i) => (
                    <tr key={i} className={`hover:bg-stone-50 ${GARIS_BARIS}`}>
                      <td className="p-3 font-mono text-[10px] text-stone-500 whitespace-nowrap">{formatLogTime(e.time)}</td>
                      <td className="p-3 font-serif text-stone-800">{e.summary}</td>
                      <td className="p-3 font-mono text-[9px] text-stone-500">{e.files.join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelCard>
      </div>
    </div>
  );
};

export default PerlembagaanConsole;
