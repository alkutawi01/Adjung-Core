// Tarikh/bulan mengikut waktu Malaysia (Asia/Kuala_Lumpur), bukan UTC.
//
// Kenapa ini wujud (2026-08-07): dua tempat berbeza memerlukan "hari ini" dan "bulan ini" versi
// pembaca Malaysia. Kiraan harian (viewStatsRoutes) sudah betul, tetapi penaja (sponsorRoutes)
// masih memakai toISOString() — UTC — jadi antara 12:00 pagi dan 8:00 pagi MYT pada 1 haribulan,
// footer awam masih memaparkan penaja bulan LEPAS. Logiknya dikongsi di sini supaya kedua-dua
// tempat tidak boleh hanyut lagi.
const bahagianTarikh = (tarikh = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(tarikh);
  const ambil = (t) => parts.find((p) => p.type === t)?.value;
  return { tahun: ambil('year'), bulan: ambil('month'), hari: ambil('day') };
};

// 'YYYY-MM-DD' waktu Malaysia
export const tarikhMalaysia = (tarikh = new Date()) => {
  const { tahun, bulan, hari } = bahagianTarikh(tarikh);
  return `${tahun}-${bulan}-${hari}`;
};

// 'YYYY-MM' waktu Malaysia
export const bulanMalaysia = (tarikh = new Date()) => {
  const { tahun, bulan } = bahagianTarikh(tarikh);
  return `${tahun}-${bulan}`;
};
