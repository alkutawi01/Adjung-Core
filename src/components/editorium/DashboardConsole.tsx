import React, { useEffect, useState } from 'react';
import { Image as ImageIcon } from 'lucide-react';
import { labelTindakan } from './LogAuditConsole';
import { SlotMatrixCell } from '../common/SlotMatrixCell';
import { StatusBadge } from '../common/StatusBadge';
import { Tooltip } from '../common/Tooltip';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { PosterGenerator } from './PosterGenerator';

// Paparan Utama (2026-08-02, Fasa 5) — destinasi lalai selepas log masuk.
//
// 2026-08-02 (dibetulkan sama hari, teguran Izzat: "dashboard ni umum... bukan utk
// sorang2 editor la... dia mcm dashboard syarikat, dashboard production") — versi pertama
// silap letak "Draf Saya" (skop PERIBADI seorang editor sahaja) dan sapaan bernama di
// dashboard yang sepatutnya gambaran OPERASI KESELURUHAN organisasi. Draf Saya kekal
// destinasi sendiri di sidebar (skop peribadi tu memang tempatnya), dashboard ni cuma
// papar apa yang benar bagi SEMUA orang — status kandungan, kesihatan sistem, keaktifan
// pasukan keseluruhan.
//
// 2026-08-03 — reka bentuk semula ikut mockup Claude Design Izzat (Papan Pemuka Editorium):
// gaya "ledger editorial" (garis rambut, sans/serif/mono, warna lebih senyap) gantikan
// susunan kad-putih-berbayang asal. Struktur data/fetch KEKAL — cuma bina semula render,
// TAMBAH pengiraan matriks slot penuh & suapan aktiviti daripada data yang sedia difetch.
//
// Digabung daripada laluan SEDIA ADA (content/all, editor-notes, categories/slot-usage,
// audit-log, weather-status) ditambah satu laluan agregat baharu, view-stats (Fasa 14,
// 2026-08-02) — bilangan pengunjung & kandungan paling diminati kini data SEBENAR dari
// jejak pengunjung dibina sendiri (tiada pihak ketiga, tiada cookie, kiraan harian sahaja
// dalam adjung.db, lihat core/routes/viewStatsRoutes.js).
interface DashboardConsoleProps {
  onTukarTab: (tabId: string) => void;
}

interface SlotUsage { slotIndex: number; bidang: string; liveCount: number; }
// actorId (2026-08-16, pepijat "Aktiviti Editor papar event sistem" — audit ChatGPT) — signal
// SEDIA ADA yang bezakan tindakan manusia drpd automasi TANPA perlu medan/skema baharu: setiap
// panggilan logAudit() (core/audit/AuditLog.js) untuk laluan yang ubah data ATAS NAMA editor
// (terbit/tolak/urus akaun/Bidang, dll) hantar actorId=req.session.user.id; SEMUA event automasi
// (RSS Direct, Penjadual Sistem terbit/luput berjadual, amaran konfigurasi) TIDAK PERNAH hantar
// actorId (jatuh ke `null` di logAudit — lihat AuditLog.js baris 10). Jangan klasifikasi ikut teks
// `action`/`actorName` (ChatGPT: "Klasifikasi mesti datang daripada sumber event", bukan corak
// teks yang boleh berubah/bertambah bila laluan baharu ditambah).
interface EntriLog { id: number; actorId: string | number | null; actorName: string | null; action: string; createdAt: string; detail?: string | null; }
interface Nota { id: string; tajuk: string; kategori: string; dibuatPada: string; }
interface ItemRingkas { slotIndex: number; status: string; }

const JUMLAH_SLOT = 38;

