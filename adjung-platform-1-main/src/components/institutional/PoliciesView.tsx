import React, { useState } from 'react';
import { PolicyDocument } from '../../types';

interface PoliciesViewProps {
  policies: PolicyDocument[];
}

export const PoliciesView: React.FC<PoliciesViewProps> = ({ policies }) => {
  const [selectedPolicyId, setSelectedPolicyId] = useState(policies[0]?.id || '');
  const currentPolicy = policies.find((p) => p.id === selectedPolicyId);
  return (
    <div className="max-w-5xl mx-auto py-10 text-left">
      <header className="border-b border-[#111111]/10 pb-6 mb-10">
        <span className="block font-mono text-[9px] uppercase tracking-[0.25em] text-[#802334] mb-2">
          Platform Governance
        </span>
        <h1 className="font-serif text-4xl font-light text-stone-900 leading-tight">
          Publishing & Platform Policies
        </h1>
        <p className="font-serif italic text-stone-500 text-sm mt-2">
          Constitution, editorial covenants, and guidelines governing the Adjung repository.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sidebar Navigation */}
        <aside className="md:col-span-1 border-r border-stone-200/60 pr-4 space-y-1">
          <span className="block font-mono text-[8px] uppercase tracking-wider text-stone-400 mb-3 px-2">
            Policy Documents
          </span>
          {policies.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPolicyId(p.id)}
              className={`w-full text-left px-3 py-2 rounded-sm text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                selectedPolicyId === p.id
                  ? 'bg-[#802334]/8 text-[#802334] font-semibold border-l-2 border-[#802334]'
                  : 'text-stone-500 hover:text-stone-850 hover:bg-stone-50'
              }`}
            >
              {p.title}
            </button>
          ))}
        </aside>

        {/* Main Content Area */}
        <section className="md:col-span-3 min-h-[300px]">
          {currentPolicy ? (
            <div className="space-y-6">
              <div className="border-b border-stone-100 pb-4">
                <h2 className="font-serif text-2xl md:text-3xl text-stone-900">
                  {currentPolicy.title}
                </h2>
                <div className="flex gap-4 mt-2 font-mono text-[9px] text-stone-400">
                  <span>
                    Last Updated: {new Date(currentPolicy.lastUpdated).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="space-y-8 mt-6">
                {currentPolicy.sections &&
                  currentPolicy.sections.map((section) => (
                    <div key={section.id} className="space-y-2">
                      <h3 className="font-serif text-lg font-semibold text-stone-900 border-b border-stone-100/50 pb-1.5">
                        {section.title}
                      </h3>
                      <p className="font-serif text-stone-700 text-[14.5px] leading-relaxed whitespace-pre-wrap">
                        {section.content}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <p className="italic text-stone-400 font-serif">
              Select a policy document from the sidebar to read.
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
