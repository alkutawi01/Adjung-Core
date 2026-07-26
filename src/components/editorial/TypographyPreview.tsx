import React, { useState } from 'react';
import { FlaskConical } from 'lucide-react';
import { TypographyRenderer, TypographyRule } from './TypographyRenderer';

export const TypographyPreview: React.FC<{
  rules: TypographyRule[];
}> = ({ rules }) => {
  const [sampleText, setSampleText] = useState<string>(
    'Banglo tiga tingkat jadi markas 40 scammer kena serbu polis dalam kes phishing bernilai jutaan ringgit.'
  );
  const [targetScope, setTargetScope] = useState<string>('all');

  return (
    <div className="p-3 bg-amber-50/60 border border-amber-200 rounded space-y-2">
      <div className="flex justify-between items-center">
        <label className="font-mono text-[10px] uppercase font-bold text-amber-900 tracking-wider flex items-center gap-1.5">
          <FlaskConical className="w-3.5 h-3.5" strokeWidth={2} />
          <span>Pratonton Tipografi Langsung</span>
        </label>
        <select
          value={targetScope}
          onChange={(e) => setTargetScope(e.target.value)}
          className="px-2 py-0.5 text-[10px] font-mono border border-amber-300 rounded bg-white"
        >
          <option value="all">Semua Skop</option>
          <option value="title">Tajuk</option>
          <option value="brief">Huraian</option>
          <option value="body">Kandungan</option>
        </select>
      </div>

      <input
        type="text"
        value={sampleText}
        onChange={(e) => setSampleText(e.target.value)}
        placeholder="Taip sampel ayat untuk diuji..."
        className="w-full px-2.5 py-1.5 border border-stone-300 rounded font-serif text-xs bg-white"
      />

      <div className="p-2.5 bg-white border border-stone-200 rounded min-h-[38px] flex items-center">
        <span className="font-mono text-[9px] text-stone-400 mr-2 shrink-0">HASIL:</span>
        <TypographyRenderer
          text={sampleText}
          rules={rules}
          scope={targetScope}
          className="font-serif text-xs md:text-sm text-stone-900 leading-relaxed"
        />
      </div>
    </div>
  );
};
