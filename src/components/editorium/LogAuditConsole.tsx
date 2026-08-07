import React, { useEffect, useState } from 'react';
import { NotebookText, Hourglass, RefreshCw } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';

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

// Nada visual (StatusBadge) ikut jenis tindakan — cipta/terbit/aktifkan = success,
// tolak/arkib/ubah = warning, padam/ralat = error. Kod yang tiada dalam peta ni jatuh
// balik ke 'neutral' (lihat tonTindakan di bawah).
const TINDAKAN_TONE: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  'tolak-ke-draf': 'warning',
  'padam-ticker': 'error',
  'cipta-akaun': 'success',
  'ubah-peranan': 'warning',
  'daftar-bidang': 'success',
  'namakan-semula-bidang': 'warning',
  'gabung-bidang': 'warning',
  'aktifkan-bidang': 'success',
  'arkib-bidang': 'warning',
  'cipta-nota': 'success',
  'padam-nota': 'error',
  'ralat-ambilan-rss': 'error',
  'ambilan-rss-selesai': 'success',
  'rss-huraian-dipendekkan': 'warning',
  'ralat-pelayan': 'error',
};

export const tonTindakan = (action: string): 'success' | 'warning' | 'error' | 'neutral' => {
  if (TINDAKAN_TONE[action]) return TINDAKAN_TONE[action];
  if (action.startsWith('status-akaun:') && action.includes('nyahaktif')) return 'error';
  if (action.startsWith('status:') || action.startsWith('status-akaun:') || action.startsWith('status-nota:')) return 'warning';
  return 'neutral';
};

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

export const labelTindakan = (action: string): string => {
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
      <div className="bg-white p-6 rounded-lg shadow-[0_1px_2px_rgba(0,0,0,.04)] border border-stone-200 flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="font-serif text-base uppercase tracking-wider text-[var(--color-Adjung-maroon)] font-bold mb-1">
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

      {ralat && (
        <div className="bg-red-50 border border-[var(--color-error)] text-[var(--color-error)] text-xs px-3 py-2 rounded">
          {ralat}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-[0_1px_2px_rgba(0,0,0,.04)] border border-stone-200 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans text-xs min-w-[720px]">
          <thead>
            <tr className="border-b border-stone-200 font-mono text-[10px] uppercase tracking-wide text-stone-400" style={{ background: '#F7F5F2' }}>
              <th className="p-3">Masa</th>
              <th className="p-3">Pelaku</th>
              <th className="p-3">Tindakan</th>
              <th className="p-3">Sasaran</th>
              <th className="p-3">Butiran</th>
            </tr>
          </thead>
          <tbody className="font-sans">
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
              <tr key={e.id} className="hover:bg-stone-50 transition-colors" style={{ borderTop: '1px solid #F0EDE9' }}>
                <td className="p-3 text-stone-500 font-mono text-xs whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleString('ms-MY')}
                </td>
                <td className="p-3 text-stone-800 font-serif font-semibold">{e.actorName || 'Tidak diketahui'}</td>
                <td className="p-3">
                  <StatusBadge tone={tonTindakan(e.action)} label={labelTindakan(e.action)} />
                </td>
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
