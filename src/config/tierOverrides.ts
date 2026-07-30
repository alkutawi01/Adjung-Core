import { setTierOverrides } from '../../core/editorial/GeometryConfig.js';

// Pindaan had aksara tier di sisi BROWSER (2026-07-30).
//
// Kenapa fail ni wujud: GeometryConfig.js ialah kod KONGSI — server dan browser masing-masing
// memuatkan salinan sendiri. Server memuatkan pindaan Ketua Editor daripada jadual `tier_settings`
// semasa boot (tierSettingsRoutes.js), tetapi salinan browser tidak tahu apa-apa tentangnya.
//
// Akibatnya sebelum ni: naikkan had Kompak kepada 120 di Tier Kad, meter amaran dalam borang Tulis
// Kandungan masih berkata "melebihi 80" dan bertukar merah — sedangkan server sebenarnya menerima
// simpanan itu. Meter memberi amaran palsu terhadap peraturan yang sudah tidak wujud.
//
// Panggil muatPindaanTier() sekali semasa aplikasi mula, dan sekali lagi setiap kali had disimpan,
// supaya meter berubah serta-merta tanpa muat semula halaman.
export const muatPindaanTier = async (): Promise<void> => {
  try {
    const res = await fetch('/api/system/tier-settings');
    if (!res.ok) return;
    const rows = await res.json();
    if (!Array.isArray(rows)) return;
    const pindaan: Record<string, { maxTitleAlone: number; maxBriefAlone: number }> = {};
    for (const r of rows) {
      // Hanya tier yang benar-benar DIPINDA disuap masuk — tier lain kekal pada nilai lalai
      // dalam GeometryConfig, jadi lalai tetap satu sumber sahaja.
      if (r && r.dipinda) {
        pindaan[r.tierKey] = { maxTitleAlone: r.maxTitleAlone, maxBriefAlone: r.maxBriefAlone };
      }
    }
    setTierOverrides(pindaan);
  } catch {
    // Senyap: gagal ambil bermakna meter guna nilai lalai — sama seperti kelakuan sebelum ciri
    // pindaan wujud, bukan keadaan rosak.
  }
};
