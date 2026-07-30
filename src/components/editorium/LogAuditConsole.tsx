import React, { useState, useEffect, useMemo } from 'react';
import { NotebookText, Search, Filter, RefreshCw, ShieldCheck, History, Download } from 'lucide-react';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  user: string;
  role: string;
  target: string;
  details: string;
}

export const LogAuditConsole: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('Semua');

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['ID', 'Tarikh/Masa', 'Pengguna', 'Peranan', 'Tindakan', 'Sasaran', 'Perincian'];
    const rows = filteredLogs.map(l => [
      l.id,
      `"${new Date(l.timestamp).toLocaleString('ms-MY')}"`,
      `"${l.user}"`,
      `"${l.role}"`,
      `"${l.action}"`,
      `"${l.target}"`,
      `"${(l.details || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `adjung_log_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      // Build dynamic real audit trail from editorial revisions & slot config updates
      const resContent = await fetch('/api/system/content/all');
      const items = await resContent.json();

      const resSlots = await fetch('/api/system/slots');
      const slots = await resSlots.json();

      const auditList: AuditLogEntry[] = [];

      if (Array.isArray(items)) {
        items.forEach((item: any, idx: number) => {
          auditList.push({
            id: `audit-content-${item.id || idx}`,
            timestamp: item.updatedAt || item.createdAt || new Date().toISOString(),
            action: item.status === 'approved' ? 'TERBIT_KANDUNGAN' : 'SUNTING_KANDUNGAN',
            user: item.editorName || 'izzat',
            role: 'CHIEF_EDITOR',
            target: `Slot ${item.slotIndex} (${item.desk || 'UMUM'})`,
            details: `Tajuk: "${(item.title || '').slice(0, 45)}..." [Topik: ${item.topik || '-'}]`
          });
        });
      }

      if (Array.isArray(slots)) {
        slots.forEach((s: any) => {
          if (s.updatedAt) {
            auditList.push({
              id: `audit-slot-${s.slotIndex}`,
              timestamp: s.updatedAt,
              action: 'KEMASKINI_TETAPAN_SLOT',
              user: s.editorName || 'izzat',
              role: 'CHIEF_EDITOR',
              target: `Slot ${s.slotIndex}`,
              details: `Bidang: ${s.manualDesk || 'UMUM'}, Limit: ${s.generationLimit}`
            });
          }
        });
      }

      // Sort by newest timestamp
      auditList.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setLogs(auditList);
    } catch {
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  const actionTypes = useMemo(() => {
    const set = new Set(logs.map(l => l.action));
    return ['Semua', ...Array.from(set)];
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesAction = actionFilter === 'Semua' || log.action === actionFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        log.user.toLowerCase().includes(q) ||
        log.target.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q);

      return matchesAction && matchesSearch;
    });
  }, [logs, actionFilter, searchQuery]);

  return (
    <div className="space-y-6 font-sans bg-[#FDFDFD] text-[#1F1F1F]">
      {/* Header — Flat Cream Surface + 1px Hairline Rule */}
      <div className="pb-4 border-b border-stone-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-[#802334]" />
            <h2 className="text-xl font-serif font-bold text-stone-900">Konsol Log Audit Aktiviti Editorial</h2>
          </div>
          <p className="text-xs text-stone-500 font-sans mt-0.5 max-w-2xl">
            Rekod jejak audit masa-nyata menyenaraikan sebarang perubahan slot, penerbitan kandungan, dan kemaskini bidang oleh staf editorial.
          </p>
        </div>
        <button
          onClick={fetchAuditLogs}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#802334] hover:bg-[#601824] text-white rounded text-xs font-semibold shadow-xs transition-colors shrink-0 cursor-pointer font-sans"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Segar semula
        </button>
      </div>

      {/* Search & Filter Controls — Flat Cream + Hairline */}
      <div className="py-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Cari log mengikut pengarang, slot, atau perincian..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-stone-50 border border-stone-300 rounded text-xs font-sans focus:outline-none focus:border-[#802334]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-400 shrink-0" />
          <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-bold shrink-0">Jenis tindakan:</span>
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-3 py-1.5 border border-stone-300 rounded text-xs font-semibold text-stone-800 bg-stone-50 focus:outline-none focus:border-[#802334]"
          >
            {actionTypes.map(act => (
              <option key={act} value={act}>{act}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Audit Log Table — Flat Cream Surface + 1px Hairline Header */}
      <div className="border-t border-stone-200">
        <div className="py-3 flex items-center justify-between">
          <h3 className="font-serif text-sm font-bold text-stone-900">Sejarah Aktiviti Sistem</h3>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-stone-500">Memaparkan {filteredLogs.length} rekod</span>
            <button
              onClick={handleExportCSV}
              disabled={filteredLogs.length === 0}
              className="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded border border-stone-300 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-[#802334]" /> Muat Turun CSV
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-xs text-stone-500">Memuatkan log audit...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center space-y-2 border-t border-b border-stone-200">
            <NotebookText className="w-8 h-8 text-stone-300 mx-auto" />
            <p className="text-xs font-semibold text-stone-600">Tiada Log Audit Ditemui</p>
            <p className="text-[11px] text-stone-400 max-w-sm mx-auto">
              Tiada rekod aktiviti yang sepadan dengan kriteria carian anda.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-[10px] font-mono uppercase tracking-wider text-stone-500">
                  <th className="py-3 px-4">Masa & Tarikh</th>
                  <th className="py-3 px-4">Tindakan</th>
                  <th className="py-3 px-4">Pengarang</th>
                  <th className="py-3 px-4">Sasaran</th>
                  <th className="py-3 px-4">Perincian Rekod</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-mono text-xs">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-stone-50 transition-colors">
                    <td className="py-3 px-4 text-stone-500 whitespace-nowrap text-[11px]">
                      {new Date(log.timestamp).toLocaleString('ms-MY')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action.includes('TERBIT')
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-stone-100 text-stone-800 border border-stone-200'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-semibold text-stone-800">{log.user}</div>
                      <div className="text-[10px] text-stone-400 font-normal">{log.role}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-stone-700 font-semibold">
                      {log.target}
                    </td>
                    <td className="py-3 px-4 text-stone-600 max-w-md truncate font-sans text-[11px]">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogAuditConsole;
