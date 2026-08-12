// Jadual Terbit / Jadual Luput (2026-08-02) — helper tulen (pure functions), tiada kesan sampingan,
// supaya logik keputusan boleh diuji terus tanpa DB/HTTP (lihat tests/scheduling.test.js).
//
// Masa tempatan Malaysia (Asia/Kuala_Lumpur) digunakan konsisten di seluruh ciri ni — Malaysia
// tiada DST, jadi offset +08:00 tetap sepanjang tahun (sama corak seperti
// core/routes/viewStatsRoutes.js punya "Tarikh tempatan Malaysia" dan WorldClockStrip.tsx).
export const KL_OFFSET = '+08:00';

// Input <input type="datetime-local"> pulangkan '2026-08-05T09:00' (tiada zon waktu — dianggap
// waktu TEMPATAN pelayar). Kita tafsir nilai tu sebagai waktu Malaysia secara eksplisit (bukan
// waktu tempatan peranti, yang mungkin bukan Malaysia) supaya simpanan konsisten tak kira di mana
// editor log masuk.
export const klLocalToIso = (localDatetimeStr) => {
  if (!localDatetimeStr) return null;
  // Sokong dengan/tanpa saat.
  const withSeconds = localDatetimeStr.length === 16 ? `${localDatetimeStr}:00` : localDatetimeStr;
  return `${withSeconds}${KL_OFFSET}`;
};

// Untuk paparan input datetime-local semula (perlu format '2026-08-05T09:00', waktu Malaysia).
export const isoToKlLocalInput = (isoTimestamp) => {
  if (!isoTimestamp) return '';
  const d = new Date(isoTimestamp);
  if (isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuala_Lumpur', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find(p => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
};

// Label Melayu untuk paparan "Dijadualkan terbit: 5 Ogos 2026, 9:00 PG" dsb.
export const formatKlDisplay = (isoTimestamp) => {
  if (!isoTimestamp) return '';
  const d = new Date(isoTimestamp);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ms-MY', {
    timeZone: 'Asia/Kuala_Lumpur', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// Adakah cap masa berjadual ni sudah sampai (<=  sekarang)? nowMs boleh disuntik untuk ujian.
export const isDue = (isoTimestamp, nowMs = Date.now()) => {
  if (!isoTimestamp) return false;
  const t = new Date(isoTimestamp).getTime();
  return !isNaN(t) && t <= nowMs;
};

// Status yang dikira "masih/bakal hidup" dalam slot — kandungan approved (aktif), pending
// (menunggu kelulusan) atau scheduled (bakal terbit) semuanya boleh mengambil alih slot bila item
// lain luput. archived/rejected tidak dikira (dah keluar giliran).
const STATUS_MASIH_HIDUP = ['approved', 'pending', 'scheduled'];

// Keputusan #1 Izzat: sebelum benarkan tarikh luput ditetapkan pada satu-satunya kandungan hidup
// dalam slot, MESTI ada sekurang-kurangnya SATU item LAIN (bukan item ni sendiri) dalam slot yang
// sama yang masih/bakal hidup — jika tidak, slot akan kosong secara tak sengaja bila luput berlaku.
// `otherStatuses` ialah status (lajur editorial_revisions.status) bagi SEMUA item lain dalam slot
// yang sama, TIDAK termasuk item yang sedang dijadualkan luput ni sendiri.
export const hasReplacementForExpiry = (otherStatuses) => {
  return (otherStatuses || []).some((s) => STATUS_MASIH_HIDUP.includes(s));
};

// Status berkesan bagi PATCH kandungan bila medan jadual terbit turut dihantar (pepijat sebenar
// disahkan simulasi UX #36.2, 2026-08-12). Dua arah mesti simetri:
//   SET:   tiada status eksplisit + scheduledPublishAt baharu (bukan kosong) -> 'scheduled'.
//   BATAL: tiada status eksplisit + scheduledPublishAt dikosongkan + rekod SEDANG 'scheduled'
//          -> 'approved'.
// Sebelum tambahan cabang BATAL, arah tu jatuh ke `status` (undefined kalau client tak hantar),
// jadi rekod warisi currentStatus LAMA ('scheduled') — anak yatim status='scheduled' +
// scheduledPublishAt=null yang tak pernah disemak semula oleh runSchedulingTick (hanya proses
// baris yg ADA scheduledPublishAt), sebabkan kandungan hilang drpd pembaca selama-lamanya sehingga
// editor perasan & guna Tindakan->Siar secara manual.
// Status eksplisit yang client hantar (cth 'draft', atau 'approved' semasa padam jadual serentak)
// SENTIASA dihormati tanpa syarat — dua cabang automatik di bawah hanya bertindak bila client
// TIDAK hantar status langsung.
export const resolveEffectiveStatus = ({ scheduledPublishAt, status, currentStatus }) => {
  if (scheduledPublishAt !== undefined && scheduledPublishAt && status === undefined) {
    return 'scheduled';
  }
  if (
    scheduledPublishAt !== undefined &&
    !scheduledPublishAt &&
    status === undefined &&
    currentStatus === 'scheduled'
  ) {
    return 'approved';
  }
  return status;
};

export default {
  KL_OFFSET, klLocalToIso, isoToKlLocalInput, formatKlDisplay, isDue, hasReplacementForExpiry,
  resolveEffectiveStatus,
};
