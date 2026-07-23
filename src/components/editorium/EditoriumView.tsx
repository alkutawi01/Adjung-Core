import React, { useState } from 'react';
import { EditoriumLayout } from './EditoriumLayout';
import { IndeksConsole } from './IndeksConsole';
import { DirektoriConsole } from './DirektoriConsole';
import { TetapanConsole } from './TetapanConsole';
import { LogAuditConsole } from './LogAuditConsole';

export const EditoriumView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('indeks');
  const [currentUser, setCurrentUser] = useState<{ name: string; role: 'KETUA_EDITOR' | 'EDITOR' }>({
    name: 'Izzat Anas',
    role: 'KETUA_EDITOR'
  });

  const handleRoleSwitch = (role: 'KETUA_EDITOR' | 'EDITOR') => {
    if (role === 'KETUA_EDITOR') {
      setCurrentUser({ name: 'Izzat Anas', role: 'KETUA_EDITOR' });
    } else {
      setCurrentUser({ name: 'Editor Ahmad', role: 'EDITOR' });
    }
  };

  return (
    <EditoriumLayout
      activeTab={activeTab}
      onTabChange={setActiveTab}
      currentUser={currentUser}
      onUserSwitch={handleRoleSwitch}
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
    </EditoriumLayout>
  );
};

export default EditoriumView;
