import React, { useEffect, useState } from 'react';
import { Bell, LayoutGrid, Radio, Cloud, Users, Hourglass, Eye } from 'lucide-react';

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
// Digabung daripada laluan SEDIA ADA (content/all, editor-notes, categories/slot-usage,
// audit-log, weather-status) ditambah satu laluan agregat baharu, view-stats (Fasa 14,
// 2026-08-02) — bilangan pengunjung & kandungan paling diminati kini data SEBENAR dari
// jejak pengunjung dibina sendiri (tiada pihak ketiga, tiada cookie, kiraan harian sahaja
// dalam adjung.db, lihat core/routes/viewStatsRoutes.js).
interface DashboardConsoleProps {
  onTukarTab: (tabId: string) => void;
}

interface SlotUsage { slotIndex: number; bidang: string; liveCount: number; }
interface EntriLog { id: number; actorName: string | null; action: string; createdAt: string; }
interface Nota { id: string; tajuk: string; kategori: string; dibuatPada: string; }

// Carta ringkas (2026-08-02) — SVG tulen, tiada pustaka luar (tiada recharts/chart.js dalam
// projek ni). Teguran Izzat: "dashboard sepatutnya ada carta, graf... awak takde langsung."
function CartaDonut({ data }: { data: { label: string; nilai: number; warna: string }[] }) {
  const jumlah = data.reduce((s, d) => s + d.nilai, 0);
  const R = 44, STROKE = 16, C = 2 * Math.PI * R;
  let offsetTerkumpul = 0;

  return (
    <div className="flex items-center gap-5">
      <svg width="112" height="112" viewBox="0 0 112 112" className="shrink-0">
        <g transform="translate(56,56) rotate(-90)">
          {jumlah === 0 ? (
            <circle r={R} fill="none" stroke="#E7E5E4" strokeWidth={STROKE} />
          ) : data.filter(d => d.nilai > 0).map((d) => {
            const bahagian = (d.nilai / jumlah) * C;
            const dashoffset = C - offsetTerkumpul;
            offsetTerkumpul += bahagian;
            return (
              <circle
                key={d.label}
                r={R}
                fill="none"
                stroke={d.warna}
                strokeWidth={STROKE}
                strokeDasharray={`${bahagian} ${C - bahagian}`}
                strokeDashoffset={dashoffset}
                strokeLinecap="butt"
              />
            );
          })}
        </g>
        <text x="56" y="52" textAnchor="middle" className="font-mono font-bold" style={{ fontSize: 20, fill: '#1F1F1F' }}>{jumlah}</text>
        <text x="56" y="68" textAnchor="middle" className="font-mono uppercase" style={{ fontSize: 8, fill: '#78716C', letterSpacing: '0.05em' }}>Jumlah</text>
      </svg>
      <div className="space-y-1.5">
        {data.map(d => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.warna }} />
            <span className="text-stone-600">{d.label}</span>
            <span className="font-mono font-bold text-stone-800">{d.nilai}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Carta bar mendatar — Keaktifan Editor.
function CartaBar({ data }: { data: { label: string; nilai: number }[] }) {
  const maksimum = Math.max(1, ...data.map(d => d.nilai));
  return (
    <div className="space-y-2.5">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2.5 text-xs">
          <span className="w-24 shrink-0 truncate text-stone-700 font-semibold">{d.label}</span>
          <div className="flex-1 bg-stone-100 rounded h-4 overflow-hidden">
            <div
              className="bg-[#802334] h-full rounded transition-all"
              style={{ width: `${Math.max(4, (d.nilai / maksimum) * 100)}%` }}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-mono text-stone-500">{d.nilai}</span>
        </div>
      ))}
    </div>
  );
}

