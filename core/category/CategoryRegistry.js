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
  '#15803D'  // Green 800
];

class CategoryRegistry {
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

    // Assign color
    const allRegistered = await this.dbAll(db, "SELECT color FROM CategoryRegistry");
    const assignedColors = allRegistered.map(r => r.color.toUpperCase());

    // Find first unused color
    let chosenColor = COLOR_PALETTE.find(c => !assignedColors.includes(c.toUpperCase()));
    if (!chosenColor) {
      // Fallback wrap around
      chosenColor = COLOR_PALETTE[allRegistered.length % COLOR_PALETTE.length];
    }

    const id = `cat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    await this.dbRun(db, `
      INSERT INTO CategoryRegistry (id, slug, name, color, usageCount, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 0, ?, ?)
    `, [id, slug, name, chosenColor, now, now]);

    return { id, slug, name, color: chosenColor, usageCount: 0, createdAt: now, updatedAt: now };
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
}

export default CategoryRegistry;
