import React, { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw, Save } from 'lucide-react';
import { muatPindaanTier } from '../../config/tierOverrides';
import { StatusBadge } from '../common/StatusBadge';
import { ModulTajuk } from '../common/ModulTajuk';
import { PanelCard } from '../common/PanelCard';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanKosong } from '../common/KeadaanKosong';
import { Button } from '../common/Button';
import { Tooltip } from '../common/Tooltip';
import { KEPALA_JADUAL, GARIS_BARIS } from '../common/gayaKongsi';
import { TIER_GRID_SIZE } from '../../../core/editorial/GeometryConfig.js';

// Tier Kad (2026-07-30, permintaan pemilik projek) — tetapan yang dikongsi SEMUA slot yang sebentuk.
// Buat masa ini: had aksara tajuk dan huraian ringkas.
//
// Kenapa di sini dan bukan dalam Senarai Slot: had ialah sifat BENTUK kad, bukan sifat satu slot.
// Mengeditnya per-slot akan memecahkan peraturan teras projek (slot sebentuk mesti dilayan sama
// rata), jadi skrin ni sengaja hanya boleh menulis pada peringkat tier.
//
// Nilai lalai datang daripada GeometryConfig.js (diukur daripada saiz sebenar kad). Apa yang
// disimpan dalam pangkalan data hanyalah PINDAAN — butang "Kembali ke lalai" membuang pindaan itu,
// bukan menulis nombor lalai, supaya lalai kekal satu sumber sahaja.
interface TierRow {
  tierKey: string;
  label: string;
  slots: number[];
  maxTitleAlone: number;
  maxBriefAlone: number;
  lalaiMaxTitleAlone: number;
  lalaiMaxBriefAlone: number;
  dipinda: boolean;
  updatedAt: string | null;
}

const TIER_LABEL_IS_ENGLISH: Record<string, boolean> = { BAR: true, TICKER: true };

