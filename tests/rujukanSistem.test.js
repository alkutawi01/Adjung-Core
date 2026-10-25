import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import sqlite3 from 'sqlite3';
import {
  sahkanRujukan, KAD_AWAL, pastikanSkemaRujukan, createRujukanSistemRoutes, HAD_TAJUK, HAD_KANDUNGAN, HAD_KAD,
} from '../core/routes/rujukanSistemRoutes.js';

function bukaDb() {
  const db = new sqlite3.Database(':memory:');
  const dbRun = (sql, p = []) => new Promise((res, rej) => db.run(sql, p, function (e) { e ? rej(e) : res(this); }));
  const dbGet = (sql, p = []) => new Promise((res, rej) => db.get(sql, p, (e, r) => (e ? rej(e) : res(r))));
  const dbAll = (sql, p = []) => new Promise((res, rej) => db.all(sql, p, (e, r) => (e ? rej(e) : res(r))));
  return { db, dbRun, dbGet, dbAll };
}

test('sahkanRujukan: terima kad biasa, tolak kosong dan melebihi had', () => {
  assert.equal(sahkanRujukan({ tajuk: 'Hosting', kandungan: 'DigitalOcean' }).ok, true);
  assert.equal(sahkanRujukan({ tajuk: '  ', kandungan: 'x' }).ok, false);
  assert.equal(sahkanRujukan({ tajuk: 'x', kandungan: '   ' }).ok, false);
  assert.equal(sahkanRujukan({ tajuk: 'a'.repeat(HAD_TAJUK + 1), kandungan: 'x' }).ok, false);
  assert.equal(sahkanRujukan({ tajuk: 'x', kandungan: 'a'.repeat(HAD_KANDUNGAN + 1) }).ok, false);
  assert.equal(sahkanRujukan({ tajuk: 'x', kandungan: 'a'.repeat(HAD_KANDUNGAN) }).ok, true);
  assert.deepEqual(sahkanRujukan({ kandungan: 'baharu' }, { sebahagian: true }), { ok: true, kandungan: 'baharu' });
  assert.equal(sahkanRujukan({ tajuk: '' }, { sebahagian: true }).ok, false);
});

test('sahkanRujukan: tolak kunci dan token rahsia yang jelas', () => {
  const tolak = (teks) => sahkanRujukan({ tajuk: 'Nota', kandungan: teks }).ok === false;
  assert.ok(tolak('-----BEGIN OPENSSH PRIVATE KEY-----\nabc'));
  assert.ok(tolak('-----BEGIN RSA PRIVATE KEY-----'));
  assert.ok(tolak('token: ghp_' + 'a'.repeat(30)));
  assert.ok(tolak('github_pat_' + 'A1'.repeat(20)));
  assert.ok(tolak('sk-' + 'x'.repeat(30)));
  assert.ok(tolak('AKIA' + 'ABCDEFGHIJKLMNOP'));
  assert.ok(tolak('xoxb-1234567890-abcdef'));
  assert.ok(tolak('re_' + 'a'.repeat(30)));
  assert.equal(sahkanRujukan({ tajuk: 'Resend', kandungan: 'Domain penghantar ialah mail.adjung.com' }).ok, true);
  assert.equal(sahkanRujukan({ tajuk: 'URL', kandungan: 'https://brief.adjung.com/sains/kandungan/bank-dunia-unjur-ekonomi-india-tumbuh-7-1-peratus' }).ok, true);
});

test('kandungan awal: lulus pengesahan sendiri, tiada IP, em dash atau rahsia', () => {
  assert.ok(KAD_AWAL.length >= 6 && KAD_AWAL.length <= HAD_KAD);
  for (const k of KAD_AWAL) {
    assert.equal(sahkanRujukan(k).ok, true, k.tajuk);
    assert.ok(!/\b\d{1,3}(\.\d{1,3}){3}\b/.test(k.tajuk + k.kandungan), 'tiada alamat IP: ' + k.tajuk);
    assert.ok(!/—/.test(k.tajuk + k.kandungan), 'tiada em dash: ' + k.tajuk);
    assert.ok(!/kata laluan\s*[:=]/i.test(k.kandungan), 'tiada kata laluan: ' + k.tajuk);
  }
});

