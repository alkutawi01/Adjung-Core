import React from 'react';
import { CheckCircle2, Clock3, CircleDashed } from 'lucide-react';

// Sel Matriks Slot kongsi (2026-08-07, hasil audit reka bentuk — design_handoff_editorium_
// redesign, seksyen 3.5/4.3). Papan Pemuka (DashboardConsole.tsx) dahulu kod status matriks
// 38-slot cuma nombor slot berwarna + satu dot — audit: mesti ada LABEL TEKS eksplisit jugak
// (bukan warna sahaja). Satu definisi di sini, boleh dipakai semula kalau matriks dipaparkan di
// tempat lain (cth Senarai Slot) tanpa ulang corak.
//
// REDESIGN 2026-08-22 (Izzat, bulatan merah pada tangkapan skrin sebenar — "kata redesign
// semula jadual ni biar lebih jelas yg kosong, menunggu, aktif. kalau aktif berapa byk berita
// yg ada?"). Reka bentuk asal (jalur kiri 3px + label teks kecil) memerlukan pembaca meneliti
// setiap sel satu-satu untuk bezakan status — pada 38 sel serentak, ini perlahan. Dua perubahan:
// (1) latar warna PENUH lembut (~8% legap) menggantikan jalur kiri sahaja, supaya taburan
// kosong/menunggu/aktif kelihatan sebagai CORAK sekali imbas (bukan perlu baca satu-satu) —
// nota lama "latar penuh jejas kebolehbacaan label" tak lagi releven sebab legap direndahkan
// jauh (8%, bukan warna pekat) + ikon ditambah sebagai penanda kedua bukan-warna (accessibility,
// sepadan falsafah label teks eksplisit asal); (2) kiraan kandungan SEBENAR dipaparkan bagi slot
// Aktif ("N kandungan") dan Menunggu ("N menunggu") — jawapan terus kepada soalan Izzat, bukan
// perlu klik masuk Indeks untuk tahu berapa banyak. Istilah "kandungan" (bukan "berita") —
// Adjung Brief papar berita, ilmu DAN kebudayaan; "berita" salah sebab hanya satu daripada
// tiga jenis (Izzat tegur terus: "sejak bila kita panggil 'berita'?").
export type SlotMatrixStatus = 'terisi' | 'menunggu' | 'kosong';

const STATUS_WARNA: Record<SlotMatrixStatus, string> = {
  terisi: 'var(--color-success)',
  menunggu: 'var(--color-warning)',
  kosong: 'var(--color-error)',
};
const STATUS_LABEL: Record<SlotMatrixStatus, string> = {
  terisi: 'AKTIF',
  menunggu: 'MENUNGGU',
  kosong: 'KOSONG',
};
// Ikon SEBAGAI PENANDA KEDUA bukan-warna (2026-08-22) — pembaca buta warna/kontras rendah
// masih boleh bezakan status daripada bentuk ikon sahaja, tanpa bergantung semata-mata pada
// legap latar. CircleDashed (kosong) sengaja bukan Circle kosong biasa — bentuk putus-putus ikon
// itu SENDIRI dah bawa makna "belum diisi", jadi sempadan sel tak perlu ulang isyarat sama
// (Izzat tanya "kenapa mesti kena line putus-putus?" — jawapannya: tak perlu, dibuang.
// Sempadan kiri kini SAMA rata pejal untuk ketiga-tiga status, latar 8% legap pun sama rata —
// tiada lagi kes khas kosong, konsisten dgn dua status lain).
const STATUS_IKON: Record<SlotMatrixStatus, React.ComponentType<{ size?: number; strokeWidth?: number; style?: React.CSSProperties }>> = {
  terisi: CheckCircle2,
  menunggu: Clock3,
  kosong: CircleDashed,
};

export interface SlotMatrixCellProps {
  /** Slot 1-based (paparan) — pemanggil hantar slotIndex+1 kalau data 0-based. */
  slotNombor: number;
  status: SlotMatrixStatus;
  /** Bilangan kandungan AKTIF (approved) sebenar dalam slot ni — hanya bermakna bila status
   *  'terisi'. Slot carousel boleh ada >1 (cth 5 kandungan berputar dalam satu slot). */
  bilanganAktif?: number;
  /** Bilangan kandungan MENUNGGU semakan dalam slot ni — hanya bermakna bila status 'menunggu'. */
  bilanganMenunggu?: number;
  onClick?: () => void;
}

export const SlotMatrixCell: React.FC<SlotMatrixCellProps> = ({ slotNombor, status, bilanganAktif, bilanganMenunggu, onClick }) => {
  const warna = STATUS_WARNA[status];
  const Ikon = STATUS_IKON[status];
  const kiraan = status === 'terisi' ? bilanganAktif : status === 'menunggu' ? bilanganMenunggu : undefined;
  const teksKiraan = status === 'terisi'
    ? `${kiraan ?? 0} kandungan`
    : status === 'menunggu'
      ? `${kiraan ?? 0} menunggu`
      : 'Tiada kandungan';
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-2.5 flex flex-col gap-1 min-w-0 overflow-hidden hover:brightness-95 transition-[filter] cursor-pointer text-left border-l-[3px] border-solid"
      style={{
        backgroundColor: `color-mix(in srgb, ${warna} 8%, #FDFDFD)`,
        borderLeftColor: warna,
      }}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[11px] font-semibold whitespace-nowrap text-stone-700">
          S-{String(slotNombor).padStart(2, '0')}
        </span>
        <Ikon size={12} strokeWidth={2.25} style={{ color: warna, flexShrink: 0 }} />
      </div>
      <span className="font-mono text-[9px] font-bold tracking-wide" style={{ color: warna }}>
        {STATUS_LABEL[status]}
      </span>
      <span className="text-[9.5px] text-stone-500 leading-tight">
        {teksKiraan}
      </span>
    </button>
  );
};

export default SlotMatrixCell;
