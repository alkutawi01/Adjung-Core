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
  desk: string;
  warna: string;
  url: string;
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

async function lukisPoster(canvas: HTMLCanvasElement, items: ItemPoster[]): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await Promise.all([
    document.fonts.load('600 27px "Source Serif 4"'),
    document.fonts.load('600 15px "Inter"'),
    document.fonts.load('500 15px "JetBrains Mono"'),
    document.fonts.load('600 13px "JetBrains Mono"'),
  ]);
  await document.fonts.ready;

  const MARGIN = 72;

  ctx.fillStyle = '#F7F4EC';
  ctx.fillRect(0, 0, SISI, SISI);

  // Eyebrow + tarikh
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
  const tarikh = new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(tarikh, SISI - MARGIN, eyebrowY);
  ctx.textAlign = 'left';

  const wmY = eyebrowY + 26;
  const wmTinggi = await lukisWordmark(ctx, MARGIN, wmY, 118);

  const ruleY = wmY + wmTinggi + 30;
  ctx.fillStyle = '#802334';
  ctx.fillRect(MARGIN, ruleY, 56, 3);

  // 5 baris kandungan
  const areaAtas = ruleY + 46;
  const areaBawah = SISI - 108;
  const tinggiBaris = (areaBawah - areaAtas) / 5;
  const lebarTeks = SISI - MARGIN * 2 - 28;

  items.slice(0, 5).forEach((item, i) => {
    const y0 = areaAtas + i * tinggiBaris;

    // Cip warna Bidang
    ctx.fillStyle = item.warna || '#802334';
    ctx.fillRect(MARGIN, y0 + 6, 14, 14);

    // Nama Bidang
    ctx.fillStyle = item.warna || '#802334';
    ctx.font = '600 13px "JetBrains Mono", monospace';
    ctx.fillText(item.desk.toUpperCase(), MARGIN + 26, y0 + 17);

    // Tajuk (serif, dibalut maks 2 baris)
    ctx.fillStyle = '#1C1917';
    ctx.font = '600 27px "Source Serif 4", serif';
    const baris = bungkusTeks(ctx, item.title, lebarTeks, 2);
    baris.forEach((l, li) => ctx.fillText(l, MARGIN, y0 + 54 + li * 34));

    // Nombor kandungan (mono, kanan)
    ctx.fillStyle = '#D6D3D1';
    ctx.font = '500 32px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(String(i + 1).padStart(2, '0'), SISI - MARGIN, y0 + 34);
    ctx.textAlign = 'left';

    // Garis pemisah (kecuali baris terakhir)
    if (i < items.length - 1 && i < 4) {
      ctx.fillStyle = '#E7E5E4';
      ctx.fillRect(MARGIN, y0 + tinggiBaris - 1, SISI - MARGIN * 2, 1);
    }
  });

  // Footer
  const footerY = SISI - 56;
  ctx.fillStyle = '#802334';
  ctx.fillRect(MARGIN, footerY - 20, 12, 24);
  ctx.fillStyle = '#78716C';
  ctx.font = '400 15px "JetBrains Mono", monospace';
  ctx.fillText('brief.adjung.com', MARGIN + 24, footerY);
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
