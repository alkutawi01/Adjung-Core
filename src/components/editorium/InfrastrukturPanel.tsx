import React, { useCallback, useEffect, useState } from 'react';
import { bacaJsonSelamat, mesejRalat } from '../../utils/bacaJson';
import { renderMarkdownRingkas } from '../../lib/markdownRingkas';
import { Button } from '../common/Button';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanMemuat } from '../common/KeadaanMemuat';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { LABEL_BORANG, INPUT_BORANG } from '../common/gayaKongsi';

// Rujukan → Dokumentasi → 3. Infrastruktur (2026-10-25, permintaan Izzat). Kad maklumat hosting,
// domain, e-mel, deploy dan pangkalan data untuk rujukan SEMUA editor; Pentadbir boleh sunting,
// tambah dan padam kad (kebenaran sebenar dikuatkuasakan di pelayan, core/routes/
// rujukanSistemRoutes.js — `bolehSunting` di sini hanya menyembunyikan butang daripada editor lain).

interface Kad { id: string; tajuk: string; kandungan: string; urutan: number; dikemaskiniPada: string | null; dikemaskiniOleh: string | null }

const HAD_TAJUK = 120;
const HAD_KANDUNGAN = 6000;

const format = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' });
};

export const InfrastrukturPanel: React.FC<{ bolehSunting: boolean }> = ({ bolehSunting }) => {
  const [kad, setKad] = useState<Kad[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');
  // sedangSunting: id kad yang disunting, atau 'baharu' untuk kad baharu, atau null.
  const [sedangSunting, setSedangSunting] = useState<string | null>(null);
  const [tajuk, setTajuk] = useState('');
  const [kandungan, setKandungan] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);
  const [sahPadam, setSahPadam] = useState<string | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true); setRalat('');
    try {
      const res = await fetch('/api/system/rujukan-sistem');
      const b = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(b.error || 'Gagal memuatkan rujukan sistem.');
      setKad(b.kad || []);
    } catch (err: any) {
      setRalat(mesejRalat(err, 'Gagal memuatkan rujukan sistem.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const mulaSunting = (k: Kad | null) => {
    setRalat('');
    setSedangSunting(k ? k.id : 'baharu');
    setTajuk(k ? k.tajuk : '');
    setKandungan(k ? k.kandungan : '');
  };
  const batalSunting = () => { setSedangSunting(null); setRalat(''); };

  const simpan = async () => {
    setMenyimpan(true); setRalat('');
    try {
      const baharu = sedangSunting === 'baharu';
      const res = await fetch(baharu ? '/api/system/rujukan-sistem' : `/api/system/rujukan-sistem/${encodeURIComponent(sedangSunting!)}`, {
        method: baharu ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tajuk, kandungan }),
      });
      const b = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(b.error || 'Gagal menyimpan.');
      setSedangSunting(null);
      await muat();
    } catch (err: any) {
      setRalat(mesejRalat(err, 'Gagal menyimpan.'));
    } finally {
      setMenyimpan(false);
    }
  };

  const padam = async (id: string) => {
    setRalat('');
    try {
      const res = await fetch(`/api/system/rujukan-sistem/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const b = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(b.error || 'Gagal memadam.');
      setSahPadam(null);
      await muat();
    } catch (err: any) {
      setRalat(mesejRalat(err, 'Gagal memadam.'));
    }
  };

  const borang = (
    <PanelCard padding="p-4" className="space-y-3">
      <MesejStatus tone="neutral">
        Halaman ini boleh dibaca semua editor. Jangan simpan kata laluan, kunci atau token di sini.
      </MesejStatus>
      <label className="block">
        <span className={LABEL_BORANG}>Tajuk ({tajuk.length}/{HAD_TAJUK})</span>
        <input className={INPUT_BORANG} value={tajuk} maxLength={HAD_TAJUK} onChange={(e) => setTajuk(e.target.value)} />
      </label>
      <label className="block">
        <span className={LABEL_BORANG}>Kandungan ({kandungan.length}/{HAD_KANDUNGAN})</span>
        <textarea
          className={`${INPUT_BORANG} min-h-[11rem] leading-relaxed`} value={kandungan} maxLength={HAD_KANDUNGAN}
          onChange={(e) => setKandungan(e.target.value)}
        />
        <span className="font-sans text-[11px] text-stone-400">
          Gunakan **tebal** untuk label, baris baharu untuk menyusun baris, dan satu baris kosong untuk perenggan baharu.
        </span>
      </label>
      <div className="flex items-center gap-2">
        <Button variant="primary" onClick={simpan} disabled={menyimpan || !tajuk.trim() || !kandungan.trim()}>
          {menyimpan ? 'Menyimpan…' : 'Simpan'}
        </Button>
        <Button variant="secondary" onClick={batalSunting} disabled={menyimpan}>Batal</Button>
      </div>
    </PanelCard>
  );

  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Infrastruktur"
        huraian="Rujukan ringkas tentang tempat Adjung Brief dihoskan dan cara ia berjalan: pelayan, domain, e-mel, deploy dan salinan sandaran. Tiada kata laluan atau kunci disimpan di sini."
      />
      {ralat && <MesejStatus tone="error" onCubaLagi={sedangSunting ? undefined : muat}>{ralat}</MesejStatus>}
      {memuat && kad.length === 0 && <KeadaanMemuat />}
      {!memuat && kad.length === 0 && !ralat && <KeadaanKosong>Belum ada maklumat rujukan.</KeadaanKosong>}

      {kad.map((k) => (
        sedangSunting === k.id ? (
          <React.Fragment key={k.id}>{borang}</React.Fragment>
        ) : (
          <PanelCard key={k.id} padding="p-4" className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-serif text-sm font-bold text-stone-900">{k.tajuk}</h3>
              {bolehSunting && sedangSunting === null && (
                <div className="flex items-center gap-2 shrink-0 text-xs">
                  <button type="button" onClick={() => mulaSunting(k)} className="font-semibold text-[#802334] hover:underline cursor-pointer">Sunting</button>
                  {sahPadam === k.id ? (
                    <>
                      <button type="button" onClick={() => padam(k.id)} className="font-semibold text-[var(--color-error)] hover:underline cursor-pointer">Sahkan padam</button>
                      <button type="button" onClick={() => setSahPadam(null)} className="text-stone-500 hover:underline cursor-pointer">Batal</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => setSahPadam(k.id)} className="text-stone-500 hover:text-[var(--color-error)] hover:underline cursor-pointer">Padam</button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-2 text-xs text-stone-600 leading-relaxed">
              {renderMarkdownRingkas(k.kandungan, { kelasPerenggan: 'whitespace-pre-line' })}
            </div>
            {k.dikemaskiniPada && (
              <p className="text-[11px] text-stone-400">
                Dikemas kini {format(k.dikemaskiniPada)}{k.dikemaskiniOleh && k.dikemaskiniOleh !== 'sistem' ? ` oleh ${k.dikemaskiniOleh}` : ''}
              </p>
            )}
          </PanelCard>
        )
      ))}

      {bolehSunting && (
        sedangSunting === 'baharu'
          ? borang
          : sedangSunting === null && <Button variant="secondary" onClick={() => mulaSunting(null)}>Tambah kad</Button>
      )}
    </div>
  );
};

export default InfrastrukturPanel;
