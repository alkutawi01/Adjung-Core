import express from 'express';
import CategoryRegistry from '../category/CategoryRegistry.js';
import { parseRssXml, filterByLanguage, deduplicateRssItems } from '../sources/RssDirectEngine.js';
import { calculateEditorialScore, tentukanKeputusanSkor } from '../sources/EditorialScoreEngine.js';
import { processTextWithTrace, normalizeEditorialText } from '../sources/EditorialTextNormalizer.js';
import { calculateDeskScores, classifyDesk } from '../sources/DeskClassifier.js';
import { parseTypographyTokens } from '../sources/TypographyRulesEngine.js';
import { requirePermission } from '../middleware/auth.js';
import { gantiBlokModTicker } from './contentRoutes.js';
import { denganKunciTicker } from '../utils/kunciKandungan.js';
import { logAudit } from '../audit/AuditLog.js';
import { notifyMany } from '../notifications/Notify.js';
import { sahkanUrlSelamatUntukFetch } from '../utils/urlSafety.js';

// Notifikasi Sistem (Fasa 6b) — RSS/cuaca gagal ditujukan kepada Pentadbir/Ketua Editor sahaja
// (mereka yang boleh bertindak ke atas kegagalan infrastruktur, bukan setiap editor biasa).
// dbGet opsyenal (2026-08-16, "notification hygiene") — diteruskan ke notifyMany()/notify() untuk
// sokong `kumpul` (kegagalan berulang sumber SAMA kemaskini SATU baris, bukan banjir baris baharu).
async function beritahuPentadbirDanKetuaEditor(dbAll, dbRun, payload, dbGet) {
  const rows = await dbAll("SELECT DISTINCT userId FROM user_roles WHERE roleId IN ('pentadbir', 'ketua_editor')");
  await notifyMany(dbRun, (rows || []).map((r) => r.userId), payload, dbGet);
}

// nilaiSemulaKeputusanSediaAda() (2026-08-20, laporan Izzat "GAGAL" — tetapan Editorial RSS
// dinaikkan/diturunkan di Editorium tapi kiraan Auto Aktif/Menunggu Semakan langsung TAK
// berubah) — PUNCA: `rssGuid` bertanda UNIQUE (server.js), jadi setiap INSERT item RSS guna
// `INSERT OR IGNORE` (baris ~992/1032 fail ni) — sebaik SATU item pernah discan & disimpan
// dengan SATU keputusan (cth TITLE_TOO_SHORT bawah had lama), ia tak PERNAH discan/dinilai
// semula walau tetapan berubah, sebab rssGuid yg sama menghalang INSERT baharu. Backlog lama
// (ratusan/ribuan item) terperangkap keputusan LAMA selama-lamanya — bukan "tunggu larian
// akan datang", ia takkan berubah LANGSUNG sampai bila-bila.
//
// Nilai semula SEMUA baris yang keputusannya berasaskan skor/panjang tajuk/kata kunci disekat
// (BUKAN BLOCKED_CATEGORY — sekatan tag XML mentah tak berkaitan ambang editorial, kekal tak
// disentuh) guna tentukanKeputusanSkor() (EditorialScoreEngine.js) dengan tetapan TERKINI.
// Dipanggil di DUA tempat: (a) POST /rss-settings — kesan nampak SERTA-MERTA bila Ketua
// Editor/Pentadbir simpan tetapan; (b) setiap larian executeDirectRssFetch() (jadual 3 jam +
// "Serap RSS Sekarang") — sistem terus "automatik" (keperluan Izzat 2026-08-20: "tanpa perlu
// saya buat apa2") walau tetapan tak disentuh langsung pada hari tu, cth selepas restart
// pelayan atau perubahan tetapan yg tertinggal sebelum backlog sempat dinilai semula.
//
// KATA KUNCI DISEKAT DISEMAK DI SINI, bukan dalam blok purge berasingan (2026-08-20, pembetulan
// susulan audit — bug SEBENAR dalam versi pertama fungsi ni beberapa jam sebelumnya): versi lama
// hantar `containsSensational = false` TEGAR, jadi ia tak tahu apa-apa tentang kata kunci. Blok
// "Retroactive Purge kata kunci" dalam POST /rss-settings pula cuma set `status='rejected'`
// TANPA menyentuh `decision` — jadi baris yang baru sahaja disekat kekal `decision='AUTO_LIVE'`,
// tertangkap semula oleh SELECT di bawah, dinilai semula dengan skor LAMA yang belum dipenalti,
// dan DIHIDUPKAN SEMULA jadi 'approved' — membatalkan sekatan Ketua Editor dalam permintaan HTTP
// yang SAMA. Sekatan kata kunci ialah DASAR EDITORIAL Izzat, bukan cadangan; ia mesti jadi kata
// putus, jadi semakannya disatukan ke dalam SATU fungsi ni (bukan dua tempat yang boleh
// berlawan) dan sentiasa menang atas skor.
//
// PEMULIHAN BILA KATA KUNCI DIBUANG (2026-08-20, permintaan Izzat "baiki semua"): item yang
// pernah disekat mempunyai `score` tersimpan 0 (skor dipaksa 0 semasa sekatan), jadi menilai
// semula daripada skor tersimpan sahaja akan mengekalkannya disekat SELAMANYA walaupun Ketua
// Editor sudah membuang kata kunci itu. Baris sebegitu — dan HANYA baris sebegitu — dikira
// semula skornya daripada medan tersimpan (tajuk/huraian/tag + skor amanah sumber).
//
// SENGAJA SEMPIT, bukan kerana malas: mengira semula skor SEMUA ~2,900 baris setiap kitaran
// berisiko MENURUNKAN berita yang sedang hidup, kerana skor asal dikira daripada huraian RSS
// MENTAH manakala yang tersimpan ialah huraian yang sudah dibersihkan dan dipotong 220 aksara —
// kata kunci keutamaan yang berada di hujung huraian panjang akan hilang, bonusnya tergugur, dan
// berita sah jatuh di bawah ambang. Kes pemulihan tidak menanggung risiko itu: skor 0 memang
// sudah tidak bermakna, jadi apa-apa kiraan semula adalah peningkatan.
async function nilaiSemulaKeputusanSediaAda(dbAll, dbRun, editorialSettings) {
  const senaraiDisekat = (editorialSettings.blockedKeywords || '')
    .split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);

  // Peta sumber (skor amanah + pemetaan kategori) untuk kiraan semula skor kes pemulihan.
  // Sumber yang sudah dibuang daripada pendaftaran jatuh ke lalai calculateEditorialScore().
  const barisSumber = await dbAll("SELECT sourceName, trustScore, categoryMapping FROM rss_sources_registry");
  const petaSumber = new Map((barisSumber || []).map((s) => [s.sourceName, s]));

  const items = await dbAll(
    "SELECT id, score, title, formattedBrief, rawCategory, source, decision, status FROM rss_ticker_items WHERE decision IN ('AUTO_LIVE', 'EDITOR_REVIEW', 'REJECT', 'TITLE_TOO_SHORT', 'BLOCKED_KEYWORD')"
  );

  // Kumpul dahulu, tulis kemudian — hanya baris yang keputusannya BENAR-BENAR berubah ditulis.
  // Tanpa tapisan ni, setiap larian (setiap 3 jam) menulis semula ~2,900 baris walaupun tiada
  // apa-apa berubah, di dalam kunci ticker, memblok laluan lain tanpa sebab.
  const perubahan = [];
  for (const item of items) {
    const teks = `${item.title || ''} ${item.formattedBrief || ''}`.toLowerCase();
    const adaKataDisekat = senaraiDisekat.some((kw) => teks.includes(kw));

    let skorSemasa = item.score;
    let skorBaharu = null;

    // Kes pemulihan: pernah disekat kata kunci, kini tidak lagi sepadan (Ketua Editor sudah
    // membuang kata kunci itu). Skor 0 yang terbenam dikira semula supaya berita boleh kembali
    // dinilai atas merit sebenarnya, bukan terkubur kekal. Lihat nota skop di atas fungsi.
    if (item.decision === 'BLOCKED_KEYWORD' && !adaKataDisekat) {
      const sumber = petaSumber.get(item.source) || {};
      const dikira = calculateEditorialScore(
        { title: item.title, description: item.formattedBrief, category: item.rawCategory },
        sumber,
        editorialSettings
      );
      skorSemasa = dikira.score;
      skorBaharu = dikira.score;
    }

    const { decision, status } = tentukanKeputusanSkor(
      skorSemasa, adaKataDisekat, (item.title || '').length, editorialSettings
    );
    if (decision !== item.decision || status !== item.status || skorBaharu !== null) {
      perubahan.push({ id: item.id, decision, status, skor: skorBaharu });
    }
  }

  if (perubahan.length === 0) return 0;

  // Transaksi atomik (corak sama contentRoutes.js/glosariRoutes.js, CLAUDE.md) — ribuan UPDATE
  // berasingan bermakna ribuan fsync SQLite; dalam satu transaksi ia jadi satu sahaja.
  await dbRun('BEGIN TRANSACTION');
  try {
    for (const p of perubahan) {
      if (p.skor !== null) {
        // Kes pemulihan sahaja — skor turut ditulis semula. Baris lain skornya TIDAK disentuh.
        await dbRun("UPDATE rss_ticker_items SET decision = ?, status = ?, score = ? WHERE id = ?", [p.decision, p.status, p.skor, p.id]);
      } else {
        await dbRun("UPDATE rss_ticker_items SET decision = ?, status = ? WHERE id = ?", [p.decision, p.status, p.id]);
      }
    }
    await dbRun('COMMIT');
  } catch (err) {
    await dbRun('ROLLBACK');
    throw err;
  }
  return perubahan.length;
}

