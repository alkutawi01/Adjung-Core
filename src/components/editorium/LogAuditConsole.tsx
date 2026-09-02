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

  // PEMBETULAN (2026-09-02, dapatan bug-hunt — sambungan corak "peta/enum tercicir" yang
  // terbukti di MaklumanDrawer.tsx pusingan 15/16). Disahkan terus daripada data audit_log
  // SEBENAR (`SELECT action, COUNT(*) FROM audit_log GROUP BY action`): 'menerbit-kandungan'
  // (tindakan Terbit paling kerap, 50 baris sedia ada) TIADA entri tone di sini, jadi lencana
  // StatusBadge jatuh balik 'neutral' (kelabu, sama macam kemas kini tetapan biasa) walaupun ia
  // tindakan POSITIF (kandungan berjaya disiar) — sepatutnya hijau 'success' sama seperti
  // 'ambilan-rss-selesai'. Tindakan lain kekal automasi sistem, ikut nada yang sama:
  'menerbit-kandungan': 'success',
  'kandungan-terbit-berjadual': 'success',
  'kandungan-naik-taraf-slot-kosong': 'success',
  'pulihkan-kandungan-tong-sampah': 'success',
  'kandungan-luput-berjadual': 'warning',
  'kandungan-putar-auto-arkib-24-jam': 'warning',
  'kandungan-berjadual-tunggu-slot': 'warning',
  'padam-kandungan-tong-sampah': 'error',
  'padam-kandungan-kekal': 'error',
  'kandungan-padam-kekal-auto-tong-sampah': 'error',
  'padam-kandungan-belum-terbit': 'error',
  'cipta-kandungan': 'success',
  'cipta-kandungan-ticker': 'success',
  'cipta-prompt-semakan': 'success',
  'padam-prompt-semakan': 'error',
  'cipta-petikan': 'success',
  'import-petikan': 'success',
  'padam-petikan': 'error',
  'cipta-penaja': 'success',
  'tambah-ejaan-piawai': 'success',
  'padam-ejaan-piawai': 'error',
  'tambah-glosari': 'success',
  'padam-glosari': 'error',
  'tambah-sense-glosari': 'success',
  'padam-sense-glosari': 'error',
  'tambah-pengecualian-pemenggalan': 'success',
  'padam-pengecualian-pemenggalan': 'error',
  'padam-konfigurasi-terjemahan': 'error',
  'reset-tetapan-tier': 'warning',
  'set-semula-label-ui': 'warning',
  'permohonan-penaja-lulus': 'success',
  'permohonan-penaja-sahkan-bayaran': 'success',
  'permohonan-penaja-aktifkan': 'success',
  'permohonan-penaja-tolak': 'warning',
  'permohonan-penaja-minta_maklumat': 'warning',
  'terima-permohonan-editor': 'success',
  'tolak-permohonan-editor': 'warning',
  'konfigurasi-base-url-tiada': 'error',
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

  // PEMBETULAN (2026-09-02, dapatan bug-hunt) — audit penuh SEMUA tapak panggilan logAudit()
  // merentasi core/routes/*.js dibandingkan senarai di atas dedah lebih 40 kod tindakan SAH
  // (bukan hipotesis, disahkan wujud dalam data audit_log SEBENAR) yang tiada padanan di sini,
  // jadi Log Sistem DAN panel "Aktiviti Editor" (DashboardConsole.tsx, guna labelTindakan()
  // yang sama) memaparkannya mentah dalam gaya kod ("sunting-petikan", "tetapkan-bidang-slot").
  // Round 16 nilai ni sebagai "fallback selamat" munasabah untuk kod BAHARU/JARANG — tapi
  // semakan `SELECT action, COUNT(*) FROM audit_log GROUP BY action` dedah beberapa antaranya
  // ialah tindakan KERAP, bukan jarang: 'padam-kandungan-tong-sampah' (81 baris),
  // 'sunting-petikan' (74), 'padam-petikan' (47), 'tetapkan-bidang-slot' (44) — kesemuanya lebih
  // kerap daripada 'tolak-ke-draf' (cuma 6) yang SUDAH dipadankan sejak awal. Ditambah SEMUA
  // kod yang ditemui (bukan cuma yang kerap) supaya corak ni tak berulang setiap kali modul
  // baharu (Petikan, Glosari, Ejaan, dll.) capai kadar guna tinggi.
  'sunting-petikan': 'Sunting Petikan',
  'padam-kandungan-tong-sampah': 'Hantar kandungan ke Tong Sampah',
  'tetapkan-bidang-slot': 'Tetapkan Bidang slot',
  'padam-petikan': 'Padam Petikan',
  'cipta-petikan': 'Cipta Petikan',
  'import-petikan': 'Import Petikan pukal',
  'kemas-kini-tetapan-tier': 'Kemas kini Tetapan Tier',
  'reset-tetapan-tier': 'Set semula Tetapan Tier ke lalai',
  'kemas-kini-tetapan-am-slot': 'Kemas kini Tetapan Am Slot',
  'kemas-kini-halaman-awam': 'Kemas kini Halaman Awam',
  'kemas-kini-taksonomi': 'Kemas kini Bidang/Topik kandungan',
  'kemas-kini-tetapan-sistem': 'Kemas kini Tetapan Sistem',
  'kemas-kini-dasar-terbit-sendiri': 'Kemas kini Dasar Terbit Sendiri Editor',
  'kemas-kini-dasar-aktif-editorial': 'Kemas kini Dasar Aktif Editorial',
  'cipta-prompt-semakan': 'Cipta Arahan AI untuk Semakan',
  'padam-prompt-semakan': 'Padam Arahan AI untuk Semakan',
  'cipta-kandungan': 'Cipta kandungan baharu',
  'cipta-kandungan-ticker': 'Cipta kandungan Ticker',
  'padam-kandungan-kekal': 'Padam kandungan secara kekal',
  'kandungan-padam-kekal-auto-tong-sampah': 'Padam kekal automatik (Tong Sampah lapuk)',
  'padam-kandungan-belum-terbit': 'Padam kandungan belum terbit (akaun dipadam)',
  'pulihkan-kandungan-tong-sampah': 'Pulihkan kandungan daripada Tong Sampah',
  'kandungan-naik-taraf-slot-kosong': 'Naik taraf kandungan menunggu ke slot kosong',
  'kandungan-luput-berjadual': 'Kandungan luput mengikut jadual',
  'kandungan-terbit-berjadual': 'Kandungan diterbitkan mengikut jadual',
  'kandungan-berjadual-tunggu-slot': 'Jadual terbit tertangguh — slot penuh',
  'kandungan-putar-auto-arkib-24-jam': 'Putar automatik ke arkib (24 jam)',
  'kemas-kini-editor-slot': 'Kemas kini penugasan editor slot',
  'kemas-kini-ai-provider': 'Kemas kini pembekal AI',
  'kemas-kini-templat-prompt-ai': 'Kemas kini templat Arahan AI',
  'set-semula-kata-laluan-editor': 'Tetapkan semula kata laluan editor',
  'selaraskan-warna-bidang': 'Selaraskan warna Bidang',
  'pelbagaikan-warna-bidang': 'Pelbagaikan warna Bidang',
  'tambah-ejaan-piawai': 'Tambah ejaan piawai',
  'sunting-ejaan-piawai': 'Sunting ejaan piawai',
  'padam-ejaan-piawai': 'Padam ejaan piawai',
  'tambah-glosari': 'Tambah istilah Glosari',
  'padam-glosari': 'Padam istilah Glosari',
  'tambah-sense-glosari': 'Tambah Sense Glosari',
  'sunting-sense-glosari': 'Sunting Sense Glosari',
  'padam-sense-glosari': 'Padam Sense Glosari',
  'tambah-pengecualian-pemenggalan': 'Tambah pengecualian pemenggalan suku kata',
  'sunting-pengecualian-pemenggalan': 'Sunting pengecualian pemenggalan suku kata',
  'padam-pengecualian-pemenggalan': 'Padam pengecualian pemenggalan suku kata',
  'cipta-penaja': 'Cipta Penaja',
  'kemas-kini-penaja': 'Kemas kini Penaja',
  'kemas-kini-konfigurasi-terjemahan': 'Kemas kini konfigurasi Terjemahan',
  'padam-konfigurasi-terjemahan': 'Padam konfigurasi Terjemahan',
  'kemas-kini-label-ui': 'Kemas kini Label Sistem',
  'set-semula-label-ui': 'Set semula Label Sistem ke lalai',
  'permohonan-penaja-mula_semakan': 'Mula semakan permohonan penajaan',
  'permohonan-penaja-minta_maklumat': 'Minta maklumat tambahan (permohonan penajaan)',
  'permohonan-penaja-tolak': 'Tolak permohonan penajaan',
  'permohonan-penaja-lulus': 'Luluskan permohonan penajaan',
  'permohonan-penaja-sahkan-bayaran': 'Sahkan bayaran penajaan',
  'permohonan-penaja-aktifkan': 'Aktifkan penajaan',
  'terima-permohonan-editor': 'Terima permohonan editor',
  'tolak-permohonan-editor': 'Tolak permohonan editor',
  'konfigurasi-base-url-tiada': 'BASE_URL tiada dalam konfigurasi produksi',
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
  // PEMBETULAN (2026-09-02, dapatan bug-hunt) — dua corak dinamik lagi (contentRoutes.js,
  // userAdminRoutes.js) tiada gerbang prefix macam status:/status-akaun:/status-nota: di atas,
  // jadi jatuh terus ke `return action` mentah ("pulih-versi:v2->v5", "auto-terbit:hidup").
  if (action.startsWith('pulih-versi:')) {
    return `Pulih versi kandungan: ${action.slice('pulih-versi:'.length).replace('->', ' → ')}`;
  }
  if (action.startsWith('auto-terbit:')) {
    const nilai = action.slice('auto-terbit:'.length);
    return `Tukar dasar auto-terbit editor: ${nilai.charAt(0).toUpperCase()}${nilai.slice(1)}`;
  }
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
                {/* PEMBETULAN (2026-09-02, dapatan bug-hunt) — dahulu `e.actorName || 'Tidak
                    diketahui'` semata-mata, tanpa bezakan DUA sebab actorName kosong: (1)
                    event AUTOMASI/SISTEM sengaja tiada actorId/actorName langsung (konvensyen
                    CLAUDE.md, "actorId ialah kontrak pembeza manusia vs sistem") — cth
                    `ambilan-rss-selesai` (slotRoutes.js) tercicir actorName walau ia SAH event
                    automasi biasa; (2) actorId WUJUD tetapi actorName hilang/rosak — kes tu
                    SEBENARNYA patut jadi "Tidak diketahui". Disahkan data sebenar: dalam SATU
                    larian RSS, baris `rss-huraian-dipendekkan` label "RSS Direct (automatik)"
                    tapi `ambilan-rss-selesai` (larian sama) label "Tidak diketahui" — nampak
                    macam pelaku misteri sedangkan cuma ringkasan automasi biasa. Kini bezakan
                    ikut `actorId === null` (konvensyen sengaja) lawan actorId ada tapi nama
                    hilang (SEBENAR tak diketahui). */}
                <td className="p-3 text-stone-800 font-serif font-semibold">
                  {e.actorName || (e.actorId === null ? 'Automasi Sistem' : 'Tidak diketahui')}
                </td>
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
