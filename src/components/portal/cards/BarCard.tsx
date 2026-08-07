import React from 'react';
import { extractOrganizerAcronym, formatEventDateRange } from '../../../../core/editorial/EventDateValidator.js';

interface BarCardProps {
  item: any;
  onClick: () => void;
  isEditMode?: boolean;
  onEditClick?: (e: React.MouseEvent) => void;
}

export function extractOrganizerLabel(item: any): string {
  return extractOrganizerAcronym(item);
}

// Extract access badge e.g. "Terbuka" / "Tertutup"
export function extractAccessBadge(item: any): { label: string; isTerbuka: boolean } {
  const accessText = (item.access || item.manualAccess || item.akses || 'Terbuka').toString().toLowerCase();
  const isTertutup = accessText.includes('tertutup') || accessText.includes('closed');
  return {
    label: isTertutup ? 'TERTUTUP' : 'TERBUKA',
    isTerbuka: !isTertutup,
  };
}

export const BarCard: React.FC<BarCardProps> = ({ item, onClick, isEditMode, onEditClick }) => {
  if (!item) return null;

  const eventDate = formatEventDateRange(item.originalDate || item.date, item.dateEnd)
    || (item.publishedAt || '').toString().trim().toUpperCase();
  // Peraturan Khas Slot Bar: kiri atas ialah Tarikh acara; jika tiada, jatuh balik ke nama desk
  // (bukan kosong) supaya baris atas tak pernah nampak "hilang" sebuah medan.
  const dateOrDeskLabel = eventDate || (item.desk || 'ADJUNG EDITORIAL').toString().toUpperCase();

  // Peraturan Khas Slot Bar: lencana kanan atas ialah Penganjur SAHAJA bila medan Penganjur diisi
  // terus (item.organizer mentah, bukan hasil rekaan extractOrganizerAcronym daripada desk/sumber
  // lain) — jika tidak, jatuh balik ke lencana status Akses (Terbuka/Tertutup).
  const hasOrganizer = !!(item.organizer && item.organizer.toString().trim());
  const organizerLabel = hasOrganizer ? extractOrganizerLabel(item) : '';
  const accessBadge = extractAccessBadge(item);

  return (
    <div
      onClick={onClick}
      className={`group relative bg-[#802334] border border-amber-300/40 rounded-lg p-3 sm:px-3.5 sm:py-2.5 hover:brightness-110 transition-all duration-200 cursor-pointer flex flex-col justify-start gap-1.5 min-h-[84px] flex-1 w-full overflow-hidden shadow-sm ${
        isEditMode ? 'ring-2 ring-dashed ring-amber-300 cursor-pointer' : ''
      }`}
    >
      {/* Top Row: Tarikh/Desk (Kiri) & Lencana Penganjur atau Akses (Kanan)
          TELEFON: ditindan dua baris — lencana (Terbuka/Penganjur) di baris PERTAMA, Tarikh/Desk
          di baris KEDUA (permintaan Izzat). `flex-col-reverse` dipakai supaya lencana (anak KEDUA
          dalam DOM) naik ke atas tanpa perlu susun semula JSX — turutan DOM kekal sama untuk
          desktop. Had lebar 60%/40% turut dilonggarkan ke penuh pada telefon: had itu wujud untuk
          kongsi SATU baris, jadi apabila ditindan ia cuma memotong teks tanpa sebab (disahkan:
          lencana terpotong "TER…", desk terpotong "PENERBIT…"). Desktop kekal satu baris asal. */}
      <div className="flex flex-col-reverse items-start gap-1 md:flex-row md:items-center md:justify-between md:gap-2 w-full">
        <span className="font-mono text-[8px] md:text-[9px] uppercase font-bold text-amber-100/90 tracking-wider truncate max-w-full md:max-w-[60%] select-none">
          {dateOrDeskLabel}
        </span>
        {hasOrganizer ? (
          <span className="font-mono text-[7px] md:text-[8px] uppercase tracking-widest font-extrabold bg-white/15 text-white border border-white/30 rounded px-1.5 py-0.5 truncate max-w-full md:max-w-[40%] md:text-right shrink-0">
            {organizerLabel}
          </span>
        ) : (
          <span className={`font-mono text-[7px] md:text-[8px] uppercase tracking-widest font-extrabold rounded px-1.5 py-0.5 truncate max-w-full md:max-w-[40%] md:text-right shrink-0 ${
            accessBadge.isTerbuka
              ? 'bg-amber-400/20 text-amber-300 border border-amber-300/30'
              : 'bg-rose-950/60 text-rose-300 border border-rose-500/40'
          }`}>
            {accessBadge.label}
          </span>
        )}
      </div>

      {/* Main Row: Tajuk Acara (Bawah) */}
      {/* Telefon: tajuk membalut penuh ke berapa-berapa baris yang perlu (line-clamp-none) —
          bukan dipotong 2 baris + elipsis. Memotong teks editorial secara mekanikal melanggar
          Falsafah teras #1; pada lebar telefon yang sempit, had 2 baris memang kerap terkena.
          Desktop kekal line-clamp-2 seperti asal (md: = 768px, breakpoint telefon projek ini). */}
      <h4 className="font-serif text-[10px] md:text-sm text-white leading-snug font-medium line-clamp-none md:line-clamp-2 group-hover:text-[#E9D8A6] transition-colors duration-200 mt-1">
        {/* Tiada penggalSukuKata() di sini dengan sengaja: `item.title` sampai ke sini sudah
            menjadi elemen React (diproses di FrontpageView, lihat nota "penggalSukuKata()
            disisipkan DI SINI"). Soft hyphen sudah pun tersisip di titik pusat itu. */}
        {item.title}
      </h4>
    </div>
  );
};