// janaSemulaTickerRssDirect() — SATU tapak penjanaan semula rentetan ticker mod 'RSS Direct'
// (2026-08-20). Logik ni dahulu disalin DUA tempat (POST /rss-settings + executeDirectRssFetch)
// dan sudah pun MENYIMPANG antara satu sama lain: satu salinan guna fallback huraian
// `formattedBrief || description || ''`, satu lagi `formattedBrief || title` — dan lajur
// `description` LANGSUNG tiada dalam skema rss_ticker_items, jadi salinan pertama sebenarnya
// menghasilkan huraian KOSONG di tempat salinan kedua menghasilkan tajuk. Corak salinan-berbilang
// ni yang CLAUDE.md rekod sebagai punca pepijat paling kerap dalam projek ni (5 salinan had
// aksara, 2 daripadanya pepijat sebenar). Disatukan: fallback `|| item.title` dikekalkan kerana
// itulah laluan yang benar-benar berjalan setiap 3 jam dan menghasilkan ticker hidup sekarang.
//
// KONTRAK KUNCI — PEMANGGIL MESTI SUDAH MEMEGANG denganKunciTicker. Fungsi ni SENGAJA tidak
// mengunci sendiri: `denganKunciTicker` (kunciKandungan.js) ialah rantaian janji dan BUKAN
// re-entrant, jadi mengunci di dalam sini akan MEMBUNTUKAN (deadlock) pemanggil yang sudah
// terkunci — POST /rss-settings membalut SELURUH pengendalinya dengan kunci itu, jadi kunci
// bersarang di sini menggantung permintaan itu selama-lamanya. Pemanggil tak terkunci
// (cth /ticker/review-action) mesti membalut panggilan ini sendiri.
async function janaSemulaTickerRssDirect(dbAll, dbGet, dbRun) {
  const tetapan = await dbGet("SELECT tickerMaxItems FROM rss_editorial_settings WHERE id = 'main'");
  const hadItem = tetapan && tetapan.tickerMaxItems ? Number(tetapan.tickerMaxItems) : 20;

  const diluluskan = await dbAll(
    "SELECT * FROM rss_ticker_items WHERE status = 'approved' ORDER BY score DESC, publishedAt DESC LIMIT ?",
    [hadItem]
  );
  const blok = diluluskan.map((item) => {
    const kategoriPapar = (item.category === 'BELUM DIKELASKAN' || !item.category) ? 'SEMASA' : item.category;
    return {
      desk: kategoriPapar,
      title: item.title,
      brief: item.formattedBrief || item.title,
      source: item.source,
      url: item.originalUrl,
      mode: 'RSS Direct',
    };
  });

  const semasa = await dbGet("SELECT inTheNewsText FROM system_settings WHERE id = 'settings-main'");
  const teksBaharu = gantiBlokModTicker(semasa ? semasa.inTheNewsText : '', 'RSS Direct', blok);
  await dbRun("UPDATE system_settings SET inTheNewsText = ? WHERE id = 'settings-main'", [teksBaharu]);

  return blok.length;
}

