import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { bacaJsonSelamat } from '../../utils/bacaJson';
import { BadgeCheck, Check, ChevronDown, ChevronRight, ClipboardPaste, Copy, Pencil, Plus, Power, Search, SkipForward, Trash2, TriangleAlert, X } from 'lucide-react';
import { KATEGORI_PETIKAN, HAD_TEKS_PETIKAN, labelTerjemahan, adalahBahasaMelayu } from '../../../core/editorial/PetikanConfig.js';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { SectionLabel } from '../common/SectionLabel';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { LABEL_BORANG, INPUT_BORANG } from '../common/gayaKongsi';

// Petikan — konsol editorial (2026-08-19, dipecah kepada sub-halaman selepas kajian ChatGPT).
//
// SEJARAH: modul asal (satu borang) tak sepadan model mental Tulis Kandungan (Izzat: "kenapa tak
// sama?"). Ditulis semula jadi kad boleh sunting (2026-08-19, petang). Kemudian Izzat tanya sama
// ada koleksi patut jadi jadual, dan pesan: "yg penting mudah diuruskan oleh ketua editor. kalau
// perlu buat submodul, pecahkan lagi. jangan semua benda sumbat dlm satu page." — dibincang dengan
// ChatGPT (pusingan 6): keputusan TEGAS kekal kad (bukan jadual, sebab pengguna tunggal + kandungan
// dwibahasa yang perlu DIBACA bukan diimbas), tetapi PECAHKAN 4 seksyen bertindanan kepada 4
// sub-halaman — SATU laman panjang sendiri satu masalah UX apabila ia mengandungi 4 KERJA berbeza
// (konfigurasi, import+sunting, semakan, urus koleksi).
//
// Corak sub-tab SAMA seperti EditorialConsole.tsx (role="tablist" + navigasi anak panah) — jangan
// cipta corak navigasi kedua dalam Editorium.
//
// Model mental navigasi (ChatGPT):
//   Ruang Kerja = saya sedang menghasilkan/membaiki petikan.
//   Semakan     = ada kerja editorial yang perlu diselesaikan.
//   Koleksi     = saya mahu mencari/mengurus petikan yang sudah ada.
//   Tetapan     = saya mahu mengubah tingkah laku modul (bukan kerja harian).
//
// DUA PENGESAHAN, BUKAN SATU (keputusan Izzat, dasar bahasa):
//   statusSumber     — teks asal benar-benar wujud dalam karya secara verbatim
//   statusTerjemahan — teks Melayu setia kepada teks asal ('tidak_perlu' bila sumbernya Melayu)
// Kelayakan terbit diterbitkan daripada kedua-duanya di pelayan; konsol tidak pernah mengiranya
// sendiri. Terjemahan tidak boleh disahkan sebelum sumber — pelayan membalas 400.

type SubTab = 'ruang_kerja' | 'semakan' | 'koleksi' | 'tetapan';

const SUB_TABS: { id: SubTab; label: string }[] = [
  { id: 'ruang_kerja', label: '1. Ruang Kerja' },
  { id: 'semakan', label: '2. Semakan' },
  { id: 'koleksi', label: '3. Koleksi' },
  { id: 'tetapan', label: '4. Tetapan' },
];

interface Petikan {
  id: string;
  teksAsal: string;
  bahasaAsal: string;
  teksPaparan: string;
  pengarang: string;
  karya: string;
  rujukan: string;
  kategori: string | null;
  statusSumber: 'belum_sah' | 'sah' | 'dipertikai';
  statusTerjemahan: 'tidak_perlu' | 'belum_sah' | 'sah' | 'dipertikai';
  sumberDisahkanPada: string;
  terjemahanDisahkanPada: string;
  layakTerbit: boolean;
  aktif: boolean;
  pautanBuku: string;
  labelPautan: string;
  dibuatOleh: string;
  dibuatPada: string;
  dikemasPada: string;
  kumpulanImport: string;
}

/** Kad draf — wujud dalam ingatan pelayar SAHAJA sehingga editor menekan simpan. Ini bahagian
 *  yang hilang dalam modul asal: tempat hasil AI mendarat dan boleh dibetulkan. */
interface KadDraf {
  kunci: string;
  teksAsal: string;
  bahasaAsal: string;
  teksMelayu: string;
  pengarang: string;
  karya: string;
  rujukan: string;
  kategori: string;
  pautanBuku: string;
  amaran: string | null;
  dibuka: boolean;
}

/** Borang sunting untuk petikan yang SUDAH tersimpan (Koleksi). Bentuk sama seperti KadDraf
 *  supaya kedua-dua borang (draf baharu, sunting sedia ada) terasa serupa kepada editor. */
interface BorangSunting {
  id: string;
  teksAsal: string;
  bahasaAsal: string;
  teksMelayu: string;
  pengarang: string;
  karya: string;
  rujukan: string;
  kategori: string;
  pautanBuku: string;
}

const HAD_PENGARANG = 120;
const HAD_KARYA = 200;

const LABEL_STATUS: Record<string, string> = {
  belum_sah: 'Belum disemak',
  sah: 'Disahkan',
  dipertikai: 'Dipertikai',
  tidak_perlu: 'Tidak diperlukan',
};

const nadaStatus = (s: string) => (s === 'sah' ? 'success' : s === 'dipertikai' ? 'error' : 'neutral');

// Guna takrifan KONGSI, bukan padanan tempatan — pelayan menerima 'ms'/'Malay'/'Bahasa Melayu'
// sebagai Melayu (peta NAMA_BAHASA), dan padanan tempatan `=== 'melayu'` akan menyekat kad yang
// pelayan sebenarnya terima. Ini kelas pepijat "dua takrifan terpesong" yang PetikanConfig.js
// memang wujud untuk mencegah (ditemui imbasan kod 19/8/2026).
const adalahMelayu = (b: string) => adalahBahasaMelayu(b);

let kiraKunci = 0;
const kadKosong = (): KadDraf => ({
  kunci: `kad-${++kiraKunci}`,
  teksAsal: '', bahasaAsal: 'Melayu', teksMelayu: '',
  pengarang: '', karya: '', rujukan: '', kategori: '', pautanBuku: '',
  amaran: null, dibuka: true,
});

