import React, { useEffect, useState } from 'react';
import { NotebookText, RefreshCw } from 'lucide-react';
import { StatusBadge } from '../common/StatusBadge';
import { Tooltip } from '../common/Tooltip';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { Button } from '../common/Button';
import { KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';

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
  // 2026-08-16 (permintaan Izzat — "Aktiviti Editor takde apa2" lepas penerbitan sebenar
  // pertama) — 'menerbit-kandungan'/'kandungan-menunggu-kelulusan' baris KHUSUS baharu
  // (slotsConfigRoutes.js, guna publishOutcomes), 'kemas-kini-konfigurasi-slot' label lama
  // yang jatuh balik ke teks mentah kod sebelum ni (Pilihan A ChatGPT/Izzat — label mesra
  // walaupun entri generik ni sendiri tak sebut tajuk).
  'menerbit-kandungan': 'Menerbitkan kandungan',
  'kandungan-menunggu-kelulusan': 'Kandungan menunggu kelulusan',
  'kemas-kini-konfigurasi-slot': 'Kemas kini slot',
};

// Label Bahasa Melayu bagi kod status DALAMAN kandungan (CONTENT_STATUSES, contentRoutes.js) —
// nilai mentah 'approved'/'archived'/dsb. TIDAK PERNAH patut sampai ke paparan (2026-08-16,
// Izzat: "ni teruk. sangat teruk. bahasa rojak" — Log Audit dahulu papar terus "approved →
// archived" tanpa terjemah, bahasa Inggeris+Melayu bercampur dalam SATU ayat). Sama label yang
// dipakai di ContentReview.tsx/IndeksConsole.tsx supaya konsisten merentasi sistem.
const STATUS_KANDUNGAN_LABEL: Record<string, string> = {
  approved: 'Aktif',
  pending: 'Menunggu',
  rejected: 'Ditolak',
  archived: 'Arkib',
  scheduled: 'Berjadual',
  dipadam: 'Dipadam',
};
const labelStatusKandungan = (kod: string) => STATUS_KANDUNGAN_LABEL[kod.trim()] || kod.trim();

export const labelTindakan = (action: string): string => {
  if (TINDAKAN_LABEL[action]) return TINDAKAN_LABEL[action];
  if (action.startsWith('status:')) {
    const [lama, baharu] = action.slice('status:'.length).split('->');
    return `Tukar status: ${labelStatusKandungan(lama || '')} → ${labelStatusKandungan(baharu || '')}`;
  }
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
      {/* Log Sistem ialah modul satu-fungsi — tiada seksyen bernombor (Pelan 01 Fasa D1). */}
      <ModulTajuk
        tajuk="Log Sistem"
        huraian={
          <>
            Jejak tindakan editorial dan pentadbiran: terbit/tolak/arkib kandungan, urus akaun,
            perubahan Bidang, ambilan RSS, ralat pelayan. Terkini di atas.
          </>
        }
        tindakan={
          <Button variant="secondary" onClick={muatSemula} icon={<RefreshCw className="w-3.5 h-3.5" />}>
            Muat Semula
          </Button>
        }
      />

      {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}

      <PanelCard padding="p-0">
        {/* 2026-08-07 (Audit §I1, semakan sanggahan) — pembalut PanelCard padding="p-0" guna
            overflow-hidden (untuk sudut bulat), yang tanpa disedari jadi "bekas tatal" TERDEKAT
            bagi kepala melekat (position: sticky) sebelum peluang ia sampai ke tatal laman
            sebenar — sebab bekas tu sendiri tak pernah tatal (tinggi mengikut kandungan), kepala
            melekat jadi tak berkesan langsung. `overflow-y-auto` + `max-h-[70vh]` di sini
            menjadikan bekas jadual SENDIRI bekas tatal yang sah, supaya kepala benar-benar
            melekat semasa senarai log ditatal. Disahkan mata: lihat pelan audit §I1. */}
        <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
        <table className="w-full text-left border-collapse font-sans text-xs min-w-[720px]">
          <caption className="sr-only">Log tindakan sistem dan editorial</caption>
          <thead>
            <tr className={KEPALA_JADUAL}>
              <th scope="col" className="p-3">Masa</th>
              <th scope="col" className="p-3">Pelaku</th>
              <th scope="col" className="p-3">Tindakan</th>
              <th scope="col" className="p-3">Sasaran</th>
              <th scope="col" className="p-3">Butiran</th>
            </tr>
          </thead>
          <tbody className="font-sans">
            {memuat && (
              <tr><td colSpan={5}><KeadaanMemuat baris={5} /></td></tr>
            )}
            {!memuat && entri.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <KeadaanKosong ikon={<NotebookText className="w-6 h-6" />}>
                    Log Kosong. Belum ada tindakan direkod lagi.
                  </KeadaanKosong>
                </td>
              </tr>
            )}
            {!memuat && entri.map(e => (
              <tr key={e.id} className={`hover:bg-stone-50 transition-colors ${GARIS_BARIS}`}>
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
                <Tooltip text={e.detail || ''}>
                  <td className="p-3 text-stone-600 max-w-xs truncate">{e.detail || '-'}</td>
                </Tooltip>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </PanelCard>
    </div>
  );
};

export default LogAuditConsole;