// NOTE: this router used to also define GET/POST /slots and POST /slots/run-now, plus a whole
// "Slot Governance" section (SlotGovernanceService + 4 routes at /api/slot-governance*,
// /api/slot-ownerships). All of that was dead code: server.js registers its own (more complete,
// e.g. it actually clamps to the real geometry ceiling and updates activeObjectId) handlers for
// the same paths earlier in the file, so Express never reached any of these. The governance
// section was additionally backed entirely by mock data (a fake in-memory DB stub, hardcoded
// "Chief Editor Izzat" as every mandate owner) with zero real frontend callers. Removed rather
// than fixed — see core/db/legacy_slot_mapping.js removal in the same change.
export function createSlotRoutes(dbAll, dbRun, dbGet) {
  const router = express.Router();

  // GET /api/system/rss-sources — requirePermission (2026-08-08, dapatan audit keselamatan
  // ChatGPT) — dahulu tiada gerbang, walhal POST/DELETE bersebelahan dah dikunci manageEditorial.
  // Dedah URL RSS/skor amanah sumber dalaman kepada sesiapa. Sifar pengguna awam disahkan.
  router.get('/rss-sources', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const sources = await dbAll("SELECT * FROM rss_sources_registry ORDER BY createdAt DESC");
      res.json(sources);
    } catch (err) {
      console.error('Fetch RSS sources error:', err);
      res.status(500).json({ error: 'Gagal membaca sumber RSS.' });
    }
  });

  // POST /api/system/rss-sources
  router.post('/rss-sources', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id, sourceName, rssUrl, language, trustScore, edition, categoryMapping, enabled } = req.body;
      // Sekatan SSRF (2026-08-08, audit keselamatan) — tolak awal-awal semasa daftar, bukan
      // senyap gagal semasa fetch, supaya editor nampak sebab ditolak.
      const semakan = await sahkanUrlSelamatUntukFetch(rssUrl);
      if (!semakan.selamat) {
        return res.status(400).json({ error: `URL RSS tidak sah: ${semakan.sebab}` });
      }
      // Sahkan julat trustScore + normalkan enabled (2026-08-08, dapatan audit keselamatan
      // ChatGPT) — dahulu `trustScore || 80` terima apa-apa nilai (negatif, >100, perpuluhan,
      // rentetan bukan nombor jatuh ke NaN yang SQLite terima senyap); `enabled !== undefined ?
      // enabled : 1` terima apa-apa jenis (rentetan "false" ialah truthy dlm JS).
      const trustScoreNum = trustScore !== undefined && trustScore !== null && trustScore !== ''
        ? Number(trustScore) : 80;
      if (!Number.isFinite(trustScoreNum) || trustScoreNum < 0 || trustScoreNum > 100) {
        return res.status(400).json({ error: 'Skor amanah mesti nombor antara 0 hingga 100.' });
      }
      const enabledVal = (enabled === false || enabled === 0 || enabled === '0' || enabled === 'false') ? 0 : 1;
      const sourceId = id || `rss-${Date.now()}`;
      await dbRun(`
        INSERT OR REPLACE INTO rss_sources_registry (id, sourceName, rssUrl, language, trustScore, edition, categoryMapping, enabled, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [sourceId, sourceName, rssUrl, language || 'ms-MY', Math.round(trustScoreNum), edition || 'Malaysia', categoryMapping || 'BERITA', enabledVal, new Date().toISOString()]);
      res.json({ success: true, id: sourceId });
    } catch (err) {
      console.error('Save RSS source error:', err);
      res.status(500).json({ error: 'Gagal menyimpan sumber RSS.' });
    }
  });

  // DELETE /api/system/rss-sources/:id
  router.delete('/rss-sources/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const h = await dbRun("DELETE FROM rss_sources_registry WHERE id = ?", [id]);
      if (!h || h.changes === 0) return res.status(404).json({ error: 'Sumber RSS tidak dijumpai.' });
      res.json({ success: true, id });
    } catch (err) {
      console.error('Delete RSS source error:', err);
      res.status(500).json({ error: 'Gagal memadam sumber RSS.' });
    }
  });

  // GET /api/system/ticker/review-queue — requirePermission (2026-08-08, dapatan audit
  // keselamatan ChatGPT) — dahulu TIADA gerbang langsung, walhal laluan tindakan bersebelahan
  // (review-action) memang dikunci manageEditorial. Baca giliran semakan RSS (skor/pecahan
  // Bidang/keputusan dalaman) sepatutnya sama terhad macam tindakan ke atasnya.
  router.get('/ticker/review-queue', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const items = await dbAll("SELECT * FROM rss_ticker_items WHERE status = 'pending' ORDER BY publishedAt DESC LIMIT 50");
      res.json(items);
    } catch (err) {
      console.error('Fetch review queue error:', err);
      res.status(500).json({ error: 'Gagal membaca giliran semakan.' });
    }
  });

  // GET /api/system/ticker/status
  // requirePermission (2026-08-08, dapatan audit keselamatan ChatGPT) — sama sebab macam
  // /rss-sources di atas.
  router.get('/ticker/status', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const activeSourcesRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_sources_registry WHERE enabled = 1");
      const autoLiveRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items WHERE status = 'approved'");
      const pendingReviewRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items WHERE status = 'pending'");
      const totalFetchedRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items");

      res.json({
        success: true,
        activeSourcesCount: activeSourcesRow ? activeSourcesRow.cnt : 0,
        totalFetchedCount: totalFetchedRow ? totalFetchedRow.cnt : 0,
        autoLiveCount: autoLiveRow ? autoLiveRow.cnt : 0,
        pendingReviewCount: pendingReviewRow ? pendingReviewRow.cnt : 0
      });
    } catch (err) {
      console.error('Fetch ticker status error:', err);
      res.status(500).json({ error: 'Gagal membaca status Ticker.' });
    }
  });

  // POST /api/system/ticker/review-action
  router.post('/ticker/review-action', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { itemId, action } = req.body; // action: 'approve' | 'reject'
      if (!itemId || !action) return res.status(400).json({ error: 'itemId atau tindakan tiada.' });
      // Senarai terkawal, bukan andaian "bukan approve = reject" (2026-08-08, dapatan audit
      // keselamatan ChatGPT) — dahulu apa-apa nilai action selain 'approve' (taip silap, medan
      // rosak, "undefined" literal) senyap jadi 'rejected'. Tindakan destruktif kandungan editorial
      // tak patut tercetus oleh input yang tidak sah/tak dikenali.
      if (action !== 'approve' && action !== 'reject') {
        return res.status(400).json({ error: `Tindakan tidak sah: "${action}". Guna 'approve' atau 'reject'.` });
      }
      const newStatus = action === 'approve' ? 'approved' : 'rejected';
      const h = await dbRun("UPDATE rss_ticker_items SET status = ? WHERE id = ?", [newStatus, itemId]);
      if (!h || h.changes === 0) return res.status(404).json({ error: 'Item Ticker tidak dijumpai.' });

      // Jana semula ticker SERTA-MERTA (2026-08-20, dapatan audit) — dahulu laluan ni cuma
      // menukar `status` dalam DB dan berhenti di situ. Editor yang meluluskan berita dalam
      // Review Queue nampak ia bertukar "Lulus" di skrin, tetapi berita itu TIDAK muncul di
      // ticker awam sehingga kitaran serapan berikutnya — sampai 3 JAM kemudian. Menolak pula
      // lebih teruk: berita yang ditolak KEKAL terpapar kepada pembaca sepanjang tempoh itu.
      // Kelulusan editor mesti berkuat kuasa apabila ia dibuat, bukan apabila jadual mengizinkan.
      // Laluan ni TIDAK terkunci, jadi ia mengunci sendiri (lihat kontrak kunci di fungsi tu).
      await denganKunciTicker(() => janaSemulaTickerRssDirect(dbAll, dbGet, dbRun));

      res.json({ success: true, itemId, status: newStatus });
    } catch (err) {
      console.error('Review action error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini status item.' });
    }
  });

  // GET /api/system/rss-settings
  // requirePermission (2026-08-08, dapatan audit keselamatan ChatGPT) — dedah formula operasi
  // editorial (ambang skor, kata kunci diutamakan/disekat) kepada sesiapa.
  router.get('/rss-settings', requirePermission('manageEditorial'), async (req, res) => {
    try {
      let settings = await dbGet("SELECT * FROM rss_editorial_settings WHERE id = 'main'");
      if (!settings) {
        settings = {
          id: 'main',
          autoLiveThreshold: 80,
          reviewThreshold: 60,
          priorityKeywords: 'dasar, belanjawan, ekonomi, pendidikan, menteri, kerajaan',
          blockedKeywords: 'gempar, viral, panas, terbongkar',
          priorityBonus: 15,
          blockedPenalty: 40,
          // maxNewsAgeHours/tickerMaxItems (2026-08-16, audit Izzat) — dahulu TERTINGGAL drpd
          // objek fallback ni (CLAUDE.md dah amaran corak ni: "nombor lalai disalin berulang
          // di N tempat" — punca pepijat priorityBonus/blockedPenalty di atas). Tak sengaja
          // pecah setakat ni sebab lalai frontend kebetulan sama (48/20), tapi rapuh, sengaja
          // diselaraskan sekarang.
          maxNewsAgeHours: 48,
          tickerMaxItems: 20,
          tickerTitleMinChars: 0,
          updatedAt: new Date().toISOString()
        };
      }
      res.json(settings);
    } catch (err) {
      console.error('Fetch RSS settings error:', err);
      res.status(500).json({ error: 'Gagal membaca tetapan RSS.' });
    }
  });

  // POST /api/system/rss-settings — denganKunciTicker (2026-08-08, dapatan audit keselamatan
  // ChatGPT) — dahulu baca-ubah-tulis system_settings.inTheNewsText TANPA kunci, sama medan yang
  // executeDirectRssFetch() (tik penjadual RSS + POST /ticker/fetch-direct) turut tulis. Simpan
  // tetapan RSS serentak dgn ambilan RSS auto boleh timpa satu sama lain. Laluan ni tiada
  // panggilan rangkaian (semua dbRun/dbAll/dbGet), jadi selamat bungkus SELURUH pengendali.
  router.post('/rss-settings', requirePermission('manageEditorial'), (req, res) => denganKunciTicker(async () => {
    try {
      const { autoLiveThreshold, reviewThreshold, priorityKeywords, blockedKeywords, priorityBonus, blockedPenalty, maxNewsAgeHours, tickerMaxItems, tickerTitleMinChars } = req.body;
      const updatedAt = new Date().toISOString();

      // Sahkan julat + hubungan ambang (2026-08-08, dapatan audit keselamatan ChatGPT) — dahulu
      // `Number(x) || lalai` terima apa-apa nilai (negatif, >100, NaN jatuh senyap ke lalai TAPI
      // 0 turut jatuh ke lalai — sengaja tak dibenarkan tetapkan 0 langsung), dan reviewThreshold
      // boleh > autoLiveThreshold (klasifikasi editorial jadi bercanggah dgn niat sistem).
      const autoLiveVal = autoLiveThreshold !== undefined ? Number(autoLiveThreshold) : 80;
      const reviewVal = reviewThreshold !== undefined ? Number(reviewThreshold) : 60;
      const bonusVal = priorityBonus !== undefined ? Number(priorityBonus) : 15;
      const penaltyVal = blockedPenalty !== undefined ? Number(blockedPenalty) : 40;
      const ageVal = maxNewsAgeHours !== undefined ? Number(maxNewsAgeHours) : 48;
      const limitVal = tickerMaxItems !== undefined ? Number(tickerMaxItems) : 20;
      // tickerTitleMinChars (2026-08-16, permintaan Izzat) — sepadan konvensyen had minimum
      // sedia ada (slotAmRoutes.js hadHuraianPanjangMin dsb): 0 = tiada had.
      const minCharsVal = tickerTitleMinChars !== undefined ? Number(tickerTitleMinChars) : 0;
      if (![autoLiveVal, reviewVal, bonusVal, penaltyVal, ageVal, limitVal, minCharsVal].every(Number.isFinite)) {
        return res.status(400).json({ error: 'Semua nilai tetapan RSS mesti nombor sah.' });
      }
      if (autoLiveVal < 0 || autoLiveVal > 100 || reviewVal < 0 || reviewVal > 100) {
        return res.status(400).json({ error: 'Ambang auto-live/semakan mesti antara 0 hingga 100.' });
      }
      if (reviewVal > autoLiveVal) {
        return res.status(400).json({ error: 'Ambang semakan tak boleh melebihi ambang auto-live (menyebabkan klasifikasi bercanggah).' });
      }
      if (bonusVal < 0 || penaltyVal < 0) {
        return res.status(400).json({ error: 'Bonus keutamaan dan penalti sekatan tak boleh negatif.' });
      }
      // ageVal < 0 (BUKAN <= 0, 2026-08-16, bug sebenar dijumpai audit Izzat "benar2 berfungsi
      // atau hiasan?") — dropdown UI eksplisit tawarkan pilihan "Tiada Had (Semua Usia Berita)"
      // (value={0}, TickerManagementModal.tsx), dan executeDirectRssFetch() SEDIA ADA sokong 0 =
      // tiada penapis usia (`if (maxAgeHours > 0 && ...)` — 0 sengaja langkau penapis terus).
      // Semakan `<= 0` di sini TOLAK 0 sebagai ralat 400 — pilih "Tiada Had" dan klik Simpan
      // GAGAL SETIAP KALI, dan sebab kesemua 9 medan tetapan disimpan dlm SATU POST gabungan,
      // sebarang perubahan LAIN yg dibuat serentak (kata kunci, ambang, dll.) turut terbuang
      // senyap bersama satu ralat generik.
      if (ageVal < 0) {
        return res.status(400).json({ error: 'Had usia berita tidak boleh negatif.' });
      }
      if (limitVal < 1 || limitVal > 100) {
        return res.status(400).json({ error: 'Bilangan maksimum item Ticker mesti antara 1 hingga 100.' });
      }
      if (minCharsVal < 0 || minCharsVal > 200) {
        return res.status(400).json({ error: 'Had minimum aksara tajuk Ticker mesti antara 0 hingga 200.' });
      }

      await dbRun(`
        INSERT OR REPLACE INTO rss_editorial_settings (
          id, autoLiveThreshold, reviewThreshold, priorityKeywords, blockedKeywords, priorityBonus, blockedPenalty, maxNewsAgeHours, tickerMaxItems, tickerTitleMinChars, updatedAt
        ) VALUES ('main', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        Math.round(autoLiveVal),
        Math.round(reviewVal),
        priorityKeywords || '',
        blockedKeywords || '',
        Math.round(bonusVal),
        Math.round(penaltyVal),
        Math.round(ageVal),
        Math.round(limitVal),
        Math.round(minCharsVal),
        updatedAt
      ]);

      // Nilai semula backlog sedia ada guna tetapan BAHARU (2026-08-20) — lihat komen penuh di
      // nilaiSemulaKeputusanSediaAda() atas fail ni. Fungsi tu SUDAH menyemak kata kunci disekat
      // sekali dengan ambang skor/had aksara tajuk, jadi blok "Retroactive Purge & Filter of newly
      // blocked keywords" yang dahulu berdiri di sini DIBUANG (bukan dipindah): ia menulis
      // `status` sahaja tanpa `decision`, jadi baris yang disekatnya ditangkap semula dan
      // DIHIDUPKAN SEMULA oleh nilai semula ni — dua blok berlawan dalam permintaan yang sama.
      // Satu fungsi, satu kebenaran (CLAUDE.md: logik disalin dua tempat ialah punca pepijat
      // paling kerap dalam projek ni).
      //
      // WAJIB sebelum purge usia di bawah: purge usia MESTI jadi kata putus TERAKHIR tentang
      // kesegaran, bukan nilai semula skor.
      await nilaiSemulaKeputusanSediaAda(dbAll, dbRun, {
        autoLiveThreshold: autoLiveVal,
        reviewThreshold: reviewVal,
        tickerTitleMinChars: minCharsVal,
        blockedKeywords: blockedKeywords || '',
      });

      // Retroactive Purge berdasarkan usia (2026-08-19, laporan Izzat: "kenapa ticker
      // memaparkan yg lama? sedangkan saya dah set had usia berita 24 jam?") — corak SAMA
      // seperti purge kata kunci di atas, sekarang untuk `maxNewsAgeHours`. Tanpa ni, mengetatkan
      // had usia (cth 48 -> 24 jam) hanya beri kesan pada item BAHARU larian akan datang; item
      // lama yang pernah lulus di bawah had lama kekal `approved` sehingga penjanaan semula
      // berikutnya (setiap 3 jam, `executeDirectRssFetch` — semakan berterusan turut ditambah
      // di situ untuk item yang lapuk secara semula jadi selepas ni, bukan hanya bila tetapan
      // ditukar). Simpan tetapan patut nampak kesan SERTA-MERTA, bukan tunggu kitaran seterusnya.
      if (ageVal > 0) {
        // 'pending' turut disemak (2026-08-20, laporan Izzat "kenapa yg lain kena tunggu
        // semakan?" — toast papar 545 Menunggu Semakan, kebanyakannya berita LAPUK terkumpul
        // berminggu): berita yang sudah melepasi had usia tidak patut kekal dalam giliran
        // semakan — menyemaknya sia-sia (dah basi, takkan disiarkan pun), dan longgokan itu
        // menenggelamkan item pending yang benar-benar layak disemak.
        const semuaApprovedUsia = await dbAll("SELECT id, publishedAt FROM rss_ticker_items WHERE status IN ('approved', 'pending')");
        const kiniMs = Date.now();
        for (const item of semuaApprovedUsia) {
          if (!item.publishedAt) continue;
          const masaItem = new Date(item.publishedAt).getTime();
          if (isNaN(masaItem)) continue;
          if ((kiniMs - masaItem) / (1000 * 60 * 60) > ageVal) {
            await dbRun("UPDATE rss_ticker_items SET status = 'rejected' WHERE id = ?", [item.id]);
          }
        }
      }

      // Jana semula rentetan ticker — lihat janaSemulaTickerRssDirect() di atas fail ni (SATU
      // tapak, dikongsi dengan executeDirectRssFetch dan /ticker/review-action). Pengendali ni
      // SUDAH dibalut denganKunciTicker sepenuhnya, jadi ia dipanggil TANPA kunci tambahan —
      // kunci bersarang akan membuntukan permintaan ni (kunci tu bukan re-entrant).
      await janaSemulaTickerRssDirect(dbAll, dbGet, dbRun);

      res.json({ success: true });
    } catch (err) {
      console.error('Save RSS settings error:', err);
      res.status(500).json({ error: 'Gagal menyimpan tetapan RSS.' });
    }
  }));

  // GET /api/system/rss-text-rules
  // requirePermission (2026-08-08, dapatan audit keselamatan ChatGPT) — dedah peraturan
  // transformasi teks editorial dalaman kepada sesiapa.
  router.get('/rss-text-rules', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const rules = await dbAll("SELECT * FROM rss_text_rules ORDER BY orderIndex ASC, createdAt ASC");
      res.json(rules);
    } catch (err) {
      console.error('Fetch RSS text rules error:', err);
      res.status(500).json({ error: 'Gagal membaca peraturan teks RSS.' });
    }
  });

  // POST /api/system/rss-text-rules
  router.post('/rss-text-rules', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { ruleName, ruleType, scope, sourceId, pattern, replacement, enabled, orderIndex } = req.body;
      const id = `rule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = new Date().toISOString();

      await dbRun(`
        INSERT INTO rss_text_rules (
          id, ruleName, ruleType, scope, sourceId, pattern, replacement, enabled, locked, orderIndex, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `, [
        id,
        ruleName || 'Peraturan Baharu',
        ruleType || 'substitute',
        scope || 'brief',
        sourceId || null,
        pattern || '',
        replacement || '',
        enabled !== undefined ? (enabled ? 1 : 0) : 1,
        Number(orderIndex) || 10,
        createdAt
      ]);

      res.json({ success: true, id });
    } catch (err) {
      console.error('Create RSS text rule error:', err);
      res.status(500).json({ error: 'Gagal mencipta peraturan teks RSS.' });
    }
  });

  // PUT /api/system/rss-text-rules/:id
  router.put('/rss-text-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const { ruleName, ruleType, scope, sourceId, pattern, replacement, enabled, orderIndex } = req.body;

      const existing = await dbGet("SELECT * FROM rss_text_rules WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Rule not found' });

      // If rule is locked, only allow reordering or enabling/disabling
      const isLocked = existing.locked === 1;

      await dbRun(`
        UPDATE rss_text_rules SET
          ruleName = ?,
          ruleType = ?,
          scope = ?,
          sourceId = ?,
          pattern = ?,
          replacement = ?,
          enabled = ?,
          orderIndex = ?
        WHERE id = ?
      `, [
        isLocked ? existing.ruleName : (ruleName !== undefined ? ruleName : existing.ruleName),
        isLocked ? existing.ruleType : (ruleType !== undefined ? ruleType : existing.ruleType),
        scope !== undefined ? scope : existing.scope,
        sourceId !== undefined ? sourceId : existing.sourceId,
        isLocked ? existing.pattern : (pattern !== undefined ? pattern : existing.pattern),
        isLocked ? existing.replacement : (replacement !== undefined ? replacement : existing.replacement),
        enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        orderIndex !== undefined ? Number(orderIndex) : existing.orderIndex,
        id
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error('Update RSS text rule error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini peraturan teks RSS.' });
    }
  });

  // DELETE /api/system/rss-text-rules/:id
  router.delete('/rss-text-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await dbGet("SELECT * FROM rss_text_rules WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Rule not found' });
      if (existing.locked === 1) {
        return res.status(400).json({ error: 'Peraturan asas (System Rule) tidak boleh dipadam.' });
      }

      await dbRun("DELETE FROM rss_text_rules WHERE id = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete RSS text rule error:', err);
      res.status(500).json({ error: 'Gagal memadam peraturan teks RSS.' });
    }
  });

  // POST /api/system/rss-text-rules/test (Transformation Trace Tester!)
  router.post('/rss-text-rules/test', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { testText, scope, sourceId, customRule } = req.body;
      let rules = await dbAll("SELECT * FROM rss_text_rules ORDER BY orderIndex ASC, createdAt ASC");
      
      if (customRule && customRule.ruleType) {
        rules = [...rules, { ...customRule, id: 'custom-temp', enabled: 1, orderIndex: 999 }];
      }

      const testResult = processTextWithTrace(testText || '', scope || 'brief', sourceId || null, rules);
      res.json({ success: true, ...testResult });
    } catch (err) {
      console.error('Test RSS text rules error:', err);
      res.status(500).json({ error: 'Gagal menguji peraturan teks RSS.' });
    }
  });

  // --- ADJUNG DESKS REGISTRY ENDPOINTS ---

  // GET /api/system/adjung-desks
  router.get('/adjung-desks', async (req, res) => {
    try {
      const desks = await dbAll("SELECT * FROM adjung_desks ORDER BY displayOrder ASC, createdAt ASC");
      res.json(desks);
    } catch (err) {
      console.error('Fetch adjung desks error:', err);
      res.status(500).json({ error: 'Gagal membaca senarai Bidang Adjung.' });
    }
  });

  // POST /api/system/adjung-desks
  router.post('/adjung-desks', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { deskName, description, displayOrder } = req.body;
      if (!deskName || !deskName.trim()) {
        return res.status(400).json({ error: 'Sila masukkan Nama Desk.' });
      }
      const id = `desk-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = new Date().toISOString();

      await dbRun(`
        INSERT INTO adjung_desks (id, deskName, description, displayOrder, enabled, locked, createdAt)
        VALUES (?, ?, ?, ?, 1, 0, ?)
      `, [id, deskName.trim(), description || '', Number(displayOrder) || 10, createdAt]);

      res.json({ success: true, id });
    } catch (err) {
      console.error('Create adjung desk error:', err);
      res.status(500).json({ error: err.message.includes('UNIQUE') ? 'Nama Desk ini sudah wujud.' : 'Failed to create Adjung desk.' });
    }
  });

  // PUT /api/system/adjung-desks/:id
  router.put('/adjung-desks/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const { deskName, description, displayOrder, enabled } = req.body;
      const existing = await dbGet("SELECT * FROM adjung_desks WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Desk not found' });

      await dbRun(`
        UPDATE adjung_desks SET
          deskName = ?,
          description = ?,
          displayOrder = ?,
          enabled = ?
        WHERE id = ?
      `, [
        deskName !== undefined ? deskName.trim() : existing.deskName,
        description !== undefined ? description : existing.description,
        displayOrder !== undefined ? Number(displayOrder) : existing.displayOrder,
        enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        id
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error('Update adjung desk error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini Bidang Adjung.' });
    }
  });

  // DELETE /api/system/adjung-desks/:id
  router.delete('/adjung-desks/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await dbGet("SELECT * FROM adjung_desks WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Desk not found' });

      await dbRun("DELETE FROM adjung_desks WHERE id = ?", [id]);
      // Delete associated desk rules
      await dbRun("DELETE FROM rss_desk_rules WHERE deskId = ?", [id]);
      res.json({ success: true });
    } catch (err) {
      console.error('Delete adjung desk error:', err);
      res.status(500).json({ error: 'Gagal memadam Bidang Adjung.' });
    }
  });

  // --- RSS DESK RULES ENDPOINTS ---

  // GET /api/system/rss-desk-rules — requirePermission (dapatan bug-hunt 2026-09-02, sama
  // kelas pepijat/pembetulan seperti /rss-sources dan /rss-settings dalam fail sama, audit
  // 2026-08-08 — dedah formula pengelasan Bidang RSS (kata kunci, pemberat) tak sepatutnya
  // awam, walau POST bersebelahan sudah bergerbang manageEditorial sejak awal.
  router.get('/rss-desk-rules', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const rules = await dbAll("SELECT * FROM rss_desk_rules ORDER BY orderIndex ASC, createdAt ASC");
      res.json(rules);
    } catch (err) {
      console.error('Fetch RSS desk rules error:', err);
      res.status(500).json({ error: 'Gagal membaca peraturan Bidang RSS.' });
    }
  });

  // POST /api/system/rss-desk-rules
  router.post('/rss-desk-rules', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { deskId, keyword, weight, isNegative, enabled, orderIndex } = req.body;
      if (!deskId || !keyword || !keyword.trim()) {
        return res.status(400).json({ error: 'Sila pilih Desk dan masukkan Kata Kunci.' });
      }
      const id = `drule-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = new Date().toISOString();

      await dbRun(`
        INSERT INTO rss_desk_rules (id, deskId, keyword, weight, isNegative, enabled, orderIndex, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        id,
        deskId,
        keyword.trim(),
        Number(weight) || 15,
        isNegative ? 1 : 0,
        enabled !== undefined ? (enabled ? 1 : 0) : 1,
        Number(orderIndex) || 10,
        createdAt
      ]);

      res.json({ success: true, id });
    } catch (err) {
      console.error('Create RSS desk rule error:', err);
      res.status(500).json({ error: 'Gagal mencipta peraturan Bidang RSS.' });
    }
  });

  // PUT /api/system/rss-desk-rules/:id
  router.put('/rss-desk-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const { deskId, keyword, weight, isNegative, enabled, orderIndex } = req.body;
      const existing = await dbGet("SELECT * FROM rss_desk_rules WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Desk rule not found' });

      await dbRun(`
        UPDATE rss_desk_rules SET
          deskId = ?,
          keyword = ?,
          weight = ?,
          isNegative = ?,
          enabled = ?,
          orderIndex = ?
        WHERE id = ?
      `, [
        deskId !== undefined ? deskId : existing.deskId,
        keyword !== undefined ? keyword.trim() : existing.keyword,
        weight !== undefined ? Number(weight) : existing.weight,
        isNegative !== undefined ? (isNegative ? 1 : 0) : existing.isNegative,
        enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        orderIndex !== undefined ? Number(orderIndex) : existing.orderIndex,
        id
      ]);

      res.json({ success: true });
    } catch (err) {
      console.error('Update RSS desk rule error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini peraturan Bidang RSS.' });
    }
  });

  // DELETE /api/system/rss-desk-rules/:id
  router.delete('/rss-desk-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const h = await dbRun("DELETE FROM rss_desk_rules WHERE id = ?", [id]);
      if (!h || h.changes === 0) return res.status(404).json({ error: 'Peraturan Bidang RSS tidak dijumpai.' });
      res.json({ success: true });
    } catch (err) {
      console.error('Delete RSS desk rule error:', err);
      res.status(500).json({ error: 'Gagal memadam peraturan Bidang RSS.' });
    }
  });

  // POST /api/system/rss-desk-rules/test (Desk Classifier Live Tester!)
  router.post('/rss-desk-rules/test', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { testTitle, testBrief, testCategory } = req.body;
      const desks = await dbAll("SELECT * FROM adjung_desks WHERE enabled = 1 ORDER BY displayOrder ASC");
      const rules = await dbAll("SELECT * FROM rss_desk_rules WHERE enabled = 1 ORDER BY orderIndex ASC");

      const combinedText = `${testTitle || ''} ${testBrief || ''}`;
      const classificationResult = calculateDeskScores(combinedText, testCategory || '', rules, desks);
      res.json({ success: true, ...classificationResult });
    } catch (err) {
      console.error('Test RSS desk rules error:', err);
      res.status(500).json({ error: 'Gagal menguji peraturan Bidang RSS.' });
    }
  });

  // PUT /api/system/ticker/override-desk/:id (Manual Editor Override with Passive Editorial Memory)
  router.put('/ticker/override-desk/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const { newDesk } = req.body;
      if (!newDesk || !newDesk.trim()) {
        return res.status(400).json({ error: 'Sila pilih Desk baharu.' });
      }

      const item = await dbGet("SELECT * FROM rss_ticker_items WHERE id = ?", [id]);
      if (item) {
        // Extract 2-3 key words from title for memory suggestion
        const titleWords = (item.title || '')
          .replace(/[^\w\s]/gi, '')
          .split(/\s+/)
          .filter(w => w.length > 4)
          .slice(0, 2)
          .join(' ')
          .toLowerCase();

        if (titleWords) {
          const memId = `mem-${Date.now()}`;
          const now = new Date().toISOString();
          await dbRun(`
            INSERT INTO rss_editorial_memory (id, rssItemId, phraseExtracted, suggestedDesk, occurrenceCount, status, createdAt)
            VALUES (?, ?, ?, ?, 1, 'pending', ?)
          `, [memId, id, titleWords, newDesk.trim(), now]);
        }
      }

      const h = await dbRun("UPDATE rss_ticker_items SET category = ? WHERE id = ?", [newDesk.trim(), id]);
      if (!h || h.changes === 0) return res.status(404).json({ error: 'Item Ticker tidak dijumpai.' });
      res.json({ success: true });
    } catch (err) {
      console.error('Override ticker desk error:', err);
      res.status(500).json({ error: 'Gagal menukar Bidang item Ticker.' });
    }
  });

  // GET /api/system/editorial-memory — sama kelas pepijat seperti aiRoutes.js/aiCostRoutes.js
  // (dapatan bug-hunt 2026-09-01): tiada gerbang kebenaran, walhal laluan bersebelahan
  // (POST /editorial-memory/promote) sudah digerbang manageEditorial. Data ni cadangan RSS
  // belum disemak ("status='pending'") — bukan untuk paparan awam sebelum Ketua Editor luluskan.
  router.get('/editorial-memory', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const memories = await dbAll("SELECT * FROM rss_editorial_memory WHERE status = 'pending' ORDER BY createdAt DESC LIMIT 20");
      res.json(memories);
    } catch (err) {
      console.error('Fetch editorial memory error:', err);
      res.status(500).json({ error: 'Gagal membaca memori editorial.' });
    }
  });

  // POST /api/system/editorial-memory/promote
  router.post('/editorial-memory/promote', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { memoryId, deskName, phrase } = req.body;
      if (!memoryId || !deskName || !phrase) {
        return res.status(400).json({ error: 'Sila lengkapkan maklumat memori.' });
      }

      const desk = await dbGet("SELECT * FROM adjung_desks WHERE deskName = ?", [deskName]);
      if (!desk) {
        return res.status(400).json({ error: 'Desk tidak wujud.' });
      }

      const ruleId = `rule-mem-${Date.now()}`;
      const now = new Date().toISOString();

      await dbRun(`
        INSERT INTO rss_desk_rules (id, deskId, keyword, weight, isNegative, enabled, orderIndex, createdAt)
        VALUES (?, ?, ?, 40, 0, 1, 10, ?)
      `, [ruleId, desk.id, phrase.trim().toLowerCase(), now]);

      const h = await dbRun("UPDATE rss_editorial_memory SET status = 'promoted' WHERE id = ?", [memoryId]);
      if (!h || h.changes === 0) return res.status(404).json({ error: 'Cadangan memori tidak dijumpai.' });

      res.json({ success: true, ruleId });
    } catch (err) {
      console.error('Promote memory error:', err);
      res.status(500).json({ error: 'Gagal menaikkan cadangan memori.' });
    }
  });

  // GET /api/system/rss-blocked-categories — requirePermission (2026-08-16, audit Izzat "benar2
  // berfungsi atau hiasan?" dedah gerbang tertinggal) — SETIAP laluan RSS lain di fail ni
  // (/rss-sources, /ticker/review-queue, /ticker/status, /rss-settings, /rss-text-rules) dah
  // dikukuhkan requirePermission('manageEditorial') dlm audit keselamatan 2026-08-08, laluan ni
  // sengaja TERLEPAS drpd pusingan tu — dedah senarai kategori disekat editorial kepada sesiapa
  // tanpa log masuk. POST/DELETE bersebelahan SUDAH dikunci; GET patut sama.
  router.get('/rss-blocked-categories', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const categories = await dbAll("SELECT * FROM rss_blocked_categories ORDER BY createdAt DESC");
      res.json(categories);
    } catch (err) {
      console.error('Fetch blocked categories error:', err);
      res.status(500).json({ error: 'Gagal membaca kategori disekat.' });
    }
  });

  // POST /api/system/rss-blocked-categories
  router.post('/rss-blocked-categories', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { categoryName } = req.body;
      if (!categoryName || !categoryName.trim()) {
        return res.status(400).json({ error: 'Sila masukkan nama Kategori.' });
      }

      const id = `blk-${Date.now()}`;
      const now = new Date().toISOString();
      await dbRun(`
        INSERT INTO rss_blocked_categories (id, categoryName, enabled, createdAt)
        VALUES (?, ?, 1, ?)
      `, [id, categoryName.trim(), now]);

      res.json({ success: true, id });
    } catch (err) {
      console.error('Add blocked category error:', err);
      res.status(500).json({ error: 'Gagal menambah kategori disekat.' });
    }
  });

  // DELETE /api/system/rss-blocked-categories/:id
  router.delete('/rss-blocked-categories/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const h = await dbRun("DELETE FROM rss_blocked_categories WHERE id = ?", [id]);
      if (!h || h.changes === 0) return res.status(404).json({ error: 'Kategori disekat tidak dijumpai.' });
      res.json({ success: true });
    } catch (err) {
      console.error('Delete blocked category error:', err);
      res.status(500).json({ error: 'Gagal memadam kategori disekat.' });
    }
  });

  // GET /api/system/ticker/blocked-queue (Visual Audit Trail of Blocked News) — requirePermission
  // (dapatan bug-hunt 2026-09-02, sama kelas pepijat berulang dalam fail ni: /rss-sources,
  // /rss-settings, /editorial-memory, /rss-desk-rules kesemuanya dibetulkan pusingan lepas).
  // Laluan audit dalaman moderasi RSS, bukan untuk paparan awam.
  router.get('/ticker/blocked-queue', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const items = await dbAll("SELECT * FROM rss_ticker_items WHERE status = 'blocked_category' ORDER BY createdAt DESC LIMIT 50");
      res.json(items);
    } catch (err) {
      console.error('Fetch blocked queue error:', err);
      res.status(500).json({ error: 'Gagal membaca giliran disekat.' });
    }
  });

  // GET /api/system/adjung-typography-rules
  router.get('/adjung-typography-rules', async (req, res) => {
    try {
      const rules = await dbAll("SELECT * FROM adjung_typography_rules ORDER BY priority DESC, term ASC");
      res.json(rules);
    } catch (err) {
      console.error('Fetch typography rules error:', err);
      res.status(500).json({ error: 'Gagal membaca peraturan tipografi.' });
    }
  });

  // POST /api/system/adjung-typography-rules
  router.post('/adjung-typography-rules', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { term, style, category, matchType, scope, language, caseSensitive, priority, status, excludeTerms } = req.body;
      if (!term || !term.trim()) {
        return res.status(400).json({ error: 'Sila masukkan Istilah.' });
      }

      const id = `typo-${Date.now()}`;
      const now = new Date().toISOString();
      const exclStr = Array.isArray(excludeTerms) ? JSON.stringify(excludeTerms) : (excludeTerms || null);

      await dbRun(`
        INSERT INTO adjung_typography_rules (
          id, term, style, category, matchType, scope, language, caseSensitive, priority, status, enabled, excludeTerms, ruleVersion, createdBy, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'Chief Editor', ?, ?)
      `, [
        id, term.trim(), style || 'italic', category || 'foreign_term',
        matchType || 'word', scope || 'all', language || 'ms-MY',
        caseSensitive ? 1 : 0, Number(priority) || 50,
        status || 'active', (status === 'pending' || status === 'rejected' || status === 'archived') ? 0 : 1,
        exclStr, now, now
      ]);

      res.json({ success: true, id });
    } catch (err) {
      console.error('Create typography rule error:', err);
      res.status(500).json({ error: 'Gagal mencipta peraturan tipografi. Pastikan istilah/bahasa/skop belum didaftarkan.' });
    }
  });

  // PUT /api/system/adjung-typography-rules/:id
  router.put('/adjung-typography-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const { term, style, category, matchType, scope, language, caseSensitive, priority, status, enabled, excludeTerms } = req.body;
      const existing = await dbGet("SELECT * FROM adjung_typography_rules WHERE id = ?", [id]);
      if (!existing) return res.status(404).json({ error: 'Typography rule not found' });

      const now = new Date().toISOString();
      const newVersion = (Number(existing.ruleVersion) || 1) + 1;
      const exclStr = Array.isArray(excludeTerms) ? JSON.stringify(excludeTerms) : (excludeTerms !== undefined ? excludeTerms : existing.excludeTerms);

      await dbRun(`
        UPDATE adjung_typography_rules SET
          term = ?, style = ?, category = ?, matchType = ?, scope = ?, language = ?,
          caseSensitive = ?, priority = ?, status = ?, enabled = ?, excludeTerms = ?,
          ruleVersion = ?, updatedAt = ?
        WHERE id = ?
      `, [
        term !== undefined ? term.trim() : existing.term,
        style !== undefined ? style : existing.style,
        category !== undefined ? category : existing.category,
        matchType !== undefined ? matchType : existing.matchType,
        scope !== undefined ? scope : existing.scope,
        language !== undefined ? language : existing.language,
        caseSensitive !== undefined ? (caseSensitive ? 1 : 0) : existing.caseSensitive,
        priority !== undefined ? Number(priority) : existing.priority,
        status !== undefined ? status : existing.status,
        enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        exclStr,
        newVersion, now, id
      ]);

      res.json({ success: true, id, newVersion });
    } catch (err) {
      console.error('Update typography rule error:', err);
      res.status(500).json({ error: 'Gagal mengemas kini peraturan tipografi.' });
    }
  });

  // DELETE /api/system/adjung-typography-rules/:id
  router.delete('/adjung-typography-rules/:id', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { id } = req.params;
      const h = await dbRun("DELETE FROM adjung_typography_rules WHERE id = ?", [id]);
      if (!h || h.changes === 0) return res.status(404).json({ error: 'Peraturan tipografi tidak dijumpai.' });
      res.json({ success: true });
    } catch (err) {
      console.error('Delete typography rule error:', err);
      res.status(500).json({ error: 'Gagal memadam peraturan tipografi.' });
    }
  });

  // POST /api/system/adjung-typography-rules/preview (Live Typography Sandbox Preview)
  router.post('/adjung-typography-rules/preview', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const { testText, scope, language } = req.body;
      const rules = await dbAll("SELECT * FROM adjung_typography_rules WHERE enabled = 1 AND status = 'active' ORDER BY priority DESC");
      const tokens = parseTypographyTokens(testText || '', rules, scope || 'all', language || 'ms-MY');
      res.json({ success: true, tokens });
    } catch (err) {
      console.error('Preview typography error:', err);
      res.status(500).json({ error: 'Gagal memaparkan pratonton tipografi.' });
    }
  });

  // POST /api/system/ticker/fetch-direct
  router.post('/ticker/fetch-direct', requirePermission('manageEditorial'), async (req, res) => {
    try {
      const result = await executeDirectRssFetch(dbAll, dbGet, dbRun);
      res.json(result);
    } catch (err) {
      console.error('Fetch direct RSS ticker error:', err);
      res.status(500).json({ error: 'Gagal membaca Ticker RSS langsung.' });
    }
  });

  // GET /api/system/editorial-calibration/export-txt (ACEF v1.0)
  router.get('/system/editorial-calibration/export-txt', async (req, res) => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const sampleItems = [
        { id: '10542', timestamp: '2026-07-23 08:22', source: 'Bernama', title: 'PDRM tahan tiga suspek pemalsuan pasport biometrik di KLIA', brief: 'Polis menahan tiga individu yang disyaki terlibat dalam sindiket pemalsuan dokumen perjalanan antarabangsa.', rssCategory: 'Semasa', proposedDesk: 'Nasional', score: 84, confidenceRating: 'HIGH', secondaryDesk: 'Politik', status: 'REVIEW' },
        { id: '10543', timestamp: '2026-07-23 09:15', source: 'Kosmo!', title: 'NASA menemui exoplanet mempunyai atmosfera air luar sistem suria', brief: 'Teleskop Angkasa James Webb merekodkan spektrum atmosfera planet ekstrasolar LHS 1140b.', rssCategory: 'Sains', proposedDesk: 'Sains & Teknologi', score: 92, confidenceRating: 'HIGH', secondaryDesk: 'Astronomi', status: 'REVIEW' },
        { id: '10544', timestamp: '2026-07-23 10:00', source: 'Sinar Harian', title: 'Bangunan MPKJ, INTI College berlaku gegaran luar biasa', brief: 'Laporan awal merekodkan pergerakan struktur di kawasan sekitar namun skop disiplin belum disahkan enjin.', rssCategory: 'Kultur', proposedDesk: 'BELUM DIKELASKAN', score: 41, confidenceRating: 'LOW', secondaryDesk: 'Pendidikan', status: 'REVIEW' },
        { id: '10545', timestamp: '2026-07-23 10:45', source: 'Utusan Malaysia', title: 'Arab Saudi perkenal visa umrah baharu kemudahan jemaah antarabangsa', brief: 'Kementerian Haji dan Umrah Arab Saudi mengumumkan pelancaran platform sistem visa umrah elektronik baharu.', rssCategory: 'Antarabangsa', proposedDesk: 'Pelancongan', score: 65, confidenceRating: 'MEDIUM', secondaryDesk: 'Ibadah', status: 'REVIEW' }
      ];

      const headerBanner = `ADJUNG CALIBRATION EXCHANGE FORMAT (ACEF) v1.0\nTarikh Penjanaan: ${new Date().toLocaleString()}\nJumlah Berita: ${sampleItems.length}\n\n`;

      const blocks = sampleItems.map(item => (
        `==================================================\n\n` +
        `RSS_ID          : ${item.id}\n` +
        `DATE            : ${item.timestamp}\n` +
        `SOURCE          : ${item.source}\n\n` +
        `TITLE           : ${item.title}\n\n` +
        `BRIEF           : ${item.brief}\n\n` +
        `RSS_CATEGORY    : ${item.rssCategory}\n\n` +
        `SYSTEM_DESK     : ${item.proposedDesk}\n` +
        `SYSTEM_SCORE    : ${item.score}\n` +
        `CONFIDENCE      : ${item.confidenceRating}\n` +
        `SECONDARY_DESK  : ${item.secondaryDesk}\n\n` +
        `STATUS          : ${item.status}\n`
      ));

      const fullTxt = headerBanner + blocks.join('\n') + `\n==================================================\n`;

      res.setHeader('Content-Type', 'text/plain;charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="adjung_editorial_calibration_dataset_${todayStr}.txt"`);
      res.send(fullTxt);
    } catch (err) {
      console.error('Export TXT error:', err);
      res.status(500).send('Export error');
    }
  });

  return router;
}

