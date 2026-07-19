import React, { useState } from 'react';
import { Search, Globe, FileText, User as UserIcon, BookOpen, Compass } from 'lucide-react';
import { User } from '../../types';
import { db } from '../../db/mockDb';
import { SignatureRenderer } from '../desk/SignatureRenderer';

interface DirectoryProps {
  users: User[];
  onSelectMember: (userId: string, targetTab: 'folio' | 'bio') => void;
}

export function Directory({ users, onSelectMember }: DirectoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | 'Chief Editor' | 'Editor' | 'Writer'>('All');

  // Filter members based on query and role selection
  const filteredUsers = users.filter(u => {
    // Only active (non-suspended) users should show in the directory, or show all? 
    // In a public directory, we don't show suspended accounts, or we just show active ones.
    if (u.suspended) return false;

    const matchesRole = roleFilter === 'All' || u.role === roleFilter;

    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query ||
      u.penName.toLowerCase().includes(query) ||
      u.username.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query) ||
      (u.bioSummary && u.bioSummary.toLowerCase().includes(query));

    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-8">
      {/* Title & Description */}
      <div className="space-y-1 border-b border-[#111111]/10 pb-5">
        <h2 className="font-serif text-2xl font-light text-[#111111] flex items-center gap-2 text-left">
          <Compass className="w-6 h-6 text-[#802334]" />
          Directory
        </h2>
        <p className="font-sans text-[10px] uppercase tracking-widest text-[#111111]/40 text-left">
          A searchable record of all Adjung members, contributors, and the editorial team
        </p>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-200/50 pb-4">
        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <input
            type="text"
            placeholder="Search members by name, role, bio..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-stone-200 p-2 pl-8 rounded text-xs focus:outline-none focus:border-Adjung-maroon font-sans bg-white"
          />
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-3" />
        </div>

        {/* Role Filters */}
        <div className="flex flex-wrap items-center gap-1 text-xs font-mono select-none">
          <span className="text-stone-400 uppercase tracking-wider mr-2 text-[10px]">Filter Role:</span>
          {(['All', 'Chief Editor', 'Editor', 'Writer'] as const).map(role => (
            <button
              key={role}
              type="button"
              onClick={() => setRoleFilter(role)}
              className={`px-3.5 py-1.5 rounded-full text-[11px] transition-all duration-300 cursor-pointer ${
                roleFilter === role
                  ? 'bg-Adjung-maroon/12 text-Adjung-maroon font-semibold border border-Adjung-maroon/20 backdrop-blur-sm shadow-sm shadow-Adjung-maroon/5'
                  : 'text-stone-500 hover:text-Adjung-maroon hover:bg-stone-50 border border-transparent'
              }`}
            >
              {role === 'All' ? 'All Members' : role}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Layout of Scholar Cards */}
      {filteredUsers.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-stone-200 rounded max-w-xl mx-auto">
          <UserIcon className="w-10 h-10 text-stone-300 mx-auto mb-3" />
          <h3 className="font-serif text-stone-700 text-lg">No Members Found</h3>
          <p className="font-sans text-xs text-stone-500 mt-1">
            Try adjusting your search query or role filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredUsers.map(u => {
            const domain = `${u.username}.Adjung.com`;
            return (
              <div
                key={u.id}
                className="bg-white border border-stone-200 rounded-sm p-6 hover:shadow-md hover:border-Adjung-maroon/30 transition duration-300 flex flex-col justify-between text-left relative overflow-hidden group"
              >
                {/* Decorative personal seal top-right */}
                <div className="absolute top-2 right-2 h-16 w-36 flex items-center justify-end mix-blend-multiply opacity-10 group-hover:opacity-20 transition-all pointer-events-none select-none rotate-[-6deg]">
                  {(() => {
                    const sig = db.getIdentityByAccountId(u.id)?.signatures.find(s => s.status === 'Default');
                    return (
                      <SignatureRenderer 
                        strokes={sig?.strokes || []} 
                        type={sig?.type || 'drawn'}
                        typedText={sig?.typedText || u.signature}
                        fontFamily={sig?.fontFamily}
                        typographyStyle={sig?.typographyStyle}
                        className="w-full h-full overflow-visible" 
                        color="#802334" 
                        strokeWidth={2.0} 
                        enableBleed={true}
                      />
                    );
                  })()}
                </div>

                <div className="space-y-3">
                  {/* Pen Name & Role */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif font-semibold text-stone-950 text-base">
                        {u.penName}
                      </h3>
                      <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded tracking-wider ${
                        u.role === 'Chief Editor'
                          ? 'bg-Adjung-maroon text-[#FDFDFD] font-bold'
                          : u.role === 'Editor'
                          ? 'bg-amber-100 text-amber-900 border border-amber-200/50'
                          : 'bg-stone-100 text-stone-600'
                      }`}>
                        {u.role}
                      </span>
                    </div>

                    {(() => {
                      const identity = db.getIdentityByAccountId(u.id);
                      if (identity?.displayName && identity.displayName !== u.penName) {
                        return (
                          <p className="font-sans text-[10px] text-stone-500 font-medium">
                            Real Name: {identity.displayName}
                          </p>
                        );
                      }
                      return null;
                    })()}

                    <p className="font-mono text-[10px] text-stone-400 lowercase leading-none">
                      @{u.username}
                    </p>
                  </div>

                  {/* Personal Subdomain */}
                  <div className="flex items-center gap-1.5 text-stone-500 font-mono text-[10px]">
                    <Globe className="w-3.5 h-3.5 text-stone-300 flex-shrink-0" />
                    <span className="lowercase hover:text-Adjung-maroon select-all">{domain}</span>
                  </div>

                  {/* Biography summary (optional) */}
                  {u.bioSummary ? (
                    <p className="font-serif italic text-stone-600 text-xs leading-relaxed line-clamp-3 pt-1 border-t border-stone-100">
                      {u.bioSummary}
                    </p>
                  ) : (
                    <p className="font-serif italic text-stone-400 text-xs leading-relaxed pt-1 border-t border-stone-100">
                      No biography summary provided yet.
                    </p>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="mt-5 pt-4 border-t border-stone-100 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectMember(u.id, 'folio')}
                    className="flex items-center justify-center gap-1.5 border border-stone-200 hover:border-Adjung-maroon hover:bg-Adjung-maroon/[0.02] text-stone-700 hover:text-Adjung-maroon font-mono text-[10px] uppercase tracking-wider py-1.5 rounded transition cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    View Folio
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectMember(u.id, 'bio')}
                    className="flex items-center justify-center gap-1.5 border border-stone-200 hover:border-Adjung-maroon hover:bg-Adjung-maroon/[0.02] text-stone-700 hover:text-Adjung-maroon font-mono text-[10px] uppercase tracking-wider py-1.5 rounded transition cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    Biography
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
