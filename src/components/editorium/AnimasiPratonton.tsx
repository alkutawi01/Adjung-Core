import React, { useState, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { vektorArahOverlay, LogoTransisiAdjung, VEKTOR_ARAH } from '../portal/FrontpageView';

// Pratonton Animasi Transisi Carousel (2026-08-16, permintaan Izzat: "sila buat pratonton supaya
// editor nampak mcm mana bentuk dan rupa animasi tersebut termasuk dengan 3d [warna panel]") —
// dipakai di DUA tempat: TetapanAmSlotConsole.tsx (papar lalai) dan SenaraiSlotConsole.tsx →
// Tetapan Kad (papar kesan EFEKTIF slot tu selepas override).
//
// REKA BENTUK SENGAJA: komponen ni TIDAK menggunakan semula CarouselStableBlock (FrontpageView.tsx)
// — mesin keadaan/timer/portal/refs komponen tu SANGAT rapuh (CLAUDE.md), dan pratonton ni cuma
// perlu MAIN SEKALI bila diklik, bukan carousel sebenar dgn auto-putar/navigasi/limpahan. Yang
// dikongsi SEBENAR ialah primitif VISUAL tulen (vektorArahOverlay, LogoTransisiAdjung, kelas CSS
// keyframe .carousel-colophon-penuh/.carousel-sapuan-penuh di src/index.css) dan FORMULA MASA yang
// SAMA seperti FrontpageView.tsx (masukMasa/tahanMasa/jumlahMasa untuk Colophon/Sapuan Lajur,
// tempohGerakMs untuk Gerak Susun, tempohPudarMs untuk Pudar) — kalau nombor asas (400/550/500/900/
// 1000) berubah di FrontpageView.tsx, kemas kini SINI SERENTAK supaya pratonton kekal jujur.
//
// Lengkung `cubic-bezier(0.4, 0, 0.2, 1)` pada transition Gerak Susun/Swipe di bawah (2026-09-02,
// dapatan bug-hunt) — MESTI ikut lengkung SEBENAR FrontpageView.tsx, bukan nombor bebas sendiri.
// Pepijat sebenar ditemui di sini: komited f3472fe (26/8) tukar lengkung Gerak Susun/Swipe di
// FrontpageView.tsx drpd cubic-bezier(0.65,0,0.35,1) ke (0.4,0,0.2,1) ("lembutkan... bukan lagi
// tergesa-gesa"), tapi fail ni (disunting kali terakhir SEBELUM komit tu pada hari sama) tak
// pernah dikemas kini sekali — pratonton terus papar lengkung LAMA yang lebih mendadak berhenti,
// bercanggah senyap dgn animasi sebenar walau semua nombor tempoh masa lain (900/640ms dsb) tepat.
export interface AnimasiPratontonProps {
  // string = jenis literal (kelakuan asal, sentiasa sama tiap main). Fungsi = resolver dipanggil
  // SETIAP kali butang "Main" diklik (2026-08-18, mod jenisAnimasi==='rawak', soalan Izzat) —
  // pemanggil (TetapanAmSlotConsole.tsx) hantar fungsi yg pilih rawak drpd kolam supaya tiap
  // klik "Main" boleh papar jenis animasi BERBEZA, cerminan jujur tingkah laku sebenar carousel.
  jenis: string | (() => string);
  arah: string;
  kelajuan: number;
  warnaPanel: string;
  logoMode?: string; // '' | 'adjung' | 'penaja' | 'tiada' — 'penaja' papar ruang letak sahaja
                      // (modul penaja belum wired, lihat CLAUDE.md — bukan pepijat).
}

const KANDUNGAN_CONTOH = [
  { tajuk: 'Contoh Tajuk Kandungan A', huraian: 'Baris huraian ringkas untuk pratonton sahaja.' },
  { tajuk: 'Contoh Tajuk Kandungan B', huraian: 'Kandungan kedua bagi tunjuk pertukaran carousel.' },
];

const KandunganContoh: React.FC<{ index: number }> = ({ index }) => {
  const k = KANDUNGAN_CONTOH[index % KANDUNGAN_CONTOH.length];
  return (
    <div className="px-3 py-2">
      <div className="font-mono text-[8px] uppercase tracking-widest text-[#802334] font-bold mb-1">Bidang Contoh</div>
      <div className="font-serif text-[13px] text-[#1F1F1F] leading-snug font-medium">{k.tajuk}</div>
      <div className="font-serif text-[10px] text-stone-600 leading-relaxed mt-1">{k.huraian}</div>
    </div>
  );
};

const LogoPanel: React.FC<{ logoMode?: string }> = ({ logoMode }) => {
  if (logoMode === 'tiada') return null;
  if (logoMode === 'penaja') {
    return (
      <div className="border border-dashed border-stone-400 rounded px-2 py-1 text-center">
        <span className="font-mono text-[8px] uppercase tracking-widest text-stone-500">Ruang Logo Penaja</span>
      </div>
    );
  }
  return <LogoTransisiAdjung />;
};

export const AnimasiPratonton: React.FC<AnimasiPratontonProps> = ({ jenis, arah, kelajuan, warnaPanel, logoMode }) => {
  // jenis literal RESOLVED utk render (§ prop function, komen di deklarasi prop) — bila `jenis`
  // ialah fungsi (mod Rawak), nilai ni HANYA dikemas kini di dalam main() (klik "Main"), bukan
  // setiap render, supaya panel semasa main tak bertukar jenis di tengah-tengah animasi sendiri.
  const [jenisSemasa, setJenisSemasa] = useState<string>(() => (typeof jenis === 'function' ? jenis() : jenis));
  const [aktif, setAktif] = useState(0);
  const [tayang, setTayang] = useState(false);
  const [fasaGerak, setFasaGerak] = useState<'diam' | 'gerak'>('diam');
  // Pudar keluar SWIPE sahaja (2026-09-08, bug-hunt) — lihat nota fasaGerak/main() di bawah:
  // FrontpageView.tsx (tempohPudarSwipeMs, ~baris 1239) tak terus buang overlay swipe sebaik
  // gelongsoran (tempohSwipeMs) selesai — ia pudar opacity->0 dulu (200ms*kelajuan) SEBELUM
  // overlay ditanggalkan, fasa visual sebenar carousel. Pratonton ni terlepas fasa ni sepenuhnya
  // (overlay terus lenyap sebaik gelongsoran tamat), jadi "Main pratonton" utk Swipe sentiasa
  // tamat ~220ms*kelajuan lebih awal drpd animasi sebenar DAN tak pernah tunjuk kesan pudar
  // keluar yang pembaca portal sebenar nampak.
  const [swipeMemudar, setSwipeMemudar] = useState(false);
  const lain = 1 - aktif;

  // Senarai timeout tertunda (2026-09-09, bug-hunt) — main() jadualkan sehingga 2 window.setTimeout
  // yang panggil setState (setAktif/setTayang/setFasaGerak/setSwipeMemudar) selang beberapa RATUS ms
  // (sehingga ~1000ms bagi jenis Pudar). Kalau editor tutup modal "Tetapan Kad"/navigasi keluar
  // SEMASA animasi tengah main (tayang===true), komponen ni unmount tapi timeout yg dah dijadualkan
  // TETAP jalan lepas tu — panggil setState pada komponen yang dah unmount (amaran React, kebocoran
  // memori). Rujukan disimpan di sini supaya effect cleanup di bawah boleh batalkan semuanya semasa
  // unmount.
  const timeoutRef = useRef<number[]>([]);
  const jadualTimeout = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutRef.current.push(id);
    return id;
  };
  useEffect(() => () => {
    timeoutRef.current.forEach((id) => window.clearTimeout(id));
    timeoutRef.current = [];
  }, []);

  // Segerak drpd prop bila LITERAL (bukan mod Rawak) — editor tukar dropdown jenis, pratonton
  // patut ikut serta-merta tanpa perlu klik Main dulu (kelakuan asal, tak berubah).
  useEffect(() => {
    if (typeof jenis !== 'function') setJenisSemasa(jenis);
  }, [jenis]);

  const main = () => {
    if (tayang) return;
    // Resolusi SEKALI di sini (bukan baca jenisSemasa lama) — mod Rawak pilih jenis BAHARU
    // setiap klik. Formula masa dikira drpd `j` tempatan (bukan konst luar `masukMasa` dll di
    // bawah, yang masih berasaskan jenisSemasa PRA-klik) supaya setTimeout dijadualkan dgn nombor
    // yg SEPADAN jenis yg BAHARU dipilih, bukan nombor pusingan sebelumnya.
    const j = typeof jenis === 'function' ? jenis() : jenisSemasa;
    setJenisSemasa(j);
    const masukMasaJ = Math.round((j === 'sapuan_lajur' ? 550 : 400) * kelajuan);
    const tahanMasaJ = Math.round(500 * kelajuan);
    const jumlahMasaJ = masukMasaJ * 2 + tahanMasaJ;
    const tempohGerakMsJ = Math.round(900 * kelajuan);
    const tempohPudarMsJ = Math.round(1000 * kelajuan);
    if (j === 'pudar') {
      setTayang(true);
      // Timeout kosong (1 bingkai) supaya opacity 0 render dahulu sebelum transition CSS tercetus.
      jadualTimeout(() => setAktif(lain), 20);
      jadualTimeout(() => setTayang(false), tempohPudarMsJ + 50);
      return;
    }
    if (j === 'gerak_susun') {
      setTayang(true);
      setFasaGerak('gerak');
      jadualTimeout(() => {
        setAktif(lain);
        setFasaGerak('diam');
        setTayang(false);
      }, tempohGerakMsJ);
      return;
    }
    if (j === 'swipe') {
      // Dua fasa, sama urutan FrontpageView.tsx (~baris 1236-1252): gelongsor (tempohSwipeJ)
      // -> pudar keluar (tempohPudarSwipeJ) -> baru overlay ditanggalkan. Sebelum ni laluan ni
      // langkau terus ke `setTayang(false)` lepas gelongsor, tiada fasa pudar langsung.
      setTayang(true);
      setFasaGerak('gerak');
      setSwipeMemudar(false);
      const tempohSwipeJ = Math.round(640 * kelajuan);
      const tempohPudarSwipeJ = Math.round(200 * kelajuan);
      jadualTimeout(() => {
        setAktif(lain);
        setFasaGerak('diam');
        setSwipeMemudar(true);
      }, tempohSwipeJ);
      jadualTimeout(() => {
        setSwipeMemudar(false);
        setTayang(false);
      }, tempohSwipeJ + tempohPudarSwipeJ);
      return;
    }
    // Colophon / Sapuan Lajur — sama formula FrontpageView.tsx (masukMasa/tahanMasa/jumlahMasa).
    setTayang(true);
    jadualTimeout(() => setAktif(lain), masukMasaJ);
    jadualTimeout(() => setTayang(false), jumlahMasaJ);
  };

  // Formula masa SAMA seperti FrontpageView.tsx — dikira dari jenisSemasa (jenis literal RESOLVED
  // semasa, lihat komen deklarasi state di atas), dikongsi dgn JSX (animationDuration dipaparkan).
  const masukMasa = Math.round((jenisSemasa === 'sapuan_lajur' ? 550 : 400) * kelajuan);
  const tahanMasa = Math.round(500 * kelajuan);
  const jumlahMasa = masukMasa * 2 + tahanMasa;
  const tempohGerakMs = Math.round(900 * kelajuan);
  const tempohPudarMs = Math.round(1000 * kelajuan);
  const tempohSwipeMs = Math.round(640 * kelajuan);
  const tempohPudarSwipeMs = Math.round(200 * kelajuan);

  return (
    <div className="space-y-1.5">
      <div
        className="relative w-full max-w-[260px] h-32 rounded-lg overflow-hidden bg-[#FDFDFD] border border-stone-200 shadow-sm"
      >
        {/* Dua kandungan bertindan — corak SAMA seperti CarouselStableBlock (col-start-1
            row-start-1, alignSelf:start), tapi tanpa refs/ResizeObserver — pratonton bersaiz
            tetap (h-32), tak perlu jaring limpahan sebenar. */}
        <div className="grid w-full h-full">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="col-start-1 row-start-1"
              style={{
                opacity: i === aktif ? 1 : 0,
                // Peralihan opacity kelihatan HANYA bagi jenis Pudar — jenis lain (Colophon/
                // Sapuan Lajur/Gerak Susun) tukar kandungan SENYAP di sebalik panel/regangan
                // (sama rasional CarouselStableBlock: transition='none' semasa overlay aktif).
                // jenisSemasa (RESOLVED), bukan `jenis` mentah (2026-08-18) — sisa terlepas
                // semasa migrasi jenis->jenisSemasa; dlm mod Rawak `jenis` ialah FUNGSI, jadi
                // `jenis === 'pudar'` sentiasa palsu dan fade tak pernah main.
                transition: jenisSemasa === 'pudar' ? `opacity ${tempohPudarMs}ms ease-in-out` : 'none',
              }}
            >
              <KandunganContoh index={i} />
            </div>
          ))}
        </div>

        {tayang && (jenisSemasa === 'colophon') && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none carousel-colophon-penuh"
            style={{ backgroundColor: warnaPanel, animationDuration: `${jumlahMasa}ms`, ...vektorArahOverlay(arah, false) }}
          >
            <div className="scale-[0.6]"><LogoPanel logoMode={logoMode} /></div>
          </div>
        )}
        {tayang && (jenisSemasa === 'sapuan_lajur') && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none carousel-sapuan-penuh"
            style={{ backgroundColor: warnaPanel, animationDuration: `${jumlahMasa}ms`, ...vektorArahOverlay(arah, true) }}
          >
            <div className="scale-[0.6]"><LogoPanel logoMode={logoMode} /></div>
          </div>
        )}
        {tayang && jenisSemasa === 'gerak_susun' && (
          <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none">
            <div
              className="flex h-full"
              style={{
                width: '300%',
                transform: (() => {
                  const kanan = arah !== 'kiri';
                  if (fasaGerak === 'gerak') return kanan ? 'translateX(-66.6667%)' : 'translateX(0%)';
                  return kanan ? 'translateX(0%)' : 'translateX(-66.6667%)';
                })(),
                transition: fasaGerak === 'gerak' ? `transform ${tempohGerakMs}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
              }}
            >
              {arah === 'kiri' ? (
                <>
                  <div className="w-1/3 h-full shrink-0 bg-[#FDFDFD]"><KandunganContoh index={lain} /></div>
                  <div className="w-1/3 h-full shrink-0 flex items-center justify-center" style={{ backgroundColor: warnaPanel }}>
                    <div className="scale-[0.6]"><LogoPanel logoMode={logoMode} /></div>
                  </div>
                  <div className="w-1/3 h-full shrink-0 bg-[#FDFDFD]"><KandunganContoh index={aktif} /></div>
                </>
              ) : (
                <>
                  <div className="w-1/3 h-full shrink-0 bg-[#FDFDFD]"><KandunganContoh index={aktif} /></div>
                  <div className="w-1/3 h-full shrink-0 flex items-center justify-center" style={{ backgroundColor: warnaPanel }}>
                    <div className="scale-[0.6]"><LogoPanel logoMode={logoMode} /></div>
                  </div>
                  <div className="w-1/3 h-full shrink-0 bg-[#FDFDFD]"><KandunganContoh index={lain} /></div>
                </>
              )}
            </div>
          </div>
        )}
        {tayang && jenisSemasa === 'swipe' && (
          <div
            className="absolute inset-0 z-10 overflow-hidden pointer-events-none"
            style={{
              // Pudar keluar (swipeMemudar, lihat nota deklarasi state) — sama corak
              // FrontpageView.tsx: opacity->0 SELEPAS gelongsoran selesai, sebelum overlay hilang.
              opacity: swipeMemudar ? 0 : 1,
              transition: swipeMemudar ? `opacity ${tempohPudarSwipeMs}ms ease-out` : 'none',
            }}
          >
            <div
              className="absolute inset-0 bg-[#FDFDFD]"
              style={{
                transform: fasaGerak === 'gerak' ? (VEKTOR_ARAH[arah] || VEKTOR_ARAH.kanan).masuk : 'translate(0, 0)',
                transition: fasaGerak === 'gerak' ? `transform ${tempohSwipeMs}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
              }}
            >
              <KandunganContoh index={aktif} />
            </div>
            <div
              className="absolute inset-0 bg-[#FDFDFD]"
              style={{
                transform: fasaGerak === 'gerak' ? 'translate(0, 0)' : (VEKTOR_ARAH[arah] || VEKTOR_ARAH.kanan).keluar,
                transition: fasaGerak === 'gerak' ? `transform ${tempohSwipeMs}ms cubic-bezier(0.4, 0, 0.2, 1)` : 'none',
              }}
            >
              <KandunganContoh index={lain} />
            </div>
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={main}
        disabled={tayang}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 border border-stone-300 rounded text-[11px] font-sans font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-40 cursor-pointer disabled:cursor-default"
      >
        <Play className="w-3 h-3" />
        {tayang ? 'Sedang main…' : 'Main pratonton'}
      </button>
    </div>
  );
};

export default AnimasiPratonton;