/** Masalah yang menghalang kad daripada disimpan. Dikira di klien untuk maklum balas segera;
 *  pelayan tetap menyemak semula dan tidak mempercayai apa yang datang daripada borang. */
function masalahKad(k: KadDraf | BorangSunting): string[] {
  const m: string[] = [];
  if (!k.teksAsal.trim()) m.push('Teks asal kosong');
  if (!k.pengarang.trim()) m.push('Pengarang kosong');
  if (!k.karya.trim()) m.push('Karya kosong');
  if (!adalahMelayu(k.bahasaAsal) && !k.teksMelayu.trim()) m.push('Terjemahan Melayu wajib');
  const paparan = adalahMelayu(k.bahasaAsal) ? k.teksAsal : k.teksMelayu;
  if (paparan.trim().length > HAD_TEKS_PETIKAN) m.push(`Teks paparan ${paparan.trim().length}/${HAD_TEKS_PETIKAN} aksara`);
  if (!k.kategori.trim()) m.push('Kategori belum diisi');
  return m;
}

/** Borang medan Teks Asal / Bahasa Asal / Teks Melayu / Pengarang / Karya / Rujukan / Kategori /
 *  Pautan Buku — DIKONGSI antara kad draf (Ruang Kerja) dan borang sunting (Koleksi) supaya
 *  kedua-dua tempat tidak boleh terpesong dalam susunan atau label medan. */