test('semai: sekali sahaja, tidak muncul semula selepas semua kad dipadam', async () => {
  const d = bukaDb();
  await pastikanSkemaRujukan(d.dbRun, d.dbGet);
  assert.equal((await d.dbAll(`SELECT * FROM rujukan_sistem`)).length, KAD_AWAL.length);
  await pastikanSkemaRujukan(d.dbRun, d.dbGet);
  assert.equal((await d.dbAll(`SELECT * FROM rujukan_sistem`)).length, KAD_AWAL.length, 'tidak digandakan');
  await d.dbRun(`DELETE FROM rujukan_sistem`);
  await pastikanSkemaRujukan(d.dbRun, d.dbGet);
  assert.equal((await d.dbAll(`SELECT * FROM rujukan_sistem`)).length, 0, 'tidak disemai semula');
});

// ---- kebenaran sebenar melalui pelayan Express ujian -----------------------------------------

async function mulaPelayan(pengguna) {
  const d = bukaDb();
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { if (pengguna.nilai) req.session = { user: pengguna.nilai }; next(); });
  app.use('/api', createRujukanSistemRoutes(d.dbAll, d.dbGet, d.dbRun));
  await d.dbRun(`CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, createdAt TEXT, actorId TEXT, actorName TEXT, action TEXT, targetType TEXT, targetId TEXT, detail TEXT)`).catch(() => {});
  const server = await new Promise((res) => { const s = app.listen(0, '127.0.0.1', () => res(s)); });
  const asas = `http://127.0.0.1:${server.address().port}/api/system/rujukan-sistem`;
  const panggil = async (kaedah, laluan = '', badan) => {
    const r = await fetch(asas + laluan, { method: kaedah, headers: { 'Content-Type': 'application/json' }, body: badan ? JSON.stringify(badan) : undefined });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  };
  return { panggil, tutup: () => server.close(), ...d };
}

test('kebenaran: tanpa sesi 401; editor boleh baca tetapi tidak boleh ubah; Pentadbir boleh', async () => {
  const pengguna = { nilai: null };
  const s = await mulaPelayan(pengguna);
  try {
    assert.equal((await s.panggil('GET')).status, 401);

    pengguna.nilai = { id: 'u1', username: 'editor1', roles: ['editor'] };
    const baca = await s.panggil('GET');
    assert.equal(baca.status, 200);
    assert.ok(baca.json.kad.length >= 6);
    const id = baca.json.kad[0].id;
    assert.equal((await s.panggil('POST', '', { tajuk: 'T', kandungan: 'K' })).status, 403);
    assert.equal((await s.panggil('PATCH', '/' + id, { kandungan: 'Cubaan' })).status, 403);
    assert.equal((await s.panggil('DELETE', '/' + id)).status, 403);

    pengguna.nilai = { id: 'u2', username: 'pentadbir1', penName: 'Pentadbir Satu', roles: ['pentadbir'] };
    const tambah = await s.panggil('POST', '', { tajuk: 'Kad baharu', kandungan: 'Isi **penting**' });
    assert.equal(tambah.status, 200);
    const sunting = await s.panggil('PATCH', '/' + tambah.json.id, { kandungan: 'Isi dikemas kini' });
    assert.equal(sunting.status, 200);
    const selepas = (await s.panggil('GET')).json.kad.find((k) => k.id === tambah.json.id);
    assert.equal(selepas.kandungan, 'Isi dikemas kini');
    assert.equal(selepas.tajuk, 'Kad baharu', 'tajuk tidak berubah pada PATCH separa');
    assert.equal(selepas.dikemaskiniOleh, 'Pentadbir Satu');
    assert.equal((await s.panggil('PATCH', '/' + tambah.json.id, { kandungan: 'ghp_' + 'z'.repeat(30) })).status, 400);
    assert.equal((await s.panggil('PATCH', '/tiada-id', { kandungan: 'x' })).status, 404);
    assert.equal((await s.panggil('PATCH', '/' + tambah.json.id, {})).status, 400);
    assert.equal((await s.panggil('DELETE', '/' + tambah.json.id)).status, 200);
    assert.equal((await s.panggil('GET')).json.kad.some((k) => k.id === tambah.json.id), false);
  } finally {
    s.tutup();
  }
});
