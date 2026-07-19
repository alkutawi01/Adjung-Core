import React from 'react';
import { db } from '../../db/mockDb';

export const ChangelogView: React.FC = () => {
  const releaseLogs = db.getReleaseLogs();

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-10">
      <header className="border-b border-[#111111]/10 pb-6 text-left">
        <span className="block font-mono text-[9px] uppercase tracking-[0.25em] text-[#802334] mb-2">
          Development Timeline
        </span>
        <h1 className="font-serif text-4xl font-light text-stone-900 leading-tight">
          Version History
        </h1>
        <p className="font-serif italic text-stone-500 text-sm mt-2">
          Changelogs, releases, and platform versions of the Adjung repository.
        </p>
      </header>
      <div className="relative border-l border-stone-200 ml-4 pl-8 space-y-12 text-left">
        {releaseLogs.length === 0 ? (
          <p className="text-center italic text-stone-400 font-serif py-12 ml-[-2rem]">
            No releases are cataloged in version history.
          </p>
        ) : (
          releaseLogs
            .sort((a, b) =>
              b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' })
            )
            .map((log) => (
              <div key={log.id} className="relative group">
                {/* Chronology Dot */}
                <span className="absolute -left-[41px] top-1.5 w-4.5 h-4.5 bg-[#802334] border-4 border-[#FDFDFD] rounded-full group-hover:scale-110 transition-transform"></span>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-mono text-sm font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded-sm">
                      {log.version}
                    </span>
                    <time className="font-mono text-[10px] text-stone-400">
                      {new Date(log.date).toLocaleDateString(undefined, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </time>
                  </div>
                  <h3 className="font-serif text-xl font-medium text-stone-850">
                    {log.version} Release
                  </h3>
                  <p className="font-serif italic text-stone-500 text-xs">
                    Released by: Adjung Editorial Board
                  </p>

                  <div className="font-serif text-stone-600 text-sm leading-relaxed pt-2 space-y-3">
                    {log.changes.added && log.changes.added.length > 0 && (
                      <div>
                        <span className="block font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1 text-left">
                          Added
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-left">
                          {log.changes.added.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {log.changes.improved && log.changes.improved.length > 0 && (
                      <div>
                        <span className="block font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1 text-left">
                          Improved
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-left">
                          {log.changes.improved.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {log.changes.fixed && log.changes.fixed.length > 0 && (
                      <div>
                        <span className="block font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1 text-left">
                          Fixed
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-left">
                          {log.changes.fixed.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {log.changes.deprecated && log.changes.deprecated.length > 0 && (
                      <div>
                        <span className="block font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1 text-left">
                          Deprecated
                        </span>
                        <ul className="list-disc pl-4 space-y-1 text-left">
                          {log.changes.deprecated.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  );
};
