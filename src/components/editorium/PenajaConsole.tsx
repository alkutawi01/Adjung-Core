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
import { EditorDialog } from '../common/EditorDialog';

// Penaja (2026-08-05, Fasa 12 — permintaan Izzat; dikemas kini 2026-08-30 audit mendalam).
// Tajaan BULANAN (lama) ATAU julat tarikh tepat (mulaTajaan/tamatTajaan, cth 7 hari), boleh
// berbilang penaja serentak. Halaman awam /penaja senaraikan SEMUA penaja aktif (lama + semasa,
// bulan terbaru dahulu); footer papar penaja AKTIF SEMASA sahaja — lihat FrontpageView.tsx dan
// HalamanPenaja.tsx. Gerbang server `manageSettings` (Pentadbir sahaja) — keputusan perniagaan/
// penempatan, bukan editorial harian, sama corak macam Direktori/Tetapan/Halaman Awam.
//
// `tayangSemasaTransisi` — togol AKTIF sepenuhnya (overlay transisi carousel sebenar, lihat
// ambilLogoTransisi()/FrontpageView.tsx). Skop kelayakan (tempoh + slot) dikira di
// core/editorial/PenajaEligibility.js, SATU tapak semakan dikongsi pelayan+klien.
interface Penaja {
  id: string;
  nama: string;
  logoUrl: string;
  url: string;
  bulan: string; // 'YYYY-MM'
  mulaTajaan?: string; // ISO 8601 +08:00, pilihan — kosong = jatuh balik ke `bulan`
  tamatTajaan?: string; // ISO 8601 +08:00, pilihan
  slotIndexes?: number[]; // kosong = portal keseluruhan, tidak kosong = skop slot tertentu
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

// Permohonan Penaja (2026-08-30) — aliran awam "Mohon Jadi Penaja", lihat
// core/routes/permohonanPenajaRoutes.js untuk carta status penuh + rujukan reka bentuk.
interface PermohonanPenaja {
  id: string;
  jenisPemohon: 'individu' | 'organisasi';
  namaSebenar: string | null;
  namaOrganisasi: string | null;
  namaWakil: string | null;
  emel: string;
  laman: string | null;
  noPendaftaran: string | null;
  aktivitiUtama: string | null;
  penerangan: string | null;
  pilihanPaparan: string | null;
  pilihanTajaan: string | null;
  catatan: string | null;
  status: string;
  catatanDalaman: string | null;
  sebabTolak: string | null;
  jumlahDipersetujui: number | null;
  buktiBayaranUrl: string | null;
  logoUrl: string | null;
  sponsorId: string | null;
  createdAt: string;
}

const STATUS_LABEL_PERMOHONAN: Record<string, string> = {
  baharu: 'Baharu',
  dalam_semakan: 'Dalam Semakan',
  perlu_maklumat: 'Perlu Maklumat',
  ditolak: 'Ditolak',
  diluluskan: 'Diluluskan — Menunggu Bayaran',
  dibayar: 'Bayaran Disahkan',
  aktif: 'Aktif',
  tamat: 'Tamat',
};
const namaPaparPermohonan = (p: PermohonanPenaja) => (p.jenisPemohon === 'individu' ? p.namaSebenar : p.namaOrganisasi) || '—';

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

// Tarikh julat tajaan (mulaTajaan/tamatTajaan) disimpan ISO 8601 + offset +08:00 (Waktu
// Malaysia, konvensyen sama seperti Jadual Terbit kandungan). Medan input HTML
// `datetime-local` tiada offset — tambah/buang secara eksplisit di sempadan borang ni sahaja.
const isoDariInputTempatan = (v: string) => (v ? `${v}:00+08:00` : '');
const inputTempatanDariIso = (iso: string | undefined) => (iso ? iso.slice(0, 16) : '');

// Skop slot dipaparkan/diedit sebagai teks nombor dipisah koma (cth "0, 5, 12") — 38 slot
// terlalu ramai utk checkbox grid tanpa membebankan borang ni; editor bukan dev, nombor slot
// sudah biasa dilihat di Editorium (label "Slot N" di mana-mana sahaja). Kosong = portal
// keseluruhan.
const slotIndexesDariTeks = (teks: string): number[] =>
  teks.split(',').map((s) => s.trim()).filter((s) => s !== '').map((s) => parseInt(s, 10)).filter((n) => !Number.isNaN(n) && n >= -1 && n <= 37);
const teksDariSlotIndexes = (arr: number[] | undefined) => (arr && arr.length > 0 ? arr.join(', ') : '');

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
  const [mulaTajaanInput, setMulaTajaanInput] = useState('');
  const [tamatTajaanInput, setTamatTajaanInput] = useState('');
  const [slotIndexesTeks, setSlotIndexesTeks] = useState('');
  const [tayangSemasaTransisi, setTayangSemasaTransisi] = useState(false);
  const [jumlahBayaran, setJumlahBayaran] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralatBorang, setRalatBorang] = useState('');
  const [mesej, setMesej] = useState('');
  const [memuatNaik, setMemuatNaik] = useState(false);
  const [notaLogo, setNotaLogo] = useState('');
  const [arkibDisahkanId, setArkibDisahkanId] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [permohonan, setPermohonan] = useState<PermohonanPenaja[]>([]);
  const [memuatPermohonan, setMemuatPermohonan] = useState(true);
  const [ralatPermohonan, setRalatPermohonan] = useState('');
  const [permohonanDibuka, setPermohonanDibuka] = useState<PermohonanPenaja | null>(null);
  const [tunjukPermohonanSelesai, setTunjukPermohonanSelesai] = useState(false);

  const muatPermohonan = useCallback(() => {
    setMemuatPermohonan(true);
    setRalatPermohonan('');
    fetch('/api/system/permohonan-penaja')
      .then(async (res) => {
        const data = await bacaJsonSelamat(res);
        if (!res.ok) throw new Error(data.error || 'Gagal membaca senarai permohonan.');
        return data;
      })
      .then((d) => setPermohonan(Array.isArray(d) ? d : []))
      .catch((e) => setRalatPermohonan(e.message || 'Gagal membaca senarai permohonan.'))
      .finally(() => setMemuatPermohonan(false));
  }, []);

  useEffect(() => { muatPermohonan(); }, [muatPermohonan]);

  const permohonanDipapar = permohonan.filter((p) =>
    tunjukPermohonanSelesai ? ['aktif', 'ditolak', 'tamat'].includes(p.status) : !['aktif', 'ditolak', 'tamat'].includes(p.status)
  );

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
    setMulaTajaanInput('');
    setTamatTajaanInput('');
    setSlotIndexesTeks('');
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
    setMulaTajaanInput(inputTempatanDariIso(p.mulaTajaan));
    setTamatTajaanInput(inputTempatanDariIso(p.tamatTajaan));
    setSlotIndexesTeks(teksDariSlotIndexes(p.slotIndexes));
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
          body: JSON.stringify({
            nama, logoUrl, url, bulan,
            mulaTajaan: isoDariInputTempatan(mulaTajaanInput),
            tamatTajaan: isoDariInputTempatan(tamatTajaanInput),
            slotIndexes: slotIndexesDariTeks(slotIndexesTeks),
            tayangSemasaTransisi,
            jumlahBayaran: jumlahBayaran === '' ? 0 : Number(jumlahBayaran),
          }),
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

      <PanelCard className="space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <SectionLabel>00 — Permohonan Penaja</SectionLabel>
            <p className="text-stone-500 text-xs">
              Permohonan awam daripada borang "Jadi Penaja Adjung Brief" (/jadi-penaja). Semak, lulus/tolak, dan aktifkan selepas bayaran disahkan.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setTunjukPermohonanSelesai((v) => !v)}>
            {tunjukPermohonanSelesai ? 'Lihat Dalam Proses' : 'Lihat Selesai/Ditolak'}
          </Button>
        </div>

        {ralatPermohonan && <MesejStatus tone="error" onCubaLagi={muatPermohonan}>{ralatPermohonan}</MesejStatus>}

        {memuatPermohonan ? (
          <KeadaanMemuat baris={3} />
        ) : permohonanDipapar.length === 0 ? (
          <KeadaanKosong>{tunjukPermohonanSelesai ? 'Tiada permohonan selesai/ditolak.' : 'Tiada permohonan dalam proses.'}</KeadaanKosong>
        ) : (
          <ul className="list-none m-0 p-0 divide-y divide-Adjung-line">
            {permohonanDipapar.map((p) => (
              <li key={p.id}>
                <button
                  type="button" onClick={() => setPermohonanDibuka(p)}
                  className="w-full text-left py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4 cursor-pointer hover:bg-stone-50 -mx-2 px-2 rounded"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge
                        tone={p.status === 'ditolak' ? 'neutral' : p.status === 'aktif' ? 'success' : 'warning'}
                        label={STATUS_LABEL_PERMOHONAN[p.status] || p.status}
                      />
                      <span className="font-mono text-[9px] uppercase tracking-wider text-stone-400">{p.id}</span>
                    </div>
                    <p className="font-serif text-sm text-stone-900 truncate mt-0.5">{namaPaparPermohonan(p)}</p>
                    <p className="text-stone-400 text-[10px] truncate">{p.emel} · {p.jenisPemohon === 'individu' ? 'Individu' : 'Organisasi'}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

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

        <div className="grid grid-cols-2 gap-4">
          <label className="flex flex-col gap-1">
            <span className={LABEL_BORANG}>Mula Tajaan (pilihan)</span>
            <input
              type="datetime-local" value={mulaTajaanInput} onChange={(e) => setMulaTajaanInput(e.target.value)}
              className={`${INPUT_BORANG} cursor-pointer`}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className={LABEL_BORANG}>Tamat Tajaan (pilihan)</span>
            <input
              type="datetime-local" value={tamatTajaanInput} onChange={(e) => setTamatTajaanInput(e.target.value)}
              className={`${INPUT_BORANG} cursor-pointer`}
            />
          </label>
        </div>
        <p className="text-stone-400 text-[10px] -mt-2">
          Isi keduanya untuk tempoh tajaan tepat (cth. 7 hari) — logo hilang tepat bila tamat. Kosongkan kedua-duanya untuk kekal ikut Bulan Tajaan di atas sahaja.
        </p>

        <label className="flex flex-col gap-1">
          <span className={LABEL_BORANG}>Skop Slot (pilihan)</span>
          <input
            type="text" value={slotIndexesTeks} onChange={(e) => setSlotIndexesTeks(e.target.value)}
            placeholder="Contoh: 0, 5, 12"
            className={INPUT_BORANG}
          />
          <span className="text-stone-400 text-[10px]">
            Nombor slot dipisah koma. Kosongkan untuk taja portal keseluruhan (semua slot).
          </span>
        </label>

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
              Untuk kegunaan dalaman: akan tentukan saiz visual penaja di /penaja apabila ciri visualisasi dibina. Tidak dipaparkan kepada awam.
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
            Papar semasa transisi karusel <span className="text-stone-400">(logo penaja akan muncul dalam panel transisi kad, ikut nisbah dan skop slot di Tetapan Am)</span>
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

        {ralat && <MesejStatus tone="error" onCubaLagi={muat}>{ralat}</MesejStatus>}

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
                  {!paparanArkib && arkibDisahkanId === p.id ? (
                    <Button
                      variant="secondary" size="sm"
                      onClick={() => { setArkibDisahkanId(''); ubahStatus(p.id, 'arkib'); }}
                    >
                      Sah Arkib?
                    </Button>
                  ) : (
                    <Tooltip text={paparanArkib ? 'Pulihkan' : 'Arkibkan'}>
                      <button
                        type="button"
                        onClick={() => (paparanArkib ? ubahStatus(p.id, 'aktif') : setArkibDisahkanId(p.id))}
                        onBlur={() => setArkibDisahkanId('')}
                        aria-label={paparanArkib ? 'Pulihkan' : 'Arkibkan'}
                        className="p-1.5 text-stone-500 hover:text-Adjung-maroon cursor-pointer"
                      >
                        {paparanArkib ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                      </button>
                    </Tooltip>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      {permohonanDibuka && (
        <PermohonanPenajaModal
          permohonan={permohonanDibuka}
          onTutup={() => setPermohonanDibuka(null)}
          onSelesai={() => { setPermohonanDibuka(null); muatPermohonan(); muat(); }}
        />
      )}
    </div>
  );
};

// Modal semakan satu permohonan penaja (2026-08-30) — papar maklumat penuh pemohon + tindakan
// ikut status semasa. Corak sama seperti PermohonanModal (DirektoriConsole.tsx): satu modal,
// tindakan berubah ikut status, bukan pelbagai modal berasingan.
function PermohonanPenajaModal({ permohonan, onTutup, onSelesai }: {
  permohonan: PermohonanPenaja;
  onTutup: () => void;
  onSelesai: () => void;
}) {
  const [catatan, setCatatan] = useState('');
  const [jumlah, setJumlah] = useState('');
  const [tempohHari, setTempohHari] = useState('31');
  const [slotIndexesTeks, setSlotIndexesTeks] = useState('');
  const [sponsorSediaAdaId, setSponsorSediaAdaId] = useState('');
  const [menghantar, setMenghantar] = useState(false);
  const [ralat, setRalat] = useState('');

  const p = permohonan;

  const hantarKeputusan = async (tindakan: string, extra?: Record<string, any>) => {
    setMenghantar(true);
    setRalat('');
    try {
      const res = await fetch(`/api/system/permohonan-penaja/${p.id}/keputusan`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tindakan, catatan, ...extra }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal merekodkan keputusan.');
      onSelesai();
    } catch (e: any) {
      setRalat(e.message || 'Gagal merekodkan keputusan.');
    } finally {
      setMenghantar(false);
    }
  };

  const sahkanBayaran = async () => {
    setMenghantar(true);
    setRalat('');
    try {
      const res = await fetch(`/api/system/permohonan-penaja/${p.id}/sahkan-bayaran`, { method: 'PATCH' });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengesahkan bayaran.');
      onSelesai();
    } catch (e: any) {
      setRalat(e.message || 'Gagal mengesahkan bayaran.');
    } finally {
      setMenghantar(false);
    }
  };

  const aktifkan = async () => {
    setMenghantar(true);
    setRalat('');
    try {
      const res = await fetch(`/api/system/permohonan-penaja/${p.id}/aktifkan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempohHari: Number(tempohHari) || 31,
          slotIndexes: slotIndexesDariTeks(slotIndexesTeks),
          sponsorSediaAdaId: sponsorSediaAdaId.trim() || undefined,
        }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengaktifkan penajaan.');
      onSelesai();
    } catch (e: any) {
      setRalat(e.message || 'Gagal mengaktifkan penajaan.');
    } finally {
      setMenghantar(false);
    }
  };

  return (
    <EditorDialog tajuk={`${p.id} — ${namaPaparPermohonan(p)}`} onTutup={onTutup} saiz="lg">
      <div className="space-y-4 text-xs font-sans">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div><span className="text-stone-400">Status:</span> {STATUS_LABEL_PERMOHONAN[p.status] || p.status}</div>
          <div><span className="text-stone-400">Jenis:</span> {p.jenisPemohon === 'individu' ? 'Individu' : 'Organisasi'}</div>
          <div><span className="text-stone-400">E-mel:</span> {p.emel}</div>
          {p.jenisPemohon === 'individu' ? (
            <div><span className="text-stone-400">Paparan diminta:</span> {p.pilihanPaparan === 'hamba_allah' ? 'Hamba Allah' : 'Nama sebenar'}</div>
          ) : (
            <>
              <div><span className="text-stone-400">Wakil:</span> {p.namaWakil || '—'}</div>
              <div><span className="text-stone-400">Laman:</span> {p.laman || '—'}</div>
              <div><span className="text-stone-400">No. Pendaftaran:</span> {p.noPendaftaran || '—'}</div>
              <div><span className="text-stone-400">Aktiviti utama:</span> {p.aktivitiUtama || '—'}</div>
            </>
          )}
          {p.pilihanTajaan && <div className="col-span-2"><span className="text-stone-400">Pilihan tajaan:</span> {p.pilihanTajaan}</div>}
          {p.penerangan && <div className="col-span-2"><span className="text-stone-400">Penerangan:</span> {p.penerangan}</div>}
          {p.catatan && <div className="col-span-2"><span className="text-stone-400">Catatan pemohon:</span> {p.catatan}</div>}
          {p.catatanDalaman && <div className="col-span-2"><span className="text-stone-400">Catatan dalaman:</span> {p.catatanDalaman}</div>}
          {p.sebabTolak && <div className="col-span-2"><span className="text-stone-400">Sebab tolak:</span> {p.sebabTolak}</div>}
          {p.jumlahDipersetujui != null && <div><span className="text-stone-400">Jumlah dipersetujui:</span> RM{Number(p.jumlahDipersetujui).toLocaleString('ms-MY')}</div>}
          {p.sponsorId && <div><span className="text-stone-400">Penaja:</span> {p.sponsorId}</div>}
        </div>

        {(p.buktiBayaranUrl || p.logoUrl) && (
          <div className="flex gap-4 border-t border-Adjung-line pt-3">
            {p.buktiBayaranUrl && (
              <div>
                <p className="text-stone-400 mb-1">Bukti Bayaran</p>
                <a href={p.buktiBayaranUrl} target="_blank" rel="noopener noreferrer">
                  <img src={p.buktiBayaranUrl} alt="Bukti bayaran" className="h-24 object-contain border border-stone-150 rounded bg-white p-1" />
                </a>
              </div>
            )}
            {p.logoUrl && (
              <div>
                <p className="text-stone-400 mb-1">Logo</p>
                <img src={p.logoUrl} alt="Logo" className="h-24 object-contain border border-stone-150 rounded bg-white p-1" />
              </div>
            )}
          </div>
        )}

        {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}

        <div className="border-t border-Adjung-line pt-3 space-y-3">
          {p.status === 'baharu' && (
            <Button variant="primary" disabled={menghantar} onClick={() => hantarKeputusan('mula_semakan')}>Mula Semakan</Button>
          )}

          {['baharu', 'dalam_semakan', 'perlu_maklumat'].includes(p.status) && (
            <>
              <label className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Catatan (untuk Minta Maklumat / Tolak)</span>
                <textarea value={catatan} onChange={(e) => setCatatan(e.target.value)} className={`${INPUT_BORANG} min-h-[60px]`} />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={menghantar} onClick={() => hantarKeputusan('minta_maklumat')}>Minta Maklumat</Button>
                <Button variant="secondary" disabled={menghantar} onClick={() => hantarKeputusan('tolak')}>Tolak</Button>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className={LABEL_BORANG}>Jumlah Tajaan Dipersetujui (RM)</span>
                  <input type="number" min="0" value={jumlah} onChange={(e) => setJumlah(e.target.value)} className={INPUT_BORANG} />
                </label>
                <Button variant="primary" disabled={menghantar || !jumlah} onClick={() => hantarKeputusan('lulus', { jumlahDipersetujui: Number(jumlah) })}>
                  Luluskan
                </Button>
              </div>
            </>
          )}

          {p.status === 'diluluskan' && !p.buktiBayaranUrl && (
            <p className="text-stone-500">Menunggu pemohon menghantar bukti bayaran melalui pautan e-mel.</p>
          )}
          {p.status === 'diluluskan' && p.buktiBayaranUrl && (
            <Button variant="primary" disabled={menghantar} onClick={sahkanBayaran}>Sahkan Bayaran Diterima</Button>
          )}

          {p.status === 'dibayar' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex flex-col gap-1">
                  <span className={LABEL_BORANG}>Tempoh Tajaan (hari, maks 31)</span>
                  <input type="number" min="1" max="31" value={tempohHari} onChange={(e) => setTempohHari(e.target.value)} className={INPUT_BORANG} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className={LABEL_BORANG}>Skop Slot (pilihan)</span>
                  <input type="text" value={slotIndexesTeks} onChange={(e) => setSlotIndexesTeks(e.target.value)} placeholder="Contoh: 0, 5, 12" className={INPUT_BORANG} />
                </label>
              </div>
              <label className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Pautkan kepada Penaja Sedia Ada (pembaharuan, pilihan)</span>
                <input type="text" value={sponsorSediaAdaId} onChange={(e) => setSponsorSediaAdaId(e.target.value)} placeholder="ID penaja sedia ada — kosongkan untuk cipta baharu" className={INPUT_BORANG} />
                <span className="text-stone-400 text-[10px]">Guna ni untuk Hamba Allah yang menyambung semula, supaya nombor kekal sama.</span>
              </label>
              <Button variant="primary" disabled={menghantar} onClick={aktifkan}>Aktifkan sebagai Penaja</Button>
            </>
          )}

          {['aktif', 'ditolak', 'tamat'].includes(p.status) && (
            <p className="text-stone-500">Permohonan ini sudah selesai.</p>
          )}
        </div>
      </div>
    </EditorDialog>
  );
}