export const DashboardConsole: React.FC<DashboardConsoleProps> = ({ onTukarTab }) => {
  const [memuat, setMemuat] = useState(true);
  const [posterTerbuka, setPosterTerbuka] = useState(false);
  // Bendera kegagalan (UX-08, audit ChatGPT 2026-08-08) — bezakan "0 sebenar" drpd "gagal
  // diambil". Sebelum ni, .catch() jatuh balik ke {items:[]}/{hariIni:0,...} lalu paparan
  // terus tunjuk "0" macam ia bilangan sebenar, mengelirukan Ketua Editor semasa gangguan
  // pelayan. Hanya medan berasaskan KIRAAN (statusKandungan, jejakPengunjung.hariIni)
  // terjejas — medan berasaskan status (RSS/cuaca/pautan mati) sudah betul, terus `null`.
  const [gagalMuatKandungan, setGagalMuatKandungan] = useState(false);
  const [gagalMuatPengunjung, setGagalMuatPengunjung] = useState(false);
  // menunggu dipecah dua (2026-09-04, audit Izzat "menunggu sepatutnya ada dua") — menungguSemakan
  // (perlu keputusan Ketua Editor/Penolong) vs menungguSlotPenuh (dah lulus, cuma tunggu ruang
  // slot, naik taraf automatik). `menunggu` jumlah dikekalkan untuk kegunaan matriks slot di bawah,
  // yang cuma perlu tahu "belum aktif", bukan sebabnya.
  const [statusKandungan, setStatusKandungan] = useState({ menunggu: 0, menungguSemakan: 0, menungguSlotPenuh: 0, dijadualkan: 0, aktif: 0, arkib: 0 });
  const [maklumanTerbaru, setMaklumanTerbaru] = useState<Nota[]>([]);
  const [slotUsage, setSlotUsage] = useState<SlotUsage[]>([]);
  const [itemsRingkas, setItemsRingkas] = useState<ItemRingkas[]>([]);
  const [statusRss, setStatusRss] = useState<{ masa: string; butiran: string; ralat: boolean } | null>(null);
  const [statusCuaca, setStatusCuaca] = useState<{ status: string; sihat: boolean } | null>(null);
  // Semakan pautan mati (2026-08-05, Fasa 8b) — dibaca daripada source_link_checks (server.js
  // setInterval, 12 jam), bukan disemak langsung di sini (elak paparan tersekat menunggu pelayan
  // luar yang perlahan/mati).
  const [statusPautan, setStatusPautan] = useState<{ jumlahDiperiksa: number; jumlahMati: number; terakhirSemak: string | null } | null>(null);
  const [aktivitiTerkini, setAktivitiTerkini] = useState<EntriLog[]>([]);
  const [jejakPengunjung, setJejakPengunjung] = useState<{
    hariIni: number;
    trenHarian: { tarikh: string; jumlah: number }[];
    palingDiminati: { slotIndex: number; bidang: string; jumlah: number }[];
  }>({ hariIni: 0, trenHarian: [], palingDiminati: [] });

  useEffect(() => {
    let batal = false;
    setMemuat(true);

    Promise.all([
      fetch('/api/system/content/all').then(r => r.json()).catch(() => ({ items: [], __gagal: true })),
      fetch('/api/system/editor-notes?status=aktif').then(r => r.json()).catch(() => []),
      fetch('/api/system/categories/slot-usage').then(r => r.json()).catch(() => []),
      fetch('/api/system/audit-log?limit=200').then(r => r.json()).catch(() => []),
      fetch('/api/system/weather-status').then(r => r.json()).catch(() => null),
      fetch('/api/system/view-stats?days=7').then(r => r.json()).catch(() => ({ hariIni: 0, trenHarian: [], kandunganPalingDiminati: [], __gagal: true })),
      fetch('/api/system/link-checks').then(r => r.json()).catch(() => null),
    ]).then(([kandungan, nota, slotUsageResp, logAudit, cuaca, statsView, pautan]) => {
      if (batal) return;

      setGagalMuatKandungan(!!kandungan?.__gagal);
      setGagalMuatPengunjung(!!statsView?.__gagal);

      const items = kandungan?.items || [];
      setStatusKandungan({
        menunggu: items.filter((i: any) => i.status === 'pending').length,
        menungguSemakan: items.filter((i: any) => i.status === 'pending' && i.sebabMenunggu !== 'slot_penuh').length,
        menungguSlotPenuh: items.filter((i: any) => i.status === 'pending' && i.sebabMenunggu === 'slot_penuh').length,
        // Dijadualkan (2026-09-06, permintaan Izzat) — kandungan status 'scheduled' (Jadual
        // Terbit, IndeksConsole) berasingan sepenuhnya drpd 'pending' (tak pernah dikira dalam
        // `menunggu` di atas), tapi Izzat nak ia kelihatan sekali pandang di kotak Menunggu yang
        // sama juga (bukan gantikan angka utama, cuma baris pecahan tambahan sebelah "semakan"/
        // "slot kosong") supaya kandungan berjadual tak "hilang" drpd papan pemuka.
        dijadualkan: items.filter((i: any) => i.status === 'scheduled').length,
        aktif: items.filter((i: any) => i.status === 'approved').length,
        arkib: items.filter((i: any) => i.status === 'archived').length,
      });
      setItemsRingkas(items.map((i: any) => ({ slotIndex: i.slotIndex, status: i.status })));

      setMaklumanTerbaru(Array.isArray(nota) ? nota.slice(0, 3) : []);

      setSlotUsage(Array.isArray(slotUsageResp) ? slotUsageResp : []);

      // Jejak pengunjung (Fasa 14) — bidang slot dicari dari slot-usage sedia ada (sudah dimuat
      // di atas), supaya senarai "paling diminati" papar Bidang, bukan cuma nombor slot mentah.
      const bidangSlot: Record<number, string> = {};
      (Array.isArray(slotUsageResp) ? slotUsageResp : []).forEach((s: SlotUsage) => { bidangSlot[s.slotIndex] = s.bidang; });
      const palingDiminati = Array.isArray(statsView?.kandunganPalingDiminati)
        ? statsView.kandunganPalingDiminati.map((r: { slotIndex: number; jumlah: number }) => ({
            slotIndex: r.slotIndex,
            bidang: bidangSlot[r.slotIndex] || '',
            jumlah: r.jumlah,
          }))
        : [];
      setJejakPengunjung({
        hariIni: statsView?.hariIni || 0,
        trenHarian: Array.isArray(statsView?.trenHarian) ? statsView.trenHarian : [],
        palingDiminati,
      });

      const logs: EntriLog[] = Array.isArray(logAudit) ? logAudit : [];
      const larianRss = logs.find(l => l.action === 'ambilan-rss-selesai' || l.action === 'ralat-ambilan-rss');
      if (larianRss) {
        setStatusRss({
          masa: new Date(larianRss.createdAt).toLocaleString('ms-MY'),
          butiran: larianRss.detail || '',
          ralat: larianRss.action === 'ralat-ambilan-rss',
        });
      }
      // Cuma tindakan MANUSIA (actorId hadir) — event sistem/automasi (RSS, Penjadual Sistem, dll,
      // lihat nota EntriLog di atas) tenggelamkan tindakan editor sebenar dalam 6 slot terhad ni
      // kalau tak ditapis (RSS boleh log berpuluh kali sejam, editor mungkin cuma sekali sehari).
      setAktivitiTerkini(logs.filter((l) => l.actorId != null).slice(0, 6));

      if (cuaca?.openMeteo) {
        setStatusCuaca({ status: cuaca.openMeteo.status, sihat: (cuaca.openMeteo.status || '').includes('ONLINE') });
      }

      if (pautan) {
        setStatusPautan({
          jumlahDiperiksa: pautan.jumlahDiperiksa || 0,
          jumlahMati: pautan.jumlahMati || 0,
          terakhirSemak: pautan.terakhirSemak || null,
        });
      }
    }).finally(() => { if (!batal) setMemuat(false); });

    return () => { batal = true; };
  }, []);

  if (memuat) {
    // Rangka pulsa (Fasa 18, 2026-08-05, permintaan pemilik projek) — bayang kasar susun atur
    // sebenar (jalur statistik 4-kad + carta) gantikan teks statik "Memuatkan..." lama, supaya
    // pembaca nampak SESUATU sedang berlaku dan bentuk kandungan akan datang, bukan skrin kosong.
    return (
      <div className="animate-pulse flex flex-col gap-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-stone-200 rounded-lg p-5 flex flex-col gap-3">
              <div className="h-2.5 w-16 bg-stone-150 rounded" />
              <div className="h-7 w-12 bg-stone-200 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white border border-stone-200 rounded-lg p-5 h-40" />
      </div>
    );
  }

  const jumlahRekod = statusKandungan.menunggu + statusKandungan.aktif + statusKandungan.arkib;

  // Matriks 38 slot — status sebenar setiap slot (terisi/menunggu/kosong), dikira daripada
  // slotUsage (liveCount > 0 = terisi) + itemsRingkas (ada kandungan 'pending' = menunggu).
  // Slot 1-based dalam paparan (per konvensyen bercakap projek ni), 0-based dalam data.
  //
  // bilanganMenunggu (2026-08-22, permintaan Izzat "kalau aktif berapa byk berita yg ada?")
  // — dikira daripada itemsRingkas SAMA persis yang menentukan adaMenunggu, cuma .length
  // bukan .some(), supaya jawapan "berapa banyak" konsisten dengan gerbang status yang
  // sudah wujud (bukan pengiraan berasingan yang boleh menyimpang daripadanya).
  const slotMatrix = Array.from({ length: JUMLAH_SLOT }, (_, idx) => {
    const usage = slotUsage.find(s => s.slotIndex === idx);
    const liveCount = usage?.liveCount || 0;
    const bilanganMenunggu = itemsRingkas.filter(i => i.slotIndex === idx && i.status === 'pending').length;
    const status: 'terisi' | 'menunggu' | 'kosong' = liveCount > 0 ? 'terisi' : bilanganMenunggu > 0 ? 'menunggu' : 'kosong';
    return { slotIndex: idx, status, liveCount, bilanganMenunggu };
  });
  const jumlahBermasalah = slotMatrix.filter(s => s.status !== 'terisi').length;

  // Taburan Bidang — jumlah liveCount per Bidang merentas semua slot, susun menurun.
  const bidangMap: Record<string, number> = {};
  slotUsage.forEach(s => {
    if (!s.bidang) return;
    bidangMap[s.bidang] = (bidangMap[s.bidang] || 0) + s.liveCount;
  });
  const bidangTersusun = Object.entries(bidangMap)
    .map(([label, nilai]) => ({ label, nilai }))
    .sort((a, b) => b.nilai - a.nilai)
    .slice(0, 6);
  const bidangMaks = Math.max(1, ...bidangTersusun.map(b => b.nilai));

  const trenMaks = Math.max(1, ...jejakPengunjung.trenHarian.map(t => t.jumlah));
  const tarikhHariIni = new Date().toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });

  const WARNA_STATUS: Record<'terisi' | 'menunggu' | 'kosong', string> = {
    terisi: 'var(--color-success)',
    menunggu: 'var(--color-warning)',
    kosong: 'var(--color-error)',
  };

  return (
    <div className="bg-[#FDFDFD] border border-stone-200">
      {/* Tajuk + tarikh */}
      <div className="flex items-end gap-6 px-6 md:px-8 pt-7 pb-5 border-b border-stone-300 flex-wrap">
        <h1 className="font-serif text-2xl md:text-4xl font-normal tracking-tight text-stone-900 leading-tight">
          Kandungan, kesihatan sistem dan pasukan
        </h1>
        <p className="mb-1 ml-auto max-w-[28ch] text-[11px] md:text-xs leading-relaxed text-stone-500 text-right">
          {tarikhHariIni} · data dikira semula setiap kali paparan dibuka.
        </p>
        <button
          type="button"
          onClick={() => setPosterTerbuka(true)}
          className="mb-1 inline-flex items-center gap-1.5 border border-stone-300 px-3 py-1.5 text-[11px] font-semibold text-stone-700 hover:border-Adjung-maroon hover:text-Adjung-maroon transition-colors cursor-pointer shrink-0"
        >
          <ImageIcon className="w-3.5 h-3.5" /> Jana Poster Media Sosial
        </button>
      </div>
      {posterTerbuka && <PosterGenerator onTutup={() => setPosterTerbuka(false)} />}

      {/* Statistik utama */}
      <section className="grid grid-cols-2 md:grid-cols-4 border-b border-stone-200">
        <div className="p-5 md:p-6 border-r border-b md:border-b-0 border-stone-200 text-center">
          <div className="font-mono text-[9px] uppercase tracking-widest font-semibold text-stone-400 mb-2.5">Jumlah rekod</div>
          <div className="font-serif text-4xl md:text-5xl font-normal text-stone-900">{gagalMuatKandungan ? '—' : jumlahRekod}</div>
          <div className="text-[11px] text-stone-500 mt-2">
            {gagalMuatKandungan ? 'Gagal dimuatkan, cuba muat semula' : `Merentas ${JUMLAH_SLOT} slot terbitan`}
          </div>
        </div>
        <button onClick={() => onTukarTab('kandungan')} className="p-5 md:p-6 border-b md:border-b-0 border-stone-200 text-center hover:bg-Adjung-maroon/5 transition-colors cursor-pointer">
          <div className="font-mono text-[9px] uppercase tracking-widest font-semibold text-stone-400 mb-2.5">Aktif</div>
          <div className="font-serif text-4xl md:text-5xl font-normal" style={{ color: 'var(--color-success)' }}>{gagalMuatKandungan ? '—' : statusKandungan.aktif}</div>
          <div className="flex items-center gap-2 mt-3 px-2">
            <span className="flex-1 h-[3px] bg-stone-200">
              <span className="block h-[3px]" style={{ width: `${jumlahRekod > 0 ? (statusKandungan.aktif / jumlahRekod) * 100 : 0}%`, background: 'var(--color-success)' }} />
            </span>
            <span className="font-mono text-[10px] text-stone-500">{gagalMuatKandungan ? '—' : jumlahRekod > 0 ? `${Math.round((statusKandungan.aktif / jumlahRekod) * 100)}%` : '0%'}</span>
          </div>
        </button>
        <button onClick={() => onTukarTab('kandungan')} className="p-5 md:p-6 border-r md:border-r border-stone-200 text-center hover:bg-Adjung-maroon/5 transition-colors cursor-pointer">
          <div className="font-mono text-[9px] uppercase tracking-widest font-semibold text-stone-400 mb-2.5">Menunggu</div>
          <div className="font-serif text-4xl md:text-5xl font-normal" style={{ color: 'var(--color-warning)' }}>{gagalMuatKandungan ? '—' : statusKandungan.menunggu}</div>
          {/* Pecahan sebab (2026-09-04, audit Izzat) — "Menunggu semakan" generik sebelum ni
              membayangkan SEMUA kandungan pending perlu keputusan Ketua Editor, walhal sebahagian
              cuma beratur slot (dah lulus). */}
          <div className="text-[11px] text-stone-500 mt-2">
            {gagalMuatKandungan ? 'Gagal dimuatkan' : (
              <>
                {statusKandungan.menungguSemakan} semakan{statusKandungan.menungguSlotPenuh > 0 ? ` · ${statusKandungan.menungguSlotPenuh} slot kosong` : ''}{statusKandungan.dijadualkan > 0 ? ` · ${statusKandungan.dijadualkan} dijadualkan` : ''}
              </>
            )}
          </div>
        </button>
        <button onClick={() => onTukarTab('kandungan')} className="p-5 md:p-6 text-center hover:bg-Adjung-maroon/5 transition-colors cursor-pointer">
          <div className="font-mono text-[9px] uppercase tracking-widest font-semibold text-stone-400 mb-2.5">Arkib</div>
          <div className="font-serif text-4xl md:text-5xl font-normal text-stone-400">{gagalMuatKandungan ? '—' : statusKandungan.arkib}</div>
          <div className="text-[11px] text-stone-500 mt-2">{gagalMuatKandungan ? 'Gagal dimuatkan' : 'Disimpan dalam arkib'}</div>
        </button>
      </section>

      {/* Pengunjung frontpage (tren) + Taburan Bidang */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-8 md:gap-10 px-6 md:px-8 py-7 border-b border-stone-200">
        <div>
          <div className="flex items-baseline gap-3 mb-5 flex-wrap">
            <h2 className="font-mono text-[10px] uppercase tracking-widest font-semibold text-stone-400">Pengunjung frontpage (7 hari)</h2>
            <span className="ml-auto font-mono text-[10.5px] text-stone-400">{gagalMuatPengunjung ? 'Gagal dimuatkan' : `${jejakPengunjung.hariIni} muatan hari ini`}</span>
          </div>
          {jejakPengunjung.trenHarian.length === 0 ? (
            <KeadaanKosong className="py-4">Belum ada rekod jejak.</KeadaanKosong>
          ) : (
            <>
              <div className="flex items-end gap-1.5 h-32 border-b border-stone-100">
                {jejakPengunjung.trenHarian.map(t => (
                  <Tooltip key={t.tarikh} text={`${t.tarikh}: ${t.jumlah}`}>
                    <div className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                      <div className="w-full" style={{ height: `${Math.max(3, (t.jumlah / trenMaks) * 100)}%`, background: 'rgba(128,35,52,0.75)' }} />
                    </div>
                  </Tooltip>
                ))}
              </div>
              <div className="flex justify-between mt-2.5 font-mono text-[9.5px] text-stone-400">
                {jejakPengunjung.trenHarian.map(t => <span key={t.tarikh}>{t.tarikh.slice(8, 10)}/{t.tarikh.slice(5, 7)}</span>)}
              </div>
            </>
          )}
          <p className="text-[10px] text-stone-400 mt-3">Anonim, tiada kuki dan tiada alamat IP direkodkan.</p>
        </div>

        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-widest font-semibold text-stone-400 mb-5">Taburan bidang</h2>
          {bidangTersusun.length === 0 ? (
            <KeadaanKosong className="py-4">Belum ada kandungan aktif.</KeadaanKosong>
          ) : (
            bidangTersusun.map(b => (
              <div key={b.label} className="py-2.5 border-b border-stone-100">
                <div className="flex items-baseline gap-2.5 mb-1.5">
                  <span className="text-[11.5px] text-stone-700 truncate">{b.label}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-stone-500">{b.nilai}</span>
                </div>
                <span className="block h-1 bg-stone-100">
                  <span className="block h-1" style={{ width: `${(b.nilai / bidangMaks) * 100}%`, background: 'var(--color-Adjung-maroon)' }} />
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Matriks slot terbitan */}
      <section className="px-6 md:px-8 py-7 border-b border-stone-200">
        <div className="flex items-baseline gap-3 mb-5 flex-wrap">
          <h2 className="font-mono text-[10px] uppercase tracking-widest font-semibold text-stone-400">Matriks slot terbitan</h2>
          {jumlahBermasalah > 0 && (
            <span className="font-mono text-[10.5px]" style={{ color: 'var(--color-error)' }}>{jumlahBermasalah} / {JUMLAH_SLOT} memerlukan perhatian</span>
          )}
          <button onClick={() => onTukarTab('kandungan')} className="ml-auto text-[11px] font-semibold text-[var(--color-Adjung-maroon)] hover:text-[var(--color-Adjung-maroon-dark)] cursor-pointer">
            Buka dalam Indeks →
          </button>
        </div>
        <div className="grid gap-px bg-stone-200 border border-stone-200" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
          {slotMatrix.map(s => (
            <SlotMatrixCell
              key={s.slotIndex}
              slotNombor={s.slotIndex + 1}
              status={s.status}
              bilanganAktif={s.liveCount}
              bilanganMenunggu={s.bilanganMenunggu}
              onClick={() => onTukarTab('kandungan')}
            />
          ))}
        </div>
        <div className="flex gap-6 mt-3.5 text-[10.5px] text-stone-500 flex-wrap">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2" style={{ background: WARNA_STATUS.kosong }} />Kosong</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2" style={{ background: WARNA_STATUS.menunggu }} />Menunggu</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2" style={{ background: WARNA_STATUS.terisi }} />Terisi</span>
        </div>
      </section>

      {/* Aktiviti & Status Sistem */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-8 md:gap-10 px-6 md:px-8 py-7 border-b border-stone-200">
        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-widest font-semibold text-stone-400 mb-4">Aktiviti editor</h2>
          {aktivitiTerkini.length === 0 ? (
            <KeadaanKosong className="py-4">Tiada tindakan direkod lagi.</KeadaanKosong>
          ) : (
            aktivitiTerkini.map(a => (
              <div key={a.id} className="flex items-baseline gap-4 py-3 border-b border-stone-100">
                <span className="font-mono text-[10.5px] text-stone-400 w-[74px] shrink-0">
                  {new Date(a.createdAt).toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="font-serif text-sm leading-relaxed text-stone-900 flex-1">{labelTindakan(a.action)}</span>
                {a.actorName && (
                  <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-stone-500 shrink-0">{a.actorName}</span>
                )}
              </div>
            ))
          )}
        </div>

        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-widest font-semibold text-stone-400 mb-4">Status sistem</h2>
          <div className="flex items-baseline gap-3 py-3 border-b border-stone-100">
            <span className="text-xs text-stone-700 flex-1">Suapan RSS</span>
            {statusRss ? (
              // Dwi-kod (Pelan 01): lencana berikon + berlabel, warna cuma penguat — bukan
              // warna teks semata-mata seperti dahulu.
              <span className="flex items-baseline gap-2">
                <StatusBadge tone={statusRss.ralat ? 'error' : 'success'} label={statusRss.ralat ? 'RALAT' : 'SIHAT'} />
                <span className="font-mono text-[10.5px] text-stone-400">{statusRss.masa}</span>
              </span>
            ) : (
              <StatusBadge tone="neutral" label="Tiada Rekod" />
            )}
          </div>
          <div className="flex items-baseline gap-3 py-3 border-b border-stone-100">
            <span className="text-xs text-stone-700 flex-1">API cuaca</span>
            {statusCuaca ? (
              <StatusBadge tone={statusCuaca.sihat ? 'success' : 'error'} label={statusCuaca.status} />
            ) : (
              <StatusBadge tone="neutral" label="Belum Disemak" />
            )}
          </div>
          {/* Pautan sumber mati (Fasa 8b, 2026-08-05) — semakan latar setiap 12 jam (bukan setiap
              kali papan pemuka dibuka), lihat core/editorial/LinkChecker.js. */}
          <div className="flex items-baseline gap-3 py-3 border-b border-stone-100">
            <span className="text-xs text-stone-700 flex-1">Pautan sumber</span>
            {statusPautan && statusPautan.terakhirSemak ? (
              <span className="flex items-baseline gap-2">
                <StatusBadge
                  tone={statusPautan.jumlahMati === 0 ? 'success' : 'error'}
                  label={statusPautan.jumlahMati === 0 ? 'SIHAT' : `${statusPautan.jumlahMati} MATI`}
                />
                <span className="font-mono text-[10.5px] text-stone-400">{statusPautan.jumlahDiperiksa} disemak</span>
              </span>
            ) : (
              <StatusBadge tone="neutral" label="Belum Disemak" />
            )}
          </div>
          {statusPautan && statusPautan.jumlahMati > 0 && (
            <p className="mt-2 text-[10px] text-stone-400 leading-relaxed">
              Semakan pautan sumber berjalan latar setiap 12 jam. Lihat/betulkan pautan bermasalah
              di kandungan berkaitan (Urus Kandungan).
            </p>
          )}
          {maklumanTerbaru.length > 0 && (
            <div className="mt-5">
              <h3 className="font-mono text-[9px] uppercase tracking-widest font-semibold text-stone-400 mb-3">Makluman terbaru</h3>
              <ul className="space-y-2">
                {maklumanTerbaru.map(n => (
                  <li key={n.id} className="text-xs text-stone-700 truncate border-l-2 pl-3" style={{ borderColor: 'rgba(128,35,52,0.25)' }}>{n.tajuk}</li>
                ))}
              </ul>
            </div>
          )}
          {jejakPengunjung.palingDiminati.length > 0 && (
            <div className="mt-5">
              <h3 className="font-mono text-[9px] uppercase tracking-widest font-semibold text-stone-400 mb-3">Kandungan paling diminati</h3>
              {jejakPengunjung.palingDiminati.slice(0, 4).map(p => (
                <div key={p.slotIndex} className="flex items-baseline gap-2 py-1.5 text-xs text-stone-600">
                  <span>Slot {p.slotIndex + 1}{p.bidang ? ` · ${p.bidang}` : ''}</span>
                  <span className="ml-auto font-mono text-stone-400">{p.jumlah}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer tempatan konsol ni dibuang (2026-08-07) — EditoriumLayout sudah ada footer
          kongsi dengan baris "Adjung Brief Editorium · Sistem Kawalan Editorial" yang SAMA,
          jadi Paparan Utama memaparkannya DUA kali serentak. Cap masa "Dimuat semula" turut
          dibuang bersamanya — ia cap masa render (new Date() semasa paint), bukan masa data
          sebenar diambil, jadi maklumatnya mengelirukan. */}
    </div>
  );
};

export default DashboardConsole;
