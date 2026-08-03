import React, { useEffect, useState } from 'react';
import { labelTindakan } from './LogAuditConsole';

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
interface EntriLog { id: number; actorName: string | null; action: string; createdAt: string; detail?: string | null; }
interface Nota { id: string; tajuk: string; kategori: string; dibuatPada: string; }
interface ItemRingkas { slotIndex: number; status: string; }

const JUMLAH_SLOT = 38;

export const DashboardConsole: React.FC<DashboardConsoleProps> = ({ onTukarTab }) => {
  const [memuat, setMemuat] = useState(true);
  const [statusKandungan, setStatusKandungan] = useState({ menunggu: 0, aktif: 0, arkib: 0 });
  const [maklumanTerbaru, setMaklumanTerbaru] = useState<Nota[]>([]);
  const [slotUsage, setSlotUsage] = useState<SlotUsage[]>([]);
  const [itemsRingkas, setItemsRingkas] = useState<ItemRingkas[]>([]);
  const [statusRss, setStatusRss] = useState<{ masa: string; butiran: string; ralat: boolean } | null>(null);
  const [statusCuaca, setStatusCuaca] = useState<{ status: string; sihat: boolean } | null>(null);
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
      fetch('/api/system/content/all').then(r => r.json()).catch(() => ({ items: [] })),
      fetch('/api/system/editor-notes?status=aktif').then(r => r.json()).catch(() => []),
      fetch('/api/system/categories/slot-usage').then(r => r.json()).catch(() => []),
      fetch('/api/system/audit-log?limit=200').then(r => r.json()).catch(() => []),
      fetch('/api/system/weather-status').then(r => r.json()).catch(() => null),
      fetch('/api/system/view-stats?days=7').then(r => r.json()).catch(() => ({ hariIni: 0, trenHarian: [], kandunganPalingDiminati: [] })),
    ]).then(([kandungan, nota, slotUsageResp, logAudit, cuaca, statsView]) => {
      if (batal) return;

      const items = kandungan?.items || [];
      setStatusKandungan({
        menunggu: items.filter((i: any) => i.status === 'pending').length,
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
      setAktivitiTerkini(logs.slice(0, 6));

      if (cuaca?.openMeteo) {
        setStatusCuaca({ status: cuaca.openMeteo.status, sihat: (cuaca.openMeteo.status || '').includes('ONLINE') });
      }
    }).finally(() => { if (!batal) setMemuat(false); });

    return () => { batal = true; };
  }, []);

  if (memuat) {
    return (
      <div className="bg-white p-16 text-center border border-stone-200">
        <p className="text-xs text-stone-400 font-mono uppercase tracking-wider">Memuatkan papan pemuka...</p>
      </div>
    );
  }

  const jumlahRekod = statusKandungan.menunggu + statusKandungan.aktif + statusKandungan.arkib;

  // Matriks 38 slot — status sebenar setiap slot (terisi/menunggu/kosong), dikira daripada
  // slotUsage (liveCount > 0 = terisi) + itemsRingkas (ada kandungan 'pending' = menunggu).
  // Slot 1-based dalam paparan (per konvensyen bercakap projek ni), 0-based dalam data.
  const slotMatrix = Array.from({ length: JUMLAH_SLOT }, (_, idx) => {
    const usage = slotUsage.find(s => s.slotIndex === idx);
    const liveCount = usage?.liveCount || 0;
    const adaMenunggu = itemsRingkas.some(i => i.slotIndex === idx && i.status === 'pending');
    const status: 'terisi' | 'menunggu' | 'kosong' = liveCount > 0 ? 'terisi' : adaMenunggu ? 'menunggu' : 'kosong';
    return { slotIndex: idx, status };
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
    terisi: '#3d6b4c',
    menunggu: '#b8934a',
    kosong: '#a8241f',
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
      </div>

      {/* Statistik utama */}
      <section className="grid grid-cols-2 md:grid-cols-4 border-b border-stone-200">
        <div className="p-5 md:p-6 border-r border-b md:border-b-0 border-stone-200 text-center">
          <div className="font-mono text-[9px] uppercase tracking-widest font-semibold text-stone-400 mb-2.5">Jumlah rekod</div>
          <div className="font-serif text-4xl md:text-5xl font-normal text-stone-900">{jumlahRekod}</div>
          <div className="text-[11px] text-stone-500 mt-2">Merentas {JUMLAH_SLOT} slot terbitan</div>
        </div>
        <button onClick={() => onTukarTab('kandungan')} className="p-5 md:p-6 border-b md:border-b-0 border-stone-200 text-center hover:bg-[#802334]/5 transition-colors cursor-pointer">
          <div className="font-mono text-[9px] uppercase tracking-widest font-semibold text-stone-400 mb-2.5">Aktif</div>
          <div className="font-serif text-4xl md:text-5xl font-normal" style={{ color: '#3d6b4c' }}>{statusKandungan.aktif}</div>
          <div className="flex items-center gap-2 mt-3 px-2">
            <span className="flex-1 h-[3px] bg-stone-200">
              <span className="block h-[3px]" style={{ width: `${jumlahRekod > 0 ? (statusKandungan.aktif / jumlahRekod) * 100 : 0}%`, background: '#3d6b4c' }} />
            </span>
            <span className="font-mono text-[10px] text-stone-500">{jumlahRekod > 0 ? Math.round((statusKandungan.aktif / jumlahRekod) * 100) : 0}%</span>
          </div>
        </button>
        <button onClick={() => onTukarTab('kandungan')} className="p-5 md:p-6 border-r md:border-r border-stone-200 text-center hover:bg-[#802334]/5 transition-colors cursor-pointer">
          <div className="font-mono text-[9px] uppercase tracking-widest font-semibold text-stone-400 mb-2.5">Menunggu semakan</div>
          <div className="font-serif text-4xl md:text-5xl font-normal" style={{ color: '#b8934a' }}>{statusKandungan.menunggu}</div>
          <div className="text-[11px] text-stone-500 mt-2">Dalam giliran semakan</div>
        </button>
        <button onClick={() => onTukarTab('kandungan')} className="p-5 md:p-6 text-center hover:bg-[#802334]/5 transition-colors cursor-pointer">
          <div className="font-mono text-[9px] uppercase tracking-widest font-semibold text-stone-400 mb-2.5">Arkib</div>
          <div className="font-serif text-4xl md:text-5xl font-normal text-stone-400">{statusKandungan.arkib}</div>
          <div className="text-[11px] text-stone-500 mt-2">Ditarik daripada edaran</div>
        </button>
      </section>

      {/* Pengunjung frontpage (tren) + Taburan Bidang */}
      <section className="grid grid-cols-1 lg:grid-cols-[1.55fr_1fr] gap-8 md:gap-10 px-6 md:px-8 py-7 border-b border-stone-200">
        <div>
          <div className="flex items-baseline gap-3 mb-5 flex-wrap">
            <h2 className="font-mono text-[10px] uppercase tracking-widest font-semibold text-stone-400">Pengunjung frontpage (7 hari)</h2>
            <span className="ml-auto font-mono text-[10.5px] text-stone-400">{jejakPengunjung.hariIni} muatan hari ini</span>
          </div>
          {jejakPengunjung.trenHarian.length === 0 ? (
            <p className="text-xs text-stone-400">Belum ada rekod jejak.</p>
          ) : (
            <>
              <div className="flex items-end gap-1.5 h-32 border-b border-stone-100">
                {jejakPengunjung.trenHarian.map(t => (
                  <div key={t.tarikh} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5" title={`${t.tarikh}: ${t.jumlah}`}>
                    <div className="w-full" style={{ height: `${Math.max(3, (t.jumlah / trenMaks) * 100)}%`, background: 'rgba(128,35,52,0.75)' }} />
                  </div>
                ))}
              </div>
              <div className="flex justify-between mt-2.5 font-mono text-[9.5px] text-stone-400">
                {jejakPengunjung.trenHarian.map(t => <span key={t.tarikh}>{t.tarikh.slice(8, 10)}/{t.tarikh.slice(5, 7)}</span>)}
              </div>
            </>
          )}
          <p className="text-[10px] text-stone-400 mt-3">Anonim, tiada cookie, tiada IP direkod.</p>
        </div>

        <div>
          <h2 className="font-mono text-[10px] uppercase tracking-widest font-semibold text-stone-400 mb-5">Taburan bidang</h2>
          {bidangTersusun.length === 0 ? (
            <p className="text-xs text-stone-400">Belum ada kandungan aktif.</p>
          ) : (
            bidangTersusun.map(b => (
              <div key={b.label} className="py-2.5 border-b border-stone-100">
                <div className="flex items-baseline gap-2.5 mb-1.5">
                  <span className="text-[11.5px] text-stone-700 truncate">{b.label}</span>
                  <span className="ml-auto font-mono text-[10.5px] text-stone-500">{b.nilai}</span>
                </div>
                <span className="block h-1 bg-stone-100">
                  <span className="block h-1" style={{ width: `${(b.nilai / bidangMaks) * 100}%`, background: '#802334' }} />
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
            <span className="font-mono text-[10.5px]" style={{ color: '#a8241f' }}>{jumlahBermasalah} / {JUMLAH_SLOT} memerlukan perhatian</span>
          )}
          <button onClick={() => onTukarTab('kandungan')} className="ml-auto text-[11px] font-semibold text-[#802334] hover:text-[#9b2c41] cursor-pointer">
            Buka dalam Indeks →
          </button>
        </div>
        <div className="grid gap-px bg-stone-200 border border-stone-200" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
          {slotMatrix.map(s => (
            <button
              key={s.slotIndex}
              onClick={() => onTukarTab('kandungan')}
              className="bg-[#FDFDFD] px-3 py-2.5 flex items-baseline gap-2 min-w-0 overflow-hidden hover:bg-[#802334]/5 transition-colors cursor-pointer"
            >
              <span className="font-mono text-[11px] font-semibold whitespace-nowrap" style={{ color: WARNA_STATUS[s.status] }}>
                S-{String(s.slotIndex + 1).padStart(2, '0')}
              </span>
              <span className="ml-auto w-2 h-2 shrink-0" style={{ background: WARNA_STATUS[s.status] }} />
            </button>
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
            <p className="text-xs text-stone-400">Tiada tindakan direkod lagi.</p>
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
              <span className="font-mono text-[10.5px]" style={{ color: statusRss.ralat ? '#a8241f' : '#3d6b4c' }}>
                {statusRss.ralat ? 'RALAT' : 'SIHAT'} · {statusRss.masa}
              </span>
            ) : (
              <span className="font-mono text-[10.5px] text-stone-400">TIADA REKOD</span>
            )}
          </div>
          <div className="flex items-baseline gap-3 py-3 border-b border-stone-100">
            <span className="text-xs text-stone-700 flex-1">API cuaca</span>
            {statusCuaca ? (
              <span className="font-mono text-[10.5px]" style={{ color: statusCuaca.sihat ? '#3d6b4c' : '#a8241f' }}>{statusCuaca.status}</span>
            ) : (
              <span className="font-mono text-[10.5px] text-stone-400">BELUM DISEMAK</span>
            )}
          </div>
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

      <footer className="flex items-center gap-4 px-6 md:px-8 py-5 flex-wrap">
        <span className="text-[11px] text-stone-400">Adjung Brief Editorium · Sistem Kawalan Editorial</span>
        <span className="ml-auto font-mono text-[10px] text-stone-400">Dimuat semula {new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}</span>
      </footer>
    </div>
  );
};

export default DashboardConsole;
