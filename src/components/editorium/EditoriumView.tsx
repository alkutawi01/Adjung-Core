import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Radio, X } from 'lucide-react';
import { EditoriumLayout } from './EditoriumLayout';
import { IndeksConsole } from './IndeksConsole';
import { DirektoriConsole } from './DirektoriConsole';
import { TetapanConsole } from './TetapanConsole';
import { SenaraiSlotConsole } from './SenaraiSlotConsole';
import { TierKadConsole } from './TierKadConsole';
import { BidangConsole } from './BidangConsole';
import { TetapanAmSlotConsole } from './TetapanAmSlotConsole';
import { LogAuditConsole } from './LogAuditConsole';
import { PerlembagaanConsole } from './PerlembagaanConsole';
import { SistemRekaBentukConsole } from './SistemRekaBentukConsole';
import { DrafSayaConsole } from './DrafSayaConsole';
import { ModulKhasConsole } from './ModulKhasConsole';
import { EditorialConsole } from './EditorialConsole';
import { NotaKetuaEditorConsole } from './NotaKetuaEditorConsole';
import { DokumentasiRujukanConsole } from './DokumentasiRujukanConsole';
import { ContentReview } from '../studio/ContentReview';
import { SlotManagerModal } from '../portal/SlotManagerModal';
import { useSlotEditor } from '../../hooks/useSlotEditor';
import { TIER_SLOTS } from '../../../core/editorial/GeometryConfig.js';

interface EditoriumViewProps {
  // null = belum log masuk. Peranan (KETUA_EDITOR/EDITOR) datang terus daripada akaun yang log
  // masuk — bukan lagi togol manual.
  currentUser: { name: string; role: 'KETUA_EDITOR' | 'EDITOR' } | null;
  onRequestLogin: () => void;
  onLogout: () => void;
}

