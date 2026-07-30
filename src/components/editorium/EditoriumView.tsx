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
  const [activeTab, setActiveTab] = useState('indeks');
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
      onTabChange={setActiveTab}
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
        <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4 font-sans">
          <h3 className="font-sans text-xs font-bold text-stone-800 uppercase tracking-wider">Modul Khas</h3>
          <p className="text-xs text-stone-500">
            Jam, Ticker, dan Slot Bar ada peraturan penyuntingan tersendiri, berasingan daripada kad bento biasa.
          </p>
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <Radio className="w-4 h-4 text-[#802334]" />
              <div>
                <div className="text-sm font-semibold text-stone-800">Ticker (Berita Semasa)</div>
                <div className="text-[11px] text-stone-500">RSS, animasi, status, tetapan penyuntingan khas.</div>
              </div>
            </div>
            {/* Modal Ticker sebenar (TickerManagementModal) masih hidup di FrontpageView.tsx —
                lihat nota "+ Tulis Kandungan" di EditoriumLayout.tsx untuk sebab yang sama. */}
            <a
              href="/?openTicker=1"
              className="px-3 py-1.5 bg-[#802334] text-white rounded text-xs font-semibold hover:bg-[#6a1c2a] transition-colors shrink-0"
            >
              Urus Ticker
            </a>
          </div>
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4 opacity-50">
            <div>
              <div className="text-sm font-semibold text-stone-800">Jam Dunia</div>
              <div className="text-[11px] text-stone-500">Belum disambungkan ke Editorium.</div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-4 border border-stone-200 rounded-lg p-4 opacity-50">
            <div>
              <div className="text-sm font-semibold text-stone-800">Slot Bar</div>
              <div className="text-[11px] text-stone-500">Belum disambungkan ke Editorium (kekal guna laluan sedia ada di frontpage).</div>
            </div>
          </div>
        </div>
      )}
      {activeTab === 'direktori' && (
        <DirektoriConsole
          currentUserRole={currentUser.role}
        />
      )}
      {activeTab === 'tetapan' && (
        <TetapanConsole
          currentUserRole={currentUser.role}
        />
      )}
      {activeTab === 'log_audit' && (
        <LogAuditConsole />
      )}
      {activeTab === 'perlembagaan' && (
        <PerlembagaanConsole />
      )}
      {activeTab === 'reka_bentuk' && (
        <SistemRekaBentukConsole />
      )}

      {/* Pemilih slot "Tulis Kandungan" (2026-07-29) — senarai 38 slot KECUALI Bar (bentuk
          borangnya belum sepadan, kerja berasingan akan datang) dan Ticker (Modul Khas, laluan
          sendiri). Render TERUS di sini (bukan Frontpage) — Editorium mandiri sepenuhnya. */}
      {slotEditor.showSlotPicker && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-md" onClick={() => slotEditor.setShowSlotPicker(false)}>
          <div className="bg-white rounded-lg border border-stone-200 shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex-none px-5 py-4 border-b border-stone-150 flex items-center justify-between">
              <h2 className="font-serif text-lg font-medium text-stone-900">Pilih Slot</h2>
              <button type="button" onClick={() => slotEditor.setShowSlotPicker(false)} className="text-stone-400 hover:text-stone-600 cursor-pointer"><X size={18} /></button>
            </div>
            <ol className="flex-1 min-h-0 overflow-y-auto list-none m-0 p-0">
              {Array.from({ length: 38 }, (_, i) => i).filter((i) => !TIER_SLOTS.BAR.includes(i)).map((i) => {
                const cfg = slotEditor.slotsConfig.find((s: any) => s.slotIndex === i);
                return (
                  <li key={i}>
                    <button
                      type="button"
                      onClick={() => slotEditor.openSlotEditor(i)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-2.5 text-left hover:bg-stone-50 border-b border-stone-100 last:border-b-0 cursor-pointer"
                    >
                      <span className="font-mono text-xs font-bold text-stone-400 shrink-0">Slot {i + 1}</span>
                      <span className="font-sans text-xs text-stone-700 flex-1 truncate">{cfg?.manualDesk || <span className="text-stone-400 italic">— Belum ditetapkan —</span>}</span>
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
