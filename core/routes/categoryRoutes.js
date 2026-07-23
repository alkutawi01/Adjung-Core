import express from 'express';
import CategoryRegistry from '../category/CategoryRegistry.js';

export function createCategoryRoutes(db) {
  const router = express.Router();

  // GET /api/system/categories
  router.get('/categories', async (req, res) => {
    try {
      const categories = await CategoryRegistry.getAllCategories(db);
      res.json(categories);
    } catch (err) {
      console.error('Fetch categories error:', err);
      res.status(500).json({ error: 'Failed to fetch categories.' });
    }
  });

  // POST /api/system/categories/register
  router.post('/categories/register', async (req, res) => {
    try {
      const { name } = req.body;
      if (!name) return res.status(400).json({ error: 'Missing name parameter.' });
      const reg = await CategoryRegistry.registerCategory(db, name);
      res.json({ success: true, category: reg });
    } catch (err) {
      console.error('Register category error:', err);
      res.status(500).json({ error: 'Failed to register category.' });
    }
  });

  // POST /api/system/categories/rename
  router.post('/categories/rename', async (req, res) => {
    try {
      const { oldName, newName } = req.body;
      if (!oldName || !newName) return res.status(400).json({ error: 'Missing oldName or newName parameter.' });
      await CategoryRegistry.renameCategory(db, oldName, newName);
      res.json({ success: true });
    } catch (err) {
      console.error('Rename category error:', err);
      res.status(500).json({ error: 'Failed to rename category.' });
    }
  });

  // POST /api/system/categories/merge
  router.post('/categories/merge', async (req, res) => {
    try {
      const { sourceCategory, targetCategory } = req.body;
      if (!sourceCategory || !targetCategory) return res.status(400).json({ error: 'Missing sourceCategory or targetCategory parameter.' });
      await CategoryRegistry.mergeCategories(db, sourceCategory, targetCategory);
      res.json({ success: true });
    } catch (err) {
      console.error('Merge categories error:', err);
      res.status(500).json({ error: 'Failed to merge categories.' });
    }
  });

  return router;
}
