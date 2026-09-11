import crypto from 'crypto';

const COLOR_PALETTE = [
  '#DC2626', // Red 600
  '#E11D48', // Rose 600
  '#DB2777', // Pink 600
  '#9333EA', // Purple 600
  '#7C3AED', // Violet 600
  '#4F46E5', // Indigo 600
  '#2563EB', // Blue 600
  '#0284C7', // Sky 600
  '#0891B2', // Cyan 600
  '#0D9488', // Teal 600
  '#059669', // Emerald 600
  '#16A34A', // Green 600
  '#65A30D', // Lime 600
  '#CA8A04', // Yellow 600
  '#D97706', // Amber 600
  '#EA580C', // Orange 600
  '#B45309', // Amber 700
  '#C2410C', // Orange 700
  '#B91C1C', // Red 700
  '#BE123C', // Rose 700
  '#A21CAF', // Fuchsia 700
  '#701A75', // Fuchsia 900
  '#6D28D9', // Violet 700
  '#4338CA', // Indigo 700
  '#1D4ED8', // Blue 700
  '#0369A1', // Sky 700
  '#0E7490', // Cyan 700
  '#0F766E', // Teal 700
  '#047857', // Emerald 700
  '#15803D', // Green 700
  '#4D7C0F', // Lime 700
  '#A16207', // Yellow 700
  '#9A3412', // Orange 800
  '#9F1239', // Rose 800
  '#86198F', // Fuchsia 800
  '#5B21B6', // Violet 800
  '#3730A3', // Indigo 800
  '#1E40AF', // Blue 800
  '#075985', // Sky 800
  '#115E59', // Teal 800
  '#065F46', // Emerald 800
  '#166534'  // Green 800
];

