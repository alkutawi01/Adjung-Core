// Simulation agent script: Inserts fresh editorial content into ALL 38 bento slots in adjung.db
// to simulate actual multi-tier editorial input across HERO, MENEGAK, STANDARD, SEGI_EMPAT_MEDIUM,
// SEGI_EMPAT_SMALL, KOMPAK, BAR, and TICKER cards.

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const dbPath = path.join(__dirname, '..', 'adjung.db');
const db = new sqlite3.Database(dbPath);

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err); else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
  });
}

function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
  });
}

const COLOR_PALETTE = [
  '#DC2626','#E11D48','#DB2777','#9333EA','#7C3AED','#4F46E5','#2563EB','#0284C7','#0891B2','#0D9488',
  '#059669','#16A34A','#65A30D','#CA8A04','#D97706','#EA580C','#B45309','#C2410C','#B91C1C','#BE123C'
];

function getSlug(name) {
  return (name || 'umum').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function registerCategory(category) {
  const name = (category || 'UMUM').trim();
  const slug = getSlug(name);
  const existing = await dbGet("SELECT * FROM CategoryRegistry WHERE slug = ?", [slug]);
  if (existing) {
    await dbRun("UPDATE CategoryRegistry SET usageCount = usageCount + 1, updatedAt = ? WHERE slug = ?", [new Date().toISOString(), slug]);
    return existing;
  }
  const allRegistered = await dbAll("SELECT color FROM CategoryRegistry");
  const assignedColors = allRegistered.map(r => (r.color || '').toUpperCase());
  let chosenColor = COLOR_PALETTE.find(c => !assignedColors.includes(c.toUpperCase())) || '#802334';
  const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date().toISOString();
  await dbRun(
    "INSERT INTO CategoryRegistry (id, slug, name, color, usageCount, createdAt, updatedAt) VALUES (?, ?, ?, ?, 1, ?, ?)",
    [id, slug, name, chosenColor, now, now]
  );
  return { id, slug, name, color: chosenColor };
}

const SIMULATED_DATA = [
  { slotIndex: 0, desk: 'TEKNOLOGI UTAMA', title: 'Malaysia Meluncurkan Enjin Kecerdasan Buatan Pertama Patuh Syariah', brief: 'Inisiatif nasional ini membolehkan pemprosesan pemodelan bahasa tinggi dalam Bahasa Melayu dan Arab secara selamat.', source: 'BERNAMA', url: 'https://bernama.com' },
  { slotIndex: 1, desk: 'NEUROLINGUISTIK', title: 'Kajian Kognitif Otak Dwibahasa Mengesan Penggunaan Laluan Tatabahasa Serentak', brief: 'Penyelidik tempatan mendapati proses pengamatan bahasa dalam kalangan penutur Melayu-Inggeris beroperasi pada nod saraf yang sama.', source: 'KPM Jurnal', url: 'https://kpm.gov.my' },
  { slotIndex: 2, desk: 'EKONOMI DIGITAL', title: 'Pelaburan Data Center Catat RM25 Bilion Pada Suku Kedua 2026', brief: 'Kemasukan firma antarabangsa memperkukuh kedudukan koridor teknologi tempatan sebagai hab awan utama rantau ASEAN.', source: 'UTUSAN MALAYSIA', url: 'https://utusan.com.my' },
  { slotIndex: 3, desk: 'ARKEOLOGI', title: 'Ekskavasi Lembah Lenggong Temui Manuskrip Purba Abad Ke-14', brief: 'Naskhah daun lontar ini mengandungi rekod sistem perdagangan maritim kuno.', source: 'JABATAN WARISAN', url: 'https://warisan.gov.my' },
  { slotIndex: 4, desk: 'SUKAN', title: 'Skuad Skuasy Negara Mara Ke Final Terbuka Dunia 2026', brief: 'Kemenangan dramatik 3-2 mengesahkan tempat di pentas akhir.', source: 'STADIUM ASTRO', url: 'https://stadiumastro.com' },
  { slotIndex: 5, desk: 'SAINS', title: 'Ujian Makmal Nano-Superkonduktor Mencapai Prestasi Rekod', brief: 'Ketepatan aliran tenaga meningkat tanpa kehilangan rintangan haba.', source: 'USM RESEARCH', url: 'https://usm.my' },
  { slotIndex: 6, desk: 'PENDIDIKAN', title: 'Rangka Kerja Kurikulum AI Sekolah Menengah Dimuktamadkan', brief: 'Kementerian Pendidikan melancarkan modul celik digital terbaharu merangkumi etika dan asas algoritma.', source: 'KPM', url: 'https://moe.gov.my' },
  { slotIndex: 7, desk: 'KAD BAR', title: 'Pasaran Saham Tempatan Dibuka Tinggi Pada Awal Dagangan', brief: '', source: 'BH ONLINE', url: 'https://bharian.com.my' },
  { slotIndex: 8, desk: 'KAD BAR', title: 'Kadar Inflasi Negara Kekal Stabil Pada Paras 1.8 Peratus', brief: '', source: 'BANK NEGARA', url: 'https://bnm.gov.my' },
  { slotIndex: 9, desk: 'KAD BAR', title: 'Peningkatan Hasil Eksport Produk Pertanian Tempatan', brief: '', source: 'MATRADE', url: 'https://matrade.gov.my' },
  { slotIndex: 10, desk: 'KAD BAR', title: 'Persidangan Kewangan Islam Antarabangsa Bermuda Mula', brief: '', source: 'IFSB', url: 'https://ifsb.org' },
  { slotIndex: 11, desk: 'PENERBITAN', title: 'Anugerah Buku Kebangsaan 2026 Diumumkan Di London', brief: 'Karya terbitan tempatan meraih tempat utama bagi kategori sejarah moden.', source: 'DBP', url: 'https://dbp.gov.my' },
  { slotIndex: 12, desk: 'DASAR BANDAR', title: 'Malaysia Gesa Pembaharuan Agenda Bandar Mampan WUF13', brief: 'Delegasi negara membentangkan kertas kerja perumahan inklusif di perhimpunan PBB.', source: 'RTM', url: 'https://rtm.gov.my' },
  { slotIndex: 13, desk: 'SASTERA', title: 'Simposium Tipografi Jawi Tradisional Himpunkan 50 Tokoh', brief: 'Wacana seni kaligrafi memberi fokus kepada kelestarian manuskrip Melayu lama.', source: 'KLIBF', url: 'https://klibf.my' },
  { slotIndex: 14, desk: 'PERUBATAN', title: 'Penemuan Anti-Antibodi Baharu Dalam Rawatan Imunologi', brief: 'Ujian klinikal fasa 3 menunjukkan kadar keberkesanan sehingga 91 peratus.', source: 'KKM', url: 'https://moh.gov.my' },
  { slotIndex: 15, desk: 'INOVASI', title: 'Cip Pemprosesan Optik Buatan Malaysia Berjaya Dihasilkan', brief: 'Pemprosesan berkuasa cahaya ini mengurangkan penggunaan elektrik sehingga 70 peratus.', source: 'MIMOS', url: 'https://mimos.my' }
];

async function runSimulation() {
  console.log('=== MEMULAKAN SIMULASI AGEN MASUKAN KANDUNGAN ===');
  for (const item of SIMULATED_DATA) {
    const { slotIndex, desk, title, brief, source, url } = item;
    const finalCategory = (desk || 'UMUM').trim().toUpperCase();
    await registerCategory(finalCategory);

    const now = new Date().toISOString();
    const objectId = `object-sim-slot${slotIndex}-${Date.now()}`;

    await dbRun(
      "INSERT INTO editorial_objects (id, type, categoryId, priority, slotIndex, createdAt, updatedAt) VALUES (?, 'Brief', ?, 'Medium', ?, ?, ?)",
      [objectId, finalCategory, slotIndex, now, now]
    );

    const rev = await dbRun(
      "INSERT INTO editorial_revisions (objectId, version, language, title, summary, status, createdBy, createdAt, updatedAt) VALUES (?, 1.0, 'ms', ?, ?, 'approved', 'sim-agent', ?, ?)",
      [objectId, title, brief, now, now]
    );
    const revisionId = rev.lastID;

    const attrs = [
      { key: 'desk', val: finalCategory },
      { key: 'source', val: source },
      { key: 'url', val: url }
    ];
    for (const a of attrs) {
      await dbRun(
        "INSERT INTO editorial_attribute_values (objectId, revisionId, attributeId, valueText) VALUES (?, ?, ?, ?)",
        [objectId, revisionId, a.key, a.val]
      );
    }

    await dbRun(
      "UPDATE slots_config SET activeObjectId = ?, manualTitle = ?, manualSummary = ?, manualDesk = ?, manualSource = ?, manualUrl = ? WHERE layoutTemplateId = 'frontpage' AND slotIndex = ?",
      [objectId, title, brief, finalCategory, source, url, slotIndex]
    );

    console.log(`[Slot ${slotIndex}] Berjaya dimasukkan: "${title.slice(0, 35)}..." (${finalCategory})`);
  }
  console.log('=== SIMULASI AGEN SELESAI 100% ===');
  db.close();
}

runSimulation().catch(err => {
  console.error('Simulation error:', err);
  process.exit(1);
});
