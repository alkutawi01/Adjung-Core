import React, { useState } from 'react';

// ============================================================================
// SPEC-042 AUTHORITATIVE DOMAIN MODEL INTERFACES (FROZEN v1.0)
// ============================================================================

export interface EditorialDesk {
  id: string;
  name: string;
  slug: string;
  parentDeskId?: string;
  canonical: boolean;
  status: 'Active' | 'Deprecated';
}

export interface EditorialRule {
  id: string;
  priority: number;
  primaryDeskId: string;
  secondaryDeskIds: string[];
  keywords: string[];
  negativeKeywords: string[];
  confidence: number;
  status: 'Draft' | 'Active' | 'Deprecated';
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgePack {
  id: string;
  name: string;
  version: string;
  deskIds: string[];
  ruleIds: string[];
  status: 'Active' | 'Draft' | 'Deprecated';
}

export interface CalibrationProject {
  id: string;
  name: string;
  type: 'ACEF' | 'GoldSet' | 'RegressionSet' | 'Snapshot';
  activeDatasetId: string;
  versionTag: string;
  author: string;
  createdAt: string;
  status: 'Active' | 'Archived';
}

export interface Dataset {
  id: string;
  projectId: string;
  versionTag: string;
  recordCount: number;
  source: string;
  checksum: string;
  createdAt: string;
}

export interface ExperimentResult {
  accuracy: number;
  precision: number;
  recall: number;
  coverage: number;
  f1Score?: number;
  deltaPercent?: number;
}

export interface Experiment {
  id: string;
  projectId: string;
  name: string;
  datasetId: string;
  rulePackIds: string[];
  result?: ExperimentResult;
  status: 'Draft' | 'Running' | 'Completed';
}

export interface ReleaseRecord {
  releaseId: string;
  projectId: string;
  experimentId: string;
  engineVersion: string;
  versionTag: string;
  status: 'Draft' | 'Candidate' | 'Production' | 'Archived';
  regressionPassRate: number;
  deployedAt: string;
}

export interface CandidateDesk {
  deskId: string;
  score: number;
  ruleId: string;
}

export interface DecisionNode {
  id: string;
  parentId?: string;
  type: 'Rule' | 'Desk' | 'Entity';
  label: string;
  score: number;
  selected: boolean;
}

export interface CanonicalDecisionTrace {
  inputId: string;
  title: string;
  engineVersion: string;
  keyword: string;
  candidateDesks: CandidateDesk[];
  canonicalDeskId: string;
  resolvedBy: {
    type: 'Rule' | 'Keyword' | 'Entity';
    id: string;
  };
  confidencePercent: number;
  decisionTree: DecisionNode[];
}

// ============================================================================
// MOCK DOMAIN REPOSITORY DATA
// ============================================================================

const SAMPLE_DATASETS: Record<string, Dataset> = {
  'ds-01': { id: 'ds-01', projectId: 'proj-01', versionTag: 'ACEF-v1.0', recordCount: 254, source: 'RSS Direct Engine', checksum: 'sha256-a812f', createdAt: '2026-07-23' },
  'ds-02': { id: 'ds-02', projectId: 'proj-02', versionTag: 'Gold-v2.1', recordCount: 1200, source: 'Editorial Gold Corpus', checksum: 'sha256-b941c', createdAt: '2026-06-15' },
};

const SAMPLE_PROJECTS: CalibrationProject[] = [
  { id: 'proj-01', name: 'ACEF July 2026 Project', type: 'ACEF', activeDatasetId: 'ds-01', author: 'Chief Editor (Izzat)', versionTag: 'v3.2.0-canonical', createdAt: '2026-07-23', status: 'Active' },
  { id: 'proj-02', name: 'Editorial Gold Corpus 2026', type: 'GoldSet', activeDatasetId: 'ds-02', author: 'Research Desk', versionTag: 'v3.1.0-gold', createdAt: '2026-06-15', status: 'Active' },
];

const SAMPLE_EXPERIMENTS: Experiment[] = [
  { id: 'EXP-001', projectId: 'proj-01', datasetId: 'ds-01', name: 'Baseline Rules Evaluation', rulePackIds: ['pack-canon'], result: { accuracy: 91.2, precision: 92.0, recall: 90.5, coverage: 97.0, deltaPercent: 0.0 }, status: 'Completed' },
  { id: 'EXP-002', projectId: 'proj-01', datasetId: 'ds-01', name: 'Penambahan Rule NASA & Exoplanet', rulePackIds: ['pack-canon', 'pack-tech'], result: { accuracy: 94.8, precision: 95.1, recall: 93.8, coverage: 98.4, deltaPercent: +3.6 }, status: 'Completed' },
];

const SAMPLE_CANONICAL_TRACE: CanonicalDecisionTrace = {
  inputId: 'inp-8841',
  title: 'NASA menemui exoplanet mempunyai atmosfera air luar sistem suria',
  engineVersion: 'AEIE-v3.2',
  keyword: 'NASA',
  candidateDesks: [
    { deskId: 'desk-sains', score: 85, ruleId: 'rule-sci-04' },
    { deskId: 'desk-astro', score: 92, ruleId: 'rule-astro-12' }
  ],
  canonicalDeskId: 'desk-astro',
  resolvedBy: { type: 'Rule', id: 'rule-astro-12' },
  confidencePercent: 92,
  decisionTree: [
    { id: 'node-1', type: 'Entity', label: 'Tokenization ["NASA", "exoplanet"]', score: 0, selected: true },
    { id: 'node-2', parentId: 'node-1', type: 'Rule', label: 'Rule-astro-12 Match (+92pt)', score: 92, selected: true },
    { id: 'node-3', parentId: 'node-2', type: 'Desk', label: 'Resolved: Desk Astronomi', score: 92, selected: true }
  ]
};

const SAMPLE_RELEASES: ReleaseRecord[] = [
  { releaseId: 'rel-104', projectId: 'proj-01', experimentId: 'EXP-002', engineVersion: 'AEIE-v3.2', versionTag: 'v3.2.0-canonical', regressionPassRate: 100, status: 'Production', deployedAt: '2026-07-22' },
  { releaseId: 'rel-103', projectId: 'proj-01', experimentId: 'EXP-001', engineVersion: 'AEIE-v3.1', versionTag: 'v3.1.5-beta', regressionPassRate: 98.4, status: 'Candidate', deployedAt: '2026-07-18' }
];

export const EditorialIntelligencePlatform: React.FC = () => {
  const [activePillar, setActivePillar] = useState<'project' | 'engine' | 'validation' | 'release'>('project');
  const [activeSubTab, setActiveSubTab] = useState<string>('projects');

  const [selectedProject, setSelectedProject] = useState<CalibrationProject>(SAMPLE_PROJECTS[0]);

  // Health Index Formula calculation
  const metrics = { accuracy: 94.2, coverage: 98.4, canonicalMatch: 99.1, conflictPenalty: 4.2, latencyRating: 95.0 };
  const calculatedHealthIndex = ((metrics.accuracy * 0.35) + (metrics.coverage * 0.20) + (metrics.canonicalMatch * 0.20) - (metrics.conflictPenalty * 0.15) + (metrics.latencyRating * 0.10)).toFixed(1);

  return (
    <div className="space-y-6 font-sans text-xs text-stone-900">
      {/* HEADER BANNER */}
      <div className="bg-stone-900 text-stone-100 p-4 rounded-lg shadow-md border border-stone-800 flex flex-wrap justify-between items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-[#802334] text-[#E9D8A6] font-bold text-[10px] px-2 py-0.5 rounded tracking-widest uppercase">
              AEOS SUBSYSTEM • ARCHITECTURE FROZEN v1.0
            </span>
            <h1 className="font-serif text-base font-bold text-white tracking-wide">
              Adjung Editorial Intelligence Platform (AEIP)
            </h1>
          </div>
          <p className="text-stone-400 text-xs mt-1">
            Platform Kejuruteraan Sub-Sistem AEIP Bagi Pembangunan, Validasi, Graph Ontologi & Pelepasan Enjin AEIE.
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-right">
            <span className="text-stone-400 block text-[10px] uppercase">Engine Release Tag</span>
            <span className="text-emerald-400 font-bold">{selectedProject.versionTag}</span>
          </div>
        </div>
      </div>

      {/* MAIN PLATFORM LAYOUT */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* SIDEBAR: CALCULATED ENGINE HEALTH SCORE */}
        <div className="md:col-span-3 space-y-4 font-sans">
          <div className="bg-white p-5 rounded-lg border border-stone-200 shadow-xs space-y-4">
            <div className="border-b border-stone-100 pb-3 flex justify-between items-center">
              <h2 className="font-bold text-stone-900 uppercase tracking-wider text-[11px]">
                📊 ENGINE HEALTH INDEX
              </h2>
              <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                EXCELLENT
              </span>
            </div>

            <div className="bg-stone-900 text-stone-100 p-4 rounded-md text-center space-y-1">
              <span className="text-stone-400 text-[10px] uppercase tracking-wider block">Calculated Health Index</span>
              <div className="text-3xl font-serif font-bold text-[#E9D8A6]">{calculatedHealthIndex} <span className="text-xs text-stone-400">/ 100</span></div>
              <p className="text-[10px] text-stone-400 pt-1 border-t border-stone-800">
                Formula: (Acc×0.35) + (Cov×0.2) + (Match×0.2) - (Pen×0.15) + (Lat×0.1)
              </p>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-stone-600">Accuracy (Acc)</span>
                <span className="font-mono font-bold text-emerald-700">{metrics.accuracy}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-stone-600">Coverage (Cov)</span>
                <span className="font-mono font-bold text-emerald-700">{metrics.coverage}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4-PILLAR WORKSPACE CONTENT AREA */}
        <div className="md:col-span-9 space-y-4">
          
          {/* MAIN PILLAR SWITCHER */}
          <div className="bg-white p-2 rounded-lg border border-stone-200 shadow-2xs flex flex-wrap gap-2">
            <button
              onClick={() => { setActivePillar('project'); setActiveSubTab('projects'); }}
              className={`px-4 py-2 font-bold rounded-md transition-colors text-xs flex items-center gap-2 cursor-pointer ${
                activePillar === 'project' ? 'bg-[#802334] text-white shadow-xs' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span>📁</span> 1. PROJECT & DATASET MANAGER
            </button>

            <button
              onClick={() => { setActivePillar('engine'); setActiveSubTab('packs'); }}
              className={`px-4 py-2 font-bold rounded-md transition-colors text-xs flex items-center gap-2 cursor-pointer ${
                activePillar === 'engine' ? 'bg-[#802334] text-white shadow-xs' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span>⚙️</span> 2. KNOWLEDGE PACKS & REASONER
            </button>

            <button
              onClick={() => { setActivePillar('validation'); setActiveSubTab('audit'); }}
              className={`px-4 py-2 font-bold rounded-md transition-colors text-xs flex items-center gap-2 cursor-pointer ${
                activePillar === 'validation' ? 'bg-[#802334] text-white shadow-xs' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span>🔍</span> 3. VALIDATION & REGRESSION
            </button>

            <button
              onClick={() => { setActivePillar('release'); setActiveSubTab('deploy'); }}
              className={`px-4 py-2 font-bold rounded-md transition-colors text-xs flex items-center gap-2 cursor-pointer ${
                activePillar === 'release' ? 'bg-[#802334] text-white shadow-xs' : 'bg-stone-50 text-stone-600 hover:bg-stone-100'
              }`}
            >
              <span>🚀</span> 4. RELEASE MANAGER
            </button>
          </div>

          {/* PILLAR 1: PROJECT MANAGER */}
          {activePillar === 'project' && (
            <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-6">
              <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                <div>
                  <h2 className="font-bold text-stone-900 uppercase tracking-wider text-xs flex items-center gap-2">
                    <span>📁</span> CALIBRATION PROJECTS & DATASETS REPOSITORY
                  </h2>
                  <p className="text-stone-500 text-xs mt-0.5">
                    Model SPEC-042: Penormalan Entiti Domain & Value Objects.
                  </p>
                </div>

                <div className="flex gap-2">
                  <button className="bg-[#802334] hover:bg-[#962d42] text-white font-semibold px-3 py-1.5 rounded text-xs transition-colors shadow-2xs">
                    📤 Export ACEF Dataset (.txt)
                  </button>
                </div>
              </div>

              {/* Projects List */}
              <div className="overflow-x-auto border border-stone-200 rounded">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-stone-100 border-b border-stone-200 text-stone-700 uppercase font-bold text-[10px]">
                    <tr>
                      <th className="p-2.5">Project ID & Name</th>
                      <th className="p-2.5">Dataset ID Rujukan</th>
                      <th className="p-2.5">Bilangan Rekod</th>
                      <th className="p-2.5">Pengarang</th>
                      <th className="p-2.5">Version Tag</th>
                      <th className="p-2.5 text-right">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {SAMPLE_PROJECTS.map(proj => {
                      const ds = SAMPLE_DATASETS[proj.activeDatasetId];
                      return (
                        <tr key={proj.id} className={selectedProject.id === proj.id ? 'bg-amber-50/60' : 'hover:bg-stone-50'}>
                          <td className="p-2.5 font-bold text-stone-900">{proj.name}</td>
                          <td className="p-2.5 font-mono text-stone-600">{proj.activeDatasetId}</td>
                          <td className="p-2.5 font-mono">{ds ? ds.recordCount : 0} berita</td>
                          <td className="p-2.5 text-stone-600">{proj.author}</td>
                          <td className="p-2.5 font-mono text-emerald-700 font-bold">{proj.versionTag}</td>
                          <td className="p-2.5 text-right">
                            <button onClick={() => setSelectedProject(proj)} className="bg-stone-800 text-white px-2.5 py-1 rounded text-[11px] font-semibold">Pilih Project</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* PILLAR 2: ENGINE & REASONER */}
          {activePillar === 'engine' && (
            <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-6">
              <div className="bg-stone-900 text-stone-100 p-4 rounded-lg space-y-3 font-mono text-xs">
                <div className="flex justify-between items-center border-b border-stone-800 pb-2">
                  <span className="text-[#E9D8A6] font-bold">CANONICAL DECISION TREE REASONER (EXPLAINABLE TRACE)</span>
                  <span className="text-stone-400">Engine Version: {SAMPLE_CANONICAL_TRACE.engineVersion}</span>
                </div>

                <p className="text-white font-serif text-sm font-bold pt-0.5">"{SAMPLE_CANONICAL_TRACE.title}"</p>

                <div className="pt-2 space-y-1.5">
                  <span className="text-stone-400 text-[10px] uppercase font-bold block">Decision Tree Nodes:</span>
                  {SAMPLE_CANONICAL_TRACE.decisionTree.map(node => (
                    <div key={node.id} className="bg-stone-800 p-2 rounded border border-stone-700 flex gap-2 items-center text-[11px]">
                      <span className="bg-[#802334] text-white px-2 py-0.5 rounded text-[10px] font-bold">{node.type}</span>
                      <span className="text-stone-200">{node.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PILLAR 3: VALIDATION */}
          {activePillar === 'validation' && (
            <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4">
              <h2 className="font-bold text-stone-900 text-xs uppercase">VALIDATION & REGRESSION CI/CD GATE</h2>
              <div className="bg-emerald-50 border border-emerald-300 p-4 rounded text-xs text-emerald-900 space-y-1">
                <strong>✓ Regression Quality Gate Passed (100%)</strong>
                <p className="text-[11px]">Ujian regresi automatik mengesahkan tiada sebarang degradasi klasifikasi pada dataset {selectedProject.name}.</p>
              </div>
            </div>
          )}

          {/* PILLAR 4: RELEASE MANAGER */}
          {activePillar === 'release' && (
            <div className="bg-white p-6 rounded-lg border border-stone-200 space-y-4">
              <h2 className="font-bold text-stone-900 text-xs uppercase">RELEASE REPOSITORY MANAGER</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SAMPLE_RELEASES.map(rel => (
                  <div key={rel.releaseId} className="p-4 rounded border border-stone-200 bg-stone-50 space-y-2">
                    <div className="flex justify-between items-center font-mono text-xs">
                      <span className="font-bold text-stone-900">{rel.versionTag} ({rel.engineVersion})</span>
                      <span className="bg-emerald-800 text-white text-[10px] px-2 py-0.5 rounded uppercase font-bold">{rel.status}</span>
                    </div>
                    <div className="text-[11px] text-stone-600">
                      <div>Project ID: {rel.projectId}</div>
                      <div>Experiment ID: {rel.experimentId}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default EditorialIntelligencePlatform;
