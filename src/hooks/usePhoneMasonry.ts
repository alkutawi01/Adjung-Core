import { useLayoutEffect, RefObject } from 'react';
import { PHONE_MAX_WIDTH_PX } from '../../core/editorial/PhoneGeometry.js';

// Susun atur masonry telefon SEBENAR (2026-07-31) — algoritma "lajur-terpendek-dahulu" diukur
// dengan JavaScript, bukan CSS `columns`/Grid.
//
// Dua percubaan CSS tulen sebelum ni GAGAL, disahkan hidup dengan geometri sebenar (bukan andaian):
//   - Grid (grid-auto-flow:dense): struktur baris-lajur TEGAR — kad pendek berkongsi "baris"
//     dengan kad tinggi tinggalkan lubang sehingga 990px, dense cuma isi lubang untuk kad akan
//     datang, tak susun semula baris sedia ada.
//   - CSS columns:2 (column-fill:balance): jangka dulu "jamin 0 jurang" — SALAH. Bila kad tinggi
//     tak boleh dipecah (break-inside:avoid) dan saiz kad sangat berbeza-beza, algoritma seimbang
//     browser masih boleh tinggalkan jurang (disahkan hidup pada 600px: 320px + beberapa lagi
//     jurang merentasi 4727px tinggi halaman).
//
// CSS TIADA cara jamin 0 jurang bila kandungan pelbagai tinggi + ada item lebar-penuh sekali gus.
// Penyelesaian sebenar: ukur tinggi SEBENAR setiap kad (offsetHeight, selepas lebar ditetapkan),
// letak setiap kad dalam lajur yang PALING PENDEK setakat itu — algoritma masonry tulen
// (Pinterest/Masonry.js), position:absolute dengan top/left dikira terus, bukan harap CSS agih.
//
// Kad "lebarPenuh" (STANDARD/Melintang) letak di y = max(tinggiLajurKiri, tinggiLajurKanan),
// kedua-dua lajur "disamakan" ke titik itu + tingginya.
//
// Kumpulan (BAR): Izzat — "jgn pisahkan slot bar, nampak hodoh" — kad Bar individu yang terapung
// bersendirian (tak bersebelahan Bar lain) nampak macam confetti bertaburan, bukan reka bentuk.
// `groupSlots` (kluster Bar 7-10 dan 21-24) dicantum jadi SATU unit peletakan (tindanan menegak
// dalam satu lajur, macam sebelum masonry wujud), bukan diagih individu merentasi dua lajur.
//
// NOTA (2026-07-31): dua percubaan berasingan "regangkan kad terakhir setiap lajur" (ubah TINGGI
// kad, guna style.height) untuk tutup baki jurang di titik penyegerakan DIBUANG selepas gagal
// berulang kali dalam pengujian sebenar (footer/sumber nampak terapung, ruang kosong di bawahnya).
// Punca sebenar isu footer itu telah ditemui & dibetulkan berasingan (BentoInner di
// FrontpageView.tsx kurang `flex-1`) — TAPI teknik regang-tinggi kekal dibuang, sebab ada risiko
// lain (gelung ResizeObserver) yang tak berbaloi sekarang punca footer dah selesai betul-betul.
//
// SEBALIKNYA (permintaan Izzat): jurang baki di setiap titik penyegerakan diagihkan SAMA RATA
// merentasi jurang ANTARA kad dalam segmen lajur pendek tu (bukan bertimbun sekali di penghujung
// sahaja) — lihat "agihSamaRata" di bawah. Ni cuma UBAH KEDUDUKAN (top) kad yang dah diletakkan,
// TAK SENTUH tinggi/CSS dalaman kad langsung — jadi tiada risiko bug footer berulang (itu punca
// SEMUA kegagalan regangan sebelum ni: mengubah tinggi kad mendedahkan struktur dalaman kad yang
// rapuh; mengubah kedudukan sahaja tak sentuh struktur dalaman langsung).
const GAP_PX = 16; // 1rem — padan column-gap/gap sedia ada dalam reka bentuk lain

type QueueItem = { el: HTMLElement; isWide: boolean; h: number; group?: { el: HTMLElement; h: number }[] };

