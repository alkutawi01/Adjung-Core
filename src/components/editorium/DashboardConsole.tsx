import React, { useEffect, useState } from 'react';
import { FileEdit, Bell, LayoutGrid, Radio, Cloud, Users, Hourglass } from 'lucide-react';

// Paparan Utama (2026-08-02, Fasa 5) — destinasi lalai selepas log masuk. Digabung daripada
// laluan SEDIA ADA sahaja (content/all, drafts, editor-notes, categories/slot-usage,
// audit-log, weather-status) — tiada laluan agregat baharu, semua ni sudah wujud dan diuji
// (Fasa 1-4). Dua item yang Izzat minta (bilangan pengunjung, kandungan paling diminati)
// SENGAJA tiada di sini — belum ada sumber data (jejak pengunjung, Fasa 14, frontpage belum
// kira lawatan langsung) — placeholder jujur, bukan angka rekaan.
interface DashboardConsoleProps {
  currentUser: { id: string; name: string; roles: string[] };
  onTukarTab: (tabId: string) => void;
}

interface SlotUsage { slotIndex: number; bidang: string; liveCount: number; }
interface EntriLog { id: number; actorName: string | null; action: string; createdAt: string; }
interface Nota { id: string; tajuk: string; kategori: string; dibuatPada: string; }

export const DashboardConsole: React.FC<DashboardConsoleProps> = ({ currentUser, onTukarTab }) => {
  const [memuat, setMemuat] = useState(true);
  const [statusKandungan, setStatusKandungan] = useState({ menunggu: 0, aktif: 0, arkib: 0 });
  const [bilanganDraf, setBilanganDraf] = useState(0);
  const [maklumanTerbaru, setMaklumanTerbaru] = useState<Nota[]>([]);
  const [slotBermasalah, setSlotBermasalah] = useState<SlotUsage[]>([]);
  const [statusRss, setStatusRss] = useState<{ masa: string; butiran: string; ralat: boolean } | null>(null);
  const [statusCuaca, setStatusCuaca] = useState<{ status: string; sihat: boolean } | null>(null);
  const [keaktifanEditor, setKeaktifanEditor] = useState<{ nama: string; bilangan: number }[]>([]);

  useEffect(() => {
    let batal = false;
    setMemuat(true);

    Promise.all([
      fetch('/api/system/content/all').then(r => r.json()).catch(() => ({ items: [] })),
      fetch(`/api/system/drafts?editorId=${encodeURIComponent(currentUser.id)}&penulis=${encodeURIComponent(currentUser.name)}`).then(r => r.json()).catch(() => []),
      fetch('/api/system/editor-notes?status=aktif').then(r => r.json()).catch(() => []),
      fetch('/api/system/categories/slot-usage').then(r => r.json()).catch(() => []),
      fetch('/api/system/audit-log?limit=200').then(r => r.json()).catch(() => []),
      fetch('/api/system/weather-status').then(r => r.json()).catch(() => null),
    ]).then(([kandungan, draf, nota, slotUsage, logAudit, cuaca]) => {
      if (batal) return;

      const items = kandungan?.items || [];
      setStatusKandungan({
        menunggu: items.filter((i: any) => i.status === 'pending').length,
        aktif: items.filter((i: any) => i.status === 'approved').length,
        arkib: items.filter((i: any) => i.status === 'archived').length,
      });

      setBilanganDraf(Array.isArray(draf) ? draf.length : 0);

      setMaklumanTerbaru(Array.isArray(nota) ? nota.slice(0, 3) : []);

      setSlotBermasalah(Array.isArray(slotUsage) ? slotUsage.filter((s: SlotUsage) => s.liveCount === 0) : []);

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
  }, [currentUser.id, currentUser.name]);

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
          Ringkasan operasi editorial harian, {currentUser.name}.
        </p>
      </div>

      {/* Status kandungan */}
      <div className="bg-white p-5 rounded-lg shadow-sm border border-stone-200">
        <h3 className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-500 mb-3">Status Kandungan</h3>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Draf saya */}
        <button onClick={() => onTukarTab('draf_saya')} className="bg-white p-5 rounded-lg shadow-sm border border-stone-200 flex items-center gap-4 cursor-pointer hover:border-[#802334] transition-colors text-left">
          <FileEdit className="w-8 h-8 text-[#802334] shrink-0" />
          <div>
            <div className="text-2xl font-bold font-mono text-stone-900">{bilanganDraf}</div>
            <div className="text-[10px] uppercase font-semibold text-stone-500">Draf Saya</div>
          </div>
        </button>

        {/* Makluman terbaru */}
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
          <Users className="w-3.5 h-3.5" /> Keaktifan Editor (200 tindakan terkini)
        </h3>
        {keaktifanEditor.length === 0 ? (
          <p className="text-xs text-stone-400">Tiada tindakan direkod lagi.</p>
        ) : (
          <ul className="space-y-1.5">
            {keaktifanEditor.map(k => (
              <li key={k.nama} className="flex justify-between text-xs">
                <span className="text-stone-700 font-semibold">{k.nama}</span>
                <span className="text-stone-500 font-mono">{k.bilangan}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bilangan pengunjung / paling diminati — SENGAJA placeholder jujur, bukan angka
          rekaan. Belum ada sumber data (Fasa 14, jejak pengunjung belum dibina). */}
      <div className="bg-stone-50 p-5 rounded-lg border border-stone-200 border-dashed text-center">
        <p className="text-xs text-stone-400">
          Bilangan pengunjung & kandungan paling diminati akan dipaparkan di sini selepas jejak pengunjung dibina (Fasa 14).
        </p>
      </div>
    </div>
  );
};

export default DashboardConsole;
