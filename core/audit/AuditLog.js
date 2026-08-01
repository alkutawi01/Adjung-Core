// Log Audit (2026-08-02, Fasa 4) — dahulu SIFAR jejak langsung: tiada jadual, tiada tulisan,
// `logs: []` berkod keras di dbStateRoutes.js. Satu fungsi kongsi supaya setiap laluan yang
// mengubah data penting (terbit/tolak/arkib kandungan, urus akaun, Bidang, dsb.) mencatat SATU
// baris konsisten — bukan setiap laluan reka format sendiri.
export async function logAudit(dbRun, { actorId, actorName, action, targetType, targetId, detail }) {
  try {
    await dbRun(
      `INSERT INTO audit_log (actorId, actorName, action, targetType, targetId, detail, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [actorId || null, actorName || null, action, targetType || null, targetId || null, detail || null, new Date().toISOString()]
    );
  } catch (err) {
    // Kegagalan menulis log TIDAK BOLEH menggagalkan tindakan sebenar (terbit/tolak/dsb.) —
    // log audit ialah rekod sampingan, bukan bahagian kritikal alur kerja.
    console.error('Gagal menulis log audit:', err.message);
  }
}

export default logAudit;
