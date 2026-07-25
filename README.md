# Adjung Brief

Portal berita/kandungan bahasa Melayu bergaya "scholarly magazine" — bento-grid
frontpage yang memaparkan kandungan editorial (berita, ilmu, kebudayaan), diurus
melalui alat editorial dalaman **Adjung Brief** (Editorium).

Stack: Vite + React (`src/`) + Express (`server.js`) + SQLite (`adjung.db`).

## Jalankan Secara Tempatan

**Prasyarat:** Node.js

1. Pasang dependencies:
   `npm install`
2. Jalankan aplikasi (frontend + backend serentak):
   `npm run dev`
3. Buka http://localhost:3000 untuk frontpage awam, atau
   http://localhost:3000/editorium untuk Editorium (admin editorial).

Tiada API key diperlukan untuk jalan asas — sumber kandungan (RSS) percuma dan
tidak bergantung kepada mana-mana API AI berbayar.

## Struktur Ringkas

- `src/components/portal/` — halaman awam (bento frontpage)
- `src/components/editorium/` — konsol editorial dalaman (Adjung Brief)
- `core/` — logik editorial & AI pipeline sisi pelayan (dikongsi dengan `server.js`)
- `server.js` — API Express + pangkalan data SQLite

Rujuk [CLAUDE.md](CLAUDE.md) untuk peraturan seni bina dan konvensyen projek.
