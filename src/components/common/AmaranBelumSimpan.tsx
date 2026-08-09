import React from 'react';
import { Button } from './Button';

// Bar pengesahan "perubahan belum disimpan" (DS-12, VR-01 2026-08-09) — diekstrak daripada 4
// salinan aksara-demi-aksara (DirektoriConsole, ProfilEditorModal, SenaraiSlotConsole ×2) yang
// semuanya dibina serentak semasa DLG-01 (refactor useAmaranBelumSimpan). Satu komponen supaya
// pola ni tak hanyut esok apabila salah satu disunting tanpa yang lain diikut sama.
export interface AmaranBelumSimpanProps {
  onBatal: () => void;
  onSahkan: () => void;
}

export const AmaranBelumSimpan: React.FC<AmaranBelumSimpanProps> = ({ onBatal, onSahkan }) => (
  <div className="flex items-center justify-between gap-3 rounded-md border border-Adjung-maroon/30 bg-Adjung-maroon/5 px-3 py-2">
    <span className="font-sans text-xs text-stone-700">Ada perubahan belum disimpan. Tutup dan buang perubahan ini?</span>
    <div className="flex items-center gap-2 shrink-0">
      <Button type="button" variant="ghost" size="sm" onClick={onBatal}>Batal</Button>
      <Button type="button" variant="primary" size="sm" onClick={onSahkan}>Ya, teruskan</Button>
    </div>
  </div>
);

export default AmaranBelumSimpan;
