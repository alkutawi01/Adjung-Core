import React from 'react';
import { Download, Loader2, RefreshCw } from 'lucide-react';
import { EditorDialog } from '../common/EditorDialog';

// PosterGenerator.tsx (2026-08-23, permintaan Izzat — poster media sosial dijana automatik
// daripada 5 kandungan terbaharu). Skop dikunci selepas soal balas: muat turun MANUAL sahaja
// (editor klik "Muat Turun PNG", pos sendiri ke Instagram/Facebook/dsb — BUKAN OG image dinamik),
// 5 kandungan TERBAHARU (tiada UI pilihan manual tambahan), segi empat 1080x1080.
//
// Poster dilukis client-side terus ke <canvas> (bukan dijana pelayan) — elak pergantungan native
// module (sharp/canvas Node) yang rapuh untuk deploy, dan padan corak "muat turun terus, tiada
// storan fail baharu" yang projek ni sudah amalkan di tempat lain (cth mod "Dengan Artikel
// Jurnal", CLAUDE.md). Reka bentuk visual sepadan aset OG (public/og-image.png) — kertas krim,
// aksen maroon, wordmark Adjung Brief, tipografi serif/mono yang sama.

const SISI = 1080;

interface ItemPoster {
  objectId: string;
  title: string;
  summary: string;
  desk: string;
  warna: string;
  url: string;
}

const HARI_MELAYU = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];

/** Satu baris teks dipangkas dgn elipsis kalau melebihi lebar — sama corak `bungkusTeks` tapi
 *  SATU baris sahaja (utk konteks di bawah tajuk, bukan tajuk itu sendiri). */
function pangkasSatuBaris(ctx: CanvasRenderingContext2D, teks: string, lebarMaks: number): string {
  if (ctx.measureText(teks).width <= lebarMaks) return teks;
  let t = teks;
  while (t.length > 1 && ctx.measureText(t + '…').width > lebarMaks) t = t.slice(0, -1);
  return t.replace(/\s+$/, '') + '…';
}

function bungkusTeks(ctx: CanvasRenderingContext2D, teks: string, lebarMaks: number, barisMaks: number): string[] {
  const perkataan = teks.split(' ');
  const baris: string[] = [];
  let semasa = '';
  for (const p of perkataan) {
    const cuba = semasa ? `${semasa} ${p}` : p;
    if (ctx.measureText(cuba).width > lebarMaks && semasa) {
      baris.push(semasa);
      semasa = p;
      if (baris.length === barisMaks) break;
    } else {
      semasa = cuba;
    }
  }
  if (baris.length < barisMaks && semasa) baris.push(semasa);
  // Pangkas + elipsis kalau masih ada perkataan tertinggal selepas had baris dicapai.
  const habisDilukis = baris.join(' ').length;
  if (habisDilukis < teks.length && baris.length > 0) {
    let terakhir = baris[baris.length - 1];
    while (ctx.measureText(terakhir + '…').width > lebarMaks && terakhir.length > 1) {
      terakhir = terakhir.slice(0, -1);
    }
    baris[baris.length - 1] = terakhir.replace(/\s+$/, '') + '…';
  }
  return baris;
}

