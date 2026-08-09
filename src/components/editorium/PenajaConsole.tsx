import React, { useCallback, useEffect, useRef, useState } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { Archive, ArchiveRestore, Pencil, Upload } from 'lucide-react';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { SectionLabel } from '../common/SectionLabel';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { FormColumn } from '../common/FormColumn';
import { LABEL_BORANG, INPUT_BORANG } from '../common/gayaKongsi';

// Penaja (2026-08-05, Fasa 12 — permintaan Izzat). Tajaan BULANAN, boleh berbilang penaja
// serentak dalam satu bulan. Halaman awam /penaja senaraikan SEMUA penaja aktif (lama + semasa,
// bulan terbaru dahulu); footer papar penaja bulan SEMASA sahaja — lihat FrontpageView.tsx dan
// HalamanPenaja.tsx. Gerbang server `manageSettings` (Pentadbir sahaja) — keputusan perniagaan/
// penempatan, bukan editorial harian, sama corak macam Direktori/Tetapan/Halaman Awam.
//
// `tayangSemasaTransisi` — togol DATA sahaja buat masa ini (keputusan Izzat 2026-08-05): bina
// tetapan/wiring dulu, overlay transisi carousel sebenar KEMUDIAN selepas reka bentuk/kelakuan
// disahkan — JSX carousel tu rapuh (lihat CLAUDE.md). Togol ni belum beri sebarang kesan visual.
interface Penaja {
  id: string;
  nama: string;
  logoUrl: string;
  url: string;
  bulan: string; // 'YYYY-MM'
  tayangSemasaTransisi: boolean;
  // Jumlah bayaran (2026-08-05, permintaan Izzat) — utk kegunaan DALAMAN sahaja buat masa ini:
  // halaman /penaja akan dinaik taraf supaya saiz "kotak" setiap penaja berkadar terus dgn
  // jumlah tajaan (cth RM1000 = kotak 10x lebih besar drpd RM100), tapi pengiraan/lukisan
  // sebenar ialah kerja fasa akan datang — angka ni TIDAK dipaparkan di /penaja sekarang
  // (maklumat sensitif, laluan awam sengaja tak pulangkan medan ni — lihat sponsorRoutes.js).
  jumlahBayaran: number;
  status: 'aktif' | 'arkib';
  dikemasPada: string;
}

const HAD_NAMA = 100;
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const bulanRingkas = (bulan: string) => {
  const [tahun, bulanNo] = (bulan || '').split('-');
  if (!tahun || !bulanNo) return bulan || '—';
  const d = new Date(Number(tahun), Number(bulanNo) - 1, 1);
  if (Number.isNaN(d.getTime())) return bulan;
  return d.toLocaleDateString('ms-MY', { month: 'long', year: 'numeric' });
};

const bulanSemasaInput = () => new Date().toISOString().slice(0, 7);