export const TierKadConsole: React.FC = () => {
  const [rows, setRows] = useState<TierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draf, setDraf] = useState<Record<string, { tajuk: string; huraian: string }>>({});
  const [menyimpan, setMenyimpan] = useState<string | null>(null);
  const [ralat, setRalat] = useState<string | null>(null);
  const [berjaya, setBerjaya] = useState<string | null>(null);

  const muat = () => {
    setLoading(true);
    fetch('/api/system/tier-settings')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setRows(data);
          setDraf(Object.fromEntries(data.map((t: TierRow) => [
            t.tierKey, { tajuk: String(t.maxTitleAlone), huraian: String(t.maxBriefAlone) },
          ])));
        }
      })
      .catch(e => setRalat('Gagal memuatkan tetapan tier: ' + (e.message || '')))
      .finally(() => setLoading(false));
  };

  useEffect(muat, []);

  const berubah = (t: TierRow) => {
    const d = draf[t.tierKey];
    if (!d) return false;
    return Number(d.tajuk) !== t.maxTitleAlone || Number(d.huraian) !== t.maxBriefAlone;
  };

  const simpan = async (t: TierRow) => {
    const d = draf[t.tierKey];
    setMenyimpan(t.tierKey);
    setRalat(null);
    setBerjaya(null);
    try {
      const res = await fetch('/api/system/tier-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierKey: t.tierKey, maxTitleAlone: Number(d.tajuk), maxBriefAlone: Number(d.huraian) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan.');
      setBerjaya(`Had ${t.label} dikemas kini, berkuat kuasa pada ${t.slots.length} slot.`);
      muat();
      muatPindaanTier();
    } catch (e: any) {
      setRalat(e.message || 'Gagal menyimpan.');
    } finally {
      setMenyimpan(null);
    }
  };

  const kembaliLalai = async (t: TierRow) => {
    setMenyimpan(t.tierKey);
    setRalat(null);
    setBerjaya(null);
    try {
      const res = await fetch('/api/system/tier-settings/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierKey: t.tierKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengembalikan nilai lalai.');
      setBerjaya(`Had ${t.label} dikembalikan kepada nilai lalai.`);
      muat();
      muatPindaanTier();
    } catch (e: any) {
      setRalat(e.message || 'Gagal mengembalikan nilai lalai.');
    } finally {
      setMenyimpan(null);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      <ModulTajuk
        tajuk="Tier Kad"
        huraian={
          <>
            Tetapan yang dikongsi semua slot yang sama bentuk. Menukar had di sini berkuat kuasa serentak
            pada setiap slot dalam tier itu — tiada pengecualian per-slot.
          </>
        }
      />

      <PanelCard className="space-y-4 text-xs">
        <MesejStatus tone="neutral" className="leading-relaxed">
          Tajuk dan huraian berkongsi <strong className="font-semibold">satu</strong> bajet ruang, bukan dua had berasingan.
          Nombor di bawah ialah had setiap medan apabila medan satu lagi kosong; tajuk yang panjang mengecilkan
          ruang huraian secara berkadar, dan sebaliknya.
        </MesejStatus>

        {ralat && (
          <MesejStatus tone="error" className="flex items-start gap-1.5" onCubaLagi={muat}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {ralat}
          </MesejStatus>
        )}
        {berjaya && <MesejStatus tone="success">{berjaya}</MesejStatus>}

        {loading ? (
          <KeadaanKosong>Memuatkan tetapan tier…</KeadaanKosong>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className={KEPALA_JADUAL}>
                  <th className="p-2.5">Bentuk Kad</th>
                  <th className="p-2.5 text-right">Bilangan Slot</th>
                  <th className="p-2.5 text-right">Had Tajuk</th>
                  <th className="p-2.5 text-right">Had Huraian</th>
                  <th className="p-2.5">Lalai</th>
                  <th className="p-2.5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(t => {
                  const d = draf[t.tierKey] || { tajuk: '', huraian: '' };
                  const adaPerubahan = berubah(t);
                  const barSahaja = t.tierKey === 'BAR';
                  return (
                    <tr key={t.tierKey} className={`hover:bg-stone-50 ${GARIS_BARIS}`}>
                      <td className="p-2.5">
                        <div className="font-semibold text-stone-800">
                          {TIER_LABEL_IS_ENGLISH[t.tierKey] ? <em>{t.label}</em> : t.label}
                          {TIER_GRID_SIZE[t.tierKey] && (
                            <span className="font-mono text-[10px] text-stone-400 font-normal"> ({TIER_GRID_SIZE[t.tierKey]})</span>
                          )}
                        </div>
                        <div className="font-mono text-[9px] text-stone-400 uppercase">{t.tierKey}</div>
                      </td>
                      <td className="p-2.5 text-right font-mono text-stone-600">{t.slots.length}</td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min={1}
                          value={d.tajuk}
                          onChange={e => setDraf(p => ({ ...p, [t.tierKey]: { ...d, tajuk: e.target.value } }))}
                          className="w-20 px-2 py-1 border border-stone-300 rounded text-right font-mono text-xs focus:outline-none focus:border-Adjung-maroon"
                        />
                      </td>
                      <td className="p-2.5 text-right">
                        <input
                          type="number"
                          min={0}
                          value={d.huraian}
                          disabled={barSahaja}
                          title={barSahaja ? 'Kad Bar tiada medan huraian langsung.' : undefined}
                          onChange={e => setDraf(p => ({ ...p, [t.tierKey]: { ...d, huraian: e.target.value } }))}
                          className="w-20 px-2 py-1 border border-stone-300 rounded text-right font-mono text-xs focus:outline-none focus:border-Adjung-maroon disabled:bg-stone-100 disabled:text-stone-400"
                        />
                      </td>
                      <td className="p-2.5 font-mono text-[10px] text-stone-500">
                        {t.lalaiMaxTitleAlone} / {t.lalaiMaxBriefAlone}
                        {t.dipinda && <StatusBadge tone="warning" label="DIPINDA" className="ml-1.5" />}
                      </td>
                      <td className="p-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {t.dipinda && (
                            <Tooltip text="Kembali ke nilai lalai">
                              <span className="inline-flex shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => kembaliLalai(t)}
                                  disabled={menyimpan === t.tierKey}
                                  aria-label="Kembali ke nilai lalai"
                                  className="hover:text-Adjung-maroon"
                                  icon={<RotateCcw className="w-3.5 h-3.5" />}
                                />
                              </span>
                            </Tooltip>
                          )}
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => simpan(t)}
                            disabled={!adaPerubahan || menyimpan === t.tierKey}
                            icon={<Save className="w-3 h-3" />}
                          >
                            {menyimpan === t.tierKey ? 'Menyimpan…' : 'Simpan'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-Adjung-line pt-3 text-[10px] text-stone-500 leading-relaxed space-y-1.5">
          <p>
            <strong className="font-semibold text-stone-700">Menaikkan had tidak membesarkan kad.</strong>{' '}
            Nilai lalai diukur daripada ruang sebenar yang ada pada kad itu. Menaikkannya bermakna teks yang
            lebih panjang akan diterima semasa simpan — dan teks itu terpaksa muat dalam kad yang saiznya tidak berubah.
            Selepas meminda, tinjau kad berkenaan di frontpage untuk pastikan tiada yang terkeluar.
          </p>
          <p>
            Pindaan berkuat kuasa serta-merta pada semua laluan simpan (tampal manual, tampal pukal, jana AI,
            suntingan terus). Kandungan sedia ada tidak disemak semula.
          </p>
        </div>
      </PanelCard>
    </div>
  );
};

export default TierKadConsole;
