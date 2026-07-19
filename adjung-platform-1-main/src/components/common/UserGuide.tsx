import React, { useState } from 'react';
import { BookOpen, Key, Compass, Award, CheckCircle, Info, Copy } from 'lucide-react';

export function UserGuide() {
  const [activeTab, setActiveTab] = useState<'philosophy' | 'notation' | 'shortcuts' | 'roadmap'>('philosophy');
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 select-none animate-fade-in text-left">
      {/* Title & Introduction */}
      <div className="text-center mb-10">
        <h1 className="font-serif text-4xl md:text-5xl font-light text-[#802334] tracking-tight mb-3">
          Adjung Scholarly Guide
        </h1>
        <p className="font-serif text-stone-500 italic max-w-xl mx-auto text-sm leading-relaxed">
          Understanding the topology, markup conventions, keyboard shortcuts, and launch path of the Adjung platform.
        </p>
      </div>

      {/* Nav Tabs */}
      <div className="flex border-b border-stone-200/80 mb-8 font-mono text-[10px] uppercase tracking-wider overflow-x-auto whitespace-nowrap">
        <button
          type="button"
          onClick={() => setActiveTab('philosophy')}
          className={`px-4 py-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'philosophy'
              ? 'border-[#802334] text-[#802334] font-bold'
              : 'border-transparent text-stone-550 hover:text-stone-800'
          }`}
        >
          <Compass className="w-3.5 h-3.5" /> Philosophy
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('notation')}
          className={`px-4 py-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'notation'
              ? 'border-[#802334] text-[#802334] font-bold'
              : 'border-transparent text-stone-550 hover:text-stone-800'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" /> 3-Layer Notation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('shortcuts')}
          className={`px-4 py-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'shortcuts'
              ? 'border-[#802334] text-[#802334] font-bold'
              : 'border-transparent text-stone-550 hover:text-stone-800'
          }`}
        >
          <Key className="w-3.5 h-3.5" /> Keyboard Shortcuts
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('roadmap')}
          className={`px-4 py-3 border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
            activeTab === 'roadmap'
              ? 'border-[#802334] text-[#802334] font-bold'
              : 'border-transparent text-stone-550 hover:text-stone-800'
          }`}
        >
          <Award className="w-3.5 h-3.5" /> Pre-Launch Roadmap
        </button>
      </div>

      {/* Tab Content Panels */}
      <div className="bg-[#FDFDFD] border border-stone-200 rounded p-6 md:p-8 shadow-sm">
        {/* TAB 1: PHILOSOPHY */}
        {activeTab === 'philosophy' && (
          <div className="space-y-6 font-serif text-[15px] text-stone-800 leading-relaxed">
            <h3 className="font-serif text-xl font-semibold text-stone-950 border-b border-stone-100 pb-2 mb-4">
              Slow Reading & Scholarly Calm
            </h3>
            
            <p>
              Adjung is designed not as a generic blogging site, but as a digital press for deep, structured scholarship. Unlike modern feeds that capitalize on instant scrolling and superficial reactions, Adjung is built on <strong>restraint</strong>:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-6 font-sans text-xs">
              <div className="p-4 bg-stone-50 border border-stone-200 rounded">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold block mb-1">No Popularity Chase</span>
                <p className="text-stone-600 leading-relaxed">
                  There are no like buttons, view counts, or comment count metrics. Articles are evaluated purely on their substance, structural validity, and logical references.
                </p>
              </div>
              <div className="p-4 bg-stone-50 border border-stone-200 rounded">
                <span className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold block mb-1">Textual Integrity</span>
                <p className="text-stone-600 leading-relaxed">
                  The primary text block remains uncluttered. Secondary dialogic notes live on the right margin, while formal citations and footnotes are anchored neatly at the base of the page.
                </p>
              </div>
            </div>

            <p>
              By giving writers control of their own signature styles and formatting schemas, Adjung functions as a digital scriptorium. Every publication is treated as a permanent addition to humanity’s shared record of knowledge.
            </p>
          </div>
        )}

        {/* TAB 2: 3-LAYER NOTATION */}
        {activeTab === 'notation' && (
          <div className="space-y-6 text-stone-850">
            <div className="border-b border-stone-100 pb-2 mb-4">
              <h3 className="font-serif text-xl font-semibold text-stone-950">The 3-Layer Notation System</h3>
              <p className="font-sans text-[11px] text-stone-500 mt-1">Markdown formatting syntax for interlinear, margin, and bottom footnotes</p>
            </div>

            <div className="space-y-6 font-sans text-xs">
              {/* Note 1: Interlinear */}
              <div className="border border-stone-200 rounded p-4 bg-stone-50/30">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#802334] font-bold">1. Interlinear Glosses (Word Translation)</span>
                  <button 
                    onClick={() => copyToClipboard('[kalimat](gloss:sentence)', 'interlinear')}
                    className="p-1 text-stone-400 hover:text-[#802334] transition flex items-center gap-1 select-none cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="font-mono text-[8px] uppercase tracking-widest">
                      {copiedText === 'interlinear' ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                </div>
                <p className="font-serif text-sm leading-relaxed mb-3 text-stone-800">
                  Used for inline lexical translation or definitions. The translated word is shown in tiny colored script directly above or below the term on hover.
                </p>
                <div className="bg-stone-50 p-2 border border-stone-200 font-mono text-[11px] text-stone-700 rounded select-all mb-2">
                  [kalimat](gloss:sentence)
                </div>
                <div className="text-[10px] text-stone-500 italic font-serif">
                  Renders as: <span className="inline-block border-b border-[#802334]/30 pb-0.5 relative group">kalimat<span className="absolute left-1/2 -translate-x-1/2 -top-3.5 text-[9px] font-mono text-[#802334] whitespace-nowrap bg-white px-0.5 leading-none">sentence</span></span>
                </div>
              </div>

              {/* Note 2: Margin Note */}
              <div className="border border-stone-200 rounded p-4 bg-stone-50/30">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#802334] font-bold">2. Margin Notes (Contextual Commentary)</span>
                  <button 
                    onClick={() => copyToClipboard('[^mn-1]', 'margin')}
                    className="p-1 text-stone-400 hover:text-[#802334] transition flex items-center gap-1 select-none cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="font-mono text-[8px] uppercase tracking-widest">
                      {copiedText === 'margin' ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                </div>
                <p className="font-serif text-sm leading-relaxed mb-3 text-stone-800">
                  Places secondary commentary or active dialogue in the margins of Articles.
                </p>
                <div className="bg-stone-50 p-2 border border-stone-200 font-mono text-[11px] text-stone-700 rounded select-all mb-2">
                  Add [^mn-1] anywhere in the paragraph text to link it to the margin note.
                </div>
              </div>

              {/* Note 3: Footnote */}
              <div className="border border-stone-200 rounded p-4 bg-stone-50/30">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-3">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[#802334] font-bold">3. Bottom Footnotes (Citations)</span>
                  <button 
                    onClick={() => copyToClipboard('[^fn-1]', 'footnote')}
                    className="p-1 text-stone-400 hover:text-[#802334] transition flex items-center gap-1 select-none cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span className="font-mono text-[8px] uppercase tracking-widest">
                      {copiedText === 'footnote' ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                </div>
                <p className="font-serif text-sm leading-relaxed mb-3 text-stone-800">
                  Links specific paragraphs to formal academic bibliographies at the bottom of Essays or Articles.
                </p>
                <div className="bg-stone-50 p-2 border border-stone-200 font-mono text-[11px] text-stone-700 rounded select-all mb-2">
                  Insert [^fn-1] in your text. Click the footnote badge to view or edit the citation.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: KEYBOARD SHORTCUTS */}
        {activeTab === 'shortcuts' && (
          <div className="space-y-6 text-stone-850">
            <div className="border-b border-stone-100 pb-2 mb-4">
              <h3 className="font-serif text-xl font-semibold text-stone-950">Academic Transliteration Shortcuts</h3>
              <p className="font-sans text-[11px] text-stone-500 mt-1">Planned standard mapping for keyboard-friendly scholarly transliteration</p>
            </div>

            <div className="bg-amber-50/40 border border-amber-200 rounded p-4 flex gap-3 text-xs leading-normal font-sans text-stone-700 mb-6">
              <Info className="w-5 h-5 text-amber-700 flex-shrink-0" />
              <div>
                <strong>Notice:</strong> These Alt-key bindings will be natively enabled in the Writing Desk starting in **Fasa 2**. Use them as a reference sheet during composition.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse border border-stone-200 font-sans text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 font-mono text-[9px] uppercase tracking-wider text-stone-500">
                    <th className="p-3 pl-4">Target Character</th>
                    <th className="p-3">Keys Combination</th>
                    <th className="p-3">Character Name / Arabic Letter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-150 text-stone-700 font-mono">
                  <tr className="hover:bg-stone-50/30 transition">
                    <td className="p-3 pl-4 font-serif text-base font-bold text-stone-900">ā</td>
                    <td className="p-3">Alt + A</td>
                    <td className="p-3 font-sans text-xs">A-macron (Long a / Alif)</td>
                  </tr>
                  <tr className="hover:bg-stone-50/30 transition">
                    <td className="p-3 pl-4 font-serif text-base font-bold text-stone-900">ī</td>
                    <td className="p-3">Alt + I</td>
                    <td className="p-3 font-sans text-xs">I-macron (Long i / Ya)</td>
                  </tr>
                  <tr className="hover:bg-stone-50/30 transition">
                    <td className="p-3 pl-4 font-serif text-base font-bold text-stone-900">ū</td>
                    <td className="p-3">Alt + U</td>
                    <td className="p-3 font-sans text-xs">U-macron (Long u / Waw)</td>
                  </tr>
                  <tr className="hover:bg-stone-50/30 transition">
                    <td className="p-3 pl-4 font-serif text-base font-bold text-stone-900">ḥ</td>
                    <td className="p-3">Alt + H</td>
                    <td className="p-3 font-sans text-xs">H-dot (Ha / ح)</td>
                  </tr>
                  <tr className="hover:bg-stone-50/30 transition">
                    <td className="p-3 pl-4 font-serif text-base font-bold text-stone-900">ṣ</td>
                    <td className="p-3">Alt + S</td>
                    <td className="p-3 font-sans text-xs">S-dot (Sad / ص)</td>
                  </tr>
                  <tr className="hover:bg-stone-50/30 transition">
                    <td className="p-3 pl-4 font-serif text-base font-bold text-stone-900">ḍ</td>
                    <td className="p-3">Alt + D</td>
                    <td className="p-3 font-sans text-xs">D-dot (Dad / ض)</td>
                  </tr>
                  <tr className="hover:bg-stone-50/30 transition">
                    <td className="p-3 pl-4 font-serif text-base font-bold text-stone-900">ṭ</td>
                    <td className="p-3">Alt + T</td>
                    <td className="p-3 font-sans text-xs">T-dot (Ta / ط)</td>
                  </tr>
                  <tr className="hover:bg-stone-50/30 transition">
                    <td className="p-3 pl-4 font-serif text-base font-bold text-stone-900">ẓ</td>
                    <td className="p-3">Alt + Z</td>
                    <td className="p-3 font-sans text-xs">Z-dot (Za / ظ)</td>
                  </tr>
                  <tr className="hover:bg-stone-50/30 transition">
                    <td className="p-3 pl-4 font-serif text-base font-bold text-stone-900">‘</td>
                    <td className="p-3">Alt + C</td>
                    <td className="p-3 font-sans text-xs">Left single quotation mark (Ayn / ع)</td>
                  </tr>
                  <tr className="hover:bg-stone-50/30 transition">
                    <td className="p-3 pl-4 font-serif text-base font-bold text-stone-900">’</td>
                    <td className="p-3">Alt + G</td>
                    <td className="p-3 font-sans text-xs">Right single quotation mark (Hamzah / ء)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 4: PRE-LAUNCH ROADMAP */}
        {activeTab === 'roadmap' && (
          <div className="space-y-6 text-stone-850">
            <div className="border-b border-stone-100 pb-2 mb-4">
              <h3 className="font-serif text-xl font-semibold text-stone-950">Pre-Launch Roadmap</h3>
              <p className="font-sans text-[11px] text-stone-500 mt-1">Official developmental milestones leading to launching the platform</p>
            </div>

            <div className="space-y-6 font-sans text-xs leading-relaxed max-w-2xl">
              {/* Milestone 1 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="w-5 h-5 rounded-full bg-emerald-50 border border-emerald-250 text-emerald-800 flex items-center justify-center font-bold text-[10px] flex-shrink-0 select-none">
                    A
                  </span>
                  <div className="w-px h-full bg-stone-200 mt-1" />
                </div>
                <div className="pb-4">
                  <h4 className="font-serif text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                    Milestone A: Scholarly Archetypes & Digital Twin 
                    <span className="font-mono text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold uppercase">Completed</span>
                  </h4>
                  <p className="text-stone-550 mt-1">
                    Design and verify specific presentation frameworks (Note, Essay, Article), visual SSoT dependency tracking inside Architecture Studio, and matrix validations.
                  </p>
                </div>
              </div>

              {/* Milestone 2 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="w-5 h-5 rounded-full bg-[#802334] text-white flex items-center justify-center font-bold text-[10px] flex-shrink-0 select-none">
                    B
                  </span>
                  <div className="w-px h-full bg-stone-200 mt-1" />
                </div>
                <div className="pb-4">
                  <h4 className="font-serif text-sm font-semibold text-stone-900 flex items-center gap-1.5">
                    Milestone B: Localization, Arabic RTL & Keyboards 
                    <span className="font-mono text-[8px] bg-[#802334]/10 text-[#802334] border border-[#802334]/20 px-1.5 py-0.5 rounded font-bold uppercase">Next Up</span>
                  </h4>
                  <p className="text-stone-550 mt-1">
                    Establish stable RTL layout margins for full-length Arabic manuscripts and incorporate Alt-key transliteration bindings inside the editing canvas.
                  </p>
                </div>
              </div>

              {/* Milestone 3 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0 select-none">
                    C
                  </span>
                  <div className="w-px h-full bg-stone-200 mt-1" />
                </div>
                <div className="pb-4">
                  <h4 className="font-serif text-sm font-semibold text-stone-900">Milestone C: Dialogic Commentary & Citing Responses</h4>
                  <p className="text-stone-550 mt-1">
                    Enable authors to cross-quote specific blocks/paragraphs from other essays to compile relational cross-commentaries in their local folios.
                  </p>
                </div>
              </div>

              {/* Milestone 4 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0 select-none">
                    D
                  </span>
                  <div className="w-px h-full bg-stone-200 mt-1" />
                </div>
                <div className="pb-4">
                  <h4 className="font-serif text-sm font-semibold text-stone-900">Milestone D: Platform Logs, Notifier & Share Cards</h4>
                  <p className="text-stone-550 mt-1">
                    Launch platform notification broadcasts and add a graphical poster generator for mobile downloads and social card previews.
                  </p>
                </div>
              </div>

              {/* Milestone 5 */}
              <div className="flex gap-4">
                <div className="flex flex-col items-center">
                  <span className="w-5 h-5 rounded-full bg-stone-200 text-stone-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0 select-none">
                    E
                  </span>
                </div>
                <div>
                  <h4 className="font-serif text-sm font-semibold text-stone-900">Milestone E: Audit, Hardening & Launch Invitation</h4>
                  <p className="text-stone-550 mt-1">
                    Conduct security reviews of private keys signatures, implement backup structures, configure invite-only registrations, and deploy to staging for production launch.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