export async function executeDirectRssFetch(dbAll, dbGet, dbRun) {
  const activeSources = await dbAll("SELECT * FROM rss_sources_registry WHERE enabled = 1");
  const textRules = await dbAll("SELECT * FROM rss_text_rules WHERE enabled = 1 ORDER BY orderIndex ASC");
  const desks = await dbAll("SELECT * FROM adjung_desks WHERE enabled = 1 ORDER BY displayOrder ASC");
  const deskRules = await dbAll("SELECT * FROM rss_desk_rules WHERE enabled = 1 ORDER BY orderIndex ASC");
  const globalExclusions = await dbAll("SELECT * FROM rss_global_exclusion_rules WHERE enabled = 1");
  const blockedCategories = await dbAll("SELECT * FROM rss_blocked_categories WHERE enabled = 1");

  let editorialSettings = await dbGet("SELECT * FROM rss_editorial_settings WHERE id = 'main'");
  if (!editorialSettings) {
    editorialSettings = {
      autoLiveThreshold: 80,
      reviewThreshold: 60,
      priorityKeywords: 'dasar, belanjawan, ekonomi, pendidikan, menteri, kerajaan',
      blockedKeywords: 'gempar, viral, panas, terbongkar',
      priorityBonus: 15,
      blockedPenalty: 40,
      // maxNewsAgeHours/tickerMaxItems/tickerTitleMinChars (2026-08-16, audit Izzat) — sepadan
      // pembetulan objek fallback GET /rss-settings di atas fail ni (nota sama di situ).
      maxNewsAgeHours: 48,
      tickerMaxItems: 20,
      tickerTitleMinChars: 0,
    };
  }

  await Promise.allSettled(activeSources.map(async (source) => {
    try {
      // Sekatan SSRF (2026-08-08, audit keselamatan) — rssUrl didaftar sendiri oleh Ketua
      // Editor/Penolong (manageEditorial), tapi tetap input manusia; semak sebelum ambil.
      const semakan = await sahkanUrlSelamatUntukFetch(source.rssUrl);
      if (!semakan.selamat) return;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s max wait per source

      const response = await fetch(source.rssUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        }
      });
      clearTimeout(timeoutId);

      if (!response.ok) return;
      const xmlText = await response.text();
      const parsedItems = parseRssXml(xmlText);
      const maxAgeHours = editorialSettings.maxNewsAgeHours !== undefined ? Number(editorialSettings.maxNewsAgeHours) : 48;

      for (const item of parsedItems) {
        if (!filterByLanguage(item, source.language || 'ms-MY')) continue;

        // 1. Raw XML RSS Category Pre-Filter
        const rawCategory = (item.category || '').trim();
        const isCategoryBlocked = blockedCategories.some(b => {
          const bName = (b.categoryName || '').toLowerCase().trim();
          return bName && rawCategory.toLowerCase().includes(bName);
        });

        if (isCategoryBlocked) {
          const itemId = `item-blk-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
          try {
            await dbRun(`
              INSERT OR IGNORE INTO rss_ticker_items (
                id, rssGuid, title, formattedBrief, source, originalUrl, category, publishedAt, score, scoreBreakdown, deskBreakdown, decision, status, createdAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'BLOCKED_CATEGORY', 'blocked_category', ?)
            `, [
              itemId, item.rssGuid || itemId, item.title, item.formattedBrief || item.description || item.title,
              source.sourceName, item.link || '#', rawCategory || 'DISEKAT',
              item.publishedAt || new Date().toISOString(),
              JSON.stringify({ reason: `Kategori XML RSS '${rawCategory}' berada dalam senarai Kategori Tersekat Editor.` }),
              JSON.stringify({ winningDesk: 'DISEKAT', publicCategory: 'DISEKAT', explanation: `Kategori XML RSS '${rawCategory}' disekat secara automatik.` }),
              new Date().toISOString()
            ]);
          } catch (e) {}
          continue;
        }

        // 2. Freshness Filter
        if (maxAgeHours > 0 && item.publishedAt) {
          const itemTime = new Date(item.publishedAt).getTime();
          if (!isNaN(itemTime)) {
            const ageInHours = (Date.now() - itemTime) / (1000 * 60 * 60);
            if (ageInHours > maxAgeHours) {
              continue;
            }
          }
        }

        // 3. Editorial Text Rules Engine
        const cleanedTitle = normalizeEditorialText(item.title, 'title', source.id, textRules);
        const cleanedBrief = normalizeEditorialText(item.formattedBrief || item.description || item.title, 'brief', source.id, textRules);

        // 4. Desk Classification & Score Engine
        const scoreItem = { ...item, title: cleanedTitle, formattedBrief: cleanedBrief };
        const deskClassification = classifyDesk(scoreItem, deskRules, desks, globalExclusions);
        const assignedDesk = deskClassification.winningDesk || source.categoryMapping || 'SEMASA';

        const scoreResult = calculateEditorialScore(scoreItem, source, editorialSettings);
        const itemId = `item-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

        try {
          await dbRun(`
            INSERT OR IGNORE INTO rss_ticker_items (
              id, rssGuid, title, formattedBrief, briefTruncated, source, originalUrl, category, rawCategory, publishedAt, score, scoreBreakdown, deskBreakdown, secondaryDesk, secondaryScore, decision, status, createdAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            itemId, item.rssGuid, cleanedTitle, cleanedBrief, item.briefTruncated ? 1 : 0,
            source.sourceName, item.link, assignedDesk, rawCategory || 'TIADA TAG',
            item.publishedAt, scoreResult.score, JSON.stringify(scoreResult.scoreBreakdown),
            JSON.stringify(deskClassification),
            deskClassification.secondaryDesk,
            deskClassification.secondaryScore || 0,
            scoreResult.decision, scoreResult.status, new Date().toISOString()
          ]);
          // Limpahan teks (2026-08-02, Fasa 8) — "tiada pemotongan mekanikal senyap" (Perlembagaan):
          // pemotongan 220 aksara KEKAL (Ticker satu baris, keputusan Izzat), tapi kini dicatat
          // supaya boleh disemak/dipanjangkan semula, bukan hilang senyap terus. Hanya log item
          // yang benar-benar AUTO_LIVE (bukan setiap item ditolak/disekat — bunyi bising tak
          // bermakna untuk item yang tak pernah siar pun).
          if (item.briefTruncated && scoreResult.decision === 'AUTO_LIVE') {
            await logAudit(dbRun, {
              actorName: 'RSS Direct (automatik)',
              action: 'rss-huraian-dipendekkan',
              targetType: 'rss_ticker_item',
              targetId: itemId,
              detail: `${source.sourceName}: "${cleanedTitle}". Huraian dipendekkan pada 220 aksara semasa auto-siar Ticker.`,
            });
          }
        } catch (dbErr) {
          console.error(`[RSS DB Insert Error] Source '${source.sourceName}':`, dbErr.message);
        }
      }
    } catch (fetchErr) {
      // 2026-08-02 (Fasa 4) — dahulu ralat ambilan RSS ditelan senyap sepenuhnya (komen "Gracefully
      // skip" di atas) — feed yang MATI tak dapat dibezakan langsung dengan feed yang memang
      // SUNYI (tiada berita baharu). Catat ke Log Audit supaya kegagalan berterusan kelihatan.
      await logAudit(dbRun, {
        action: 'ralat-ambilan-rss',
        targetType: 'rss_source',
        targetId: source.id,
        detail: `${source.sourceName}: ${fetchErr.message || fetchErr.name || 'ralat tidak diketahui'}`,
      });
      await beritahuPentadbirDanKetuaEditor(dbAll, dbRun, {
        type: 'sistem_rss_gagal',
        title: `Ambilan RSS gagal: ${source.sourceName}`,
        detail: fetchErr.message || fetchErr.name || 'Ralat tidak diketahui',
        targetType: 'rss_source',
        targetId: source.id,
        kumpul: true,
      }, dbGet);
    }
  }));

  // Query total DB counts for actual statistics
  const autoLiveRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items WHERE status = 'approved'");
  const pendingReviewRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items WHERE status = 'pending'");
  const totalFetchedRow = await dbGet("SELECT COUNT(*) as cnt FROM rss_ticker_items");

  const autoLiveCount = autoLiveRow ? autoLiveRow.cnt : 0;
  const pendingReviewCount = pendingReviewRow ? pendingReviewRow.cnt : 0;
  const totalFetchedCount = totalFetchedRow ? totalFetchedRow.cnt : 0;

  // Query approved items ordered by HIGHEST SCORE first!
  // tickerMaxItems TIDAK dibaca di sini lagi — janaSemulaTickerRssDirect() membacanya sendiri
  // supaya had itu ada SATU tapak bacaan sahaja bagi semua pemanggil.
  const settingsRow = await dbGet("SELECT maxNewsAgeHours FROM rss_editorial_settings WHERE id = 'main'");

  // Penyemakan usia BERTERUSAN pada item yang SUDAH approved (2026-08-19, laporan Izzat:
  // "kenapa ticker memaparkan yg lama? sedangkan saya dah set had usia berita 24 jam?").
  //
  // PUNCA: "2. Freshness Filter" di atas (baris ~981) hanya tapis item BAHARU semasa satu-satu
  // larian ambilan RSS — ia TIDAK PERNAH menyemak semula item yang SUDAH `status='approved'`
  // daripada larian SEBELUM ni. Fungsi ni jalan setiap 3 jam (penjadual di server.js) dan
  // SETIAP kali cuma `SELECT ... WHERE status='approved'` tanpa syarat usia langsung — jadi
  // item lama yang pernah lulus (di bawah had lama/tiada had) kekal 'approved' SELAMANYA dan
  // terus muncul dalam rentetan ticker setiap kali dijana semula, tak kira usia sebenar.
  //
  // Dibaiki dengan corak SAMA seperti "Retroactive Purge & Filter" kata kunci disekat (POST
  // /rss-settings, baris ~255) — cuma di sini ia jalan pada SETIAP penjanaan semula (bukan
  // hanya bila tetapan disimpan), supaya item yang lapuk secara semula jadi (masa berlalu,
  // bukan sahaja tetapan ditukar) turut tertangkap dalam lingkungan 3 jam berikutnya.
  // Nilai semula backlog sedia ada guna tetapan TERKINI (2026-08-20) — lihat komen penuh di
  // nilaiSemulaKeputusanSediaAda() (atas fail ni). `editorialSettings` di sini ialah objek SAMA
  // yg dimuat segar di awal fungsi ni (baris ~937), jadi sentiasa tetapan terkini walau
  // Ketua Editor/Pentadbir tak sentuh panel Tetapan langsung hari ni. MESTI sebelum purge usia
  // di bawah — purge usia kata putus TERAKHIR tentang kesegaran, bukan nilai semula skor ni.
  // Dibalut denganKunciTicker (2026-08-20) atas DUA sebab, kedua-duanya perlu:
  // (1) nilaiSemulaKeputusanSediaAda() membuka BEGIN TRANSACTION. Laluan POST /rss-settings
  //     memanggilnya SUDAH di dalam kunci ticker; kalau larian ni pula berjalan TANPA kunci,
  //     dua transaksi boleh bertindih atas sambungan SQLite yang SAMA — SQLite tak benarkan
  //     transaksi bersarang, jadi salah satu gagal ("cannot start a transaction within a
  //     transaction") dan nilai semula terbatal separuh jalan.
  // (2) Tanpa kunci, gelung UPDATE ni boleh berselang-seli dengan simpanan tetapan editor yang
  //     berlaku serentak — dua set keputusan berdasarkan tetapan BERBEZA ditulis bercampur, dan
  //     yang terakhir siap menang secara rawak.
  await denganKunciTicker(() => nilaiSemulaKeputusanSediaAda(dbAll, dbRun, editorialSettings));

  const maxAgeHoursSemasa = settingsRow && settingsRow.maxNewsAgeHours !== undefined
    ? Number(settingsRow.maxNewsAgeHours) : 48;
  if (maxAgeHoursSemasa > 0) {
    // 'pending' turut disemak — sama seperti tapak POST /rss-settings di atas (2026-08-20,
    // lihat nota penuh di situ): giliran semakan tak patut dilonggokkan berita lapuk.
    const semuaApproved = await dbAll("SELECT id, publishedAt FROM rss_ticker_items WHERE status IN ('approved', 'pending')");
    const kiniMs = Date.now();
    const lapuk = semuaApproved.filter((item) => {
      if (!item.publishedAt) return false;
      const masaItem = new Date(item.publishedAt).getTime();
      if (isNaN(masaItem)) return false;
      return (kiniMs - masaItem) / (1000 * 60 * 60) > maxAgeHoursSemasa;
    });
    for (const item of lapuk) {
      await dbRun("UPDATE rss_ticker_items SET status = 'rejected' WHERE id = ?", [item.id]);
    }
  }

  // TANPA gerbang `length > 0` (2026-08-19, susulan laporan Izzat "masih ada berita lama...
  // kenapa?"): gerbang lama langkau penjanaan semula bila TIADA item layak — meninggalkan
  // rentetan ticker LAMA (dengan berita lapuk) kekal terpapar SELAMANYA. Kes sebenar di
  // production: had usia 24 jam + tiada berita baharu dalam 24 jam = 0 item approved, tetapi
  // inTheNewsText masih penuh blok lama dari minggu lepas. gantiBlokModTicker dengan senarai
  // KOSONG memang direka buang semua blok mod 'RSS Direct' sambil KEKALKAN blok mod lain
  // (Manual/AI Generated) — corak sama sudah dipakai EditorialPipeline.js:433. Ticker kosong
  // yang jujur ("Tiada berita semasa buat masa ini", FrontpageView) lebih betul daripada
  // berita lapuk yang tak sepatutnya tersiar. janaSemulaTickerRssDirect() memang tiada gerbang
  // sedemikian — jangan tambah semula.
  //
  // denganKunciTicker (2026-08-08, dapatan audit keselamatan ChatGPT) — bahagian baca-ubah-
  // tulis inTheNewsText SAHAJA (bukan seluruh fungsi ni, yang buat panggilan rangkaian PERLAHAN
  // ke pelayan RSS luar sebelum sampai sini) — lihat nota di kunciKandungan.js.
  const approvedCount = await denganKunciTicker(() => janaSemulaTickerRssDirect(dbAll, dbGet, dbRun));

  const lastFetchedAt = new Date().toISOString();

  // Log Audit (Fasa 4) — satu baris ringkasan setiap larian, di atas kegagalan per-sumber yang
  // dicatat individu di atas — supaya "berapa sumber aktif, berapa item ditemui" boleh disemak
  // dari sejarah, bukan cuma keadaan semasa.
  await logAudit(dbRun, {
    action: 'ambilan-rss-selesai',
    actorName: 'RSS Direct (automatik)',
    targetType: 'rss',
    detail: `${activeSources.length} sumber aktif, ${totalFetchedCount} item ditemui, ${autoLiveCount} auto-live, ${pendingReviewCount} menunggu semakan`,
  });

  return {
    success: true,
    activeSourcesCount: activeSources.length,
    totalFetchedCount,
    autoLiveCount,
    pendingReviewCount,
    lastFetchedAt,
    approvedCount
  };
}