// Sesi log masuk (currentUser) kini state kongsi diangkat naik ke App.tsx — supaya FrontpageView
// (borang Tetapan Slot Bidang, butang "Edit Kandungan") turut boleh baca sesi yang sama.
export const EditoriumView: React.FC<EditoriumViewProps> = ({ currentUser, onRequestLogin, onLogout }) => {
  const navigate = useNavigate();
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '').trim();
    return hash || 'indeks';
  };
  const [activeTab, setActiveTab] = useState(getInitialTab);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    window.location.hash = tabId;
  };
  // Log keluar = keluar terus ke frontpage. Editorium bukan tempat untuk sesiapa yang tak log
  // masuk — dulu pengguna ditinggalkan di /editorium (skrin pagar) selepas log keluar.
  //
  // `sedangKeluar` wujud sebab peralihan laman ni beransur (AnimatePresence, 0.4s): sebaik sesi
  // dikosongkan, laman lama masih di skrin sepanjang animasi keluar tu — dan tanpa sesi ia
  // melukis skrin pagar "Log Masuk" untuk seketika sebelum frontpage muncul. Sepanjang kita
  // sedang beredar, jangan lukis skrin pagar langsung.
  const [sedangKeluar, setSedangKeluar] = useState(false);
  const handleLogoutAndLeave = () => {
    setSedangKeluar(true);
    navigate('/');
    onLogout();
  };
  // Sub-menu tab "Indeks" (2026-07-29, permintaan pemilik projek) — corak sama macam sub-tab
  // Tetapan. "Semakan Kandungan" (dulu laman berasingan /studio/semakan-kandungan) kini dibenam
  // terus di sini sebagai sub-menu kedua, bukan pautan keluar. ContentReview sendiri sudah ada
  // togol dalaman "Paparan Kad"/"Paparan Teks Pukal" (a/b dalam permintaan pemilik projek).
  const [indeksSubTab, setIndeksSubTab] = useState<'senarai' | 'semakan'>('senarai');
  // Sub-menu tab "Slot" (2026-07-30, permintaan pemilik projek).
  const [slotSubTab, setSlotSubTab] = useState<'senarai' | 'tier' | 'bidang' | 'tetapan_am'>('senarai');
  // Tulis Kandungan (2026-07-29) — mandiri sepenuhnya, lihat useSlotEditor.ts. Hantar nama editor
  // log masuk supaya setiap Simpan/Terbit catat siapa sebenarnya terbitkan kandungan tu.
  const slotEditor = useSlotEditor(currentUser?.name);

  // Sedang beredar ke frontpage selepas log keluar — biarkan kosong sepanjang animasi keluar,
  // jangan sesekali kelipkan skrin pagar.
  if (sedangKeluar) return null;

  if (!currentUser) {
    // Sengaja TIADA onRequestLogin ke Layout di sini — kalau tidak, satu skrin papar dua butang
    // "Log Masuk" (masthead + tengah) yang buat benda sama. Butang tengah dikekalkan sebab
    // dialah tumpuan skrin pagar ni.
    return (
      <EditoriumLayout activeTab={activeTab} onTabChange={setActiveTab} currentUser={null} onLogout={handleLogoutAndLeave}>
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-stone-500 font-sans">
          <Lock className="w-8 h-8 text-stone-300" />
          <p className="text-sm">Log masuk diperlukan untuk mengakses Editorium.</p>
          <button
            onClick={onRequestLogin}
            className="bg-[#802334] text-white text-xs font-semibold px-4 py-2 rounded hover:bg-[#6a1c2a] transition-colors"
          >
            Log Masuk
          </button>
        </div>
      </EditoriumLayout>
    );
  }

  return (
    <EditoriumLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      currentUser={currentUser}
      onRequestLogin={onRequestLogin}
      onLogout={handleLogoutAndLeave}
      onOpenSlotPicker={() => slotEditor.setShowSlotPicker(true)}
    >
      {activeTab === 'indeks' && (
        <div className="space-y-4 font-sans">
          <div className="flex flex-wrap gap-1 border-b border-stone-200 text-xs">
            <button
              onClick={() => setIndeksSubTab('senarai')}
              className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                indeksSubTab === 'senarai' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              1. Indeks
            </button>
            <button
              onClick={() => setIndeksSubTab('semakan')}
              className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                indeksSubTab === 'semakan' ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              2. Semakan Kandungan
            </button>
          </div>
          {indeksSubTab === 'senarai' && (
            <IndeksConsole
              currentUserRole={currentUser.role}
              currentUserName={currentUser.name}
            />
          )}
          {indeksSubTab === 'semakan' && <ContentReview />}
        </div>
      )}
      {activeTab === 'draf_saya' && (
        <DrafSayaConsole
          onOpenSlotEditor={(idx) => slotEditor.openSlotEditor(idx)}
          currentEditorName={currentUser?.name}
        />
      )}
      {/* Slot (2026-07-30, permintaan pemilik projek) — segala yang MENTAKRIFKAN slot duduk di
          sini: bentuk, Bidang, warna, had aksara, animasi. Rasionalnya: slot ialah kad, kad ialah
          slot. Senarai KANDUNGAN dalam slot sengaja tiada di sini — Ketua Editor menyunting
          kandungan di Kandungan → Semakan Kandungan. Ticker dan tier Bar juga tiada di sini;
          kedua-duanya ada rumah sendiri di Modul Khas. */}
      {activeTab === 'slot' && (
        <div className="space-y-4 font-sans">
          <div className="flex flex-wrap gap-1 border-b border-stone-200 text-xs">
            {([
              ['senarai', '1. Senarai Slot'],
              ['tier', '2. Tier Kad'],
              ['bidang', '3. Bidang'],
              ['tetapan_am', '4. Tetapan Am'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSlotSubTab(id)}
                className={`px-4 py-2 font-semibold transition-all border-b-2 ${
                  slotSubTab === id ? 'border-[#802334] text-[#802334] bg-stone-50' : 'border-transparent text-stone-500 hover:text-stone-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {slotSubTab === 'senarai' && <SenaraiSlotConsole />}
          {slotSubTab === 'tier' && <TierKadConsole />}
          {slotSubTab === 'bidang' && <BidangConsole />}
          {slotSubTab === 'tetapan_am' && <TetapanAmSlotConsole />}
        </div>
      )}
      {activeTab === 'modul_khas' && (
        <ModulKhasConsole />
      )}
      {activeTab === 'editorial' && (
        <EditorialConsole />
      )}
      {activeTab === 'direktori' && (
        <DirektoriConsole
          currentUserRole={currentUser.role}
        />
      )}
      {activeTab === 'nota_ketua_editor' && (
        <NotaKetuaEditorConsole />
      )}
      {activeTab === 'tetapan' && (
        <TetapanConsole
          currentUserRole={currentUser.role}
        />
      )}
      {activeTab === 'dokumentasi' && (
        <DokumentasiRujukanConsole />
      )}

      {/* Pemilih slot "Tulis Kandungan" */}
      {slotEditor.showSlotPicker && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => slotEditor.setShowSlotPicker(false)}>
          <div className="bg-[#FDFDFD] rounded-xl border border-stone-300 shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden font-sans" onClick={(e) => e.stopPropagation()}>
            <div className="flex-none px-5 py-4 border-b border-stone-200 flex items-center justify-between bg-white">
              <h2 className="font-serif text-base font-bold text-stone-900">Pilih Slot Untuk Disunting</h2>
              <button type="button" onClick={() => slotEditor.setShowSlotPicker(false)} className="text-stone-400 hover:text-[#802334] cursor-pointer"><X size={18} /></button>
            </div>
            <ol className="flex-1 min-h-0 overflow-y-auto list-none m-0 p-0 divide-y divide-stone-100">
              {Array.from({ length: 38 }, (_, i) => i).filter((i) => !TIER_SLOTS.BAR.includes(i)).map((i) => {
                const cfg = slotEditor.slotsConfig.find((s: any) => s.slotIndex === i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => slotEditor.openSlotEditor(i)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-stone-100/60 transition-colors cursor-pointer"
                    >
                      <span className="font-mono text-xs font-bold text-stone-900 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">Slot {i + 1}</span>
                      <span className="font-sans text-xs text-stone-700 font-semibold flex-1 truncate">{cfg?.manualDesk || <span className="text-stone-400 font-normal">— Belum ditetapkan —</span>}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      )}

      {slotEditor.editingSlotIndex !== null && slotEditor.formConfig && !TIER_SLOTS.BAR.includes(slotEditor.editingSlotIndex) && (
        <SlotManagerModal
          key={slotEditor.editingSlotIndex}
          editingSlotIndex={slotEditor.editingSlotIndex}
          formConfig={slotEditor.formConfig}
          setFormConfig={slotEditor.setFormConfig}
          activeBidangList={slotEditor.activeBidangList}
          currentEditoriumRole={currentUser.role}
          currentEditoriumName={currentUser.name}
          isSavingSlot={slotEditor.isSavingSlot}
          onClose={slotEditor.closeSlotEditor}
          onSave={slotEditor.handleSaveSlot}
          slotOptions={Array.from({ length: 38 }, (_, i) => i)
            .filter((i) => !TIER_SLOTS.BAR.includes(i))
            .map((i) => ({
              index: i,
              label: `Slot ${i + 1} — ${slotEditor.slotsConfig.find((s: any) => s.slotIndex === i)?.manualDesk || 'Belum ditetapkan'}`,
            }))}
          onSwitchSlot={slotEditor.openSlotEditor}
        />
      )}
      {slotEditor.saveError && (
        <div className="fixed bottom-4 right-4 z-[60] bg-red-50 border border-red-200 text-red-800 text-xs px-4 py-3 rounded shadow-lg max-w-sm">
          {slotEditor.saveError}
        </div>
      )}
    </EditoriumLayout>
  );
};

export default EditoriumView;
