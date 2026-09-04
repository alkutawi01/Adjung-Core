import React from 'react';
import { Check, Clock, Ban } from 'lucide-react';

// Lencana status kongsi (2026-08-07, hasil audit reka bentuk — design_handoff_editorium_redesign,
// seksyen 3.5/3.6/4.2). Sebelum ni status (Aktif/Menunggu/Arkib, Lulus/Gagal) dikod WARNA SAHAJA
// merentasi Matriks Slot Papan Pemuka, lencana Indeks, dsb — tak jelas bagi pembaca buta warna
// atau skrin kecerahan rendah. Peraturan audit: setiap status MESTI ada (a) corak/bentuk berbeza
// DAN (b) label teks eksplisit; warna cuma penguat, bukan satu-satunya isyarat.
//
// `tone` ialah paksi VISUAL (bukan nama status Melayu) — pemanggil bekalkan `label` (biasanya
// drpd labelStatus() di config/istilah.ts, supaya istilah kekal satu tempat, tak diterjemah dua
// kali di sini):
//   success — isian PADAT hijau + tanda ✓ (Aktif, Lulus, Sihat)
//   warning — corak LOREK serong emas + jam ⏳ (Menunggu)
//   error   — sempadan PUTUS-PUTUS merah + ⊘ (Ralat, Gagal)
//   neutral — sempadan PUTUS-PUTUS kelabu, tiada ikon (Kosong, Arkib — bukan kegagalan, cuma
//             ketiadaan/senyap)
export type StatusTone = 'success' | 'warning' | 'error' | 'neutral';

const TONE_COLOR: Record<StatusTone, string> = {
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  error: 'var(--color-error)',
  neutral: 'var(--stone-400)',
};

const TONE_ICON: Record<StatusTone, React.ReactNode> = {
  success: <Check className="w-2.5 h-2.5" strokeWidth={3} />,
  warning: <Clock className="w-2.5 h-2.5" strokeWidth={2.5} />,
  error: <Ban className="w-2.5 h-2.5" strokeWidth={2.5} />,
  neutral: null,
};

export interface StatusBadgeProps {
  tone: StatusTone;
  label: string;
  /** Sembunyi ikon corak — jarang perlu, cuma bila ruang amat terhad (cth sel matriks kecil yang
   *  sudah guna SlotMatrixCell dgn corak latar sendiri). */
  hideIcon?: boolean;
  /** Benarkan label panjang balut ke baris kedua dalam lencana (2026-09-04) — lalai KEKAL
   *  whitespace-nowrap (bentuk pil, reka bentuk asal) sebab kebanyakan label pendek ("Aktif",
   *  "Ralat") dan lencana ni dipakai serata (Papan Pemuka, Direktori, dsb) di mana nowrap
   *  sengaja. Cuma perlu di lajur jadual yang lebarnya TETAP (`table-fixed`) dan boleh terima
   *  label panjang (cth "Menunggu Slot Kosong" IndeksConsole.tsx) — di situ nowrap+lajur sempit
   *  buat teks melimpah bertindan ke lajur sebelah; lebarkan lajur bukan penyelesaian sebab
   *  kebanyakan baris papar label pendek ("Aktif"), jadi lajur jadi terlalu lebar tanpa sebab.
   *  Wrap kekalkan lajur padat, cuma baris yang perlu tumbuh tinggi. */
  wrap?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ tone, label, hideIcon, wrap, className = '' }) => {
  const warna = TONE_COLOR[tone];
  const style: React.CSSProperties = tone === 'warning'
    ? {
        color: warna,
        backgroundImage: `repeating-linear-gradient(45deg, ${warna}26 0, ${warna}26 3px, transparent 3px, transparent 7px)`,
        border: `1px solid ${warna}66`,
      }
    : tone === 'error' || tone === 'neutral'
      ? { color: warna, background: 'transparent', border: `1px dashed ${warna}` }
      : { color: warna, background: `${warna}1F`, border: `1px solid ${warna}40` };

  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase font-bold tracking-wide px-2 py-0.5 ${wrap ? 'rounded-md whitespace-normal text-center leading-tight' : 'rounded-full whitespace-nowrap'} ${className}`}
      style={style}
    >
      {!hideIcon && TONE_ICON[tone]}
      {label}
    </span>
  );
};

export default StatusBadge;