export const PenajaConsole: React.FC = () => {
  const [senarai, setSenarai] = useState<Penaja[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');
  const [paparanArkib, setPaparanArkib] = useState(false);

  const [menyunting, setMenyunting] = useState<string>('');
  const [nama, setNama] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [url, setUrl] = useState('');
  const [bulan, setBulan] = useState(bulanSemasaInput());
  const [tayangSemasaTransisi, setTayangSemasaTransisi] = useState(false);
  const [jumlahBayaran, setJumlahBayaran] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralatBorang, setRalatBorang] = useState('');
  const [mesej, setMesej] = useState('');
  const [memuatNaik, setMemuatNaik] = useState(false);
  const [notaLogo, setNotaLogo] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const muat = useCallback(() => {
    setMemuat(true);
    setRalat('');
    fetch('/api/system/sponsors')
      .then(async (res) => {
        const data = await bacaJsonSelamat(res);
        if (!res.ok) throw new Error(data.error || 'Gagal membaca senarai penaja.');
        return data;
      })
      .then((d) => setSenarai(Array.isArray(d) ? d : []))
      .catch((e) => setRalat(e.message || 'Gagal membaca senarai penaja.'))
      .finally(() => setMemuat(false));
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const kosongkanBorang = () => {
    setMenyunting('');
    setNama('');
    setLogoUrl('');
    setUrl('');
    setBulan(bulanSemasaInput());
    setTayangSemasaTransisi(false);
    setJumlahBayaran('');
    setRalatBorang('');
  };

  const mulaSunting = (p: Penaja) => {
    setMenyunting(p.id);
    setNama(p.nama);
    setLogoUrl(p.logoUrl);
    setUrl(p.url);
    setBulan(p.bulan);
    setTayangSemasaTransisi(p.tayangSemasaTransisi);
    setJumlahBayaran(p.jumlahBayaran ? String(p.jumlahBayaran) : '');
    setRalatBorang('');
  };

  const muatNaikLogo = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setNotaLogo('Fail mesti imej');
      setTimeout(() => setNotaLogo(''), 2400);
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setNotaLogo('Fail terlalu besar (had 5MB)');
      setTimeout(() => setNotaLogo(''), 2400);
      return;
    }
    setMemuatNaik(true);
    try {
      const fileData: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Gagal baca fail'));
        reader.readAsDataURL(file);
      });
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, fileData }),
      });
      if (!res.ok) throw new Error('Muat naik gagal');
      const data = await bacaJsonSelamat(res);
      setLogoUrl(data.url);
      setNotaLogo('Dimuat naik');
    } catch (e) {
      setNotaLogo('Muat naik gagal, cuba lagi');
    } finally {
      setMemuatNaik(false);
      setTimeout(() => setNotaLogo(''), 2400);
    }
  };

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setRalatBorang('');
    try {
      const menyuntingSedia = !!menyunting;
      const res = await fetch(
        menyuntingSedia ? `/api/system/sponsors/${menyunting}` : '/api/system/sponsors',
        {
          method: menyuntingSedia ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ nama, logoUrl, url, bulan, tayangSemasaTransisi, jumlahBayaran: jumlahBayaran === '' ? 0 : Number(jumlahBayaran) }),
        }
      );
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan penaja.');
      kosongkanBorang();
      setMesej(menyuntingSedia ? 'Penaja dikemas kini' : 'Penaja ditambah');
      setTimeout(() => setMesej(''), 6000);
      muat();
    } catch (err: any) {
      setRalatBorang(err.message || 'Gagal menyimpan penaja.');
    } finally {
      setMenyimpan(false);
    }
  };

  const ubahStatus = async (id: string, status: 'aktif' | 'arkib') => {
    try {
      const res = await fetch(`/api/system/sponsors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini penaja.');
      muat();
    } catch (err: any) {
      setRalat(err.message || 'Gagal mengemas kini penaja.');
    }
  };

  const senaraiDipapar = senarai.filter((p) => (paparanArkib ? p.status === 'arkib' : p.status === 'aktif'));

  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Penaja"
        huraian="Urus tajaan bulanan portal. Penaja bulan semasa dipapar di footer Frontpage, semua penaja aktif dipapar di halaman /penaja."
      />

      <PanelCard className="text-xs">
        <form onSubmit={hantar} className="space-y-4">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <SectionLabel>01 — {menyunting ? 'Sunting Penaja' : 'Tambah Penaja'}</SectionLabel>
            <p className="text-stone-500 text-xs">
              Papar di footer Frontpage ("Portal ini disokong oleh:") hanya untuk bulan yang dipilih. Halaman /penaja senaraikan semua penaja aktif.
            </p>
          </div>
          {menyunting && (
            <Button variant="secondary" onClick={kosongkanBorang}>Batal Sunting</Button>
          )}
        </div>

        {/* Lajur borang berhad lebar — borang ni kekal terpampang dalam PanelCard selebar
            halaman, jadi tanpa had setiap medan terbentang lebih 1000px. Butang hantar dan
            mesej ralat turut dibalut supaya tepi kanannya sejajar medan, bukan tepi skrin. */}
        <FormColumn saiz="md" className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className={`${LABEL_BORANG} flex justify-between`}>
              <span>Nama Penaja</span>
              <span className={nama.length > HAD_NAMA ? 'text-[var(--color-error)]' : 'text-stone-400'}>{nama.length}/{HAD_NAMA}</span>
            </span>
            <input
              type="text" value={nama} onChange={(e) => setNama(e.target.value)}
              placeholder="Nama syarikat/penaja"
              className={INPUT_BORANG}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={LABEL_BORANG}>Bulan Tajaan</span>
            <input
              type="month" value={bulan} onChange={(e) => setBulan(e.target.value)}
              className={`${INPUT_BORANG} cursor-pointer`}
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className={LABEL_BORANG}>URL Laman Penaja (pilihan)</span>
          <input
            type="text" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://"
            className={INPUT_BORANG}
          />
        </label>

        {/* Lebih sempit daripada lajur induk — medan ni satu nombor sahaja. */}
        <FormColumn saiz="sm">
          <label className="flex flex-col gap-1">
            <span className={LABEL_BORANG}>Jumlah Bayaran (RM)</span>
            <input
              type="number" min="0" step="1" value={jumlahBayaran} onChange={(e) => setJumlahBayaran(e.target.value)}
              placeholder="0"
              className={INPUT_BORANG}
            />
            <span className="text-stone-400 text-[10px]">
              Untuk kegunaan dalaman — akan tentukan saiz visual penaja di /penaja apabila ciri visualisasi dibina. Tidak dipaparkan kepada awam.
            </span>
          </label>
        </FormColumn>

        <label className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-3">
            <span className={LABEL_BORANG}>Logo</span>
            {notaLogo && <span className="font-sans text-[9px] text-stone-400">{notaLogo}</span>}
          </span>
          <span className="flex items-center gap-2">
            <input
              type="text" value={logoUrl} placeholder="Nama fail / URL logo" onChange={(e) => setLogoUrl(e.target.value)}
              className={`${INPUT_BORANG} w-0 flex-1`}
            />
            <Button
              variant="secondary" size="sm" className="shrink-0"
              disabled={memuatNaik} onClick={() => fileInputRef.current?.click()}
              icon={<Upload className="w-3 h-3" />}
            >
              {memuatNaik ? 'Memuat naik…' : 'Muat naik'}
            </Button>
          </span>
          <input
            ref={fileInputRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) muatNaikLogo(f); e.target.value = ''; }}
          />
          {logoUrl && (
            <img src={logoUrl} alt="Pratonton logo" className="mt-1 h-10 object-contain border border-stone-150 rounded bg-white p-1" />
          )}
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox" checked={tayangSemasaTransisi}
            onChange={(e) => setTayangSemasaTransisi(e.target.checked)}
            className="cursor-pointer"
          />
          <span className="text-stone-600 text-xs">
            Papar semasa transisi karusel <span className="text-stone-400">(akan datang dan belum tersedia dalam antara muka)</span>
          </span>
        </label>

        {ralatBorang && <MesejStatus tone="error">{ralatBorang}</MesejStatus>}

        <div className="flex items-center justify-end gap-3 pt-1">
          {mesej && <span className="text-[var(--color-success)] text-[11px] font-semibold">{mesej}</span>}
          <Button
            type="submit"
            variant="primary"
            disabled={menyimpan || !nama.trim() || nama.length > HAD_NAMA || !/^\d{4}-\d{2}$/.test(bulan)}
          >
            {menyimpan ? 'Menyimpan…' : menyunting ? 'Simpan Perubahan' : 'Tambah Penaja'}
          </Button>
        </div>
        </FormColumn>
        </form>
      </PanelCard>

      <PanelCard className="space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <SectionLabel>02 — {paparanArkib ? 'Penaja Diarkibkan' : 'Penaja Aktif'}</SectionLabel>
            <p className="text-stone-500 text-xs">
              {paparanArkib
                ? 'Penaja yang ditarik balik. Boleh dipulihkan bila-bila.'
                : 'Semua penaja aktif (lama & semasa), susun bulan terbaru dahulu.'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => setPaparanArkib((v) => !v)}>
            {paparanArkib ? 'Lihat Aktif' : 'Lihat Arkib'}
          </Button>
        </div>

        {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}

        {memuat ? (
          <KeadaanMemuat baris={4} />
        ) : senaraiDipapar.length === 0 ? (
          <KeadaanKosong>{paparanArkib ? 'Tiada penaja diarkibkan.' : 'Tiada penaja aktif.'}</KeadaanKosong>
        ) : (
          <ul className="list-none m-0 p-0 divide-y divide-Adjung-line">
            {senaraiDipapar.map((p) => (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1 flex items-center gap-3">
                  {p.logoUrl ? (
                    <img src={p.logoUrl} alt={p.nama} className="h-8 w-8 object-contain border border-stone-150 rounded bg-white p-1 shrink-0" />
                  ) : (
                    <div className="h-8 w-8 shrink-0 border border-stone-150 rounded bg-stone-50" />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Status penaja — penaja aktif nada `success`, penaja diarkibkan nada
                          `neutral` (bukan kegagalan, cuma tidak lagi disiarkan). */}
                      <StatusBadge
                        tone={p.status === 'aktif' ? 'success' : 'neutral'}
                        label={bulanRingkas(p.bulan)}
                      />
                      {p.tayangSemasaTransisi && (
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">Transisi diaktifkan</span>
                      )}
                    </div>
                    <p className="font-serif text-sm text-stone-900 truncate">{p.nama}</p>
                    <p className="text-stone-400 text-[10px] truncate">
                      {p.url}{p.url && p.jumlahBayaran > 0 ? ' · ' : ''}{p.jumlahBayaran > 0 ? `RM${p.jumlahBayaran.toLocaleString('ms-MY')}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!paparanArkib && (
                    <Tooltip text="Sunting">
                      <button
                        type="button" onClick={() => mulaSunting(p)}
                        aria-label="Sunting" className="p-1.5 text-stone-500 hover:text-Adjung-maroon cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  )}
                  <Tooltip text={paparanArkib ? 'Pulihkan' : 'Arkibkan'}>
                    <button
                      type="button"
                      onClick={() => ubahStatus(p.id, paparanArkib ? 'aktif' : 'arkib')}
                      aria-label={paparanArkib ? 'Pulihkan' : 'Arkibkan'}
                      className="p-1.5 text-stone-500 hover:text-Adjung-maroon cursor-pointer"
                    >
                      {paparanArkib ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                    </button>
                  </Tooltip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  );
};