class CategoryRegistry {
  // HSL->hex, used once the curated palette above is exhausted. Golden-angle hue stepping (the same
  // technique used to space seeds in a sunflower head) gives each successive category a hue as far
  // as possible from every hue picked before it, so colors stay genuinely distinct indefinitely
  // instead of wrapping around and reusing an already-assigned color. Fixed saturation/lightness
  // keeps every generated color in the same "family" (medium-dark, readable on white) as the palette.
  static hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const toHex = (x) => Math.round(255 * x).toString(16).padStart(2, '0');
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase();
  }

  static generateColorBeyondPalette(index) {
    const GOLDEN_ANGLE = 137.508;
    const hue = (index * GOLDEN_ANGLE) % 360;
    return this.hslToHex(hue, 65, 42);
  }

  static getSlug(name) {
    if (!name) return 'umum';
    return name.toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Database helper wrappers
  static dbAll(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows || []));
    });
  }

  static dbGet(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
    });
  }

  static dbRun(db, query, params = []) {
    return new Promise((resolve, reject) => {
      db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  static async getAllCategories(db) {
    return await this.dbAll(db, "SELECT * FROM CategoryRegistry ORDER BY name ASC");
  }

  // Pemilih warna kongsi (2026-08-06, pembetulan — dahulu activateCategory ada salinan fallback
  // BERASINGAN yang dikodkan keras generateColorBeyondPalette(0), bermakna SETIAP Bidang dicipta
  // via "+ Tambah Bidang" tanpa warna eksplisit dapat warna IDENTIK, bukan pelbagai — Izzat
  // laporkan "dua jenis maroon" di Taksonomi. SATU sumber kebenaran untuk logik "cari warna belum
  // digunakan" supaya kedua-dua laluan cipta Bidang (auto-daftar RSS/pipeline DAN "+ Tambah
  // Bidang" manual) sentiasa selari.
  static async pilihWarnaBelumDigunakan(db) {
    const allRegistered = await this.dbAll(db, "SELECT color FROM CategoryRegistry");
    const assignedColors = allRegistered.map(r => r.color.toUpperCase());

    // Find first unused color in the curated palette; once that's exhausted, generate a new one
    // algorithmically rather than wrapping around and reusing an already-assigned color.
    let chosenColor = COLOR_PALETTE.find(c => !assignedColors.includes(c.toUpperCase()));
    if (!chosenColor) {
      // Gelung cuba-semula (2026-09-09, dapatan bug-hunt) — dahulu setiap ulangan while panggil
      // generateColorBeyondPalette(allRegistered.length + assignedColors.length), TAPI kedua-dua
      // operand tu ialah .length ARRAY YANG SAMA (assignedColors = allRegistered.map(...)), jadi
      // hasilnya SATU nilai TETAP (2 x panjang asal) — bukan bertambah setiap kali cuba semula
      // macam niat komen atas ("generate a new one algorithmically"). Kalau warna beyond-palette
      // PERTAMA (index allRegistered.length) berlanggar dengan warna sedia ada, while loop ulang
      // kira nilai index SAMA berulang kali selama-lamanya — hue keluaran SAMA setiap pusingan,
      // gelung TIDAK PERNAH tamat (server tergantung/hang pada permintaan cipta Bidang tu).
      // Dibetulkan: kaunter cuba-semula BERASINGAN yang bertambah SETIAP ulangan (offset lepas
      // index asal), supaya setiap percubaan hasilkan hue GOLDEN_ANGLE berbeza sehingga jumpa
      // satu yang belum digunakan.
      let cubaan = 0;
      chosenColor = this.generateColorBeyondPalette(allRegistered.length);
      while (assignedColors.includes(chosenColor.toUpperCase())) {
        cubaan += 1;
        chosenColor = this.generateColorBeyondPalette(allRegistered.length + cubaan);
      }
    }
    return chosenColor;
  }

  static async registerCategory(db, category) {
    if (!category || category.trim() === '') {
      category = 'UMUM';
    }
    const name = category.trim();
    const slug = this.getSlug(name);

    // Check if exists
    const existing = await this.dbGet(db, "SELECT * FROM CategoryRegistry WHERE slug = ?", [slug]);
    if (existing) {
      return existing;
    }

    const chosenColor = await this.pilihWarnaBelumDigunakan(db);

    const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.dbRun(db, `
      INSERT INTO CategoryRegistry (id, slug, name, color, usageCount, originalName, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 0, ?, ?, ?)
    `, [id, slug, name, chosenColor, name, now, now]);

    return { id, slug, name, color: chosenColor, usageCount: 0, originalName: name, createdAt: now, updatedAt: now };
  }

  static async getCategoryColor(db, category) {
    const reg = await this.registerCategory(db, category);
    return reg.color;
  }

  // Cari warna Bidang TANPA mendaftar (bukan mutasi) — untuk laluan yang cuma PAPAR/BACA
  // (cth GET poster), bukan cipta Bidang. registerCategory() di atas sengaja mendaftar
  // Bidang baharu bila slug tak jumpa (betul untuk laluan tulis macam auto-daftar RSS/
  // pipeline), tapi itu salah untuk laluan baca semata-mata — nama Bidang beku/lapuk pada
  // kandungan lama (categoryId/desk dibekukan pada masa cipta, lihat nota posterRoutes.js)
  // yang tak lagi padan slug SEMASA (Bidang telah dinamakan semula/digabung) akan diam-diam
  // MENCIPTA Bidang PALSU baharu setiap kali laluan baca dipanggil (dapatan bug-hunt
  // 2026-09-08) — gema pepijat "dua jenis maroon" yang disebut di atas, cuma punca berbeza.
  // Fallback ke warna PERTAMA palet (bukan cipta) kalau slug memang tak jumpa langsung.
  static async findCategoryColorReadOnly(db, category) {
    const slug = this.getSlug(category);
    const reg = await this.dbGet(db, "SELECT color FROM CategoryRegistry WHERE slug = ?", [slug]);
    return reg ? reg.color : COLOR_PALETTE[0];
  }

  static async incrementCategoryUsage(db, category) {
    if (!category || category.trim() === '') return;
    const slug = this.getSlug(category);
    // Ensure exists
    await this.registerCategory(db, category);
    
    const now = new Date().toISOString();
    await this.dbRun(db, `
      UPDATE CategoryRegistry 
      SET usageCount = usageCount + 1, updatedAt = ? 
      WHERE slug = ?
    `, [now, slug]);
  }

  // PEMBETULAN (2026-09-11, bug-hunt, methodology "sibling function") — fungsi ni DUA pepijat
  // yang SUDAH dibaiki di renameActiveCategory() (lihat komen panjang di fungsi tu), tapi tak
  // pernah disambung ke sini walau kedua-duanya "namakan semula Bidang". Laluan
  // POST /api/system/categories/rename (satu-satunya pemanggil fungsi ni) TIADA pemanggil UI
  // (disahkan grep merentasi src/ — BidangConsole.tsx panggil /categories/rename-active sahaja),
  // tapi ia TETAP laluan API SEBENAR, boleh dicapai (gerbang manageEditorial sahaja), dan
  // pepijat lama sepenuhnya masih hidup di dalamnya:
  //   1. Slug DITUKAR pada rename (dikira semula drpd nama baharu) — bertentangan terus dengan
  //      dasar Izzat "Slug DIKUNCI kekal" (2026-09-02) yang MEMANG sebab renameActiveCategory()
  //      wujud berasingan drpd fungsi ni. Pautan /bidang/{slug} lama pecah (404) sebaik dipanggil.
  //   2. `slots_config.manualDesk`/`editorial_attribute_values.desk` TAK dicascade — kandungan
  //      sedia ada hilang senyap drpd Halaman Bidangnya sendiri (sama pepijat yang dibaiki di
  //      renameActiveCategory 2026-09-08/09-11).
  // Disahkan reproduce hujung-ke-hujung sebelum pembetulan ni: `.simulasi/sim295-old-rename-
  // route-stale.mjs` (slug bertukar, /bidang/<slug-lama> 404, /bidang/<slug-baharu> total=0).
  // Dibetulkan: slug TAK PERNAH disentuh lagi (cermin renameActiveCategory persis), dan cascade
  // manualDesk + desk yang sama diguna semula selepas tulis nama baharu.
  static async renameCategory(db, oldName, newName) {
    if (!oldName || !newName || oldName.trim() === '' || newName.trim() === '') return;
    const oldSlug = this.getSlug(oldName);
    const newNameClean = newName.trim();
    const newSlug = this.getSlug(newNameClean);

    const sourceReg = await this.dbGet(db, "SELECT * FROM CategoryRegistry WHERE slug = ?", [oldSlug]);
    if (!sourceReg) return;

    // Nama baharu padan slug BIDANG LAIN sedia ada (bukan Bidang sumber sendiri) — niat sebenar
    // pemanggil ialah GABUNG dua Bidang, bukan namakan semula (mergeCategories() sudah betul
    // cascade semuanya sendiri, termasuk manualDesk/desk).
    if (newSlug !== oldSlug) {
      const targetExists = await this.dbGet(db, "SELECT * FROM CategoryRegistry WHERE slug = ?", [newSlug]);
      if (targetExists) {
        await this.mergeCategories(db, oldName, newNameClean);
        return;
      }
    }

    // Namakan semula SEBENAR — slug KEKAL (dasar dikunci), cuma `name` bertukar.
    const now = new Date().toISOString();
    await this.dbRun(db, `
      UPDATE CategoryRegistry
      SET name = ?, updatedAt = ?
      WHERE slug = ?
    `, [newNameClean, now, oldSlug]);

    if (sourceReg.name.toLowerCase() !== newNameClean.toLowerCase()) {
      await this.dbRun(db, `
        UPDATE slots_config SET manualDesk = ?
        WHERE layoutTemplateId = 'frontpage' AND LOWER(manualDesk) = LOWER(?)
      `, [newNameClean, sourceReg.name]);
      await this.dbRun(db, `
        UPDATE editorial_attribute_values
        SET valueText = ?
        WHERE attributeId = 'desk' AND LOWER(valueText) = LOWER(?)
      `, [newNameClean, sourceReg.name]);
    }
  }

  static async mergeCategories(db, sourceCategory, targetCategory) {
    if (!sourceCategory || !targetCategory || sourceCategory.trim() === '' || targetCategory.trim() === '') return;
    const sourceSlug = this.getSlug(sourceCategory);
    const targetSlug = this.getSlug(targetCategory);

    if (sourceSlug === targetSlug) return;

    // Ensure target category exists
    const targetReg = await this.registerCategory(db, targetCategory);
    const sourceReg = await this.dbGet(db, "SELECT * FROM CategoryRegistry WHERE slug = ?", [sourceSlug]);

    if (!sourceReg) return;

    // PEMBETULAN (2026-09-08, dapatan bug-hunt) — seluruh operasi ni dibungkus SATU transaksi.
    // Sebelum ni setiap langkah (usageCount, DELETE Bidang sumber, remap kandungan) ialah
    // dbRun() berasingan tanpa BEGIN/COMMIT. `glosari_sense_bidang.categoryId` rujuk
    // CategoryRegistry(id) TANPA ON DELETE CASCADE (server.js, jadual tu — tak macam
    // glosari_sense->glosari_istilah yang memang CASCADE) — dengan PRAGMA foreign_keys=ON,
    // DELETE FROM CategoryRegistry di bawah GAGAL (SQLITE_CONSTRAINT) sebaik mana-mana Sense
    // glosari khusus-Bidang masih rujuk Bidang sumber. Sebab tiada transaksi, kegagalan pada
    // langkah TERAKHIR ni tinggalkan keadaan SEPARA: usageCount sasaran dah naik, tapi baris
    // Bidang sumber gagal padam — laluan API (categoryRoutes.js) pulangkan 500 generik yang
    // tak mendedahkan keadaan bercelaru ni (disahkan `.simulasi/sim28-gabung-bidang-glosari-fk.mjs`,
    // hujung-ke-hujung HTTP sebenar). BEGIN/COMMIT/ROLLBACK di sini jamin sama ada SEMUA
    // langkah berjaya atau TIADA satu pun terpakai — corak sama seperti transaksi glosariRoutes.js.
    await this.dbRun(db, 'BEGIN TRANSACTION');
    try {
      // Combine usageCounts
      const now = new Date().toISOString();
      await this.dbRun(db, `
        UPDATE CategoryRegistry
        SET usageCount = usageCount + ?, updatedAt = ?
        WHERE slug = ?
      `, [sourceReg.usageCount, now, targetReg.slug]);

      // Pindahkan perkaitan Sense Glosari khusus-Bidang daripada Bidang sumber ke sasaran
      // SEBELUM padam baris Bidang sumber, jika tidak DELETE di bawah akan gagal FK constraint
      // (atau, kalau constraint tu suatu hari dilonggarkan, perkaitan tu jadi rujukan yatim
      // senyap). INSERT OR IGNORE dahulu (elak langgar PRIMARY KEY (senseId, categoryId) kalau
      // Sense yang sama kebetulan dah terikat kepada Bidang sasaran juga), baru DELETE baris
      // lama yang merujuk Bidang sumber.
      await this.dbRun(db, `
        INSERT OR IGNORE INTO glosari_sense_bidang (senseId, categoryId)
        SELECT senseId, ? FROM glosari_sense_bidang WHERE categoryId = ?
      `, [targetReg.id, sourceReg.id]);
      await this.dbRun(db, "DELETE FROM glosari_sense_bidang WHERE categoryId = ?", [sourceReg.id]);

      // Delete source category from registry
      await this.dbRun(db, "DELETE FROM CategoryRegistry WHERE slug = ?", [sourceSlug]);

      // Re-map any saved items matching source slug/category to target category uppercase
      const targetNameUpper = targetReg.name.toUpperCase();

      // PEMBETULAN (2026-09-02, dapatan bug-hunt) — padanan asal `valueText = ?` (case-sensitive)
      // gagal senyap terhadap kandungan sebenar yang tersimpan bukan huruf besar penuh (disahkan
      // DB sebenar: 1 baris `desk = 'Siber'` bersebelahan majoriti `'SIBER'`). Kandungan macam ni
      // TAK PERNAH dipetakan semasa gabung Bidang — kekal senyap merujuk Bidang yang sudah dipadam
      // daripada CategoryRegistry, "yatim" tanpa amaran. LOWER() pada kedua-dua belah gerbang ni
      // padan tanpa kira huruf besar/kecil, sama corak `LOWER(TRIM())` yang sudah dipakai di tempat
      // lain (contoh: padanan editorName pemilikan kandungan, contentRoutes.js).
      await this.dbRun(db, `
        UPDATE editorial_objects
        SET categoryId = ?
        WHERE LOWER(categoryId) = LOWER(?) OR LOWER(categoryId) = LOWER(?)
      `, [targetNameUpper, sourceCategory.trim(), sourceReg.name]);

      // Update attribute values
      await this.dbRun(db, `
        UPDATE editorial_attribute_values
        SET valueText = ?
        WHERE attributeId = 'desk' AND (LOWER(valueText) = LOWER(?) OR LOWER(valueText) = LOWER(?))
      `, [targetNameUpper, sourceCategory.trim(), sourceReg.name]);

      await this.dbRun(db, 'COMMIT');
    } catch (e) {
      try { await this.dbRun(db, 'ROLLBACK'); } catch (rollbackErr) { console.error('Rollback gagal (gabung Bidang):', rollbackErr.message); }
      throw e;
    }
  }

  // Senarai Bidang tertutup (isActive=1) — sumber untuk dropdown/Taksonomi. Baris isActive=0
  // (sejarah auto-daftar lama) tetap wujud untuk warna kad lama (getAllCategories/GET /categories),
  // cuma tak muncul di sini.
  static async getActiveCategories(db) {
    return await this.dbAll(db, "SELECT * FROM CategoryRegistry WHERE isActive = 1 ORDER BY name ASC");
  }

  // Strategi warna keseluruhan Taksonomi (2026-08-06, permintaan Izzat — "biar editor boleh
  // pilih nak selaraskan semua bidang guna satu warna sahaja, atau pelbagaikan"). Ikon SVG
  // custom TIDAK perlu disentuh langsung — warna diwarisi hidup melalui `color` CSS di
  // BidangIcon.tsx (currentColor), jadi tukar CategoryRegistry.color sahaja cukup, terus
  // terpakai di ikon, eyebrow kad, dan Focus View serentak.
  static async unifyAllColors(db, warna) {
    if (!/^#[0-9a-f]{6}$/i.test(warna)) throw new Error('Warna mesti kod hex 6 digit, cth #802334.');
    const now = new Date().toISOString();
    const { changes } = await this.dbRun(db, "UPDATE CategoryRegistry SET color = ?, updatedAt = ? WHERE isActive = 1", [warna, now]);
    return { dikemas: changes };
  }

  // Pelbagaikan — Bidang yang warnanya SUDAH unik (tiada Bidang aktif lain berkongsi warna sama)
  // dikekalkan tanpa diusik ("automatik pilih warna yg dipilih pada asalnya kalau ada"). Bagi
  // setiap kumpulan Bidang yang berkongsi SATU warna sama, baris PALING LAMA (createdAt) kekal
  // dengan warna tu (dianggap "asal" — yang lain kemudiannya jatuh pada fallback identik yang
  // sama, lihat bug activateCategory di atas); baki ahli kumpulan diagihkan warna baharu berbeza
  // daripada palet, satu per satu, supaya tiada dua Bidang aktif berkongsi warna selepas ni.
  static async diversifyColors(db) {
    const semua = await this.dbAll(db, "SELECT id, name, color, createdAt FROM CategoryRegistry WHERE isActive = 1 ORDER BY createdAt ASC");
    const kumpulan = new Map();
    for (const baris of semua) {
      const kunci = (baris.color || '').toUpperCase();
      if (!kumpulan.has(kunci)) kumpulan.set(kunci, []);
      kumpulan.get(kunci).push(baris);
    }

    const warnaDigunakan = new Set(semua.map((b) => (b.color || '').toUpperCase()));
    const now = new Date().toISOString();
    let dikemas = 0;
    let indeksJana = 0;

    for (const [, ahli] of kumpulan) {
      if (ahli.length <= 1) continue; // warna dah unik, tak diusik
      // ahli[0] (paling lama) kekal; ahli selebihnya diagihkan warna baharu.
      for (let i = 1; i < ahli.length; i++) {
        let warnaBaharu = COLOR_PALETTE.find((c) => !warnaDigunakan.has(c.toUpperCase()));
        if (!warnaBaharu) {
          do {
            warnaBaharu = this.generateColorBeyondPalette(indeksJana++);
          } while (warnaDigunakan.has(warnaBaharu.toUpperCase()));
        }
        warnaDigunakan.add(warnaBaharu.toUpperCase());
        await this.dbRunMestiUbah(db, "UPDATE CategoryRegistry SET color = ?, updatedAt = ? WHERE id = ?", [warnaBaharu, now, ahli[i].id]);
        dikemas++;
      }
    }
    return { dikemas, diperiksa: semua.length };
  }

  // Cipta/guna-semula (ikut slug, sama corak macam registerCategory) + tetapkan warna PILIHAN
  // eksplisit (bukan auto-palette) + isActive=1. Guna untuk "+ Tambah Bidang" di Taksonomi.
  // `icon` (nama komponen lucide-react, kes Pascal, cth "TrendingUp") pilihan — kosong/null
  // dibiarkan kosong (fallback ikon generik di UI), bukan diagak.
  static async activateCategory(db, name, color, icon) {
    if (!name || name.trim() === '') throw new Error('Nama Bidang diperlukan.');
    const trimmedName = name.trim();
    const slug = this.getSlug(trimmedName);
    const now = new Date().toISOString();

    // PEMBETULAN (2026-09-09, dapatan bug-hunt) — invariant "tiada dua baris CategoryRegistry
    // AKTIF boleh berkongsi `name` (case-insensitive)" sudah dikuatkuasakan di setActiveStatus()
    // (laluan pulih) dan renameActiveCategory() (lihat komen panjang di kedua-dua fungsi tu),
    // tapi laluan KETIGA yang boleh set isActive=1 dgn `name` sewenang-wenangnya — laluan ni
    // ("+ Tambah Bidang", dua cawangan: cipta row baharu ATAU reaktifkan row sedia ada ikut slug
    // nama BAHARU yang ditaip, BUKAN slug row asal) — terlepas pandang sepenuhnya. Disahkan
    // reproduce (`.simulasi/sim70-aktifkan-bidang-nama-berlanggar.mjs`): Bidang A dinamakan
    // semula (slug dikunci, cuma `name` berubah) ke "Bar", kemudian "+ Tambah Bidang" ditaip
    // "Bar" lagi — slug("Bar") tak padan slug A (yang masih slug asal A), jadi cawangan CIPTA
    // BAHARU tercetus, row baharu terus isActive=1 dgn name="Bar" IDENTIK A yang masih aktif.
    // Sekat sini (sama corak, sebelum kedua-dua cawangan) — Bidang yang SUDAH pegang slug ni
    // sendiri dikecualikan (kes reaktifkan slug sendiri, `slug != ?` di bawah bukan `id != ?`
    // sebab row tu mungkin belum wujud dlm kes cipta baharu).
    const berlanggar = await this.dbGet(
      db,
      "SELECT id FROM CategoryRegistry WHERE isActive = 1 AND slug != ? AND LOWER(name) = LOWER(?)",
      [slug, trimmedName]
    );
    if (berlanggar) {
      throw new Error(`Bidang aktif "${trimmedName}" sudah wujud. Namakan semula atau pilih nama lain.`);
    }

    const existing = await this.dbGet(db, "SELECT * FROM CategoryRegistry WHERE slug = ?", [slug]);
    if (existing) {
      const finalColor = color || existing.color;
      const finalIcon = icon || existing.icon;
      // Nama dipaksa ikut apa yang ditaip di sini (bukan kekal nama lama, cth "EKONOMI" huruf
      // besar dari auto-daftar dulu) — ini tindakan kurasi Ketua Editor yang sengaja, menang
      // atas casing lama. Tak sentuh string 'desk' tersimpan pada kandungan sedia ada.
      await this.dbRun(db, "UPDATE CategoryRegistry SET name = ?, isActive = 1, color = ?, icon = ?, updatedAt = ? WHERE slug = ?", [trimmedName, finalColor, finalIcon, now, slug]);
      return { ...existing, name: trimmedName, color: finalColor, icon: finalIcon, isActive: 1 };
    }

    const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const finalColor = color || await this.pilihWarnaBelumDigunakan(db);
    const finalIcon = icon || null;
    await this.dbRun(db, `
      INSERT INTO CategoryRegistry (id, slug, name, color, icon, usageCount, isActive, originalName, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?, ?)
    `, [id, slug, trimmedName, finalColor, finalIcon, trimmedName, now, now]);
    return { id, slug, name: trimmedName, color: finalColor, icon: finalIcon, usageCount: 0, isActive: 1, originalName: trimmedName, createdAt: now, updatedAt: now };
  }

  // Arkib/pulih SATU Bidang taksonomi (2026-08-01, spesifikasi pemilik projek). Arkib TIDAK
  // mengarkibkan kandungan sedia ada dalam slot yang guna Bidang tu — itu peraturan berasingan
  // (lihat archiveLiveContentInSlot, dipanggil eksplisit apabila TUKAR Bidang satu slot, bukan
  // apabila Bidang itu sendiri diarkibkan). Bidang diarkib cuma hilang daripada senarai boleh
  // pilih untuk kandungan BAHARU — kandungan sedia ada yang sudah guna Bidang tu terus hidup.
  // Pembantu kongsi (2026-08-06, audit "kegagalan senyap") — setiap setter di bawah dahulu
  // menjalankan UPDATE ... WHERE id = ? TANPA menyemak berapa baris benar-benar berubah. Kalau id
  // tak wujud (baris diarkib/dipadam, id basi dalam tab yang lama dibuka), SQLite ubah SIFAR baris,
  // tak lempar apa-apa, dan laluan pemanggil tetap pulangkan {success:true} — Taksonomi papar
  // "warna/ikon/plat disimpan" sedangkan DB langsung tak berubah. Corak sama dengan pepijat
  // assign-slot yang disahkan hidup. Sekarang sifar baris = ralat sebenar, bukan kejayaan palsu.
  static async dbRunMestiUbah(db, query, params, mesejKalauTiada = 'Bidang tidak dijumpai.') {
    const hasil = await this.dbRun(db, query, params);
    if (!hasil || hasil.changes === 0) throw new Error(mesejKalauTiada);
    return hasil;
  }

  // PEMBETULAN (2026-09-03, dapatan bug-hunt, susulan renameActiveCategory) — pulih (un-arkib)
  // SATU Bidang cuma flip lajur isActive TANPA sebarang semakan pertindihan `name`, corak
  // kelemahan SAMA yang dibaiki di renameActiveCategory di atas tapi lubang BERBEZA: bayangkan
  // Bidang A ("Ekonomi", slug "ekonomi") diarkib, KEMUDIAN Bidang B (slug lain, cth "ekonomi-2")
  // dinamakan-semula jadi "Ekonomi" — renameActiveCategory tak sekat sebab semakannya
  // `isActive = 1` sahaja, dan A tak aktif ketika itu jadi bukan pertindihan pada masa tu. Kalau
  // A dipulihkan SELEPAS itu tanpa semakan, DUA baris CategoryRegistry aktif serentak berkongsi
  // `name` "Ekonomi" (slug berbeza) — laluan lain yang padan Bidang ikut NAMA (bukan id/slug:
  // assign-slot `active.some(c => c.name...)`, getSlotsForCategory `WHERE LOWER(manualDesk) =
  // LOWER(name)`, dropdown Bidang borang kandungan) jadi tak boleh bezakan dua baris tu lagi.
  // Ditolak eksplisit di sini (sama falsafah `unifyAllColors`/`setColor`/`renameActiveCategory`)
  // hanya bila PULIH (isActive jadi true) — arkib (isActive jadi false) tak perlu semakan ni,
  // sebab keluar daripada set aktif tak boleh cipta pertindihan.
  static async setActiveStatus(db, id, isActive) {
    if (!id) throw new Error('id Bidang diperlukan.');
    if (isActive) {
      const baris = await this.dbGet(db, "SELECT name FROM CategoryRegistry WHERE id = ?", [id]);
      if (baris) {
        const berlanggar = await this.dbGet(
          db,
          "SELECT id FROM CategoryRegistry WHERE isActive = 1 AND id != ? AND LOWER(name) = LOWER(?)",
          [id, baris.name]
        );
        if (berlanggar) {
          throw new Error(`Bidang aktif "${baris.name}" sudah wujud. Namakan semula salah satu sebelum memulihkan Bidang ini.`);
        }
      }
    }
    const now = new Date().toISOString();
    await this.dbRunMestiUbah(db, "UPDATE CategoryRegistry SET isActive = ?, updatedAt = ? WHERE id = ?", [isActive ? 1 : 0, now, id]);
  }

  // Tukar ikon SATU baris Bidang taksonomi ke ikon lucide-react terkurasi (Taksonomi -> klik badge
  // ikon). Sengaja kosongkan iconSvg — pilih ikon lucide bermaksud tinggalkan SVG custom lama.
  static async setIcon(db, id, iconName) {
    if (!id) throw new Error('id Bidang diperlukan.');
    if (!iconName || !iconName.trim()) throw new Error('Nama ikon diperlukan.');
    const now = new Date().toISOString();
    await this.dbRunMestiUbah(db, "UPDATE CategoryRegistry SET icon = ?, iconSvg = NULL, updatedAt = ? WHERE id = ?", [iconName.trim(), now, id]);
  }

  // Tetapkan SVG custom (markup dah disanitize di peringkat route sebelum sampai sini — lihat
  // categoryRoutes.js) sebagai ikon Bidang. Menang atas `icon` lucide di UI (BidangIcon), tapi
  // `icon` sendiri tak disentuh supaya ada fallback kalau iconSvg dibuang balik pada masa depan.
  static async setIconSvg(db, id, sanitizedSvg) {
    if (!id) throw new Error('id Bidang diperlukan.');
    if (!sanitizedSvg || !sanitizedSvg.trim()) throw new Error('SVG tidak sah.');
    const now = new Date().toISOString();
    await this.dbRunMestiUbah(db, "UPDATE CategoryRegistry SET iconSvg = ?, updatedAt = ? WHERE id = ?", [sanitizedSvg.trim(), now, id]);
  }

  // Warna Bidang. Warna diberi AUTOMATIK semasa Bidang dicipta, dan sehingga kini tiada cara untuk
  // menukarnya — jadi Bidang seperti "Malaysiana" boleh berakhir dengan warna yang tiada kaitan
  // langsung dengan maksudnya. Warna ini dipakai pada eyebrow kad, glif Bidang, dan eyebrow Focus
  // View, jadi ia identiti visual Bidang itu merentas seluruh portal.
  static async setColor(db, id, hex) {
    if (!id) throw new Error('id Bidang diperlukan.');
    const warna = String(hex || '').trim();
    if (!/^#[0-9a-f]{6}$/i.test(warna)) throw new Error('Warna mesti kod hex 6 digit, cth #802334.');
    const now = new Date().toISOString();
    await this.dbRunMestiUbah(db, "UPDATE CategoryRegistry SET color = ?, updatedAt = ? WHERE id = ?", [warna.toUpperCase(), now, id]);
  }

  // Namakan-semula SATU baris Bidang taksonomi — sengaja BUKAN renameCategory()/mergeCategories()
  // di atas (fungsi digabung tu remap `editorial_objects.categoryId` juga, yang dibekukan pada
  // masa penciptaan objek dan sengaja tak disentuh selepas terbit — lihat nota di seluruh
  // codebase "eo.categoryId dibekukan"). PEMBETULAN (2026-09-11, bug-hunt) — komen asal di sini
  // dulu mendakwa attribute 'desk' turut sengaja TAK dicascade "supaya kandungan lama kekal",
  // tapi 'desk' bukan teks editorial (tajuk/huraian); ia SATU-SATUNYA cara sistem padankan
  // kandungan ke Bidang (bidangRoutes.js /bidang/:slug/artikel padan STRING nama, bukan id/slug).
  // Tanpa cascade, kandungan sedia ada hilang senyap drpd Halaman Bidangnya sendiri selepas
  // rename walau slug URL dikunci kekal (disahkan reproduce, .simulasi/sim-bidang-rename.mjs) —
  // bertentangan terus dgn TUJUAN slug dikunci (nota di bawah). Kini dicascade (lihat di bawah,
  // padanan LOWER() dua-hala sama corak mergeCategories()).
  //
  // Slug DIKUNCI kekal (2026-09-02, keputusan Izzat "ikut cadangan awak") — dahulu slug dikira
  // semula dari nama BAHARU pada setiap rename, jadi pautan Halaman Bidang (/bidang/{slug}) yang
  // dah dikongsi/diindeks enjin carian akan PECAH (404) sebaik Bidang tu dinamakan semula (cth
  // baiki typo "Bahasa" -> "Bahasa Melayu"). Slug fungsi sebagai ID STABIL untuk URL (sama peranan
  // seperti kunci utama DB), TERASING drpd `name` (label paparan sahaja) — dikira SEKALI sahaja
  // semasa Bidang dicipta (createCategory/registerCategory di atas), tak pernah berubah selepas
  // itu walau nama papar bertukar berapa kali sekali pun. TIADA sistem redirect-sejarah dibina
  // (keputusan sengaja) — tiada rename pernah berlaku setakat ni (0 rekod log audit), jadi
  // membina jadual/logik redirect utk masalah yang belum wujud ialah kerumitan pra-matang.
  static async renameActiveCategory(db, id, newName) {
    if (!newName || newName.trim() === '') throw new Error('Nama Bidang diperlukan.');
    const trimmedName = newName.trim();
    const now = new Date().toISOString();
    // PEMBETULAN (2026-09-03, dapatan bug-hunt) — slug DIKUNCI (lihat nota di atas), jadi rename
    // ni cuma tukar lajur `name` paparan tanpa sebarang semakan pertindihan. Sebelum ni dua Bidang
    // AKTIF berbeza (slug berbeza, baris CategoryRegistry berbeza) boleh berakhir dengan `name`
    // IDENTIK (cth "Ekonomi" dinamakan semula jadi "Sukan" sedangkan "Sukan" (slug lain) sudah
    // wujud) — setiap laluan lain yang padan Bidang ikut NAMA (bukan id/slug: assign-slot
    // `active.some(c => c.name...)`, getSlotsForCategory `WHERE LOWER(manualDesk) = LOWER(name)`,
    // dropdown Bidang borang kandungan) jadi tak boleh bezakan dua baris tu — slot/kandungan boleh
    // tersalah kaitkan senyap. Ditolak eksplisit di sini, sama corak `unifyAllColors`/`setColor`
    // (tolak dengan sebab jelas, bukan apit senyap) — TIDAK diautomasi jadi gabung (mergeCategories)
    // sebab fungsi tu sengaja TIDAK dipakai laluan ni (cascade tulis-ganti 'desk' kandungan lama,
    // lihat nota di atas); Ketua Editor patut sedar konflik dan pilih nama lain atau gabung Bidang
    // secara eksplisit sendiri.
    const berlanggar = await this.dbGet(
      db,
      "SELECT id FROM CategoryRegistry WHERE isActive = 1 AND id != ? AND LOWER(name) = LOWER(?)",
      [id, trimmedName]
    );
    if (berlanggar) {
      throw new Error(`Bidang aktif "${trimmedName}" sudah wujud. Pilih nama lain atau gabungkan Bidang.`);
    }
    // PEMBETULAN (2026-09-08, dapatan bug-hunt) — dahulu HANYA lajur `name` di CategoryRegistry
    // ditukar; `slots_config.manualDesk` (kunci Bidang SEMASA bagi slot tu, bukan rekod sejarah
    // kandungan) dibiarkan menyimpan nama LAMA. Disahkan terhadap salinan DB sebenar: selepas
    // rename, `getSlotsForCategory(namaBaharu)` pulangkan SIFAR slot (Taksonomi nampak macam
    // peruntukan slot hilang terus), manakala manualDesk slot tu terus memegang nama lama yang
    // sudah TAK PADAN mana-mana Bidang aktif — assign-slot/dropdown borang kandungan tak lagi
    // kenal nama tu, jadi slot berkenaan terkunci pada Bidang "hantu" sehingga Pentadbir sedar dan
    // assign-slot semula secara manual. Ini BERBEZA daripada sekatan sengaja di atas (yang
    // mengelak cascade ke `editorial_objects.categoryId`/`editorial_attribute_values` — rekod
    // SEJARAH kandungan lama, memang patut kekal) — `manualDesk` bukan sejarah, ia peruntukan
    // AKTIF, jadi MESTI ikut nama baharu supaya slot terus berfungsi selepas rename.
    const lamaRow = await this.dbGet(db, "SELECT name FROM CategoryRegistry WHERE id = ?", [id]);
    await this.dbRunMestiUbah(db, "UPDATE CategoryRegistry SET name = ?, updatedAt = ? WHERE id = ?", [trimmedName, now, id]);
    if (lamaRow && lamaRow.name && lamaRow.name.toLowerCase() !== trimmedName.toLowerCase()) {
      await this.dbRun(db, `
        UPDATE slots_config SET manualDesk = ?
        WHERE layoutTemplateId = 'frontpage' AND LOWER(manualDesk) = LOWER(?)
      `, [trimmedName, lamaRow.name]);
      // PEMBETULAN (2026-09-11, bug-hunt) — attribute 'desk' kandungan sedia ada TAK PERNAH
      // dikemas kini di sini sebelum ni (sengaja, nota di atas: elak cascade tulis-ganti
      // kandungan lama, sama alasan renameCategory()/mergeCategories() TAK dipakai laluan ni).
      // Tapi 'desk' bukan teks editorial (tajuk/huraian) yang peraturan "kandungan lama kekal"
      // maksudkan — ia label pemetaan Bidang MURNI, dan SATU-SATUNYA cara sistem padankan
      // kandungan ke Bidang di SELURUH kod (bidangRoutes.js /bidang/:slug/artikel, assign-slot,
      // dropdown borang) ialah padanan STRING NAMA (bukan id/slug). Slug Bidang ni SENGAJA
      // dikunci kekal (nota di atas) khusus supaya pautan awam /bidang/{slug} tak pernah pecah
      // selepas rename — tapi tanpa cascade ni, pautan itu KEKAL 200 (tak 404) sedangkan SEMUA
      // kandungan sedia ada yang sebelum ni terpapar di situ hilang senyap terus daripada
      // senarai (bukan ralat, cuma kosong), sebab `LOWER(av.valueText) = LOWER(cat.name)` di
      // bidangRoutes.js tak lagi padan nama BAHARU. Disahkan reproduce (.simulasi/
      // sim-bidang-rename.mjs): kandungan approved WUJUD di /bidang/{slug}/artikel SEBELUM
      // rename-active, `total` jatuh terus ke 0 SELEPAS, walau slug/URL tak berubah langsung.
      // Padanan LOWER() dua-hala sama corak mergeCategories() di atas (yang MEMANG cascade
      // 'desk' bila Bidang digabung) — rename-active kini konsisten dengan gerbang sedia ada tu,
      // bukan pengecualian yang terlepas pandang.
      await this.dbRun(db, `
        UPDATE editorial_attribute_values
        SET valueText = ?
        WHERE attributeId = 'desk' AND LOWER(valueText) = LOWER(?)
      `, [trimmedName, lamaRow.name]);
    }
  }

  // Nombor slot (0-based) yang manualDesk-nya sepadan (case-insensitive) nama Bidang ni — untuk
  // paparan "Nombor Slot Diperuntukkan" di Taksonomi.
  static async getSlotsForCategory(db, name) {
    if (!name) return [];
    const rows = await this.dbAll(db,
      "SELECT slotIndex FROM slots_config WHERE layoutTemplateId = 'frontpage' AND slotIndex >= 0 AND LOWER(manualDesk) = LOWER(?) ORDER BY slotIndex ASC",
      [name]
    );
    return rows.map(r => r.slotIndex);
  }

  // Bila Bidang sesuatu slot berubah, kandungan yang sedang live/pending dalam slot tu tak lagi
  // sepadan Bidang terkunci baharu — diarkib (status flip sahaja, BUKAN padam row) supaya hilang
  // dari paparan awam tapi ID/objectId kekal selama-lamanya, boleh disiar semula lepas ni (lihat
  // PATCH /api/system/content/:id).
  static async archiveLiveContentInSlot(db, slotIndex) {
    const now = new Date().toISOString();
    await this.dbRun(db, `
      UPDATE editorial_revisions
      SET status = 'archived', updatedAt = ?
      WHERE status IN ('approved', 'pending')
        AND objectId IN (SELECT id FROM editorial_objects WHERE slotIndex = ?)
    `, [now, slotIndex]);
  }
}

export default CategoryRegistry;