// Lockup jenama RASMI (2026-08-24) — dilukis terus daripada fail vektor rasmi
// `public/adjung-brief-lockup-official.svg` (dibekalkan Izzat), BUKAN dibina semula dgn teks
// Canvas + geometri diagak/diukur. DUA pusingan sebelum ni (bina semula pakai fillText + fillRect
// manual) kedua-duanya silap dari segi geometri — Izzat: "logo pun salah. awak tak check betul",
// kemudian "logo masih salah, rasanya dah bagi fail svg semalam". Punca sebenar: fail SVG yang
// dibekalkan tidak pernah digunakan langsung — pembetulan lepas ni cuma laraskan nombor dalam
// pendekatan yang salah dari awal (bina semula tangan), bukan tukar kaedah.
//
// Fail SVG (viewBox tetap "0 0 1440 810") mengandungi TIGA elemen bertindan menegak: wordmark
// "Adjung" (merah #9f2525), garis+"BRIEF"+garis (kelabu #a6a6a6), dan slogan "MEMBINA SEMULA
// PERADABAN" (hitam) di bawah sekali. Poster media sosial padan Wordmark Hero portal
// (FrontpageView.tsx) — DUA baris sahaja (wordmark + BRIEF), TANPA slogan — jadi kawasan sumber
// dipotong (bukan seluruh fail dilukis).
//
// WORDMARK_CROP disahkan secara programatik (bukan agak mata) — muat fail SEBAGAI <img>, lukis
// kawasan potongan ke kanvas luar-skrin, imbas piksel: baris merah paling atas bermula 16px dari
// tepi atas kawasan potongan (bukan terpotong), baris kelabu (garis pembahagi) berakhir 19px
// sebelum tepi bawah (bukan terpotong), margin kiri/kanan 20px/15px (kandungan tidak menyentuh
// tepi), SIFAR piksel hitam (slogan berjaya dikecualikan). Kalau fail SVG rasmi ditukar/diganti
// pada masa depan, imbasan verifikasi ni WAJIB dijalankan semula sebelum nombor di bawah dipercayai
// — jangan agak semula secara manual, itu punca DUA pusingan silap sebelum ni.
const WORDMARK_URL = '/adjung-brief-lockup-official.svg';
const WORDMARK_VIEWBOX_LEBAR = 1440; // viewBox SVG tetap "0 0 1440 810"
const WORDMARK_CROP = { x: 130, y: 155, w: 1175, h: 430 }; // unit viewBox — wordmark + BRIEF + garis sahaja

