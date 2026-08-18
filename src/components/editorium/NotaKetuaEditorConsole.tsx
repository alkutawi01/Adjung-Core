import React, { useCallback, useEffect, useState } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { Pin, PinOff, Archive, ArchiveRestore, Trash2, Pencil } from 'lucide-react';
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

// Nota Ketua Editor (2026-08-01, spesifikasi pemilik projek) — tiga kategori nota yang Ketua
// Editor terbitkan kepada pasukan, dengan satu pengasingan penting: SKOP.
//
//   Nota (Dalaman)          — hanya kelihatan dalam Editorium.
//   Catatan Ketua Editor    — disiarkan di Frontpage (pautan footer "Catatan Ketua Editor").
//   Pengumuman              — disiarkan di Frontpage (pautan footer "Pengumuman").
//
// TIGA nilai skop (2026-08-05, dipecah daripada "Awam" generik) — setiap pilihan sepadan TEPAT
// dengan satu destinasi Frontpage sebenar, label SAMA di kedua-dua hujung (Editorium & portal
// awam) supaya editor tahu tepat ke mana nota tu akan tersiar, bukan label kabur "Awam" yang
// perlu diteka destinasinya.
//
// Pengasingan tu dikuatkuasakan di PELAYAN (SQL laluan awam menapis `type` terhadap senarai putih
// 2 nilai awam sahaja), bukan di sini — borang ni cuma menghantar pilihan, ia bukan yang
// menjaganya. Lihat core/routes/editorNotesRoutes.js.
//
// Nota tidak dipadam terus: ia diarkibkan dahulu, kemudian barulah boleh dipadam — corak sama
// macam peraturan padam/arkib kandungan editorial (sesuatu yang pernah terbit tidak lenyap dengan
// satu klik).
interface Nota {
  id: string;
  tajuk: string;
  kandungan: string;
  kategori: 'notis' | 'am' | 'khas';
  skop: 'dalaman' | 'catatan_ketua_editor' | 'pengumuman';
  status: 'aktif' | 'arkib';
  disemat: boolean;
  penulis: string;
  dibuatPada: string;
}

const LABEL_SKOP: Record<Nota['skop'], string> = {
  dalaman: 'Nota Ketua Editor',
  catatan_ketua_editor: 'Catatan Ketua Editor',
  pengumuman: 'Pengumuman',
};

interface NotaKetuaEditorConsoleProps {
  editorId: string;
  editorName: string;
  // Hanya Ketua Editor boleh menerbitkan/menyunting nota; Editor biasa membacanya sahaja.
  bolehUrus: boolean;
  // Dipanggil setiap kali senarai nota berubah — supaya lencana Peti Makluman di header tak kekal
  // memaparkan kiraan lapuk selepas nota diterbitkan/diarkibkan di sini.
  onBerubah?: () => void;
}

// Medan `kategori` (Notis/Nota Am/Nota Khas) DIBUANG daripada borang+senarai (2026-08-18,
// Izzat: "sepatutnya hanya ada 3: Nota Ketua Editor, Catatan Ketua Editor, Pengumuman") — dua
// paksi berasingan (kategori × skop) menghasilkan matriks 3×3 yang mengelirukan, sedangkan
// Izzat cuma bayangkan TIGA jenis (paksi SKOP sahaja). Lajur `category` DB dikekalkan (elak
// migrasi/risiko skema) — nota BAHARU sentiasa hantar 'am' senyap (KATEGORI_LALAI di bawah),
// nota LAMA yang tersimpan dgn kategori lain (notis/khas) kekal utuh dlm DB, cuma tak lagi
// dipaparkan/disunting di UI ni.
const KATEGORI_LALAI = 'am' as const;

const HAD_TAJUK = 150;
const HAD_KANDUNGAN = 5000;

