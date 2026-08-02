import React, { useEffect, useState } from 'react';
import { NotebookText, Hourglass, RefreshCw } from 'lucide-react';

// Log Sistem (2026-08-02, Fasa 4) — dahulu SIFAR: tiada jadual audit_log, tiada penulisan,
// konsol ni cuma placeholder jujur. Kini baca GET /api/system/audit-log (jadual sebenar,
// lihat core/audit/AuditLog.js untuk senarai tindakan yang dicatat — tidak semua tindakan
// sistem direkod, cuma yang paling bermakna untuk jejak editorial/pentadbiran).
interface EntriLog {
  id: number;
  actorId: string | null;
  actorName: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  detail: string | null;
  createdAt: string;
}

// Padanan kod tindakan dalaman -> label Bahasa Melayu dipaparkan. Kod yang tiada dalam
// senarai ni dipaparkan mentah (fallback selamat untuk tindakan baharu yang belum dipadan).
const TINDAKAN_LABEL: Record<string, string> = {
  'tolak-ke-draf': 'Tolak kandungan ke draf',
  'padam-ticker': 'Padam item ticker',
  'cipta-akaun': 'Cipta akaun editor',
  'ubah-peranan': 'Ubah peranan akaun',
  'daftar-bidang': 'Daftar Bidang baharu',
  'namakan-semula-bidang': 'Namakan semula Bidang',
  'gabung-bidang': 'Gabung Bidang',
  'aktifkan-bidang': 'Aktifkan Bidang',
  'arkib-bidang': 'Arkibkan Bidang',
  'cipta-nota': 'Cipta Nota Ketua Editor',
  'padam-nota': 'Padam Nota Ketua Editor',
  'ralat-ambilan-rss': 'Ralat ambilan RSS',
  'ambilan-rss-selesai': 'Ambilan RSS selesai',
  'rss-huraian-dipendekkan': 'Huraian RSS dipendekkan (Ticker)',
  'ralat-pelayan': 'Ralat pelayan',
};

const labelTindakan = (action: string): string => {
  if (TINDAKAN_LABEL[action]) return TINDAKAN_LABEL[action];
  if (action.startsWith('status:')) return `Tukar status: ${action.slice('status:'.length).replace('->', ' → ')}`;
  if (action.startsWith('status-akaun:')) return `Tukar status akaun: ${action.slice('status-akaun:'.length)}`;
  if (action.startsWith('status-nota:')) return `Tukar status nota: ${action.slice('status-nota:'.length)}`;
  return action;
};

export const LogAuditConsole: React.FC = () => {
  const [entri, setEntri] = useState<EntriLog[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');

  const muatSemula = () => {
    setMemuat(true);
    fetch('/api/system/audit-log?limit=150')
      .then(r => r.json())
      .then(d => { setEntri(Array.isArray(d) ? d : []); setRalat(''); })
      .catch(() => setRalat('Gagal memuatkan log audit.'))
      .finally(() => setMemuat(false));
  };
  useEffect(muatSemula, []);

  return (
    <div className="space-y-4">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-stone-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="font-serif text-base uppercase tracking-wider text-[#802334] font-bold mb-1">
            Log Sistem
          </h2>
          <p className="font-sans text-xs text-stone-600">
            Jejak tindakan editorial dan pentadbiran — terbit/tolak/arkib kandungan, urus akaun,
            perubahan Bidang, ambilan RSS, ralat pelayan. Terkini di atas.
          </p>
        </div>
        <button
          onClick={muatSemula}
          className="inline-flex items-center gap-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-mono text-xs px-3 py-2 rounded font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Muat Semula
        </button>
      </div>

      {ralat && <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2 rounded">{ralat}</div>}

      <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs">
          <thead>
            <tr className="bg-stone-100 border-b border-stone-200 font-sans text-xs uppercase text-stone-600 font-semibold">
              <th className="p-3">Masa</th>
              <th className="p-3">Pelaku</th>
              <th className="p-3">Tindakan</th>
              <th className="p-3">Sasaran</th>
              <th className="p-3">Butiran</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-sans">
            {memuat && (
              <tr><td colSpan={5} className="p-12 text-center text-stone-400"><Hourglass className="w-5 h-5 mx-auto mb-2 animate-pulse" />Memuatkan...</td></tr>
            )}
            {!memuat && entri.length === 0 && (
              <tr>
                <td colSpan={5} className="p-12 text-center text-stone-500">
                  <div className="mb-2 flex justify-center"><NotebookText className="w-6 h-6" /></div>
                  <div className="font-bold uppercase tracking-wider text-[11px] mb-1">Log Kosong</div>
                  <p className="text-xs max-w-sm mx-auto">Belum ada tindakan direkod lagi.</p>
                </td>
              </tr>
            )}
            {!memuat && entri.map(e => (
              <tr key={e.id} className="hover:bg-stone-50 transition-colors">
                <td className="p-3 text-stone-500 font-mono text-xs whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString('ms-MY')}
                </td>
                <td className="p-3 text-stone-800 font-semibold">{e.actorName || 'Tidak diketahui'}</td>
                <td className="p-3 text-stone-900">{labelTindakan(e.action)}</td>
                <td className="p-3 text-stone-500 font-mono text-xs">
                  {e.targetType || ''}{e.targetId ? ` · ${e.targetId}` : ''}
                </td>
                <td className="p-3 text-stone-600 max-w-xs truncate" title={e.detail || ''}>{e.detail || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
};

export default LogAuditConsole;