let janjiImejWordmark: Promise<HTMLImageElement> | null = null;
function muatImejWordmark(): Promise<HTMLImageElement> {
  if (!janjiImejWordmark) {
    janjiImejWordmark = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Gagal muat ${WORDMARK_URL}`));
      img.src = WORDMARK_URL;
    });
  }
  return janjiImejWordmark;
}

async function lukisWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, tinggiSasaran: number): Promise<number> {
  const img = await muatImejWordmark();
  const skala = img.naturalWidth / WORDMARK_VIEWBOX_LEBAR;
  const sx = WORDMARK_CROP.x * skala;
  const sy = WORDMARK_CROP.y * skala;
  const sw = WORDMARK_CROP.w * skala;
  const sh = WORDMARK_CROP.h * skala;
  const lebarSasaran = tinggiSasaran * (WORDMARK_CROP.w / WORDMARK_CROP.h);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, lebarSasaran, tinggiSasaran);
  return tinggiSasaran;
}

// Susunan atur (2026-08-24, dapatan Izzat — audit reka bentuk lengkap 8 perkara, disahkan
// eksplisit "utk poster" iaitu Poster Media Sosial ni sahaja, BUKAN frontpage portal sebenar).
// Perkara #5 (nama Bidang, cth "Automotif"/"Siber" ditukar "Mobiliti"/"Digital") SENGAJA tidak
// dilaksanakan di sini — `desk` datang terus daripada CategoryRegistry yang dikongsi SELURUH
// produk (frontpage, carian, sitemap, dsb.), bukan sesuatu poster ni boleh tukar bersendirian.
// Perkara lain (1,2,3,4,6,7,8) semua dalam skop kanvas poster, dilaksanakan di bawah:
//   1. Wordmark dikecilkan ~35% (118px -> 76px tinggi sasaran).
//   2. Baris konteks satu-ayat di bawah setiap tajuk (daripada huraian ringkas sedia ada).
//   3. Nombor "01" dipadankan SEBARIS dgn Bidang (gaya majalah), bukan besar terapung kanan.
//   6. Garis pemisah antara kandungan dinipiskan + ruang menegak diperbesar.
//   7. Tarikh naik taraf ke format "ISNIN, 24 OGOS 2026".
//   8. Tag baris "N PERKARA PENTING HARI INI" + blok tandatangan jenama guna ruang bawah (#4/#8).
async function lukisPoster(canvas: HTMLCanvasElement, items: ItemPoster[]): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await Promise.all([
    document.fonts.load('700 25px "Source Serif 4"'),
    document.fonts.load('600 15px "Inter"'),
    document.fonts.load('500 15px "JetBrains Mono"'),
    document.fonts.load('700 13px "JetBrains Mono"'),
    document.fonts.load('400 14px "Inter"'),
  ]);
  await document.fonts.ready;

  const MARGIN = 72;

  ctx.fillStyle = '#F7F4EC';
  ctx.fillRect(0, 0, SISI, SISI);

  // Eyebrow + tarikh (Isnin, 24 Ogos 2026)
  ctx.fillStyle = '#802334';
  ctx.font = '500 15px "JetBrains Mono", monospace';
  let ex = MARGIN;
  const eyebrowY = MARGIN + 15;
  for (const ch of 'KANDUNGAN TERKINI') {
    ctx.fillText(ch, ex, eyebrowY);
    ex += ctx.measureText(ch).width + 2.2;
  }
  ctx.fillStyle = '#78716C';
  ctx.font = '400 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  const kini = new Date();
  const tarikh = `${HARI_MELAYU[kini.getDay()]}, ${kini.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' })}`.toUpperCase();
  ctx.fillText(tarikh, SISI - MARGIN, eyebrowY);
  ctx.textAlign = 'left';

  // Wordmark ditengahkan mendatar (2026-08-24, dapatan Izzat — "lebih sesuai align ke tengah
  // berbanding ke kiri") — nisbah lebar:tinggi sama seperti dalam lukisWordmark() (WORDMARK_CROP),
  // dikira di sini semata-mata utk cari titik-x tengah, bukan disalin semula logik lukis.
  const wmY = eyebrowY + 22;
  const wmTinggiSasaran = 76;
  const wmLebarSasaran = wmTinggiSasaran * (WORDMARK_CROP.w / WORDMARK_CROP.h);
  const wmX = (SISI - wmLebarSasaran) / 2;
  const wmTinggi = await lukisWordmark(ctx, wmX, wmY, wmTinggiSasaran);

  // Tag "N kandungan penting hari ini" — signature editorial, bukan sekadar senarai terkini.
  const tagY = wmY + wmTinggi + 26;
  ctx.fillStyle = '#78716C';
  ctx.font = '700 13px "JetBrains Mono", monospace';
  let tx = MARGIN;
  for (const ch of `${items.length} KANDUNGAN PENTING HARI INI`) {
    ctx.fillText(ch, tx, tagY);
    tx += ctx.measureText(ch).width + 1.4;
  }

  // Garis pemisah nipis, lebar penuh — pisah header drpd senarai.
  const ruleY = tagY + 20;
  ctx.fillStyle = '#D6D3D1';
  ctx.fillRect(MARGIN, ruleY, SISI - MARGIN * 2, 1);

  // 5 baris kandungan
  const FOOTER_TINGGI = 130;
  const areaAtas = ruleY + 34;
  const areaBawah = SISI - FOOTER_TINGGI;
  const tinggiBaris = (areaBawah - areaAtas) / 5;
  const lebarPenuh = SISI - MARGIN * 2;

  items.slice(0, 5).forEach((item, i) => {
    const y0 = areaAtas + i * tinggiBaris;

    // "01   BIDANG" sebaris (gaya majalah) — nombor dahulu, jadi indeks INDENT visual utk
    // tajuk/konteks di bawah (hanging indent, padan cadangan susun atur Izzat).
    ctx.fillStyle = '#1C1917';
    ctx.font = '700 15px "JetBrains Mono", monospace';
    const nombor = String(i + 1).padStart(2, '0');
    ctx.fillText(nombor, MARGIN, y0 + 15);
    const INDENT = ctx.measureText(nombor).width + 16;

    ctx.fillStyle = item.warna || '#802334';
    ctx.font = '700 12px "JetBrains Mono", monospace';
    ctx.fillText(item.desk.toUpperCase(), MARGIN + INDENT, y0 + 15);

    const lebarInden = SISI - MARGIN - (MARGIN + INDENT);

    // Tajuk (serif, dominan, dibalut maks 2 baris) — diindenkan padan Bidang di atas.
    ctx.fillStyle = '#1C1917';
    ctx.font = '700 25px "Source Serif 4", serif';
    const baris = bungkusTeks(ctx, item.title, lebarInden, 2);
    baris.forEach((l, li) => ctx.fillText(l, MARGIN + INDENT, y0 + 45 + li * 31));
    const tajukTinggi = baris.length * 31;

    // Konteks satu-baris — "kenapa ini penting", bukan cuma tajuk (dapatan Izzat #2).
    if (item.summary) {
      ctx.fillStyle = '#78716C';
      ctx.font = '400 14px "Inter", sans-serif';
      const konteksY = y0 + 45 + tajukTinggi + 20;
      ctx.fillText(pangkasSatuBaris(ctx, item.summary, lebarInden), MARGIN + INDENT, konteksY);
    }

    // Garis pemisah nipis (kecuali baris terakhir) — lebih ringan drpd versi sebelumnya, ruang
    // menegak besar (tinggiBaris) sendiri sudah pisahkan setiap blok, garis cuma penanda halus.
    if (i < items.length - 1 && i < 4) {
      ctx.fillStyle = '#EAE7E2';
      ctx.fillRect(MARGIN, y0 + tinggiBaris - 1, lebarPenuh, 1);
    }
  });

  // Blok tandatangan jenama (dapatan Izzat #4 + #8 — isi ruang kosong bawah dgn identiti Adjung,
  // bukan biarkan kosong) + pautan portal sedia ada.
  const footerAtas = SISI - FOOTER_TINGGI;
  ctx.fillStyle = '#D6D3D1';
  ctx.fillRect(MARGIN, footerAtas, SISI - MARGIN * 2, 1);

  ctx.fillStyle = '#802334';
  ctx.font = '700 15px "Source Serif 4", serif';
  ctx.fillText('Adjung Brief', MARGIN, footerAtas + 34);

  ctx.fillStyle = '#78716C';
  ctx.font = '400 13px "Inter", sans-serif';
  ctx.fillText('Ringkasan ilmu, sejarah dan perkembangan dunia.', MARGIN, footerAtas + 56);

  ctx.fillStyle = '#A8A29E';
  ctx.font = '400 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'right';
  ctx.fillText('brief.adjung.com', SISI - MARGIN, footerAtas + 34);
  ctx.textAlign = 'left';
}

export const PosterGenerator: React.FC<{ onTutup: () => void }> = ({ onTutup }) => {
  const [items, setItems] = React.useState<ItemPoster[] | null>(null);
  const [ralat, setRalat] = React.useState<string | null>(null);
  const [melukis, setMelukis] = React.useState(false);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);

  const muatData = React.useCallback(async () => {
    setRalat(null);
    setItems(null);
    try {
      const res = await fetch('/api/system/poster/latest', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mendapatkan kandungan.');
      if (!data.items || data.items.length === 0) {
        setRalat('Tiada kandungan aktif untuk dijana poster.');
        return;
      }
      setItems(data.items);
    } catch (e: any) {
      setRalat(e.message || 'Gagal mendapatkan kandungan.');
    }
  }, []);

  React.useEffect(() => { muatData(); }, [muatData]);

  React.useEffect(() => {
    if (!items || !canvasRef.current) return;
    let dibatal = false;
    setMelukis(true);
    lukisPoster(canvasRef.current, items).finally(() => { if (!dibatal) setMelukis(false); });
    return () => { dibatal = true; };
  }, [items]);

  const muatTurun = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    const tarikhFail = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `adjung-brief-poster-${tarikhFail}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <EditorDialog tajuk="Poster Media Sosial — 5 Kandungan Terkini" onTutup={onTutup} saiz="md">
      <div className="space-y-4">
        <p className="text-[11px] text-stone-500 leading-relaxed">
          Poster segi empat (1080×1080) dijana automatik daripada 5 kandungan terbaharu yang aktif.
          Muat turun PNG, kemudian pos sendiri ke Instagram/Facebook/Telegram.
        </p>

        <div className="border border-stone-200 bg-stone-50 flex items-center justify-center aspect-square overflow-hidden">
          {ralat ? (
            <div className="text-center p-6 space-y-3">
              <p className="text-xs text-red-700">{ralat}</p>
              <button
                type="button"
                onClick={muatData}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-Adjung-maroon hover:underline cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Cuba semula
              </button>
            </div>
          ) : !items ? (
            <div className="flex items-center gap-2 text-stone-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> Memuatkan kandungan terbaharu…
            </div>
          ) : (
            <canvas ref={canvasRef} width={SISI} height={SISI} className="w-full h-full" />
          )}
        </div>

        {items && (
          <button
            type="button"
            onClick={muatTurun}
            disabled={melukis}
            className="w-full inline-flex items-center justify-center gap-2 bg-Adjung-maroon text-white text-xs font-semibold py-2.5 hover:bg-Adjung-maroon-dark transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <Download className="w-3.5 h-3.5" /> Muat Turun PNG
          </button>
        )}
      </div>
    </EditorDialog>
  );
};

export default PosterGenerator;
