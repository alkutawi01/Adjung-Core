import React, { useCallback, useEffect, useState } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { BadgeCheck, Pencil, Power, Trash2 } from 'lucide-react';
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

// Petikan (2026-08-19, spesifikasi Izzat selepas 6 pusingan audit reka bentuk) — kandungan
// editorial sampingan di margin kiri frontpage pada skrin lebar. Lihat core/routes/petikanRoutes.js
// untuk rasional seni bina; ringkasnya: SATU jadual, DUA gerbang berasingan.
//
//   statusSah = 'sah' -> petikan betul-betul wujud dalam karya (semakan MANUSIA thd sumber)
//   aktif = true      -> editor mahu ia disiarkan sekarang
//
// Petikan layak dipapar hanya bila KEDUA-DUANYA benar. Ini sengaja dipisahkan supaya "betul" dan
// "sedang disiarkan" tidak pernah bercampur: petikan boleh disahkan tetapi dinyahaktifkan buat
// sementara, atau aktif tetapi belum lagi disemak (maka belum layak keluar).
//
// PENTING: AI boleh mencari CALON petikan, tetapi AI BUKAN sumber pengesahan. Apa-apa yang
// dimasukkan bermula 'belum_sah' tanpa pengecualian — pelayan tidak menerima statusSah daripada
// borang cipta langsung. Menandakan "sah" ialah tindakan manusia yang berasingan dan disengajakan.
interface Petikan {
  id: string;
  teks: string;
  pengarang: string;
  karya: string;
  rujukan: string;
  bahasa: string;
  statusSah: 'belum_sah' | 'sah' | 'dipertikai';
  aktif: boolean;
  pautanBuku: string;
  labelPautan: string;
  tarikhMula: string;
  tarikhAkhir: string;
  dibuatOleh: string;
  dibuatPada: string;
  dikemasPada: string;
}

// Sepadan had pelayan (petikanRoutes.js). Petikan marginal MESTI pendek — ruang sebenar cuma
// 180-220px lebar (audit layout 2026-08-19), dan petikan panjang daripada karya terlindung ialah
// risiko hak cipta, bukan sekadar isu reka bentuk.
const HAD_TEKS = 400;
const HAD_PENGARANG = 120;
const HAD_KARYA = 200;

const LABEL_STATUS_SAH: Record<Petikan['statusSah'], string> = {
  belum_sah: 'Belum disemak',
  sah: 'Disahkan',
  dipertikai: 'Dipertikai',
};