const BorangPetikan: React.FC<{
  nilai: KadDraf | BorangSunting;
  ubah: (tampalan: Partial<KadDraf & BorangSunting>) => void;
}> = ({ nilai, ubah }) => {
  const melayu = adalahMelayu(nilai.bahasaAsal);
  return (
    <div className="space-y-3">
      <div>
        <label className={LABEL_BORANG}>Teks asal (verbatim daripada sumber)</label>
        <textarea
          value={nilai.teksAsal} rows={3}
          onChange={(e) => ubah({ teksAsal: e.target.value })}
          className={`${INPUT_BORANG} font-serif`}
          dir="auto"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_BORANG}>Bahasa asal</label>
          <input
            value={nilai.bahasaAsal}
            onChange={(e) => ubah({ bahasaAsal: e.target.value })}
            className={INPUT_BORANG}
            placeholder="Melayu / Arab / Inggeris"
          />
        </div>
        <div>
          <label className={LABEL_BORANG}>Kategori</label>
          <select value={nilai.kategori} onChange={(e) => ubah({ kategori: e.target.value })} className={INPUT_BORANG}>
            <option value="">— Pilih kategori —</option>
            {KATEGORI_PETIKAN.map((c: string) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      {/* Medan terjemahan hilang sepenuhnya untuk sumber Melayu — bukan dikosongkan atau
          dinyahaktifkan. Tiada terjemahan wujud, jadi tiada medan untuk diisi. */}
      {melayu ? (
        <p className="text-[10px] text-stone-500">
          Sumber berbahasa Melayu — teks asal terus menjadi teks yang pembaca lihat. Tiada
          terjemahan diperlukan.
        </p>
      ) : (
        <div>
          <label className={LABEL_BORANG}>
            Teks Melayu — inilah yang pembaca lihat ({(nilai.teksMelayu || '').trim().length}/{HAD_TEKS_PETIKAN})
          </label>
          <textarea
            value={nilai.teksMelayu} rows={3}
            onChange={(e) => ubah({ teksMelayu: e.target.value })}
            className={`${INPUT_BORANG} font-serif`}
          />
          <p className="text-[10px] text-stone-500 mt-1">
            Frontpage akan menandakannya “{labelTerjemahan(nilai.bahasaAsal) || 'Diterjemah daripada …'}”.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className={LABEL_BORANG}>Pengarang</label>
          <input value={nilai.pengarang} maxLength={HAD_PENGARANG} onChange={(e) => ubah({ pengarang: e.target.value })} className={INPUT_BORANG} />
        </div>
        <div>
          <label className={LABEL_BORANG}>Karya</label>
          <input value={nilai.karya} maxLength={HAD_KARYA} onChange={(e) => ubah({ karya: e.target.value })} className={INPUT_BORANG} />
        </div>
        <div>
          <label className={LABEL_BORANG}>Rujukan (pilihan)</label>
          <input value={nilai.rujukan} onChange={(e) => ubah({ rujukan: e.target.value })} className={INPUT_BORANG} placeholder="Jilid 1, m.s. 44" />
        </div>
        <div>
          <label className={LABEL_BORANG}>Pautan buku (pilihan)</label>
          <input value={nilai.pautanBuku} onChange={(e) => ubah({ pautanBuku: e.target.value })} className={INPUT_BORANG} placeholder="https://…" />
        </div>
      </div>
    </div>
  );
};

export const PetikanConsole: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('ruang_kerja');

  const [senarai, setSenarai] = useState<Petikan[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');
  const [mesej, setMesej] = useState('');
  const [tapisan, setTapisan] = useState<'semua' | 'perlu_tindakan' | 'sedia'>('semua');
  const [carianKoleksi, setCarianKoleksi] = useState('');
  const [kadDibuka, setKadDibuka] = useState<Set<string>>(new Set());
  const [borangSunting, setBorangSunting] = useState<BorangSunting | null>(null);
  const [menyimpanSuntingan, setMenyimpanSuntingan] = useState(false);
  const [sahMemadam, setSahMemadam] = useState('');

  const [ciriAktif, setCiriAktif] = useState<boolean | null>(null);
  const [menukarTogol, setMenukarTogol] = useState(false);

  const [teksTampal, setTeksTampal] = useState('');
  const [tampalDibuka, setTampalDibuka] = useState(false);
  const [memproses, setMemproses] = useState(false);
  const [notaArahan, setNotaArahan] = useState('');
  const [ditolak, setDitolak] = useState<Array<{ blok: number; sebab: string; cuplikan: string }>>([]);
  const [draf, setDraf] = useState<KadDraf[]>([]);

  const [semakanDibuka, setSemakanDibuka] = useState(false);
  const [indeksSemakan, setIndeksSemakan] = useState(0);
  const [teksDisalin, setTeksDisalin] = useState('');
  const [memprosesSemakan, setMemprosesSemakan] = useState(false);

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

  const lapor = (t: string) => { setMesej(t); setTimeout(() => setMesej(''), 6000); };

  const tukarTogolCiri = async () => {
    if (ciriAktif === null) return;
    setMenukarTogol(true);
    try {
      // Baca tetapan SEMASA dahulu, kemudian hantar semula keseluruhannya dengan satu medan
      // ditukar. Endpoint slot-am-settings ialah simpanan PENUH (bukan patch separa), jadi
      // menghantar hanya { petikanAktif } akan mengosongkan semua tetapan lain kepada lalai.
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
      lapor(!ciriAktif ? 'Ciri Petikan dihidupkan' : 'Ciri Petikan dimatikan');
    } catch (e: any) {
      setRalat(e.message || 'Gagal menukar togol ciri.');
    } finally {
      setMenukarTogol(false);
    }
  };

  const salinArahanAi = async () => {
    try {
      const res = await fetch('/api/system/petikan-arahan-ai');
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengambil Arahan AI.');
      await navigator.clipboard.writeText(data.arahan);
      setNotaArahan('Arahan AI disalin. Tampalkan ke sesi AI bersama buku atau PDF anda.');
      setTimeout(() => setNotaArahan(''), 8000);
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyalin Arahan AI.');
    }
  };

  /** Tampalan menjadi KAD, bukan kiraan. Ini destinasi editorial yang hilang dalam modul asal. */
  const pecahkanTampalan = async () => {
    setMemproses(true);
    setRalat('');
    try {
      const res = await fetch('/api/system/petikan/hurai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teks: teksTampal }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menghurai tampalan.');

      const kad: KadDraf[] = (data.rekod || []).map((r: any) => ({
        kunci: `kad-${++kiraKunci}`,
        teksAsal: r.teksAsal || '',
        bahasaAsal: r.bahasaAsal || 'Melayu',
        // Bila sumbernya Melayu, teks paparan IALAH teks asal — tiada terjemahan berasingan.
        teksMelayu: adalahMelayu(r.bahasaAsal) ? '' : (r.teksPaparan || ''),
        pengarang: r.pengarang || '',
        karya: r.karya || '',
        rujukan: r.rujukan || '',
        kategori: r.kategori || '',
        pautanBuku: r.pautanBuku || '',
        amaran: r.amaran || null,
        // Kad dengan masalah dibuka TERUS; yang bersih kekal terlipat. Editor sedang membuat
        // triage pada peringkat ini, bukan membaca setiap satu.
        dibuka: false,
      }));
      kad.forEach((k) => { k.dibuka = masalahKad(k).length > 0; });

      setDraf((sebelum) => [...sebelum, ...kad]);
      setDitolak(data.gagal || []);
      setTeksTampal('');
      setTampalDibuka(false);
      if (data.pendua > 0) lapor(`${data.pendua} petikan sudah wujud dalam koleksi dan dilangkau.`);
    } catch (e: any) {
      setRalat(e.message || 'Gagal menghurai tampalan.');
    } finally {
      setMemproses(false);
    }
  };

  const ubahKad = (kunci: string, tampalan: Partial<KadDraf>) =>
    setDraf((d) => d.map((k) => (k.kunci === kunci ? { ...k, ...tampalan } : k)));

  const buangKad = (kunci: string) => setDraf((d) => d.filter((k) => k.kunci !== kunci));

  const drafSedia = useMemo(() => draf.filter((k) => masalahKad(k).length === 0), [draf]);

  const simpanDraf = async () => {
    if (!drafSedia.length) return;
    setMemproses(true);
    setRalat('');
    try {
      const res = await fetch('/api/system/petikan/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rekod: drafSedia.map((k) => ({
            teksAsal: k.teksAsal,
            bahasaAsal: k.bahasaAsal,
            teksMelayu: k.teksMelayu,
            pengarang: k.pengarang,
            karya: k.karya,
            rujukan: k.rujukan,
            kategori: k.kategori,
            pautanBuku: k.pautanBuku,
          })),
        }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan petikan.');

      const kunciSedia = new Set(drafSedia.map((k) => k.kunci));
      setDraf((d) => d.filter((k) => !kunciSedia.has(k.kunci)));
      lapor(`${data.disimpan} petikan masuk ke koleksi sebagai belum disemak${data.dilangkau ? `, ${data.dilangkau} dilangkau` : ''}.`);
      muat();
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyimpan petikan.');
    } finally {
      setMemproses(false);
    }
  };

  const tetapkanStatus = async (id: string, tampalan: Record<string, string>) => {
    setMemprosesSemakan(true);
    try {
      const res = await fetch(`/api/system/petikan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tampalan),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal mengemas kini status.');
      muat();
    } catch (e: any) {
      setRalat(e.message || 'Gagal mengemas kini status.');
    } finally {
      setMemprosesSemakan(false);
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
    } catch (e: any) {
      setRalat(e.message || 'Gagal mengemas kini petikan.');
    }
  };

  const padam = async (id: string) => {
    try {
      const res = await fetch(`/api/system/petikan/${id}`, { method: 'DELETE' });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal memadam petikan.');
      setSahMemadam('');
      muat();
    } catch (e: any) {
      setRalat(e.message || 'Gagal memadam petikan.');
    }
  };

  const salin = async (teks: string, tanda: string) => {
    try {
      await navigator.clipboard.writeText(teks);
      setTeksDisalin(tanda);
      setTimeout(() => setTeksDisalin(''), 1800);
    } catch {
      setRalat('Pelayar menghalang salinan automatik. Sila salin teks secara manual.');
    }
  };

  // ── SUNTING petikan SEDIA ADA (Koleksi) ────────────────────────────────────────────────────
  // Keupayaan ini TIADA dalam versi kad-sahaja sebelum ini — ChatGPT menegaskan Koleksi perlu
  // "carian + tapis + status + edit", dan tanpanya, membetulkan satu typo dalam petikan tersimpan
  // memerlukan padam+cipta semula. Borang sama seperti kad draf (BorangPetikan dikongsi).
  const mulaSunting = (p: Petikan) => {
    setBorangSunting({
      id: p.id,
      teksAsal: p.teksAsal,
      bahasaAsal: p.bahasaAsal,
      teksMelayu: adalahMelayu(p.bahasaAsal) ? '' : p.teksPaparan,
      pengarang: p.pengarang,
      karya: p.karya,
      rujukan: p.rujukan,
      kategori: p.kategori || '',
      pautanBuku: p.pautanBuku,
    });
  };

  const simpanSunting = async () => {
    if (!borangSunting) return;
    setMenyimpanSuntingan(true);
    try {
      const res = await fetch(`/api/system/petikan/${borangSunting.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teksAsal: borangSunting.teksAsal,
          bahasaAsal: borangSunting.bahasaAsal,
          teksMelayu: borangSunting.teksMelayu,
          pengarang: borangSunting.pengarang,
          karya: borangSunting.karya,
          rujukan: borangSunting.rujukan,
          kategori: borangSunting.kategori,
          pautanBuku: borangSunting.pautanBuku,
        }),
      });
      const data = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan suntingan.');
      setBorangSunting(null);
      lapor('Petikan dikemas kini. Pengesahan yang terjejas oleh perubahan teks diset semula.');
      muat();
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyimpan suntingan.');
    } finally {
      setMenyimpanSuntingan(false);
    }
  };

  const togolBukaKad = (id: string) => setKadDibuka((s) => {
    const baharu = new Set(s);
    if (baharu.has(id)) baharu.delete(id); else baharu.add(id);
    return baharu;
  });

  // =========================================================================
  // MOD SEMAKAN PANTAS — satu kad, dua pemeriksaan berturutan.
  //
  // SENGAJA TIADA "Sahkan Semua" (arahan eksplisit Izzat). Butang begitu menjadikan pengesahan
  // satu klik untuk keseluruhan kelompok, iaitu tepat kebalikan maksud medan status. Kalau ia
  // wujud, ia akan digunakan, dan petikan yang tidak pernah disemak akan disiarkan sebagai
  // "disahkan". Jangan tambah walau ia nampak menjimatkan masa.
  //
  // Dua pemeriksaan pada SATU skrin, bukan dua pusingan melalui koleksi — penyemak seorang
  // sahaja, jadi menyelesaikan satu objek sepenuhnya lebih murah daripada mengingat semula
  // petikan mana yang bermasalah pada pusingan kedua.
  // =========================================================================
  const perluTindakan = useMemo(
    () => senarai.filter((p) => p.statusSumber !== 'sah' || (p.statusTerjemahan !== 'sah' && p.statusTerjemahan !== 'tidak_perlu')),
    [senarai]
  );
  const petikanSemakan = perluTindakan[Math.min(indeksSemakan, Math.max(0, perluTindakan.length - 1))] || null;
  const bilSekumpulan = petikanSemakan?.kumpulanImport
    ? senarai.filter((p) => p.kumpulanImport === petikanSemakan.kumpulanImport).length
    : 0;

  const senaraiDipapar = useMemo(() => {
    const carian = carianKoleksi.trim().toLowerCase();
    return senarai.filter((p) => {
      if (tapisan === 'sedia' && !p.layakTerbit) return false;
      if (tapisan === 'perlu_tindakan' && p.layakTerbit) return false;
      if (!carian) return true;
      return [p.teksPaparan, p.teksAsal, p.pengarang, p.karya].some((f) => (f || '').toLowerCase().includes(carian));
    });
  }, [senarai, tapisan, carianKoleksi]);

  const bilLayak = senarai.filter((p) => p.layakTerbit).length;

  // Kiraan sisi tab — orientasi sekali pandang tentang kerja tertunggak, tanpa perlu buka setiap
  // sub-halaman untuk tahu. Hanya dipaparkan apabila > 0 supaya tab bersih bila tiada kerja.
  const kiraanTab: Partial<Record<SubTab, number>> = {
    ruang_kerja: draf.length || undefined,
    semakan: perluTindakan.length || undefined,
  };

  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Petikan"
        huraian="Petikan daripada buku, kitab dan karya bertulis, dipaparkan di margin kiri Frontpage pada skrin lebar. Frontpage memaparkan Bahasa Melayu sahaja — petikan daripada sumber Arab atau Inggeris disimpan bersama teks asalnya untuk semakan, tetapi pembaca melihat terjemahan berlabel."
      />

      {mesej && <MesejStatus tone="success">{mesej}</MesejStatus>}
      {ralat && <MesejStatus tone="error">{ralat}</MesejStatus>}

      {/* Jalur status nipis, SENTIASA kelihatan tak kira sub-halaman mana sedang dibuka — ini
          injap keselamatan (kalau ciri bermasalah, Ketua Editor mesti nampak status tanpa mencari).
          Kawalan togol sebenar dipindah ke sub-halaman Tetapan supaya ia tidak menjadi kerja
          harian; jalur ini cuma PAPARAN + pautan pantas. */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <StatusBadge tone={ciriAktif ? 'success' : 'neutral'} label={ciriAktif === null ? 'Memuat…' : ciriAktif ? 'Petikan: Hidup' : 'Petikan: Mati'} />
          {ciriAktif === false && <span className="text-stone-500">Pembaca tidak melihat petikan buat masa ini.</span>}
        </div>
        {subTab !== 'tetapan' && (
          <button type="button" onClick={() => setSubTab('tetapan')} className="text-stone-500 hover:text-Adjung-maroon underline underline-offset-2 cursor-pointer">
            Urus tetapan ciri
          </button>
        )}
      </div>

      {/* Navigasi sub-halaman — corak SAMA seperti EditorialConsole.tsx (role="tablist" + anak
          panah papan kekunci). Jangan cipta corak navigasi kedua dalam Editorium. */}
      <div className="flex flex-wrap gap-1 border-b border-stone-200 text-xs" role="tablist">
        {SUB_TABS.map((t, index) => (
          <button
            key={t.id}
            id={`petikan-subtab-${t.id}`}
            type="button"
            role="tab"
            aria-selected={subTab === t.id}
            tabIndex={subTab === t.id ? 0 : -1}
            onClick={() => setSubTab(t.id)}
            onKeyDown={(e) => {
              let sasaran: SubTab | null = null;
              if (e.key === 'ArrowRight') sasaran = SUB_TABS[(index + 1) % SUB_TABS.length].id;
              else if (e.key === 'ArrowLeft') sasaran = SUB_TABS[(index - 1 + SUB_TABS.length) % SUB_TABS.length].id;
              else if (e.key === 'Home') sasaran = SUB_TABS[0].id;
              else if (e.key === 'End') sasaran = SUB_TABS[SUB_TABS.length - 1].id;
              if (sasaran) {
                e.preventDefault();
                setSubTab(sasaran);
                // Panggilan SEGERAK, bukan requestAnimationFrame — semua butang tab dirender
                // TANPA SYARAT (roving tabindex), jadi elemen sasaran sudah wujud dalam DOM
                // sebelum setSubTab pun dipanggil. rAF menyebabkan fokus tidak berpindah langsung
                // selepas anak panah (disahkan pelayar sebenar, 2026-08-19). Dibetulkan serentak
                // di EditorialConsole.tsx, MaklumanDrawer.tsx, TetapanConsole.tsx — corak sama.
                document.getElementById(`petikan-subtab-${sasaran}`)?.focus();
              }
            }}
            className={`px-4 py-2 font-semibold tracking-wide transition-all border-b-2 cursor-pointer inline-flex items-center gap-1.5 ${
              subTab === t.id
                ? 'text-Adjung-maroon border-Adjung-maroon bg-stone-50'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            {t.label}
            {!!kiraanTab[t.id] && (
              <span className="font-mono text-[9px] leading-none px-1.5 py-0.5 rounded-full bg-Adjung-maroon text-white">
                {kiraanTab[t.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ 1. RUANG KERJA — tampal, sunting, simpan. ═══
          SATU seksyen, bukan dua. Versi asal memisahkan "Import daripada Sesi AI" dan "Tambah
          Petikan" jadi dua seksyen tidak berkaitan, dan Izzat betul untuk bertanya apa gunanya
          yang kedua. Kedua-duanya mencipta objek yang SAMA; bezanya cuma dari mana kad datang. */}
      {subTab === 'ruang_kerja' && (
        <PanelCard className="text-xs space-y-4">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <SectionLabel>Ruang Kerja Petikan</SectionLabel>
              <p className="text-stone-500 text-xs">
                {draf.length > 0
                  ? `${draf.length} kad dalam ruang kerja · ${drafSedia.length} sedia disimpan.`
                  : 'Tampal hasil daripada sesi AI, atau tambah satu petikan secara manual.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={salinArahanAi}>
                <Copy className="w-3.5 h-3.5" /> Salin Arahan AI
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setTampalDibuka((v) => !v)}>
                <ClipboardPaste className="w-3.5 h-3.5" /> {tampalDibuka ? 'Tutup' : 'Tampal Hasil'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDraf((d) => [...d, kadKosong()])}>
                <Plus className="w-3.5 h-3.5" /> Tambah manual
              </Button>
            </div>
          </div>

          {notaArahan && <MesejStatus tone="success">{notaArahan}</MesejStatus>}

          {tampalDibuka && (
            <div className="space-y-2">
              <label className={LABEL_BORANG}>Tampal keseluruhan output daripada sesi AI</label>
              <textarea
                value={teksTampal}
                onChange={(e) => setTeksTampal(e.target.value)}
                rows={8}
                className={`${INPUT_BORANG} font-mono text-[11px]`}
                placeholder={'Teks Asal:\n…\n\nBahasa Asal: Arab\n\nTeks Melayu:\n…'}
              />
              <p className="text-stone-500 text-[10px]">
                Salin cara mana pun — dengan tetikus atau butang salin chatbot. Sempadan rekod dikesan
                daripada baris “Teks Asal:”, bukan daripada garis pemisah yang selalunya hilang semasa
                disalin.
              </p>
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" disabled={!teksTampal.trim() || memproses} onClick={pecahkanTampalan}>
                  {memproses ? 'Memproses…' : 'Pecahkan kepada kad'}
                </Button>
              </div>
            </div>
          )}

          {/* Blok yang penghurai tidak dapat baca. Ditunjukkan dengan sebab DAN cuplikan supaya
              editor boleh mengenal pastinya dalam sesi AI, bukan dibuang senyap. */}
          {ditolak.length > 0 && (
            <div className="border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 rounded p-3 space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-wider font-bold text-[var(--color-error)]">
                {ditolak.length} blok tidak dapat dibaca
              </p>
              {ditolak.map((g, i) => (
                <p key={i} className="text-[11px] text-stone-700">
                  <span className="font-mono">Blok {g.blok}:</span> {g.sebab}
                  {g.cuplikan && <span className="text-stone-400"> — “{g.cuplikan}…”</span>}
                </p>
              ))}
              <p className="text-[10px] text-stone-500 pt-1">
                Betulkan dalam sesi AI dan tampal semula, atau tambah petikan itu secara manual.
              </p>
            </div>
          )}

          {draf.length === 0 ? (
            <KeadaanKosong>
              Ruang kerja kosong. Hasil yang ditampal akan muncul di sini sebagai kad yang boleh
              disunting sebelum disimpan ke koleksi.
            </KeadaanKosong>
          ) : (
            <ul className="list-none m-0 p-0 space-y-2">
              {draf.map((k, idx) => {
                const masalah = masalahKad(k);
                const melayu = adalahMelayu(k.bahasaAsal);
                const paparan = melayu ? k.teksAsal : k.teksMelayu;
                return (
                  <li key={k.kunci} className={`border rounded-lg ${masalah.length ? 'border-amber-300 bg-amber-50/40' : 'border-stone-200'}`}>
                    {/* Baris ringkas — sentiasa kelihatan. Prinsipnya: sembunyikan DATA, jangan
                        sembunyikan STATUS. Editor perlu mengimbas dan terus nampak mana yang
                        bermasalah tanpa membuka setiap kad. */}
                    <div className="flex items-start gap-3 p-3">
                      <button
                        type="button"
                        onClick={() => ubahKad(k.kunci, { dibuka: !k.dibuka })}
                        className="mt-0.5 text-stone-400 hover:text-Adjung-maroon cursor-pointer shrink-0"
                        aria-label={k.dibuka ? 'Lipat kad' : 'Buka kad'}
                      >
                        {k.dibuka ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">
                            Petikan {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
                            {k.bahasaAsal || 'Melayu'}
                          </span>
                          {k.kategori && (
                            <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">{k.kategori}</span>
                          )}
                          {masalah.map((m) => (
                            <span key={m} className="font-mono text-[9px] uppercase tracking-wider font-bold text-amber-700">{m}</span>
                          ))}
                        </div>
                        <p className="font-serif text-sm text-stone-900 leading-snug">
                          {paparan.trim() ? `“${paparan.trim().slice(0, 140)}${paparan.trim().length > 140 ? '…' : ''}”` : <span className="text-stone-400 italic">Kad kosong</span>}
                        </p>
                        <p className="text-stone-500 text-[11px] mt-1">
                          {k.pengarang || <span className="text-stone-400">Pengarang belum diisi</span>}
                          {k.karya ? <> · <em>{k.karya}</em></> : ''}
                        </p>
                      </div>

                      <Tooltip text="Buang kad ini daripada ruang kerja">
                        <button
                          type="button" onClick={() => buangKad(k.kunci)} aria-label="Buang kad"
                          className="p-1.5 text-stone-400 hover:text-[var(--color-error)] cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </Tooltip>
                    </div>

                    {k.dibuka && (
                      <div className="border-t border-stone-200 p-3 space-y-3">
                        <BorangPetikan nilai={k} ubah={(t) => ubahKad(k.kunci, t)} />
                        {k.amaran && <p className="text-[11px] text-amber-700">{k.amaran}</p>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {draf.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-Adjung-line">
              <span className="text-stone-500 text-[10px] mt-3">
                Semua akan masuk sebagai <strong>Belum disemak</strong>. Format yang betul tidak
                bermakna petikan sudah disahkan terhadap sumbernya.
              </span>
              <Button variant="primary" size="sm" disabled={!drafSedia.length || memproses} onClick={simpanDraf} className="mt-3">
                {memproses ? 'Menyimpan…' : `Simpan ${drafSedia.length} ke koleksi`}
              </Button>
            </div>
          )}
        </PanelCard>
      )}

      {/* ═══ 2. SEMAKAN — Mod Semakan Pantas. ═══ */}
      {subTab === 'semakan' && (
        <PanelCard className="text-xs space-y-4">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <SectionLabel>Semakan Editorial</SectionLabel>
              <p className="text-stone-500 text-xs">
                {perluTindakan.length > 0
                  ? `${perluTindakan.length} petikan menunggu semakan terhadap sumber asalnya.`
                  : 'Tiada petikan menunggu semakan.'}
              </p>
            </div>
            {perluTindakan.length > 0 && (
              <Button
                variant={semakanDibuka ? 'secondary' : 'primary'} size="sm"
                onClick={() => { setSemakanDibuka(!semakanDibuka); setIndeksSemakan(0); }}
              >
                {semakanDibuka ? 'Tutup mod semakan' : 'Mula semak'}
              </Button>
            )}
          </div>

          {perluTindakan.length === 0 && (
            <KeadaanKosong>
              Setiap petikan dalam koleksi sudah diputuskan. Petikan baharu akan muncul di sini
              untuk disemak.
            </KeadaanKosong>
          )}

          {semakanDibuka && petikanSemakan && (
            <div className="border border-Adjung-line rounded p-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">
                  {indeksSemakan + 1} daripada {perluTindakan.length}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">
                  {petikanSemakan.bahasaAsal}
                </span>
                {petikanSemakan.kategori ? (
                  <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">{petikanSemakan.kategori}</span>
                ) : (
                  <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-amber-700">Kategori perlu diisi</span>
                )}
                {/* Konteks kelompok — kesilapan AI biasanya berkelompok, jadi penyemak patut tahu
                    petikan mana datang bersama. Ia MAKLUMAT, bukan pemilihan: tiada tindakan pukal. */}
                {bilSekumpulan > 1 && (
                  <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-Adjung-maroon">
                    Sesi AI sama · {bilSekumpulan} petikan
                  </span>
                )}
              </div>

              {/* LANGKAH 1 — sahkan teks asal terhadap karya. */}
              <div className="space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-600">
                  1 — Sahkan teks asal terhadap sumber
                </p>
                <blockquote className="font-serif text-base text-stone-900 leading-relaxed border-l-2 border-stone-300 pl-4" dir="auto">
                  {petikanSemakan.teksAsal}
                </blockquote>
                <div className="text-stone-600 text-xs">
                  <span className="font-semibold">{petikanSemakan.pengarang}</span>
                  {petikanSemakan.karya && <span> · <em>{petikanSemakan.karya}</em></span>}
                  {petikanSemakan.rujukan && <span> · {petikanSemakan.rujukan}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="secondary" size="sm" onClick={() => salin(petikanSemakan.teksAsal, 'asal')}>
                    {teksDisalin === 'asal' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {teksDisalin === 'asal' ? 'Disalin' : 'Salin teks asal'}
                  </Button>
                  {petikanSemakan.statusSumber === 'sah' ? (
                    <StatusBadge tone="success" label="Sumber disahkan" />
                  ) : (
                    <>
                      <Button variant="primary" size="sm" disabled={memprosesSemakan} onClick={() => tetapkanStatus(petikanSemakan.id, { statusSumber: 'sah' })}>
                        <BadgeCheck className="w-3.5 h-3.5" /> Sumber disahkan
                      </Button>
                      <Button variant="bahaya" size="sm" disabled={memprosesSemakan} onClick={() => tetapkanStatus(petikanSemakan.id, { statusSumber: 'dipertikai' })}>
                        <TriangleAlert className="w-3.5 h-3.5" /> Pertikai
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* LANGKAH 2 — sahkan terjemahan. Dikunci sehingga sumber disahkan: terjemahan yang
                  setia kepada sumber yang salah tetap tidak berguna. Pelayan turut menolak 400,
                  jadi kunci ini panduan, bukan satu-satunya pertahanan. */}
              {petikanSemakan.statusTerjemahan === 'tidak_perlu' ? (
                <p className="text-[11px] text-stone-500 border-t border-Adjung-line pt-3">
                  Sumber berbahasa Melayu — tiada terjemahan untuk disemak.
                </p>
              ) : (
                <div className="space-y-2 border-t border-Adjung-line pt-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider font-bold text-stone-600">
                    2 — Sahkan terjemahan setia kepada teks asal
                  </p>
                  <blockquote className="font-serif text-base text-stone-900 leading-relaxed border-l-2 border-stone-300 pl-4">
                    {petikanSemakan.teksPaparan}
                  </blockquote>
                  {petikanSemakan.statusSumber !== 'sah' ? (
                    <p className="text-[11px] text-stone-500">
                      Sahkan teks asal dahulu. Terjemahan yang tepat kepada sumber yang belum
                      disahkan tidak bermakna apa-apa.
                    </p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {petikanSemakan.statusTerjemahan === 'sah' ? (
                        <StatusBadge tone="success" label="Terjemahan disahkan" />
                      ) : (
                        <>
                          <Button variant="primary" size="sm" disabled={memprosesSemakan} onClick={() => tetapkanStatus(petikanSemakan.id, { statusTerjemahan: 'sah' })}>
                            <BadgeCheck className="w-3.5 h-3.5" /> Terjemahan disahkan
                          </Button>
                          <Button variant="bahaya" size="sm" disabled={memprosesSemakan} onClick={() => tetapkanStatus(petikanSemakan.id, { statusTerjemahan: 'dipertikai' })}>
                            <TriangleAlert className="w-3.5 h-3.5" /> Pertikai
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2 border-t border-Adjung-line pt-3">
                {/* Langkau memajukan indeks TANPA menulis apa-apa — penyemak yang tidak pasti patut
                    boleh beredar tanpa terpaksa membuat keputusan palsu. */}
                <Button variant="ghost" size="sm" disabled={indeksSemakan >= perluTindakan.length - 1} onClick={() => setIndeksSemakan((i) => i + 1)}>
                  <SkipForward className="w-3.5 h-3.5" /> Langkau
                </Button>
                {indeksSemakan > 0 && (
                  <Button variant="ghost" size="sm" onClick={() => setIndeksSemakan((i) => i - 1)}>Sebelum</Button>
                )}
              </div>
            </div>
          )}
        </PanelCard>
      )}

      {/* ═══ 3. KOLEKSI — cari, tapis, semak status, sunting. ═══
          Kekal SENARAI KAD, bukan jadual (keputusan tegas ChatGPT, pusingan 6): pengguna tunggal
          (bukan pasukan bershif), kandungan dwibahasa yang perlu DIBACA bukan diimbas, dan dua
          status yang perlu difahami BERSAMA konteks petikan — jadual menggalakkan "scan metadata",
          koleksi ini perlukan "scan kandungan + keadaan editorial". Kad PADAT secara lalai; teks
          asal/rujukan/pautan boleh dilipat. */}
      {subTab === 'koleksi' && (
        <PanelCard className="space-y-4 text-xs">
          <div className="flex flex-wrap justify-between items-end gap-4">
            <div>
              <SectionLabel>Koleksi Petikan</SectionLabel>
              <p className="text-stone-500 text-xs">
                {senarai.length} petikan dalam koleksi · {bilLayak} sedia diterbitkan.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {([['semua', 'Semua'], ['perlu_tindakan', 'Perlu Tindakan'], ['sedia', 'Sedia Diterbitkan']] as const).map(([nilai, label]) => (
                <Button key={nilai} variant={tapisan === nilai ? 'primary' : 'secondary'} size="sm" onClick={() => setTapisan(nilai)}>
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="relative max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <input
              value={carianKoleksi}
              onChange={(e) => setCarianKoleksi(e.target.value)}
              placeholder="Cari teks, pengarang atau karya…"
              className={`${INPUT_BORANG} pl-9`}
            />
          </div>

          {memuat ? (
            <KeadaanMemuat baris={4} />
          ) : senaraiDipapar.length === 0 ? (
            <KeadaanKosong>
              {senarai.length === 0
                ? 'Tiada petikan lagi. Ke Ruang Kerja untuk tampal hasil sesi AI atau tambah secara manual.'
                : 'Tiada petikan sepadan carian/tapisan ini.'}
            </KeadaanKosong>
          ) : (
            <ul className="list-none m-0 p-0 divide-y divide-Adjung-line">
              {senaraiDipapar.map((p) => {
                const dibuka = kadDibuka.has(p.id);
                const menyunting = borangSunting?.id === p.id;
                return (
                  <li key={p.id} className="py-3 first:pt-0 last:pb-0">
                    {menyunting && borangSunting ? (
                      <div className="border border-Adjung-line rounded-lg p-3 space-y-3 bg-stone-50/50">
                        <div className="flex items-center justify-between">
                          <SectionLabel>Sunting Petikan</SectionLabel>
                          <button type="button" onClick={() => setBorangSunting(null)} aria-label="Batal sunting" className="text-stone-400 hover:text-stone-700 cursor-pointer">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <BorangPetikan
                          nilai={borangSunting}
                          ubah={(t) => setBorangSunting((b) => (b ? { ...b, ...t } : b))}
                        />
                        {masalahKad(borangSunting).length > 0 && (
                          <p className="text-[11px] text-amber-700">{masalahKad(borangSunting).join(' · ')}</p>
                        )}
                        <p className="text-[10px] text-stone-500">
                          Mengubah teks asal atau teks Melayu akan meletakkan semula pengesahan
                          berkaitan kepada Belum disemak.
                        </p>
                        <div className="flex items-center gap-2 justify-end">
                          <Button variant="ghost" size="sm" onClick={() => setBorangSunting(null)}>Batal</Button>
                          <Button
                            variant="primary" size="sm"
                            disabled={menyimpanSuntingan || masalahKad(borangSunting).length > 0}
                            onClick={simpanSunting}
                          >
                            {menyimpanSuntingan ? 'Menyimpan…' : 'Simpan perubahan'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              {/* DUA status dipaparkan berasingan, bukan digabung menjadi satu
                                  perkataan. "Disahkan" sahaja tidak memberitahu editor APA yang
                                  telah disahkan. */}
                              <StatusBadge tone={nadaStatus(p.statusSumber)} label={`Sumber: ${LABEL_STATUS[p.statusSumber]}`} />
                              {p.statusTerjemahan !== 'tidak_perlu' && (
                                <StatusBadge tone={nadaStatus(p.statusTerjemahan)} label={`Terjemahan: ${LABEL_STATUS[p.statusTerjemahan]}`} />
                              )}
                              {p.layakTerbit && <StatusBadge tone="success" label="Sedia diterbitkan" />}
                              {!p.aktif && (
                                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-400">Dinyahaktifkan</span>
                              )}
                              {p.kategori ? (
                                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-stone-500">{p.kategori}</span>
                              ) : (
                                <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-amber-700">Kategori perlu diisi</span>
                              )}
                            </div>

                            <p className="font-serif text-sm text-stone-900 leading-snug">“{p.teksPaparan}”</p>
                            <p className="text-stone-500 text-[11px] mt-1">
                              {p.pengarang} · <em>{p.karya}</em>{p.rujukan ? ` · ${p.rujukan}` : ''}
                              {p.statusTerjemahan !== 'tidak_perlu' && ` · ${labelTerjemahan(p.bahasaAsal)}`}
                            </p>

                            {/* Padat secara lalai — teks asal, tarikh pengesahan dan pautan buku
                                boleh dilipat. Editor sedang mengimbas koleksi, bukan membaca
                                semula setiap petikan setiap kali. */}
                            {dibuka && (
                              <div className="mt-2 space-y-1 border-t border-Adjung-line pt-2">
                                {p.statusTerjemahan !== 'tidak_perlu' && (
                                  <p className="font-serif text-[13px] text-stone-500 leading-snug" dir="auto">{p.teksAsal}</p>
                                )}
                                {(p.sumberDisahkanPada || p.terjemahanDisahkanPada) && (
                                  <p className="text-stone-400 text-[10px]">
                                    {p.sumberDisahkanPada && `Sumber disahkan ${new Date(p.sumberDisahkanPada).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                                    {p.sumberDisahkanPada && p.terjemahanDisahkanPada && ' · '}
                                    {p.terjemahanDisahkanPada && `Terjemahan disahkan ${new Date(p.terjemahanDisahkanPada).toLocaleDateString('ms-MY', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                                  </p>
                                )}
                                {p.pautanBuku && (
                                  <a href={p.pautanBuku} target="_blank" rel="noopener noreferrer" className="text-Adjung-maroon underline underline-offset-2 text-[11px]">
                                    {p.labelPautan || 'Lihat buku'}
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <Tooltip text={dibuka ? 'Sembunyikan butiran' : 'Lihat butiran penuh'}>
                              <button
                                type="button" onClick={() => togolBukaKad(p.id)}
                                aria-label={dibuka ? 'Sembunyikan butiran' : 'Lihat butiran'}
                                className="p-1.5 text-stone-500 hover:text-Adjung-maroon cursor-pointer"
                              >
                                {dibuka ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                            </Tooltip>
                            <Tooltip text="Sunting">
                              <button
                                type="button" onClick={() => mulaSunting(p)} aria-label="Sunting"
                                className="p-1.5 text-stone-500 hover:text-Adjung-maroon cursor-pointer"
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

                        {/* Pengesahan padam sebaris (bukan window.confirm) — corak sama seperti
                            konsol lain dalam Editorium. Petikan boleh dipadam bersih kerana ia
                            kutipan karya orang lain, bukan terbitan Adjung; peraturan "arkib,
                            jangan padam" tidak terpakai. */}
                        {sahMemadam === p.id && (
                          <div className="mt-2 flex flex-wrap items-center gap-2 bg-[#802334]/5 p-2 rounded">
                            <span className="text-[11px] text-stone-700">Padam petikan ini terus? Tidak boleh dibuat asal.</span>
                            <Button variant="bahaya" size="sm" onClick={() => padam(p.id)}>Ya, padam</Button>
                            <Button variant="ghost" size="sm" onClick={() => setSahMemadam('')}>Batal</Button>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </PanelCard>
      )}

      {/* ═══ 4. TETAPAN — togol hidup/mati. ═══
          Injap keselamatan modul ni; diasingkan daripada kerja harian supaya editor tidak
          terlanggar togol ni secara tidak sengaja semasa mengimport/menyemak. */}
      {subTab === 'tetapan' && (
        <PanelCard className="text-xs">
          <div className="flex flex-wrap justify-between items-center gap-4">
            <div>
              <SectionLabel>Status Ciri Petikan</SectionLabel>
              <p className="text-stone-500 text-xs">
                {ciriAktif === null
                  ? 'Memuat status…'
                  : ciriAktif
                    ? 'Petikan sedang dipaparkan kepada pembaca di Frontpage.'
                    : 'Petikan tidak dipaparkan kepada pembaca. Koleksi kekal seperti biasa — ini togol paparan, bukan padam.'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge tone={ciriAktif ? 'success' : 'neutral'} label={ciriAktif ? 'Hidup' : 'Mati'} />
              <Button variant={ciriAktif ? 'secondary' : 'primary'} size="sm" disabled={ciriAktif === null || menukarTogol} onClick={tukarTogolCiri}>
                {menukarTogol ? 'Menukar…' : ciriAktif ? 'Matikan ciri' : 'Hidupkan ciri'}
              </Button>
            </div>
          </div>
        </PanelCard>
      )}
    </div>
  );
};
