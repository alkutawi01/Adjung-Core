import React from 'react';
import { NotebookText } from 'lucide-react';

// No audit-log table exists in the backend yet — this console has no real data source to read
// from. Previously showed 4 hardcoded fake entries (Ahmad, Izzat, Ali) instead of being honest
// about that. Shows an empty state until a real audit_log table + write-path is built.
export const LogAuditConsole: React.FC = () => {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-stone-200 p-12 text-center space-y-2">
      <NotebookText className="w-8 h-8 text-stone-400 mx-auto" strokeWidth={1.75} />
      <h3 className="font-serif text-sm font-bold text-[#802334] uppercase tracking-wider">
        Log Audit Belum Dibina
      </h3>
      <p className="font-serif text-stone-500 text-xs max-w-sm mx-auto">
        Belum ada sistem rekod audit sebenar di belakang skrin ini. Ia akan mula catat tindakan
        editorial sebenar (terbit, tolak, ubah polisi) apabila sistem log masuk sedia.
      </p>
    </div>
  );
};

export default LogAuditConsole;
