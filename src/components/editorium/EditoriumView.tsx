import React, { useState } from 'react';
import { EditoriumLayout } from './EditoriumLayout';
import { IndeksConsole } from './IndeksConsole';
import { DirektoriConsole } from './DirektoriConsole';
import { TetapanConsole } from './TetapanConsole';
import { LogAuditConsole } from './LogAuditConsole';
import { PerlembagaanConsole } from './PerlembagaanConsole';
import { SistemRekaBentukConsole } from './SistemRekaBentukConsole';

interface EditoriumViewProps {
  currentUser: { name: string; role: 'KETUA_EDITOR' | 'EDITOR' };
  onUserSwitch: (role: 'KETUA_EDITOR' | 'EDITOR') => void;
}

// Peranan (currentUser/onUserSwitch) kini state kongsi diangkat naik ke App.tsx -- supaya
// FrontpageView (borang Tetapan Slot Bidang) turut boleh baca peranan yang sama. Bukan lagi
// local state di sini.
export const EditoriumView: React.FC<EditoriumViewProps> = ({ currentUser, onUserSwitch }) => {
  const [activeTab, setActiveTab] = useState('indeks');

  return (
    <EditoriumLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      currentUser={currentUser}
      onUserSwitch={onUserSwitch}
    >
      {activeTab === 'indeks' && (
        <IndeksConsole
          currentUserRole={currentUser.role}
          currentUserName={currentUser.name}
        />
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
    </EditoriumLayout>
  );
};

export default EditoriumView;
