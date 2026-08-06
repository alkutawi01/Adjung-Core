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
      chosenColor = this.generateColorBeyondPalette(allRegistered.length);
      while (assignedColors.includes(chosenColor.toUpperCase())) {
        chosenColor = this.generateColorBeyondPalette(allRegistered.length + assignedColors.length);
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

  static async renameCategory(db, oldName, newName) {
    if (!oldName || !newName || oldName.trim() === '' || newName.trim() === '') return;
    const oldSlug = this.getSlug(oldName);
    const newNameClean = newName.trim();
    const newSlug = this.getSlug(newNameClean);

    // If new slug is identical to old, just rename display name
    if (oldSlug === newSlug) {
      const now = new Date().toISOString();
      await this.dbRun(db, `
        UPDATE CategoryRegistry 
        SET name = ?, updatedAt = ? 
        WHERE slug = ?
      `, [newNameClean, now, oldSlug]);
      return;
    }

    // Check if new category already exists
    const targetExists = await this.dbGet(db, "SELECT * FROM CategoryRegistry WHERE slug = ?", [newSlug]);
    if (targetExists) {
      // Merge them instead
      await this.mergeCategories(db, oldName, newNameClean);
      return;
    }

    // Just update slug and name
    const now = new Date().toISOString();
    await this.dbRun(db, `
      UPDATE CategoryRegistry 
      SET slug = ?, name = ?, updatedAt = ? 
      WHERE slug = ?
    `, [newSlug, newNameClean, now, oldSlug]);
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

    // Combine usageCounts
    const now = new Date().toISOString();
    await this.dbRun(db, `
      UPDATE CategoryRegistry 
      SET usageCount = usageCount + ?, updatedAt = ? 
      WHERE slug = ?
    `, [sourceReg.usageCount, now, targetReg.slug]);

    // Delete source category from registry
    await this.dbRun(db, "DELETE FROM CategoryRegistry WHERE slug = ?", [sourceSlug]);

    // Re-map any saved items matching source slug/category to target category uppercase
    const targetNameUpper = targetReg.name.toUpperCase();
    
    // Update editorial_objects
    await this.dbRun(db, `
      UPDATE editorial_objects 
      SET categoryId = ? 
      WHERE categoryId = ? OR categoryId = ?
    `, [targetNameUpper, sourceCategory.trim().toUpperCase(), sourceReg.name.toUpperCase()]);

    // Update attribute values
    await this.dbRun(db, `
      UPDATE editorial_attribute_values
      SET valueText = ?
      WHERE attributeId = 'desk' AND (valueText = ? OR valueText = ?)
    `, [targetNameUpper, sourceCategory.trim().toUpperCase(), sourceReg.name.toUpperCase()]);
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
        await this.dbRun(db, "UPDATE CategoryRegistry SET color = ?, updatedAt = ? WHERE id = ?", [warnaBaharu, now, ahli[i].id]);
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
  static async setActiveStatus(db, id, isActive) {
    if (!id) throw new Error('id Bidang diperlukan.');
    const now = new Date().toISOString();
    await this.dbRun(db, "UPDATE CategoryRegistry SET isActive = ?, updatedAt = ? WHERE id = ?", [isActive ? 1 : 0, now, id]);
  }

  // Tukar ikon SATU baris Bidang taksonomi ke ikon lucide-react terkurasi (Taksonomi -> klik badge
  // ikon). Sengaja kosongkan iconSvg — pilih ikon lucide bermaksud tinggalkan SVG custom lama.
  static async setIcon(db, id, iconName) {
    if (!id) throw new Error('id Bidang diperlukan.');
    if (!iconName || !iconName.trim()) throw new Error('Nama ikon diperlukan.');
    const now = new Date().toISOString();
    await this.dbRun(db, "UPDATE CategoryRegistry SET icon = ?, iconSvg = NULL, updatedAt = ? WHERE id = ?", [iconName.trim(), now, id]);
  }

  // Tetapkan SVG custom (markup dah disanitize di peringkat route sebelum sampai sini — lihat
  // categoryRoutes.js) sebagai ikon Bidang. Menang atas `icon` lucide di UI (BidangIcon), tapi
  // `icon` sendiri tak disentuh supaya ada fallback kalau iconSvg dibuang balik pada masa depan.
  static async setIconSvg(db, id, sanitizedSvg) {
    if (!id) throw new Error('id Bidang diperlukan.');
    if (!sanitizedSvg || !sanitizedSvg.trim()) throw new Error('SVG tidak sah.');
    const now = new Date().toISOString();
    await this.dbRun(db, "UPDATE CategoryRegistry SET iconSvg = ?, updatedAt = ? WHERE id = ?", [sanitizedSvg.trim(), now, id]);
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
    await this.dbRun(db, "UPDATE CategoryRegistry SET color = ?, updatedAt = ? WHERE id = ?", [warna.toUpperCase(), now, id]);
  }

  // Plat ilustrasi BESAR Bidang (markup dah disanitize + disahkan ikut spec di categoryRoutes.js).
  // Berasingan sepenuhnya daripada iconSvg: yang itu glif masthead 13px, ini plat bacaan ~240px
  // dalam kolum kanan Focus View. Menetapkan satu tidak menyentuh satu lagi.
  static async setIllustrationSvg(db, id, sanitizedSvg) {
    if (!id) throw new Error('id Bidang diperlukan.');
    if (!sanitizedSvg || !sanitizedSvg.trim()) throw new Error('SVG tidak sah.');
    const now = new Date().toISOString();
    await this.dbRun(db, "UPDATE CategoryRegistry SET illustrationSvg = ?, updatedAt = ? WHERE id = ?", [sanitizedSvg.trim(), now, id]);
  }

  // Buang plat ilustrasi. Bidang kembali tiada plat — kolum kanan Focus View jadi ruang lapang
  // senyap, bukan pemegang tempat.
  static async clearIllustrationSvg(db, id) {
    if (!id) throw new Error('id Bidang diperlukan.');
    const now = new Date().toISOString();
    await this.dbRun(db, "UPDATE CategoryRegistry SET illustrationSvg = NULL, updatedAt = ? WHERE id = ?", [now, id]);
  }

  // Namakan-semula SATU baris Bidang taksonomi — sengaja BUKAN renameCategory()/mergeCategories()
  // di atas, sebab dua fungsi tu cascade-tulis-ganti string 'desk' dalam editorial_objects/
  // editorial_attribute_values (melanggar peraturan "kandungan lama kekal"). Ni cuma ubah baris
  // taksonomi tu sendiri.
  static async renameActiveCategory(db, id, newName) {
    if (!newName || newName.trim() === '') throw new Error('Nama Bidang diperlukan.');
    const trimmedName = newName.trim();
    const newSlug = this.getSlug(trimmedName);
    const now = new Date().toISOString();
    await this.dbRun(db, "UPDATE CategoryRegistry SET name = ?, slug = ?, updatedAt = ? WHERE id = ?", [trimmedName, newSlug, now, id]);
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