const tarikhRingkas = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ms-MY', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const NotaKetuaEditorConsole: React.FC<NotaKetuaEditorConsoleProps> = ({
  editorId, editorName, bolehUrus, onBerubah,
}) => {
  const [nota, setNota] = useState<Nota[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');
  const [paparanArkib, setPaparanArkib] = useState(false);

  // Borang: satu borang untuk cipta DAN sunting — `menyunting` menyimpan id nota yang sedang
  // disunting (kosong = sedang mencipta nota baharu).
  const [menyunting, setMenyunting] = useState<string>('');
  const [tajuk, setTajuk] = useState('');
  const [kandungan, setKandungan] = useState('');
  const [skop, setSkop] = useState<Nota['skop']>('dalaman');
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralatBorang, setRalatBorang] = useState('');
  const [mesej, setMesej] = useState('');

  // Pengesahan dalam-aplikasi (Audit UI/UX §E1, §B4) — bukan `window.confirm`. Simpan id nota yang
  // menunggu pengesahan; butang berkenaan (Padam/Sunting) digantikan sementara dengan Ya/Batal.
  const [confirmPadamId, setConfirmPadamId] = useState('');
  const [confirmSuntingId, setConfirmSuntingId] = useState('');

  const muat = useCallback(() => {
    setMemuat(true);
    setRalat('');
    fetch(`/api/system/editor-notes?status=${paparanArkib ? 'arkib' : 'aktif'}`)
      .then(async (res) => {
        const data = await bacaJsonSelamat(res);
        if (!res.ok) throw new Error(data.error || 'Gagal membaca senarai nota.');
        return data;
      })
      .then((d) => setNota(Array.isArray(d) ? d : []))
      .catch((e) => setRalat(e.message || 'Gagal membaca senarai nota.'))
      .finally(() => setMemuat(false));
  }, [paparanArkib]);

  useEffect(() => { muat(); }, [muat]);

  const kosongkanBorang = () => {
    setMenyunting('');
    setTajuk('');
    setKandungan('');
    setSkop('dalaman');
    setRalatBorang('');
  };

  const mulaSunting = (n: Nota) => {
    setMenyunting(n.id);
    setTajuk(n.tajuk);
    setKandungan(n.kandungan);
    setSkop(n.skop);
    setRalatBorang('');
    setConfirmSuntingId('');
  };

  // B4: sebelum menimpa borang, semak jika ada kandungan belum simpan (nota BAHARU sedang ditaip,
  // atau nota LAIN sedang disunting) — kalau ada, minta pengesahan dahulu.
  const mintaSunting = (n: Nota) => {
    const adaDrafLain = (tajuk.trim() !== '' || kandungan.trim() !== '') && menyunting !== n.id;
    if (adaDrafLain) {
      setConfirmSuntingId(n.id);
    } else {
      mulaSunting(n);
    }
  };

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setRalatBorang('');
    try {
      const menyuntingSedia = !!menyunting;
      const res = await fetch(
        menyuntingSedia ? `/api/system/editor-notes/${menyunting}` : '/api/system/editor-notes',
        {
          method: menyuntingSedia ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tajuk, kandungan, kategori: KATEGORI_LALAI, skop, penulis: editorName, penulisId: editorId }),
        }
      );
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nota.');
      kosongkanBorang();
      setMesej(menyuntingSedia ? 'Nota dikemas kini' : 'Nota diterbitkan');
      setTimeout(() => setMesej(''), 6000);
      muat();
      onBerubah?.();
    } catch (err: any) {
      setRalatBorang(err.message || 'Gagal menyimpan nota.');
    } finally {
      setMenyimpan(false);
    }
  };

  // WF-07 (Pusingan 5, audit ChatGPT 2026-08-09) — dahulu ubah()/padam() (Pin/Nyahpin/Arkib/
  // Pulih/Padam) TIADA maklum balas kejayaan langsung, tak macam hantar()/simpan borang yang
  // dah ada mesej hijau — satu-satunya isyarat ialah senarai tersusun semula senyap. Sekarang
  // pesan mesej khusus tindakan (bukan "berjaya" generik) guna corak mesej sedia ada; kegagalan
  // kekal jatuh balik ke ralat MesejStatus seperti biasa.
  const ubah = async (id: string, patch: Record<string, any>, mesejBerjaya?: string) => {
    try {
      const res = await fetch(`/api/system/editor-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini nota.');
      if (mesejBerjaya) {
        setMesej(mesejBerjaya);
        setTimeout(() => setMesej(''), 4000);
      }
      muat();
      onBerubah?.();
    } catch (err: any) {
      setRalat(err.message || 'Gagal mengemas kini nota.');
    }
  };

  const padam = async (id: string) => {
    try {
      const res = await fetch(`/api/system/editor-notes/${id}`, { method: 'DELETE' });
      const data = await bacaJsonSelamat(res).catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memadam nota.');
      if (menyunting === id) kosongkanBorang();
      setMesej('Nota dipadam');
      setTimeout(() => setMesej(''), 4000);
      muat();
      onBerubah?.();
    } catch (err: any) {
      setRalat(err.message || 'Gagal memadam nota.');
    }
  };

  const bakiTajuk = HAD_TAJUK - tajuk.length;
  const bakiKandungan = HAD_KANDUNGAN - kandungan.length;

  // Nombor seksyen ikut aliran kerja (Pelan 01 Fasa D1): borang penerbitan dahulu, senarai
  // kemudian. Apabila editor tiada kebenaran mengurus, borang tidak wujud, jadi senarai naik
  // menjadi seksyen pertama.
  const nomborSenarai = bolehUrus ? '02' : '01';

  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Nota Ketua Editor"
        huraian="Nota, catatan, dan pengumuman Ketua Editor kepada pasukan. Sebahagiannya turut disiarkan di Frontpage."
      />

      {/* Borang penerbitan — Ketua Editor sahaja. */}
      {bolehUrus && (
        <PanelCard className="text-xs">
          <form onSubmit={hantar} className="space-y-4">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <SectionLabel>01 — {menyunting ? 'Sunting Nota' : 'Terbitkan Nota'}</SectionLabel>
              <p className="text-stone-500 text-xs">
                <strong className="font-semibold text-stone-700">Nota Ketua Editor</strong> hanya kelihatan dalam Editorium.
                <strong className="font-semibold text-stone-700"> Catatan Ketua Editor</strong> dan
                <strong className="font-semibold text-stone-700"> Pengumuman</strong> disiarkan di Frontpage.
              </p>
            </div>
            {menyunting && (
              <Button variant="secondary" onClick={kosongkanBorang}>Batal Sunting</Button>
            )}
          </div>

          {/* Lajur borang berhad lebar. `lg` (bukan `md`) sebab medan Kandungan ialah textarea
              perenggan yang mendominasi borang ni — satu lajur untuk semua medan supaya tepi
              kanannya rata, bukan textarea terjuih keluar daripada medan lain. */}
          <FormColumn saiz="lg" className="space-y-4">
          <label className="flex flex-col gap-1">
            <span className={LABEL_BORANG}>Jenis</span>
            <select
              value={skop}
              onChange={(e) => setSkop(e.target.value as Nota['skop'])}
              className={`${INPUT_BORANG} cursor-pointer`}
            >
              <option value="dalaman">Nota Ketua Editor (Editorium sahaja)</option>
              <option value="catatan_ketua_editor">Catatan Ketua Editor (disiarkan di Frontpage)</option>
              <option value="pengumuman">Pengumuman (disiarkan di Frontpage)</option>
            </select>
            {skop !== 'dalaman' && (
              <span className="text-Adjung-maroon text-[10px] font-semibold">
                Nota ini akan disiarkan di Frontpage (pautan footer "{LABEL_SKOP[skop]}"). Pastikan tiada maklumat dalaman di dalamnya.
              </span>
            )}
          </label>

          <label className="flex flex-col gap-1">
            <span className={`${LABEL_BORANG} flex justify-between`}>
              <span>Tajuk</span>
              <span className={bakiTajuk < 0 ? 'text-[var(--color-error)]' : 'text-stone-400'}>{tajuk.length}/{HAD_TAJUK}</span>
            </span>
            <input
              type="text"
              value={tajuk}
              onChange={(e) => setTajuk(e.target.value)}
              placeholder="Tajuk nota"
              className={INPUT_BORANG}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className={`${LABEL_BORANG} flex justify-between`}>
              <span>Kandungan</span>
              <span className={bakiKandungan < 0 ? 'text-[var(--color-error)]' : 'text-stone-400'}>{kandungan.length}/{HAD_KANDUNGAN}</span>
            </span>
            <textarea
              value={kandungan}
              onChange={(e) => setKandungan(e.target.value)}
              rows={5}
              placeholder="Kandungan nota"
              className={`${INPUT_BORANG} resize-y`}
            />
          </label>

          {ralatBorang && <MesejStatus tone="error">{ralatBorang}</MesejStatus>}

          <div className="flex items-center justify-end gap-3 pt-1">
            {/* NOTA-1 (2A, audit ChatGPT 2026-08-09) — dahulu <span> bergaya sendiri walaupun
                fail ni SUDAH import+guna MesejStatus utk ralat 2 baris di atas. */}
            {mesej && <MesejStatus tone="success">{mesej}</MesejStatus>}
            <Button
              type="submit"
              variant="primary"
              disabled={menyimpan || !tajuk.trim() || !kandungan.trim() || bakiTajuk < 0 || bakiKandungan < 0}
            >
              {menyimpan ? 'Menyimpan…' : menyunting ? 'Simpan Perubahan' : 'Terbitkan Nota'}
            </Button>
          </div>
          </FormColumn>
          </form>
        </PanelCard>
      )}

      {/* Senarai nota */}
      <PanelCard className="space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <SectionLabel>{nomborSenarai} — {paparanArkib ? 'Nota Diarkibkan' : 'Nota Aktif'}</SectionLabel>
            <p className="text-stone-500 text-xs">
              {paparanArkib
                ? 'Rekod nota lama. Nota di sini boleh dipulihkan atau dipadam terus.'
                : 'Nota yang sedang berkuat kuasa. Nota disemat sentiasa di atas.'}
            </p>
          </div>
          <Button variant="secondary" onClick={() => setPaparanArkib((v) => !v)}>
            {paparanArkib ? 'Lihat Nota Aktif' : 'Lihat Arkib'}
          </Button>
        </div>

        {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}

        {memuat ? (
          <KeadaanMemuat baris={4} />
        ) : nota.length === 0 ? (
          <KeadaanKosong>
            {paparanArkib ? 'Tiada nota diarkibkan.' : 'Tiada nota aktif.'}
          </KeadaanKosong>
        ) : (
          <ul className="list-none m-0 p-0 divide-y divide-Adjung-line">
            {nota.map((n) => (
              <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {n.disemat && (
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider font-bold text-Adjung-maroon">
                          <Pin className="w-2.5 h-2.5" /> Disemat
                        </span>
                      )}
                      {/* Skop nota — nota awam (disiarkan di Frontpage) diberi nada `success`
                          sebab ia tersiar; nota dalaman nada `neutral` sebab ia senyap. */}
                      <StatusBadge
                        tone={n.skop !== 'dalaman' ? 'success' : 'neutral'}
                        label={LABEL_SKOP[n.skop] || n.skop}
                      />
                      <span className="font-mono text-[9px] text-stone-400">{tarikhRingkas(n.dibuatPada)}</span>
                    </div>
                    <p className="font-serif text-[15px] leading-snug text-stone-900">{n.tajuk}</p>
                    <p className="text-stone-600 text-xs whitespace-pre-wrap leading-relaxed">{n.kandungan}</p>
                    {n.penulis && (
                      <p className="text-stone-400 text-[10px]">Ditulis oleh {n.penulis}</p>
                    )}
                  </div>

                  {bolehUrus && (
                    <div className="flex items-center gap-1 shrink-0">
                      {!paparanArkib && (
                        <>
                          <Tooltip text={n.disemat ? 'Nyahsemat' : 'Semat di atas'}>
                            <button
                              type="button"
                              onClick={() => ubah(n.id, { disemat: !n.disemat }, n.disemat ? 'Nota dinyahsematkan' : 'Nota disematkan')}
                              aria-label={n.disemat ? 'Nyahsemat' : 'Semat di atas'}
                              className="p-1.5 text-stone-400 hover:text-Adjung-maroon transition-colors cursor-pointer"
                            >
                              {n.disemat ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                            </button>
                          </Tooltip>
                          {confirmSuntingId === n.id ? (
                            // DLG-12 (2B, audit ChatGPT 2026-08-09) — dahulu "Buang draf semasa?"
                            // tak sebut apa hilang.
                            <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-300 rounded px-2 py-1">
                              <span className="text-[10px] text-amber-800 font-semibold whitespace-nowrap">Draf belum disimpan akan dibuang. Teruskan?</span>
                              <button
                                type="button"
                                onClick={() => mulaSunting(n)}
                                className="text-[10px] font-bold text-amber-800 hover:underline cursor-pointer"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmSuntingId('')}
                                className="text-[10px] text-stone-500 hover:underline cursor-pointer"
                              >
                                Batal
                              </button>
                            </span>
                          ) : (
                            <Tooltip text="Sunting nota">
                              <button
                                type="button"
                                onClick={() => mintaSunting(n)}
                                aria-label="Sunting nota"
                                className="p-1.5 text-stone-400 hover:text-Adjung-maroon transition-colors cursor-pointer"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          )}
                          <Tooltip text="Arkibkan nota">
                            <button
                              type="button"
                              onClick={() => ubah(n.id, { status: 'arkib' }, 'Nota diarkibkan')}
                              aria-label="Arkibkan nota"
                              className="p-1.5 text-stone-400 hover:text-Adjung-maroon transition-colors cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                        </>
                      )}
                      {paparanArkib && (
                        <>
                          <Tooltip text="Pulihkan nota">
                            <button
                              type="button"
                              onClick={() => ubah(n.id, { status: 'aktif' }, 'Nota dipulihkan')}
                              aria-label="Pulihkan nota"
                              className="p-1.5 text-stone-400 hover:text-Adjung-maroon transition-colors cursor-pointer"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                            </button>
                          </Tooltip>
                          {confirmPadamId === n.id ? (
                            <span className="flex items-center gap-1.5 bg-red-50 border border-[var(--color-error)]/40 rounded px-2 py-1">
                              <span className="text-[10px] text-[var(--color-error)] font-semibold whitespace-nowrap">Padam selamanya?</span>
                              <button
                                type="button"
                                onClick={() => { padam(n.id); setConfirmPadamId(''); }}
                                className="text-[10px] font-bold text-[var(--color-error)] hover:underline cursor-pointer"
                              >
                                Ya
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmPadamId('')}
                                className="text-[10px] text-stone-500 hover:underline cursor-pointer"
                              >
                                Batal
                              </button>
                            </span>
                          ) : (
                            <Tooltip text="Padam nota selamanya">
                              <button
                                type="button"
                                onClick={() => setConfirmPadamId(n.id)}
                                aria-label="Padam nota selamanya"
                                className="p-1.5 text-stone-400 hover:text-[var(--color-error)] transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </Tooltip>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {!bolehUrus && (
          <p className="text-stone-400 text-[10px] border-t border-stone-200 pt-3">
            Hanya Ketua Editor boleh menerbitkan, menyunting, atau mengarkibkan nota.
          </p>
        )}
      </PanelCard>
    </div>
  );
};

export default NotaKetuaEditorConsole;
