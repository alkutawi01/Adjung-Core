import React from 'react';
import { Entry } from '../../types';
import { parseInlineFormatting } from '../../utils';

interface NoticesViewProps {
  entries: Entry[];
  setSelectedEntry: (entry: Entry | null) => void;
}

export const NoticesView: React.FC<NoticesViewProps> = ({ entries, setSelectedEntry }) => {
  const notices = entries.filter((e) => e.contentType === 'Notice' && e.status === 'Published');

  return (
    <div className="max-w-3xl mx-auto space-y-12 py-10">
      <header className="border-b border-[#111111]/10 pb-6 text-left">
        <span className="block font-mono text-[9px] uppercase tracking-[0.25em] text-[#802334] mb-2">
          Institutional Announcements
        </span>
        <h1 className="font-serif text-4xl font-light text-stone-900 leading-tight">Notices</h1>
        <p className="font-serif italic text-stone-500 text-sm mt-2">
          Operational and time-sensitive announcements from the editorial board.
        </p>
      </header>
      <div className="space-y-10">
        {notices.length === 0 ? (
          <p className="text-center italic text-stone-400 font-serif py-12">
            No institutional notices have been published.
          </p>
        ) : (
          notices
            .sort(
              (a, b) =>
                new Date(b.publishedDate || b.createdDate).getTime() -
                new Date(a.publishedDate || a.createdDate).getTime()
            )
            .map((notice) => (
              <article
                key={notice.id}
                className="group border-b border-stone-200/60 pb-8 text-left cursor-pointer"
                onClick={() => setSelectedEntry(notice)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <span className="font-mono text-[9px] uppercase text-[#802334] bg-[#802334]/5 px-2 py-0.5 font-semibold">
                    Notice
                  </span>
                  <span className="text-stone-300">—</span>
                  <time className="font-mono text-[10px] text-stone-400">
                    {new Date(notice.publishedDate || notice.createdDate).toLocaleDateString()}
                  </time>
                </div>
                <h3 className="font-serif text-2xl text-stone-900 group-hover:text-[#802334] transition mb-3">
                  {parseInlineFormatting(notice.title)}
                </h3>
                <p className="font-serif text-stone-600 italic text-[14px] leading-relaxed line-clamp-3 mb-3">
                  {parseInlineFormatting(notice.excerpt || notice.content.substring(0, 200) + '...')}
                </p>
                <span className="text-[#802334] hover:underline font-mono text-[10px] uppercase tracking-wider font-semibold">
                  Read Announcement →
                </span>
              </article>
            ))
        )}
      </div>
    </div>
  );
};
