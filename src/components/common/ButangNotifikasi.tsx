import React from 'react';
import {
  type StatusPush, dapatkanStatus, aktifkanNotifikasi, matikanNotifikasi, segerakkanJikaAktif,
} from '../../utils/pushNotifikasi';

// Butang "Notifikasi berita" di footer (2026-10-25, permintaan Izzat — rujukan Monitor World).
// Teks mengikut keadaan pelayar; tiada pop-up dan tiada permintaan izin sehingga pembaca menekan.
// Kelas SAMA dengan pautan lain dalam lajur Maklumat supaya nampak sebahagian daripada senarai.
const KELAS_PAUTAN =
  'hover:text-[#802334] transition-colors text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-Adjung-maroon rounded-sm cursor-pointer';

export default function ButangNotifikasi() {
  const [status, setStatus] = React.useState<StatusPush>('memeriksa');
  const [sibuk, setSibuk] = React.useState(false);
  const [mesej, setMesej] = React.useState<string | null>(null);

  const muat = React.useCallback(async () => setStatus(await dapatkanStatus()), []);

  React.useEffect(() => {
    let batal = false;
    (async () => {
      await segerakkanJikaAktif();
      const s = await dapatkanStatus();
      if (!batal) setStatus(s);
    })();
    return () => { batal = true; };
  }, []);

  // Tidak disokong / dimatikan oleh editor / masih memeriksa: tiada apa dipaparkan.
  if (status === 'memeriksa' || status === 'tidak-disokong' || status === 'dimatikan-pelayan') return null;

  const tekan = async () => {
    if (sibuk) return;
    setSibuk(true); setMesej(null);
    if (status === 'aktif') {
      await matikanNotifikasi();
    } else if (status === 'belum') {
      const h = await aktifkanNotifikasi();
      if (!h.ok) setMesej(h.ralat || 'Gagal mengaktifkan notifikasi.');
    }
    await muat();
    setSibuk(false);
  };

  if (status === 'ios-perlu-pasang') {
    return (
      <li className="flex flex-col gap-0.5">
        <span className="text-stone-600">Notifikasi berita</span>
        <span className="font-normal text-[11px] text-stone-400 leading-snug max-w-[18rem]">
          Di iPhone: ketik ikon Kongsi, pilih “Tambah ke Skrin Utama”, buka Adjung dari skrin utama, kemudian aktifkan di sini.
        </span>
      </li>
    );
  }
  if (status === 'disekat') {
    return (
      <li className="flex flex-col gap-0.5">
        <span className="text-stone-600">Notifikasi berita</span>
        <span className="font-normal text-[11px] text-stone-400 leading-snug max-w-[18rem]">
          Disekat dalam tetapan pelayar. Benarkan notifikasi untuk laman ini untuk mengaktifkannya.
        </span>
      </li>
    );
  }
  return (
    <li className="flex flex-col gap-0.5">
      <button type="button" onClick={tekan} disabled={sibuk} aria-live="polite" className={`${KELAS_PAUTAN} disabled:opacity-60`}>
        {status === 'aktif' ? 'Notifikasi berita: aktif (matikan)' : 'Aktifkan notifikasi berita'}
      </button>
      {mesej && <span role="status" className="font-normal text-[11px] text-[#802334] leading-snug">{mesej}</span>}
    </li>
  );
}
