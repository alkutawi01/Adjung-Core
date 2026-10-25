import React, { useCallback, useEffect, useState } from 'react';
import { bacaJsonSelamat, mesejRalat } from '../../utils/bacaJson';
import { Button } from '../common/Button';
import { PanelCard } from '../common/PanelCard';
import { SectionLabel } from '../common/SectionLabel';
import { MesejStatus } from '../common/MesejStatus';
import { KeadaanMemuat } from '../common/KeadaanMemuat';

// Panel "Notifikasi pembaca" dalam konsol Editorial (2026-10-25, permintaan Izzat). Versi asas:
// satu suis padam/hidup (jika sesuatu tidak kena, Ketua Editor boleh hentikan SEMUA notifikasi serta-
// merta) dan ringkasan ringkas supaya editor tahu apa sedang berlaku. Peraturan penghantaran
// (jeda, had harian, waktu senyap) sengaja tetap dalam kod — lihat core/push/PushService.js.

interface LogHantar { masa: string; bilKandungan: number; bilPenerima: number; bilBerjaya: number; ringkasan: string }
interface Tetapan { aktif: boolean; hantarTerakhir: string | null; bilPelanggan: number; log: LogHantar[] }

const format = (iso: string | null) => {
  if (!iso) return 'Belum pernah';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('ms-MY', { dateStyle: 'medium', timeStyle: 'short' });
};

export const NotifikasiPembacaPanel: React.FC = () => {
  const [data, setData] = useState<Tetapan | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [ralat, setRalat] = useState('');
  const [menyimpan, setMenyimpan] = useState(false);

  const muat = useCallback(async () => {
    setMemuat(true); setRalat('');
    try {
      const res = await fetch('/api/system/push/tetapan');
      const b = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(b.error || 'Gagal memuatkan tetapan notifikasi.');
      setData(b as Tetapan);
    } catch (err: any) {
      setRalat(mesejRalat(err, 'Gagal memuatkan tetapan notifikasi.'));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => { muat(); }, [muat]);

  const tukar = async (aktif: boolean) => {
    setMenyimpan(true); setRalat('');
    try {
      const res = await fetch('/api/system/push/tetapan', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aktif }),
      });
      const b = await bacaJsonSelamat(res);
      if (!res.ok) throw new Error(b.error || 'Gagal menyimpan.');
      await muat();
    } catch (err: any) {
      setRalat(mesejRalat(err, 'Gagal menyimpan tetapan notifikasi.'));
    } finally {
      setMenyimpan(false);
    }
  };

  return (
    <PanelCard className="space-y-4 text-xs">
      <div>
        <SectionLabel>06 — Notifikasi Pembaca</SectionLabel>
        <p className="text-stone-500 text-xs">
          Bila kandungan diterbitkan di mana-mana slot (kecuali Ticker dan Bar), pembaca yang telah
          mengaktifkan notifikasi menerima tajuknya di telefon atau komputer. Untuk melindungi pembaca:
          setiap kandungan diberitahu sekali sahaja, kandungan serentak dilipat jadi satu notifikasi,
          sekurang-kurangnya 10 minit antara notifikasi, paling banyak 10 sehari, dan tiada notifikasi
          antara 11 malam hingga 6:30 pagi (waktu Malaysia).
        </p>
      </div>

      {ralat && <MesejStatus tone="error" onCubaLagi={muat}>{ralat}</MesejStatus>}
      {memuat && !data && <KeadaanMemuat />}

      {data && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`font-mono text-[10px] uppercase tracking-widest font-bold ${data.aktif ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
              {data.aktif ? 'Notifikasi hidup' : 'Notifikasi dimatikan'}
            </span>
            <Button variant={data.aktif ? 'secondary' : 'primary'} disabled={menyimpan} onClick={() => tukar(!data.aktif)}>
              {menyimpan ? 'Menyimpan…' : data.aktif ? 'Matikan notifikasi' : 'Hidupkan notifikasi'}
            </Button>
          </div>
          <p className="text-stone-600">
            Pelanggan: <strong>{data.bilPelanggan}</strong>. Notifikasi terakhir dihantar: <strong>{format(data.hantarTerakhir)}</strong>.
          </p>
          {!data.aktif && (
            <p className="text-stone-500">
              Semasa dimatikan, tiada notifikasi dihantar dan butang di footer disembunyikan untuk pembaca
              baharu. Kandungan yang terbit sewaktu dimatikan akan dihantar apabila dihidupkan semula, jika masih segar (kurang 14 jam).
            </p>
          )}
          {data.log.length > 0 && (
            <div className="space-y-1">
              <SectionLabel>Hantaran terkini</SectionLabel>
              <ul className="divide-y divide-stone-100 border border-stone-100 rounded">
                {data.log.map((l, i) => (
                  <li key={i} className="px-3 py-2 flex flex-col gap-0.5">
                    <span className="text-stone-400 font-mono text-[10px]">
                      {format(l.masa)} · {l.bilKandungan} kandungan · {l.bilBerjaya}/{l.bilPenerima} diterima
                    </span>
                    <span className="text-stone-700">{l.ringkasan}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </PanelCard>
  );
};

export default NotifikasiPembacaPanel;
