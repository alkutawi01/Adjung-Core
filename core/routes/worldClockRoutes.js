import express from 'express';

// GET /api/system/hijri-date?zone=KDH01 — official JAKIM Hijri date (Imkanur Rukyah) via
// waktusolat.app's public e-Solat proxy, Maghrib-adjusted for the given zone. Not a client-side
// islamic-umalqura approximation (confirmed to drift up to a day from JAKIM's actual calendar),
// and not a naive midnight cutover either: the Islamic day genuinely begins at Maghrib, not
// midnight, so once local time passes today's Maghrib the civil (JAKIM-tabulated) Hijri date for
// TOMORROW is already the correct one to show, even though the Gregorian date hasn't advanced yet.
// Maghrib time itself varies slightly by location (longitude), so the zone matters here even
// though the hijri calendar VALUE on any given civil day is identical across all of Malaysia.
const HIJRI_ZONES = ['KDH01', 'KTN01', 'TRG01'];

// Lalai berkod keras (2026-08-02, Fasa 7) — SANDARAN sahaja bila Ketua Editor belum sunting
// (system_settings.schoolHolidaysJson kosong/NULL). Jangan tambah tarikh baharu di sini lepas
// tempoh ni basi — sunting terus di Tetapan Sistem → Operasi → Jam Dunia sebaliknya, supaya
// perubahan tak perlukan deploy kod semula.
const SCHOOL_HOLIDAYS_LALAI = [
  // Penggal 1
  { start: '2026-05-24', end: '2026-06-01', group: 'A', name: 'Cuti Penggal 1 Sekolah' },
  { start: '2026-05-25', end: '2026-06-02', group: 'B', name: 'Cuti Penggal 1 Sekolah' },
  // Penggal 2
  { start: '2026-09-11', end: '2026-09-19', group: 'A', name: 'Cuti Penggal 2 Sekolah' },
  { start: '2026-09-12', end: '2026-09-20', group: 'B', name: 'Cuti Penggal 2 Sekolah' },
  // Penggal 3
  { start: '2026-12-25', end: '2027-01-02', group: 'A', name: 'Cuti Penggal 3 Sekolah' },
  { start: '2026-12-26', end: '2027-01-03', group: 'B', name: 'Cuti Penggal 3 Sekolah' },
  // Akhir Persekolahan
  { start: '2027-01-22', end: '2027-02-13', group: 'A', name: 'Cuti Akhir Persekolahan' },
  { start: '2027-01-23', end: '2027-02-14', group: 'B', name: 'Cuti Akhir Persekolahan' }
];

export function createWorldClockRoutes(dbGet) {
  const router = express.Router();

  // GET /api/system/clock-holidays
  router.get('/clock-holidays', async (req, res) => {
    try {
      const currentYear = new Date().getFullYear();
      let apiHolidays = [];
      try {
        const response = await fetch(`https://malaysia-holiday.dydxsoft.my/api/v1/holidays?year=${currentYear}`);
        if (response.ok) {
          const jsonResult = await response.json();
          if (jsonResult && Array.isArray(jsonResult.data)) {
            apiHolidays = jsonResult.data.map(h => {
              return {
                name: h.name,
                date: h.date, // "YYYY-MM-DD"
                state_codes: h.state_codes || []
              };
            });
          }
        }
      } catch (apiErr) {
        console.warn('Failed to fetch public holidays from DyDxSoft API:', apiErr.message);
      }

      let schoolHolidays = SCHOOL_HOLIDAYS_LALAI;
      try {
        const row = await dbGet("SELECT schoolHolidaysJson FROM system_settings WHERE id = 'settings-main'");
        if (row && row.schoolHolidaysJson) {
          const parsed = JSON.parse(row.schoolHolidaysJson);
          if (Array.isArray(parsed) && parsed.length > 0) schoolHolidays = parsed;
        }
      } catch (e) {
        console.warn('Failed to load schoolHolidaysJson, using hardcoded default:', e.message);
      }

      res.json({
        publicHolidays: apiHolidays,
        schoolHolidays
      });
    } catch (err) {
      console.error('Failed to resolve holidays:', err);
      res.status(500).json({ error: 'Failed to retrieve holidays list.' });
    }
  });

  // GET /api/system/hijri-date
  router.get('/hijri-date', async (req, res) => {
    const zone = HIJRI_ZONES.includes(String(req.query.zone)) ? String(req.query.zone) : 'KTN01';
    try {
      const nowParts = {};
      new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kuala_Lumpur',
        year: 'numeric', month: 'numeric', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).formatToParts(new Date()).forEach(p => { nowParts[p.type] = p.value; });
      const monthAbbr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kuala_Lumpur', month: 'short' }).format(new Date());
      const todayStr = `${nowParts.day}-${monthAbbr}-${nowParts.year}`;
      const nowTimeStr = `${nowParts.hour}:${nowParts.minute}:${nowParts.second}`;

      const fetchMonth = async (year, month) => {
        const r = await fetch(`https://api.waktusolat.app/solat/${zone}?year=${year}&month=${month}`);
        if (!r.ok) throw new Error(`waktusolat.app returned ${r.status}`);
        const d = await r.json();
        return d.prayerTime || [];
      };

      const monthData = await fetchMonth(nowParts.year, nowParts.month);
      const todayEntry = monthData.find(p => p.date === todayStr);
      if (!todayEntry) throw new Error(`No entry found for ${todayStr} (zone ${zone})`);

      let resultHijri = todayEntry.hijri;

      // Past today's Maghrib -> the Islamic day has already advanced; use tomorrow's civil-Hijri
      // value instead, crossing month boundaries by fetching next month if needed.
      if (todayEntry.maghrib && nowTimeStr >= todayEntry.maghrib) {
        const tomorrowUtc = new Date(Date.UTC(Number(nowParts.year), Number(nowParts.month) - 1, Number(nowParts.day) + 1));
        const tomorrowYear = tomorrowUtc.getUTCFullYear();
        const tomorrowMonth = tomorrowUtc.getUTCMonth() + 1;
        const tomorrowDay = String(tomorrowUtc.getUTCDate()).padStart(2, '0');
        const tomorrowMonthAbbr = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'short' }).format(tomorrowUtc);
        const tomorrowStr = `${tomorrowDay}-${tomorrowMonthAbbr}-${tomorrowYear}`;

        const tomorrowPool = tomorrowMonth === Number(nowParts.month)
          ? monthData
          : await fetchMonth(tomorrowYear, tomorrowMonth);
        const tomorrowEntry = tomorrowPool.find(p => p.date === tomorrowStr);
        if (tomorrowEntry) resultHijri = tomorrowEntry.hijri;
      }

      res.json({ hijri: resultHijri, zone }); // hijri: "YYYY-MM-DD"
    } catch (err) {
      console.warn(`Failed to fetch Hijri date (zone=${zone}) from waktusolat.app:`, err.message);
      res.json({ hijri: null, zone });
    }
  });

  return router;
}
