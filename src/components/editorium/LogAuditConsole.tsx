import React, { useState } from 'react';

interface AuditLogEntry {
  id: string;
  date: string;
  user: string;
  action: string;
  object: string;
}

export const LogAuditConsole: React.FC = () => {
  const [logs] = useState<AuditLogEntry[]>([
    {
      id: 'log-01',
      date: '22/07/2026',
      user: 'Ahmad',
      action: 'Publish Brief',
      object: 'NASA Reviews Hubble Mission'
    },
    {
      id: 'log-02',
      date: '22/07/2026',
      user: 'Izzat',
      action: 'Update Editorial Policy',
      object: 'Had Panjang Ringkasan Brief (250 aksara)'
    },
    {
      id: 'log-03',
      date: '22/07/2026',
      user: 'Izzat',
      action: 'Tetapkan Mandat',
      object: 'Editor Ahmad (Slot 1-10)'
    },
    {
      id: 'log-04',
      date: '20/07/2026',
      user: 'Ali',
      action: 'Publish Brief',
      object: 'Gua Niah Tapak Warisan UNESCO'
    }
  ]);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-stone-200 overflow-hidden">
      <table className="w-full text-left border-collapse font-sans text-xs">
        <thead>
          <tr className="bg-stone-100 border-b border-stone-200 font-mono text-[9px] uppercase text-stone-600 tracking-wider">
            <th className="p-4">TARIKH</th>
            <th className="p-4">PENGGUNA</th>
            <th className="p-4">TINDAKAN</th>
            <th className="p-4">OBJEK</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 font-mono">
          {logs.map(log => (
            <tr key={log.id} className="hover:bg-stone-50 transition-colors">
              <td className="p-4 text-stone-500 font-bold whitespace-nowrap">{log.date}</td>
              <td className="p-4 font-bold text-stone-900">{log.user}</td>
              <td className="p-4">
                <span className="bg-stone-100 text-stone-800 px-2 py-0.5 rounded font-bold border border-stone-200">
                  {log.action}
                </span>
              </td>
              <td className="p-4 font-serif text-stone-900">{log.object}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default LogAuditConsole;
