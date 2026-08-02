import { setLabelOverrides } from './istilah.ts';

// Gantian Label Sistem di sisi BROWSER (2026-08-02, Fasa 6 "Editor label & tooltip").
//
// Sama corak seperti src/config/tierOverrides.ts: pelayan simpan gantian dalam jadual
// `ui_labels`, tapi salinan browser istilah.ts tidak tahu apa-apa tentangnya sehingga
// dimuatkan secara eksplisit. Panggil muatPindaanLabel() sekali semasa aplikasi mula, dan
// sekali lagi selepas simpan di Tetapan → Label Sistem, supaya label berubah serta-merta
// tanpa muat semula halaman.
export const muatPindaanLabel = async (): Promise<void> => {
  try {
    const res = await fetch('/api/system/ui-labels');
    if (!res.ok) return;
    const data = await res.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;
    setLabelOverrides(data);
  } catch {
    // Senyap: gagal ambil bermakna label guna nilai lalai — sama seperti kelakuan sebelum
    // ciri gantian wujud, bukan keadaan rosak.
  }
};
