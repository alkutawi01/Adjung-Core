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
const WORDMARK_PATH_ADJUNG = 'M416.5 0.0L366.5 15.0L363.5 15.0L362.0 16.5L362.0 27.5L363.5 29.0L379.5 30.0L392.0 32.5L391.5 106.0L380.5 95.0L363.5 86.0L355.5 84.0L335.5 84.0L322.5 87.0L310.5 93.0L303.5 98.0L290.0 111.5L284.0 120.5L276.0 138.5L271.0 163.5L271.0 185.5L272.0 186.5L272.0 193.5L274.0 203.5L280.0 220.5L290.0 236.5L301.5 248.0L314.5 256.0L332.5 261.0L353.5 261.0L365.5 258.0L381.5 248.0L391.5 237.0L394.0 258.5L395.5 260.0L397.5 259.0L427.5 258.0L428.5 257.0L443.5 257.0L449.0 255.5L448.5 243.0L421.0 238.5L421.0 30.5L422.0 29.5L422.0 2.5L417.5 0.0ZM502.5 1.0L496.5 3.0L488.0 10.5L486.0 13.5L484.0 22.5L485.0 30.5L488.0 36.5L494.5 43.0L501.5 46.0L514.5 46.0L521.5 43.0L528.0 36.5L532.0 25.5L530.0 13.5L521.5 4.0L513.5 1.0L503.5 1.0ZM136.5 21.0L134.0 25.5L128.0 45.5L126.0 48.5L120.0 68.5L118.0 71.5L112.0 91.5L110.0 94.5L104.0 114.5L102.0 117.5L62.0 234.5L60.5 237.0L56.5 238.0L32.5 241.0L31.0 242.5L31.5 256.0L112.0 255.5L112.0 242.5L110.5 241.0L104.5 241.0L103.5 240.0L97.5 240.0L96.5 239.0L90.5 239.0L78.0 236.5L97.5 180.0L177.5 180.0L179.0 181.5L197.0 234.5L197.0 237.5L164.5 241.0L163.0 242.5L163.5 256.0L259.0 255.5L259.0 242.5L257.5 241.0L234.5 239.0L232.0 237.5L226.0 217.5L224.0 214.5L218.0 194.5L216.0 191.5L210.0 171.5L208.0 168.5L201.0 145.5L199.0 142.5L158.0 22.5L156.5 21.0L137.5 21.0ZM138.0 63.5L139.0 63.5L147.0 89.5L149.0 92.5L172.0 162.5L103.0 162.5L105.0 159.5L137.5 64.0ZM516.5 84.0L466.5 104.0L465.0 105.5L465.5 118.0L490.5 120.0L493.0 123.5L493.0 162.5L494.0 163.5L493.0 280.5L492.0 281.5L492.0 290.5L490.0 300.5L486.0 311.5L481.0 321.5L478.5 324.0L467.5 315.0L457.5 310.0L449.5 308.0L437.5 309.0L433.5 311.0L428.0 316.5L425.0 323.5L428.0 331.5L433.5 337.0L439.5 340.0L451.5 343.0L470.5 343.0L485.5 338.0L495.5 331.0L507.0 318.5L516.0 300.5L520.0 282.5L521.0 262.5L522.0 261.5L522.0 125.5L523.0 124.5L523.0 87.5L517.5 84.0ZM816.5 84.0L769.0 105.5L769.5 118.0L794.5 120.0L797.0 121.5L797.0 146.5L798.0 147.5L797.0 237.5L795.5 239.0L771.5 243.0L771.5 256.0L853.0 255.5L853.0 244.5L851.5 243.0L829.5 239.0L828.0 237.5L827.0 131.5L839.5 121.0L849.5 115.0L859.5 111.0L868.5 109.0L882.5 109.0L892.5 113.0L900.0 121.5L904.0 136.5L904.0 237.5L902.5 239.0L878.5 243.0L878.0 255.5L959.0 255.5L958.5 243.0L940.5 240.0L935.0 237.5L935.0 220.5L934.0 219.5L934.0 134.5L933.0 133.5L933.0 125.5L931.0 115.5L924.0 99.5L914.5 90.0L906.5 86.0L898.5 84.0L879.5 84.0L864.5 88.0L848.5 96.0L837.5 104.0L826.5 115.0L825.0 109.5L824.0 89.5L820.5 85.0L817.5 84.0ZM1042.5 84.0L1023.5 89.0L1010.5 97.0L1000.0 108.5L993.0 122.5L991.0 132.5L991.0 151.5L994.0 163.5L1002.0 177.5L1011.5 187.0L1017.0 190.5L1000.0 207.5L996.0 216.5L995.0 227.5L997.0 234.5L1001.0 241.5L1006.5 247.0L1014.0 251.5L1006.5 255.0L995.5 263.0L986.0 273.5L982.0 283.5L982.0 296.5L983.0 299.5L986.0 305.5L992.5 313.0L999.5 318.0L1012.5 324.0L1034.5 329.0L1071.5 329.0L1072.5 328.0L1088.5 326.0L1107.5 319.0L1120.5 311.0L1132.0 299.5L1138.0 289.5L1142.0 276.5L1142.0 261.5L1140.0 254.5L1136.0 247.5L1125.5 238.0L1114.5 233.0L1105.5 231.0L1098.5 231.0L1097.5 230.0L1041.5 230.0L1040.5 229.0L1035.5 229.0L1028.5 226.0L1024.0 221.5L1022.0 217.5L1022.0 207.5L1026.0 198.5L1028.5 196.0L1044.5 199.0L1069.5 198.0L1083.5 194.0L1099.5 184.0L1110.0 171.5L1114.0 163.5L1117.0 153.5L1117.0 145.5L1118.0 144.5L1117.0 129.5L1114.0 118.5L1110.0 111.5L1143.5 111.0L1144.0 88.5L1139.5 85.0L1136.5 85.0L1098.5 98.0L1094.5 94.0L1080.5 87.0L1066.5 84.0L1043.5 84.0ZM608.5 87.0L607.5 88.0L561.5 92.0L560.0 93.5L560.0 103.5L561.5 105.0L583.5 109.0L585.0 110.5L585.0 186.5L584.0 187.5L584.0 203.5L585.0 204.5L585.0 216.5L586.0 217.5L587.0 227.5L593.0 242.5L599.0 250.5L606.5 256.0L619.5 261.0L639.5 261.0L657.5 256.0L667.5 251.0L678.5 243.0L691.5 229.0L693.0 232.5L695.0 255.5L696.5 260.0L698.5 259.0L711.5 259.0L712.5 258.0L725.5 258.0L726.5 257.0L744.5 256.0L745.0 243.5L727.5 240.0L721.0 237.5L721.0 108.5L722.0 107.5L722.0 90.5L718.5 87.0L673.5 91.0L667.0 92.5L667.5 105.0L685.5 108.0L692.0 110.5L691.0 213.5L675.5 226.0L666.5 231.0L654.5 235.0L634.5 236.0L627.5 233.0L621.0 227.5L616.0 216.5L615.0 204.5L614.0 203.5L614.0 130.5L615.0 129.5L616.0 90.5L612.5 87.0L609.5 87.0ZM1053.0 98.5L1063.5 99.0L1075.5 105.0L1083.0 114.5L1086.0 121.5L1088.0 129.5L1088.0 137.5L1089.0 138.5L1088.0 151.5L1085.0 162.5L1080.0 171.5L1071.5 180.0L1067.5 182.0L1052.5 185.0L1038.5 182.0L1031.0 176.5L1024.0 166.5L1021.0 157.5L1020.0 142.5L1019.0 141.5L1020.0 140.5L1020.0 130.5L1024.0 117.5L1029.0 109.5L1036.5 103.0L1042.5 100.0L1052.5 99.0ZM344.0 104.5L357.5 104.0L365.5 106.0L379.5 113.0L391.0 122.5L391.0 220.5L380.5 231.0L366.5 239.0L357.5 241.0L344.5 241.0L335.5 239.0L323.5 232.0L317.0 225.5L309.0 211.5L305.0 198.5L304.0 186.5L303.0 185.5L303.0 161.5L304.0 160.5L304.0 153.5L306.0 143.5L310.0 132.5L318.0 119.5L328.5 110.0L334.5 107.0L343.5 105.0ZM1023.0 255.5L1093.5 257.0L1106.5 262.0L1112.0 267.5L1115.0 273.5L1115.0 284.5L1111.0 293.5L1101.5 303.0L1092.5 308.0L1072.5 313.0L1043.5 313.0L1042.5 312.0L1037.5 312.0L1022.5 306.0L1017.0 301.5L1012.0 292.5L1011.0 288.5L1012.0 273.5L1017.0 263.5L1023.0 256.5Z';

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

async function lukisWordmark(ctx: CanvasRenderingContext2D, x: number, y: number, lebar: number): Promise<number> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1181 343"><path fill="#802334" fill-rule="evenodd" d="${WORDMARK_PATH_ADJUNG}"/></svg>`;
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Gagal muat wordmark SVG'));
    img.src = url;
  });
  const tinggi = lebar * (343 / 1181);
  ctx.drawImage(img, x, y, lebar, tinggi);
  URL.revokeObjectURL(url);

  ctx.fillStyle = '#802334';
  ctx.font = '500 20px "JetBrains Mono", monospace';
  let cx = x + lebar + 16;
  const baseline = y + tinggi - 5;
  for (const ch of 'BRIEF') {
    ctx.fillText(ch, cx, baseline);
    cx += ctx.measureText(ch).width + 3;
  }
  return tinggi;
}

async function lukisPoster(canvas: HTMLCanvasElement, items: ItemPoster[]): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  await Promise.all([
    document.fonts.load('600 30px "Source Serif 4"'),
    document.fonts.load('500 20px "JetBrains Mono"'),
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
  const wmTinggi = await lukisWordmark(ctx, MARGIN, wmY, 280);

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