export const PetikanConsole: React.FC = () => {
  const [senarai, setSenarai] = useState<Petikan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');
  const [tapisan, setTapisan] = useState<'semua' | 'belum_sah' | 'sah'>('semua');

  const [menyunting, setMenyunting] = useState('');
  const [teks, setTeks] = useState('');
  const [pengarang, setPengarang] = useState('');
  const [karya, setKarya] = useState('');
  const [rujukan, setRujukan] = useState('');
  const [bahasa, setBahasa] = useState('ms');
  const [pautanBuku, setPautanBuku] = useState('');
  const [labelPautan, setLabelPautan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [ralatBorang, setRalatBorang] = useState('');
  const [mesej, setMesej] = useState('');
  const [sahMemadam, setSahMemadam] = useState('');

  // Togol ciri (petikanAktif, Tetapan Am Slot) — dipaparkan DI SINI supaya Ketua Editor boleh
  // hidup/matikan ciri di tempat yang sama dia menguruskan kandungannya, bukan terpaksa mencari
  // di modul tetapan lain. Ia tetap disimpan dalam slot_am_settings (satu sumber kebenaran).
  const [ciriAktif, setCiriAktif] = useState<boolean | null>(null);
  const [menukarTogol, setMenukarTogol] = useState(false);

  const muat = useCallback(() => {
    setMemuat(true);
    setRalat('');
    fetch('/api/system/petikan')
      .then(async (res) => {
        const data = await bacaJsonSelamat(res);
        if (!res.ok) throw new Error(data.error || 'Gagal membaca senarai petikan.');
        return data;
      })
      .then((d) => setSenarai(Array.isArray(d) ? d : []))
      .catch((e) => setRalat(e.message || 'Gagal membaca senarai petikan.'))
      .finally(() => setMemuat(false));
  }, []);

  const muatTogol = useCallback(() => {
    fetch('/api/system/slot-am-settings')
      .then(async (res) => (res.ok ? bacaJsonSelamat(res) : null))
      .then((d) => { if (d) setCiriAktif(!!d.petikanAktif); })
      .catch(() => { /* senyap — togol cuma tak dipapar, konsol masih boleh guna */ });
  }, []);

  useEffect(() => { muat(); muatTogol(); }, [muat, muatTogol]);

  const tukarTogolCiri = async () => {
    if (ciriAktif === null) return;
    setMenukarTogol(true);
    try {
      // Baca tetapan SEMASA dahulu, kemudian hantar semula keseluruhannya dengan satu medan
      // ditukar. Endpoint slot-am-settings ialah simpanan PENUH (bukan patch separa), jadi
      // menghantar hanya { petikanAktif } akan mengosongkan semua tetapan lain kepada lalai —
      // pepijat senyap yang akan memusnahkan tetapan animasi/had aksara Ketua Editor.
      const resBaca = await fetch('/api/system/slot-am-settings');
      const semasa = await bacaJsonSelamat(resBaca);
      if (!resBaca.ok) throw new Error(semasa.error || 'Gagal membaca tetapan semasa.');

      const res = await fetch('/api/system/slot-am-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...semasa, petikanAktif: !ciriAktif }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menukar togol.');
      setCiriAktif(!ciriAktif);
      setMesej(!ciriAktif ? 'Ciri Petikan dihidupkan' : 'Ciri Petikan dimatikan');
      setTimeout(() => setMesej(''), 6000);
    } catch (e: any) {
      setRalat(e.message || 'Gagal menukar togol ciri.');
    } finally {
      setMenukarTogol(false);
    }
  };

  const kosongkanBorang = () => {
    setMenyunting('');
    setTeks(''); setPengarang(''); setKarya(''); setRujukan('');
    setBahasa('ms'); setPautanBuku(''); setLabelPautan('');
    setRalatBorang('');
  };

  const mulaSunting = (p: Petikan) => {
    setMenyunting(p.id);
    setTeks(p.teks); setPengarang(p.pengarang); setKarya(p.karya); setRujukan(p.rujukan);
    setBahasa(p.bahasa); setPautanBuku(p.pautanBuku); setLabelPautan(p.labelPautan);
    setRalatBorang('');
  };

  const hantar = async (e: React.FormEvent) => {
    e.preventDefault();
    setMenyimpan(true);
    setRalatBorang('');
    try {
      const sedangSunting = !!menyunting;
      const res = await fetch(
        sedangSunting ? `/api/system/petikan/${menyunting}` : '/api/system/petikan',
        {
          method: sedangSunting ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teks, pengarang, karya, rujukan, bahasa, pautanBuku, labelPautan }),
        }
      );
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan petikan.');
      kosongkanBorang();
      setMesej(sedangSunting ? 'Petikan dikemas kini' : 'Petikan ditambah (belum disemak)');
      setTimeout(() => setMesej(''), 6000);
      muat();
    } catch (err: any) {
      setRalatBorang(err.message || 'Gagal menyimpan petikan.');
    } finally {
      setMenyimpan(false);
    }
  };

  const tandaSah = async (id: string, statusSah: Petikan['statusSah']) => {
    try {
      const res = await fetch(`/api/system/petikan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ statusSah }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini status.');
      muat();
    } catch (err: any) {
      setRalat(err.message || 'Gagal mengemas kini status.');
    }
  };

  const togolAktif = async (id: string, aktif: boolean) => {
    try {
      const res = await fetch(`/api/system/petikan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini petikan.');
      muat();
    } catch (err: any) {
      setRalat(err.message || 'Gagal mengemas kini petikan.');
    }
  };

  const padam = async (id: string) => {
    try {
      const res = await fetch(`/api/system/petikan/${id}`, { method: 'DELETE' });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal memadam petikan.');
      setSahMemadam('');
      muat();
    } catch (err: any) {
      setRalat(err.message || 'Gagal memadam petikan.');
    }
  };

  const senaraiDipapar = senarai.filter((p) =>
    tapisan === 'semua' ? true : tapisan === 'sah' ? p.statusSah === 'sah' : p.statusSah !== 'sah'
  );
  const bilLayakSiar = senarai.filter((p) => p.statusSah === 'sah' && p.aktif).length;

  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Petikan"
        huraian="Petikan daripada buku, kitab dan karya bertulis, dipaparkan di margin kiri Frontpage pada skrin lebar. Petikan hanya disiarkan selepas disahkan terhadap sumber asalnya."
      />

      {/* 01 — Togol ciri. Diletak PALING ATAS sengaja: ini injap keselamatan, jadi ia patut jadi
          perkara pertama yang Ketua Editor nampak dan capai, bukan tersembunyi bawah senarai. */}
      <PanelCard className="text-xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <SectionLabel>01 — Status Ciri</SectionLabel>
            <p className="text-stone-500 text-xs">
              {ciriAktif === null
                ? 'Memuatkan status…'
                : ciriAktif
                  ? `Ciri Petikan HIDUP. ${bilLayakSiar} petikan layak disiarkan (disahkan + aktif).`
                  : 'Ciri Petikan MATI. Tiada petikan dipaparkan di Frontpage walaupun koleksi sudah ada.'}
            </p>
            <p className="text-stone-400 text-[10px] mt-1">
              Mematikan ciri menghentikan paparan serta-merta tanpa memadam sebarang petikan. Guna ini jika ciri bermasalah.
            </p>
          </div>
          <Button
            variant={ciriAktif ? 'secondary' : 'primary'}
            disabled={ciriAktif === null || menukarTogol}
            onClick={tukarTogolCiri}
            icon={<Power className="w-3 h-3" />}
            className="shrink-0"
          >
            {menukarTogol ? 'Menukar…' : ciriAktif ? 'Matikan Ciri' : 'Hidupkan Ciri'}
          </Button>
        </div>
      </PanelCard>

      {/* 02 — Borang tambah/sunting. */}
      <PanelCard className="text-xs">
        <form onSubmit={hantar} className="space-y-4">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <SectionLabel>02 — {menyunting ? 'Sunting Petikan' : 'Tambah Petikan'}</SectionLabel>
              <p className="text-stone-500 text-xs">
                Petikan baharu sentiasa bermula sebagai <strong>Belum disemak</strong>. Ia perlu disahkan terhadap sumber sebelum layak disiarkan.
              </p>
            </div>
            {menyunting && <Button variant="secondary" onClick={kosongkanBorang}>Batal Sunting</Button>}
          </div>

          <FormColumn saiz="md" className="space-y-4">
            <label className="flex flex-col gap-1">
              <span className={`${LABEL_BORANG} flex justify-between`}>
                <span>Teks Petikan</span>
                <span className={teks.length > HAD_TEKS ? 'text-[var(--color-error)]' : 'text-stone-400'}>{teks.length}/{HAD_TEKS}</span>
              </span>
              <textarea
                value={teks} onChange={(e) => setTeks(e.target.value)} rows={4}
                placeholder="Salin petikan TEPAT seperti dalam karya asal. Jangan parafrasa atau memperindah."
                className={INPUT_BORANG}
              />
              <span className="text-stone-400 text-[10px]">
                Mesti verbatim daripada karya. Petikan yang diubah walau sedikit bukan lagi petikan.
              </span>
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className={`${LABEL_BORANG} flex justify-between`}>
                  <span>Pengarang</span>
                  <span className={pengarang.length > HAD_PENGARANG ? 'text-[var(--color-error)]' : 'text-stone-400'}>{pengarang.length}/{HAD_PENGARANG}</span>
                </span>
                <input type="text" value={pengarang} onChange={(e) => setPengarang(e.target.value)} placeholder="Nama pengarang" className={INPUT_BORANG} />
              </label>

              <label className="flex flex-col gap-1">
                <span className={`${LABEL_BORANG} flex justify-between`}>
                  <span>Judul Karya</span>
                  <span className={karya.length > HAD_KARYA ? 'text-[var(--color-error)]' : 'text-stone-400'}>{karya.length}/{HAD_KARYA}</span>
                </span>
                <input type="text" value={karya} onChange={(e) => setKarya(e.target.value)} placeholder="Judul buku/kitab" className={INPUT_BORANG} />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Rujukan (pilihan)</span>
                <input type="text" value={rujukan} onChange={(e) => setRujukan(e.target.value)} placeholder="cth: Bab 3, hlm. 47" className={INPUT_BORANG} />
              </label>

              <label className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Bahasa</span>
                <select value={bahasa} onChange={(e) => setBahasa(e.target.value)} className={`${INPUT_BORANG} cursor-pointer`}>
                  <option value="ms">Bahasa Melayu</option>
                  <option value="en">Inggeris</option>
                  <option value="ar">Arab</option>
                </select>
              </label>
            </div>

            {/* Pautan buku Adjung (keputusan Izzat: masuk V1). Sengaja SEKUNDER dan halus —
                tujuannya penemuan karya, bukan jualan. Lihat prinsip "PETIKAN MENARIK -> SIAPA
                MENULIS -> DARIPADA BUKU APA" dalam pelan. */}
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Pautan Buku (pilihan)</span>
                <input type="text" value={pautanBuku} onChange={(e) => setPautanBuku(e.target.value)} placeholder="/books/... atau https://" className={INPUT_BORANG} />
              </label>

              <label className="flex flex-col gap-1">
                <span className={LABEL_BORANG}>Label Pautan (pilihan)</span>
                <input type="text" value={labelPautan} onChange={(e) => setLabelPautan(e.target.value)} placeholder="cth: Terbitan Adjung" className={INPUT_BORANG} />
              </label>
            </div>

            {ralatBorang && <MesejStatus tone="error">{ralatBorang}</MesejStatus>}

            <div className="flex items-center justify-end gap-3 pt-1">
              {mesej && <span className="text-[var(--color-success)] text-[11px] font-semibold">{mesej}</span>}
              <Button
                type="submit" variant="primary"
                disabled={menyimpan || !teks.trim() || !pengarang.trim() || !karya.trim()
                  || teks.length > HAD_TEKS || pengarang.length > HAD_PENGARANG || karya.length > HAD_KARYA}
              >
                {menyimpan ? 'Menyimpan…' : menyunting ? 'Simpan Perubahan' : 'Tambah Petikan'}
              </Button>
            </div>
          </FormColumn>
        </form>
      </PanelCard>

      {/* 03 — Senarai koleksi. */}
      <PanelCard className="space-y-4 text-xs">
        <div className="flex flex-wrap justify-between items-end gap-4">
          <div>
            <SectionLabel>03 — Koleksi Petikan</SectionLabel>
            <p className="text-stone-500 text-xs">
              {senarai.length} petikan dalam koleksi · {bilLayakSiar} layak disiarkan.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['semua', 'belum_sah', 'sah'] as const).map((t) => (
              <Button key={t} variant={tapisan === t ? 'primary' : 'secondary'} size="sm" onClick={() => setTapisan(t)}>
                {t === 'semua' ? 'Semua' : t === 'sah' ? 'Disahkan' : 'Belum Disemak'}
              </Button>
            ))}
          </div>
        </div>

        {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}

        {memuat ? (
          <KeadaanMemuat baris={4} />
        ) : senaraiDipapar.length === 0 ? (
          <KeadaanKosong>
            {senarai.length === 0
              ? 'Tiada petikan lagi. Tambah petikan pertama menggunakan borang di atas.'
              : 'Tiada petikan dalam tapisan ini.'}
          </KeadaanKosong>
        ) : (
          <ul className="list-none m-0 p-0 divide-y divide-Adjung-line">
            {senaraiDipapar.map((p) => (
              <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {/* Nada warna ikut MAKNA, bukan hiasan: hanya 'sah' yang hijau kerana hanya
                          itu bermakna petikan sudah disemak terhadap sumber. 'dipertikai' merah
                          (perlu tindakan), 'belum_sah' neutral (belum diproses, bukan kegagalan). */}
                      <StatusBadge
                        tone={p.statusSah === 'sah' ? 'success' : p.statusSah === 'dipertikai' ? 'error' : 'neutral'}
                        label={LABEL_STATUS_SAH[p.statusSah]}
                      />
                      {!p.aktif && (
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">Dinyahaktifkan</span>
                      )}
                      {p.pautanBuku && (
                        <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-Adjung-maroon">
                          {p.labelPautan || 'Ada pautan buku'}
                        </span>
                      )}
                    </div>
                    <p className="font-serif text-sm text-stone-900 leading-snug">“{p.teks}”</p>
                    <p className="text-stone-500 text-[11px] mt-1">
                      {p.pengarang} · {p.karya}{p.rujukan ? ` · ${p.rujukan}` : ''}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {p.statusSah !== 'sah' && (
                      <Tooltip text="Tanda sudah disemak terhadap sumber">
                        <button
                          type="button" onClick={() => tandaSah(p.id, 'sah')}
                          aria-label="Tandakan disahkan"
                          className="p-1.5 text-stone-500 hover:text-[var(--color-success)] cursor-pointer"
                        >
                          <BadgeCheck className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    )}
                    <Tooltip text="Sunting">
                      <button
                        type="button" onClick={() => mulaSunting(p)}
                        aria-label="Sunting" className="p-1.5 text-stone-500 hover:text-Adjung-maroon cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip text={p.aktif ? 'Nyahaktifkan (sembunyi tanpa padam)' : 'Aktifkan semula'}>
                      <button
                        type="button" onClick={() => togolAktif(p.id, !p.aktif)}
                        aria-label={p.aktif ? 'Nyahaktifkan' : 'Aktifkan'}
                        className={`p-1.5 cursor-pointer ${p.aktif ? 'text-stone-500 hover:text-Adjung-maroon' : 'text-stone-300 hover:text-Adjung-maroon'}`}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip text="Padam">
                      <button
                        type="button" onClick={() => setSahMemadam(p.id)}
                        aria-label="Padam" className="p-1.5 text-stone-500 hover:text-[var(--color-error)] cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                {/* Pengesahan padam sebaris (bukan window.confirm) — corak sama seperti konsol lain
                    dalam Editorium. Petikan boleh dipadam bersih kerana ia kutipan karya orang
                    lain, bukan terbitan Adjung; peraturan "arkib, jangan padam" tidak terpakai. */}
                {sahMemadam === p.id && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 bg-[#802334]/5 p-2 rounded">
                    <span className="text-[11px] text-stone-700">Padam petikan ini terus? Tidak boleh dibuat asal.</span>
                    <Button variant="bahaya" size="sm" onClick={() => padam(p.id)}>Ya, padam</Button>
                    <Button variant="ghost" size="sm" onClick={() => setSahMemadam('')}>Batal</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  );
};