export const DashboardConsole: React.FC<DashboardConsoleProps> = ({ onTukarTab }) => {
  const [memuat, setMemuat] = useState(true);
  const [statusKandungan, setStatusKandungan] = useState({ menunggu: 0, aktif: 0, arkib: 0 });
  const [maklumanTerbaru, setMaklumanTerbaru] = useState<Nota[]>([]);
  const [slotBermasalah, setSlotBermasalah] = useState<SlotUsage[]>([]);
  const [statusRss, setStatusRss] = useState<{ masa: string; butiran: string; ralat: boolean } | null>(null);
  const [statusCuaca, setStatusCuaca] = useState<{ status: string; sihat: boolean } | null>(null);
  const [keaktifanEditor, setKeaktifanEditor] = useState<{ nama: string; bilangan: number }[]>([]);
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
    ]).then(([kandungan, nota, slotUsage, logAudit, cuaca, statsView]) => {
      if (batal) return;

      const items = kandungan?.items || [];
      setStatusKandungan({
        menunggu: items.filter((i: any) => i.status === 'pending').length,
        aktif: items.filter((i: any) => i.status === 'approved').length,
        arkib: items.filter((i: any) => i.status === 'archived').length,
      });

      setMaklumanTerbaru(Array.isArray(nota) ? nota.slice(0, 3) : []);

      setSlotBermasalah(Array.isArray(slotUsage) ? slotUsage.filter((s: SlotUsage) => s.liveCount === 0) : []);

      // Jejak pengunjung (Fasa 14) — bidang slot dicari dari slot-usage sedia ada (sudah dimuat
      // di atas), supaya senarai "paling diminati" papar Bidang, bukan cuma nombor slot mentah.
      const bidangSlot: Record<number, string> = {};
      (Array.isArray(slotUsage) ? slotUsage : []).forEach((s: SlotUsage) => { bidangSlot[s.slotIndex] = s.bidang; });
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
          butiran: (larianRss as any).detail || '',
          ralat: larianRss.action === 'ralat-ambilan-rss',
        });
      }

      // Keaktifan editor — kira kekerapan actorName dalam 200 log terkini (anggaran ringkas,
      // bukan laporan penuh — Log Sistem sendiri ada senarai lengkap).
      const kiraan: Record<string, number> = {};
      logs.forEach(l => {
        if (!l.actorName) return;
        kiraan[l.actorName] = (kiraan[l.actorName] || 0) + 1;
      });
      setKeaktifanEditor(
        Object.entries(kiraan).map(([nama, bilangan]) => ({ nama, bilangan })).sort((a, b) => b.bilangan - a.bilangan).slice(0, 5)
      );

      if (cuaca?.openMeteo) {
        setStatusCuaca({ status: cuaca.openMeteo.status, sihat: (cuaca.openMeteo.status || '').includes('ONLINE') });
      }
    }).finally(() => { if (!batal) setMemuat(false); });

    return () => { batal = true; };
  }, []);

  if (memuat) {
    return (
      <div className="bg-white p-16 text-center rounded-lg border border-stone-200">
        <Hourglass className="w-6 h-6 mx-auto mb-2 text-stone-400 animate-pulse" />
        <p className="text-xs text-stone-500">Memuatkan papan pemuka...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200">
        <h2 className="font-serif text-base uppercase tracking-wider text-[#802334] font-bold mb-1">
          Paparan Utama
        </h2>
        <p className="font-sans text-xs text-stone-600">
          Ringkasan operasi editorial Adjung Brief — kandungan, kesihatan sistem, dan keaktifan pasukan.
        </p>
      </div>

      {/* Status kandungan — carta donut + kad angka boleh klik terus ke Indeks. */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-stone-200">
        <h3 className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-3">Status Kandungan</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          <CartaDonut data={[
            { label: 'Menunggu', nilai: statusKandungan.menunggu, warna: '#D97706' },
            { label: 'Aktif', nilai: statusKandungan.aktif, warna: '#059669' },
            { label: 'Arkib', nilai: statusKandungan.arkib, warna: '#A8A29E' },
          ]} />
          <div className="grid grid-cols-3 gap-3 text-center">
            <button onClick={() => onTukarTab('kandungan')} className="bg-amber-50 border border-amber-200 rounded-lg p-3 cursor-pointer hover:bg-amber-100 transition-colors">
              <div className="text-2xl font-bold font-mono text-amber-800">{statusKandungan.menunggu}</div>
              <div className="text-[10px] uppercase font-semibold text-amber-700 mt-1">Menunggu</div>
            </button>
            <button onClick={() => onTukarTab('kandungan')} className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 cursor-pointer hover:bg-emerald-100 transition-colors">
              <div className="text-2xl font-bold font-mono text-emerald-800">{statusKandungan.aktif}</div>
              <div className="text-[10px] uppercase font-semibold text-emerald-700 mt-1">Aktif</div>
            </button>
            <button onClick={() => onTukarTab('kandungan')} className="bg-stone-100 border border-stone-200 rounded-lg p-3 cursor-pointer hover:bg-stone-200 transition-colors">
              <div className="text-2xl font-bold font-mono text-stone-700">{statusKandungan.arkib}</div>
              <div className="text-[10px] uppercase font-semibold text-stone-600 mt-1">Arkib</div>
            </button>
          </div>
        </div>
      </div>

      {/* Makluman terbaru — nota organisasi (Nota Ketua Editor), bukan skop peribadi. */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-stone-200">
        <h3 className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2 flex items-center gap-1.5">
          <Bell className="w-3.5 h-3.5" /> Makluman Terbaru
        </h3>
        {maklumanTerbaru.length === 0 ? (
          <p className="text-xs text-stone-400">Tiada makluman aktif.</p>
        ) : (
          <ul className="space-y-1.5">
            {maklumanTerbaru.map(n => (
              <li key={n.id} className="text-xs text-stone-700 truncate">{n.tajuk}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Slot bermasalah */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-stone-200">
        <h3 className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2 flex items-center gap-1.5">
          <LayoutGrid className="w-3.5 h-3.5" /> Slot Kosong/Bermasalah
        </h3>
        {slotBermasalah.length === 0 ? (
          <p className="text-xs text-emerald-700 font-semibold">Semua slot ada kandungan aktif.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {slotBermasalah.map(s => (
              <button
                key={s.slotIndex}
                onClick={() => onTukarTab('kandungan')}
                className="bg-red-50 border border-red-200 text-red-800 text-[11px] font-mono font-bold px-2 py-1 rounded cursor-pointer hover:bg-red-100"
              >
                Slot {s.slotIndex + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Status sistem: RSS + API cuaca + keaktifan editor */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-stone-200">
          <h3 className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" /> Status RSS
          </h3>
          {!statusRss ? (
            <p className="text-xs text-stone-400">Belum ada rekod larian.</p>
          ) : (
            <div className="space-y-1">
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${statusRss.ralat ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                {statusRss.ralat ? 'Ralat Ditemui' : 'Sihat'}
              </span>
              <p className="text-[11px] text-stone-500 font-mono">{statusRss.masa}</p>
              <p className="text-xs text-stone-600">{statusRss.butiran}</p>
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-stone-200">
          <h3 className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2 flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5" /> Status API Cuaca
          </h3>
          {!statusCuaca ? (
            <p className="text-xs text-stone-400">Belum disemak.</p>
          ) : (
            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${statusCuaca.sihat ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
              {statusCuaca.status}
            </span>
          )}
        </div>
      </div>

      <div className="bg-white p-5 rounded-lg shadow-sm border border-stone-200">
        <h3 className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-2 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> Keaktifan Editor (5 paling aktif)
        </h3>
        {keaktifanEditor.length === 0 ? (
          <p className="text-xs text-stone-400">Tiada tindakan direkod lagi.</p>
        ) : (
          <CartaBar data={keaktifanEditor.map(k => ({ label: k.nama, nilai: k.bilangan }))} />
        )}
      </div>

      {/* Jejak pengunjung & populariti (Fasa 14) — dibina sendiri, tiada pihak ketiga, tiada
          cookie, kiraan harian sahaja dalam adjung.db. */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-lg shadow-sm border border-stone-200">
          <h3 className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-3 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Pengunjung Frontpage
          </h3>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-3xl font-bold font-mono text-[#802334]">{jejakPengunjung.hariIni}</span>
            <span className="text-[11px] text-stone-500 mb-1">muatan hari ini</span>
          </div>
          {jejakPengunjung.trenHarian.length === 0 ? (
            <p className="text-xs text-stone-400">Belum ada rekod jejak.</p>
          ) : (
            <div className="flex items-end gap-1.5 h-16">
              {jejakPengunjung.trenHarian.map(t => {
                const maks = Math.max(1, ...jejakPengunjung.trenHarian.map(x => x.jumlah));
                return (
                  <div key={t.tarikh} className="flex-1 flex flex-col items-center gap-1" title={`${t.tarikh}: ${t.jumlah}`}>
                    <div
                      className="w-full bg-[#802334]/70 rounded-t"
                      style={{ height: `${Math.max(4, (t.jumlah / maks) * 56)}px` }}
                    />
                    <span className="text-[9px] font-mono text-stone-400">{t.tarikh.slice(8, 10)}</span>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-stone-400 mt-2">Tren 7 hari terkini. Anonim, tiada cookie, tiada IP direkod.</p>
        </div>

        <div className="bg-white p-5 rounded-lg shadow-sm border border-stone-200">
          <h3 className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-3 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> Kandungan Paling Diminati (7 hari)
          </h3>
          {jejakPengunjung.palingDiminati.length === 0 ? (
            <p className="text-xs text-stone-400">Belum ada rekod bacaan.</p>
          ) : (
            <CartaBar data={jejakPengunjung.palingDiminati.map(p => ({
              label: `Slot ${p.slotIndex + 1}${p.bidang ? ` · ${p.bidang}` : ''}`,
              nilai: p.jumlah,
            }))} />
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardConsole;