export function usePhoneMasonry(
  containerRef: RefObject<HTMLElement | null>,
  wideSlots: readonly number[],
  groupSlots: readonly (readonly number[])[] = [],
) {
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const wideSet = new Set(wideSlots);
    const slotToGroup = new Map<number, number>();
    groupSlots.forEach((grp, gi) => grp.forEach((slot) => slotToGroup.set(slot, gi)));

    const clearInline = (items: HTMLElement[]) => {
      container.style.position = '';
      container.style.height = '';
      items.forEach((el) => {
        el.style.position = '';
        el.style.left = '';
        el.style.top = '';
        el.style.width = '';
        el.style.visibility = '';
      });
    };

    const layout = () => {
      const items = (Array.from(container.querySelectorAll('[data-slot]')) as HTMLElement[]);
      const isPhone = window.innerWidth <= PHONE_MAX_WIDTH_PX;
      if (!isPhone) {
        // Bukan telefon — buang gaya inline, biar CSS desktop (grid 6-lajur asal) ambil alih.
        clearInline(items);
        return;
      }
      const containerWidth = container.clientWidth;
      if (!containerWidth) return;
      const colWidth = (containerWidth - GAP_PX) / 2;

      // Fasa 1: tetapkan LEBAR sahaja (position:absolute, tiada top/left lagi) — supaya teks
      // melilit ikut lebar sebenar sebelum diukur.
      const meta = items.map((el) => {
        const slot = Number(el.getAttribute('data-slot'));
        const isWide = wideSet.has(slot);
        el.style.position = 'absolute';
        el.style.width = (isWide ? containerWidth : colWidth) + 'px';
        return { el, slot, isWide };
      });

      // Fasa 2: baca SEMUA tinggi sekali (satu pusingan reflow, bukan berpuluh pusingan berasingan).
      const rawQueue = meta.map((m) => ({ ...m, h: m.el.offsetHeight }));

      // Fasa 2b: cantum larian slot berturutan yang sekumpulan (kluster Bar) jadi SATU unit —
      // tindanan menegak dalam satu lajur, bukan diagih individu. Lihat nota "Kumpulan (BAR)" di
      // atas.
      const queue: QueueItem[] = [];
      for (let k = 0; k < rawQueue.length; k++) {
        const cur = rawQueue[k];
        const gid = slotToGroup.get(cur.slot);
        if (gid === undefined || cur.isWide) {
          queue.push({ el: cur.el, isWide: cur.isWide, h: cur.h });
          continue;
        }
        const group = [{ el: cur.el, h: cur.h }];
        let j = k + 1;
        while (j < rawQueue.length && slotToGroup.get(rawQueue[j].slot) === gid) {
          group.push({ el: rawQueue[j].el, h: rawQueue[j].h });
          j++;
        }
        k = j - 1;
        const totalH = group.reduce((sum, g) => sum + g.h, 0) + GAP_PX * (group.length - 1);
        queue.push({ el: group[0].el, isWide: false, h: totalH, group });
      }

      // Fasa 3: algoritma lajur-terpendek-dahulu, DENGAN "lihat-dahulu" sebelum item lebar-penuh.
      // Tanpa ni: kalau item lebar-penuh muncul SEJURUS selepas satu item sempit keseorangan (cth
      // slot1 lepas tu terus slot2/STANDARD), lajur satu lagi tak pernah dapat PELUANG diisi
      // sebelum kedua-dua lajur dipaksa sama tinggi — disahkan hidup: jurang 530px terbentuk tepat
      // begitu. Bila imbangan lebih daripada AMBANG dan item seterusnya lebar-penuh, cari MERENTASI
      // BAKI SENARAI PENUH (bukan tetingkap terhad) untuk item sempit yang boleh diisi DAHULU
      // supaya kedua-dua lajur lebih rapat sebelum pemaksaan berlaku. Susunan halaman masih ikut
      // turutan sumber SEBOLEH-BOLEHNYA — item cuma ditarik ke depan bila benar-benar perlu untuk
      // elak jurang, bukan dikocok rawak.
      //
      // Fasa 3b — "penyeimbang hujung": ~8 item terakhir SAHAJA, pilih ikut PADANAN TERBAIK
      // (item yang paling kurangkan imbangan akhir) daripada seluruh baki, bukan turutan ketat.
      // Tanpa ni: jumlah tinggi kandungan jarang berpecah genap 50/50, jadi item TERAKHIR selalu
      // tinggalkan baki tak sepadan di lajur satu lagi. Skop dihadkan kepada hujung sahaja supaya
      // majoriti kandungan kekal ikut turutan sumber asal.
      const AMBANG_IMBANGAN_PX = 60;
      const PENYEIMBANG_HUJUNG = 8;
      const colH: [number, number] = [0, 0];
      // Kad yang diletakkan dalam SEGMEN semasa setiap lajur (sejak titik penyegerakan lepas —
      // permulaan halaman atau item lebar-penuh terakhir). Bila segmen tamat (item lebar-penuh
      // seterusnya diletak, atau hujung halaman), baki jurang lajur PENDEK diagih sama rata
      // merentasi kad dalam segmen tu (ubah `top`, bukan tinggi) — lihat nota "SEBALIKNYA" di atas.
      // Setiap entri dalam segmen ialah SATU unit peletakan (kad tunggal, ATAU semua elemen
      // dalam satu kluster Bar bersama — supaya bila diagih, seluruh kluster beralih SAMA jumlah
      // dan kekal tersusun rapat sesama sendiri, bukan cuma elemen pertama kluster).
      const segmen: [HTMLElement[][], HTMLElement[][]] = [[], []];
      const agihSamaRata = () => {
        const shortSide: 0 | 1 = colH[0] <= colH[1] ? 0 : 1;
        const longSide: 0 | 1 = shortSide === 0 ? 1 : 0;
        const extra = colH[longSide] - colH[shortSide];
        const n = segmen[shortSide].length;
        if (extra > 0 && n > 0) {
          const perKad = extra / n;
          segmen[shortSide].forEach((unit, i) => {
            const shift = perKad * (i + 1);
            unit.forEach((el) => {
              const semasa = parseFloat(el.style.top || '0');
              el.style.top = `${semasa + shift}px`;
            });
          });
        }
        colH[shortSide] = colH[longSide];
        segmen[0] = [];
        segmen[1] = [];
      };
      while (queue.length > 0) {
        let idx = 0;
        if (queue.length <= PENYEIMBANG_HUJUNG) {
          const side = colH[0] <= colH[1] ? 0 : 1;
          const narrowIdxs = queue.map((m, k) => (m.isWide ? -1 : k)).filter((k) => k >= 0);
          if (narrowIdxs.length > 0) {
            idx = narrowIdxs.reduce((best, k) =>
              Math.abs((colH[side] + queue[k].h) - colH[1 - side]) < Math.abs((colH[side] + queue[best].h) - colH[1 - side]) ? k : best
            , narrowIdxs[0]);
          }
        } else {
          const next = queue[0];
          if (next.isWide && Math.abs(colH[0] - colH[1]) > AMBANG_IMBANGAN_PX) {
            const altIdx = queue.findIndex((m, k) => k > 0 && !m.isWide);
            if (altIdx !== -1) idx = altIdx;
          }
        }
        const m = queue.splice(idx, 1)[0];
        if (m.isWide) {
          // Titik penyegerakan — agih baki jurang lajur pendek sama rata DAHULU (lihat
          // "agihSamaRata"), supaya item lebar-penuh bermula tepat di lantai lajur panjang.
          agihSamaRata();
          const y = Math.max(colH[0], colH[1]);
          m.el.style.left = '0px';
          m.el.style.top = `${y}px`;
          colH[0] = colH[1] = y + m.h + GAP_PX;
        } else if (m.group) {
          const side = colH[0] <= colH[1] ? 0 : 1;
          const x = side === 0 ? 0 : colWidth + GAP_PX;
          let y = colH[side];
          m.group.forEach((g) => {
            g.el.style.left = `${x}px`;
            g.el.style.top = `${y}px`;
            y += g.h + GAP_PX;
          });
          colH[side] = colH[side] + m.h + GAP_PX;
          segmen[side].push(m.group.map((g) => g.el));
        } else {
          const side = colH[0] <= colH[1] ? 0 : 1;
          m.el.style.left = `${side === 0 ? 0 : colWidth + GAP_PX}px`;
          m.el.style.top = `${colH[side]}px`;
          colH[side] = colH[side] + m.h + GAP_PX;
          segmen[side].push([m.el]);
        }
      }
      // Hujung halaman — titik penyegerakan terakhir, agih baki jurang lajur pendek sama rata.
      agihSamaRata();
      container.style.position = 'relative';
      container.style.height = `${Math.max(0, Math.max(colH[0], colH[1]) - GAP_PX)}px`;
      // Dedahkan kad selepas kedudukan dikira — elak kelipan kad bertindih sekejap (top/left
      // lalai 0,0 sebelum Fasa 3 selesai) yang ternampak pada muat halaman pertama.
      items.forEach((el) => { el.style.visibility = 'visible'; });
    };

    (Array.from(container.querySelectorAll('[data-slot]')) as HTMLElement[]).forEach((el) => { el.style.visibility = 'hidden'; });
    layout();

    // ResizeObserver pada bekas (lebar berubah — resize tetingkap/putaran) DAN setiap kad (tinggi
    // kandungannya boleh berubah — fon dimuat, imej, dsb — tanpa lebar bekas berubah langsung).
    // Tiada regangan dinamik dalam layout() lagi, jadi tiada risiko gelung mencetuskan diri sendiri.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => layout()) : null;
    ro?.observe(container);
    (Array.from(container.querySelectorAll('[data-slot]')) as HTMLElement[]).forEach((el) => ro?.observe(el));
    window.addEventListener('resize', layout);

    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', layout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, wideSlots, groupSlots]);
}
