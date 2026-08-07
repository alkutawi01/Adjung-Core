import React, { useCallback, useEffect, useState } from 'react';
import { Pin, PinOff, Archive, ArchiveRestore, Trash2, Pencil } from 'lucide-react';

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
  dalaman: 'Dalaman',
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

const KATEGORI: { id: Nota['kategori']; label: string; nota: string }[] = [
  { id: 'notis', label: 'Notis', nota: 'Pengumuman rasmi berkeutamaan tinggi.' },
  { id: 'am', label: 'Nota Am', nota: 'Peringatan dan garis panduan tugas harian.' },
  { id: 'khas', label: 'Nota Khas', nota: 'Nota bersasar, contohnya bagi satu kempen atau Bidang.' },
];

const HAD_TAJUK = 150;
const HAD_KANDUNGAN = 5000;

const labelKategori = (k: string) => KATEGORI.find((x) => x.id === k)?.label || k;

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
  const [kategori, setKategori] = useState<Nota['kategori']>('am');
  const [skop, setSkop] = useState<Nota['skop']>('dalaman');
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralatBorang, setRalatBorang] = useState('');
  const [mesej, setMesej] = useState('');

  const muat = useCallback(() => {
    setMemuat(true);
    setRalat('');
    fetch(`/api/system/editor-notes?status=${paparanArkib ? 'arkib' : 'aktif'}`)
      .then(async (res) => {
        const data = await res.json();
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
    setKategori('am');
    setSkop('dalaman');
    setRalatBorang('');
  };

  const mulaSunting = (n: Nota) => {
    setMenyunting(n.id);
    setTajuk(n.tajuk);
    setKandungan(n.kandungan);
    setKategori(n.kategori);
    setSkop(n.skop);
    setRalatBorang('');
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
          body: JSON.stringify({ tajuk, kandungan, kategori, skop, penulis: editorName, penulisId: editorId }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan nota.');
      kosongkanBorang();
      setMesej(menyuntingSedia ? 'Nota dikemas kini' : 'Nota diterbitkan');
      setTimeout(() => setMesej(''), 2400);
      muat();
      onBerubah?.();
    } catch (err: any) {
      setRalatBorang(err.message || 'Gagal menyimpan nota.');
    } finally {
      setMenyimpan(false);
    }
  };

  const ubah = async (id: string, patch: Record<string, any>) => {
    try {
      const res = await fetch(`/api/system/editor-notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini nota.');
      muat();
      onBerubah?.();
    } catch (err: any) {
      setRalat(err.message || 'Gagal mengemas kini nota.');
    }
  };

  const padam = async (id: string) => {
    try {
      const res = await fetch(`/api/system/editor-notes/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Gagal memadam nota.');
      if (menyunting === id) kosongkanBorang();
      muat();
      onBerubah?.();
    } catch (err: any) {
      setRalat(err.message || 'Gagal memadam nota.');
    }
  };

  const bakiTajuk = HAD_TAJUK - tajuk.length;
  const bakiKandungan = HAD_KANDUNGAN - kandungan.length;

  return (
    <div className="space-y-4 font-sans">
      {/* Borang penerbitan — Ketua Editor sahaja. */}
      {bolehUrus && (
        <form onSubmit={hantar} className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
                {menyunting ? 'Sunting Nota' : 'Terbitkan Nota'}
              </h3>
              <p className="text-stone-500 text-xs">
                Nota <strong className="font-semibold text-stone-700">dalaman</strong> hanya kelihatan dalam Editorium.
                Nota <strong className="font-semibold text-stone-700">awam</strong> boleh dipaparkan kepada pembaca.
              </p>
            </div>
            {menyunting && (
              <button
                type="button"
                onClick={kosongkanBorang}
                className="px-3 py-1.5 border border-stone-300 rounded text-[11px] font-semibold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
              >
                Batal Sunting
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Kategori</span>
              <select
                value={kategori}
                onChange={(e) => setKategori(e.target.value as Nota['kategori'])}
                className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs cursor-pointer"
              >
                {KATEGORI.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
              <span className="text-stone-400 text-[10px]">{KATEGORI.find((k) => k.id === kategori)?.nota}</span>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">Skop</span>
              <select
                value={skop}
                onChange={(e) => setSkop(e.target.value as Nota['skop'])}
                className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs cursor-pointer"
              >
                <option value="dalaman">Nota (Dalaman) — Editorium sahaja</option>
                <option value="catatan_ketua_editor">Catatan Ketua Editor — disiarkan di Frontpage</option>
                <option value="pengumuman">Pengumuman — disiarkan di Frontpage</option>
              </select>
              {skop !== 'dalaman' && (
                <span className="text-[var(--color-Adjung-maroon)] text-[10px] font-semibold">
                  Nota ini akan disiarkan di Frontpage (pautan footer "{LABEL_SKOP[skop]}"). Pastikan tiada maklumat dalaman di dalamnya.
                </span>
              )}
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
              <span>Tajuk</span>
              <span className={bakiTajuk < 0 ? 'text-red-700' : 'text-stone-400'}>{tajuk.length}/{HAD_TAJUK}</span>
            </span>
            <input
              type="text"
              value={tajuk}
              onChange={(e) => setTajuk(e.target.value)}
              placeholder="Tajuk nota…"
              className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="flex justify-between font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
              <span>Kandungan</span>
              <span className={bakiKandungan < 0 ? 'text-red-700' : 'text-stone-400'}>{kandungan.length}/{HAD_KANDUNGAN}</span>
            </span>
            <textarea
              value={kandungan}
              onChange={(e) => setKandungan(e.target.value)}
              rows={5}
              placeholder="Kandungan nota…"
              className="bg-stone-50 border border-stone-300 rounded px-3 py-1.5 text-xs resize-y"
            />
          </label>

          {ralatBorang && (
            <p className="text-red-800 bg-red-50 border border-red-200 rounded px-3 py-2 text-[11px]">{ralatBorang}</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-1">
            {mesej && <span className="text-emerald-700 text-[11px] font-semibold">{mesej}</span>}
            <button
              type="submit"
              disabled={menyimpan || !tajuk.trim() || !kandungan.trim() || bakiTajuk < 0 || bakiKandungan < 0}
              className="bg-[var(--color-Adjung-maroon)] text-white px-4 py-1.5 rounded font-semibold text-xs hover:bg-[var(--color-Adjung-maroon-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {menyimpan ? 'Menyimpan…' : menyunting ? 'Simpan Perubahan' : 'Terbitkan Nota'}
            </button>
          </div>
        </form>
      )}

      {/* Senarai nota */}
      <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">
              {paparanArkib ? 'Nota Diarkibkan' : 'Nota Aktif'}
            </h3>
            <p className="text-stone-500 text-xs">
              {paparanArkib
                ? 'Rekod nota lama. Nota di sini boleh dipulihkan atau dipadam terus.'
                : 'Nota yang sedang berkuat kuasa. Nota disemat sentiasa di atas.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPaparanArkib((v) => !v)}
            className="px-3 py-1.5 border border-stone-300 rounded text-[11px] font-semibold text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            {paparanArkib ? 'Lihat Nota Aktif' : 'Lihat Arkib'}
          </button>
        </div>

        {ralat && (
          <div className="border border-red-200 bg-red-50 text-red-800 rounded px-3 py-2 text-[11px]">{ralat}</div>
        )}

        {memuat ? (
          <div className="text-stone-400 text-xs py-6 text-center">Memuatkan nota…</div>
        ) : nota.length === 0 ? (
          <div className="text-stone-400 text-xs py-10 text-center">
            {paparanArkib ? 'Tiada nota diarkibkan.' : 'Tiada nota aktif.'}
          </div>
        ) : (
          <ul className="list-none m-0 p-0 divide-y divide-stone-100">
            {nota.map((n) => (
              <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {n.disemat && (
                        <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-wider font-bold text-[var(--color-Adjung-maroon)]">
                          <Pin className="w-2.5 h-2.5" /> Disemat
                        </span>
                      )}
                      <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
                        {labelKategori(n.kategori)}
                      </span>
                      <span
                        className={`font-mono text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded border ${
                          n.skop !== 'dalaman'
                            ? 'text-[var(--color-Adjung-maroon)] border-[var(--color-Adjung-maroon)]/30 bg-[var(--color-Adjung-maroon)]/[0.06]'
                            : 'text-stone-500 border-stone-200'
                        }`}
                      >
                        {LABEL_SKOP[n.skop] || n.skop}
                      </span>
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
                          <button
                            type="button"
                            title={n.disemat ? 'Nyahsemat' : 'Semat di atas'}
                            onClick={() => ubah(n.id, { disemat: !n.disemat })}
                            className="p-1.5 text-stone-400 hover:text-[var(--color-Adjung-maroon)] transition-colors cursor-pointer"
                          >
                            {n.disemat ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            title="Sunting nota"
                            onClick={() => mulaSunting(n)}
                            className="p-1.5 text-stone-400 hover:text-[var(--color-Adjung-maroon)] transition-colors cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Arkibkan nota"
                            onClick={() => ubah(n.id, { status: 'arkib' })}
                            className="p-1.5 text-stone-400 hover:text-[var(--color-Adjung-maroon)] transition-colors cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {paparanArkib && (
                        <>
                          <button
                            type="button"
                            title="Pulihkan nota"
                            onClick={() => ubah(n.id, { status: 'aktif' })}
                            className="p-1.5 text-stone-400 hover:text-[var(--color-Adjung-maroon)] transition-colors cursor-pointer"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Padam nota selamanya"
                            onClick={() => padam(n.id)}
                            className="p-1.5 text-stone-400 hover:text-red-700 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
      </div>
    </div>
  );
};

export default NotaKetuaEditorConsole;
