import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  Handle,
  Position,
  BackgroundVariant
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, BookOpen, FileCode, Link, Info, ShieldAlert } from 'lucide-react';

// --- CUSTOM NODE COMPONENTS ---

// Concept Node (Standard Knowledge Graph Node matching Adjung UI)
const ConceptNode = ({ data, selected }: any) => {
  return (
    <div className={`px-5 py-3 shadow-lg rounded bg-white border transition-all min-w-[180px] text-center select-none ${
      selected 
        ? 'border-[#802334] ring-2 ring-[#802334]/20 scale-105' 
        : 'border-stone-200 hover:border-stone-400'
    }`}>
      <Handle type="target" position={Position.Top} className="w-2.5 h-2.5 bg-stone-300 border-white" />
      <div className="font-mono text-[8px] uppercase tracking-wider text-stone-450 mb-1 font-semibold">
        Platform Concept
      </div>
      <div className="font-serif text-base font-semibold text-stone-900 leading-tight">
        {data.label}
      </div>
      <div className="font-mono text-[8px] text-stone-400 mt-1.5 italic select-all">{data.spec}</div>
      <Handle type="source" position={Position.Bottom} className="w-2.5 h-2.5 bg-[#802334] border-white" />
    </div>
  );
};

const nodeTypes = {
  conceptNode: ConceptNode,
};

// --- STATIC KNOWLEDGE MODEL DATA ---

const initialNodes: Node[] = [
  { 
    id: 'publication', 
    type: 'conceptNode', 
    position: { x: 380, y: 160 }, 
    data: { 
      label: 'Publication', 
      desc: 'Core document entity (Note, Essay, Article, Notice, Editor\'s Note).', 
      purpose: 'Represents the primary scholarly record containing text layers, footnotes, and signatures.', 
      spec: 'SPEC-007', 
      dbEntity: 'entries', 
      files: ['src/types.ts', 'src/components/EntryRenderer.tsx'] 
    } 
  },
  { 
    id: 'author', 
    type: 'conceptNode', 
    position: { x: 120, y: 50 }, 
    data: { 
      label: 'Author', 
      desc: 'Scholarly contributor profile and key owner.', 
      purpose: 'Identifies the creator of publications, holds public profile details and handwritten signature strokes.', 
      spec: 'SPEC-006', 
      dbEntity: 'users, profiles', 
      files: ['src/types.ts', 'src/components/FolioView.tsx'] 
    } 
  },
  { 
    id: 'writing-desk', 
    type: 'conceptNode', 
    position: { x: 120, y: 260 }, 
    data: { 
      label: 'Writing Desk', 
      desc: 'Authoring workspace and markdown editor.', 
      purpose: 'Provides the environment for drafting, formatting, right-clicking to insert annotations, and signing entries.', 
      spec: 'SPEC-008', 
      dbEntity: 'entries (Draft status)', 
      files: ['src/components/WritingDesk.tsx', 'src/utils.tsx'] 
    } 
  },
  { 
    id: 'editorium', 
    type: 'conceptNode', 
    position: { x: 620, y: 260 }, 
    data: { 
      label: 'Editorium', 
      desc: 'Editorial board workspace and configuration desk.', 
      purpose: 'Allows Chief Editors to manage users, roles, Frontpage curations, and inspect platform topology / Reference Library.', 
      spec: 'SPEC-011', 
      dbEntity: 'systemSettings, logs', 
      files: ['src/components/Editorium.tsx', 'src/components/ReferenceLibrary.tsx'] 
    } 
  },
  { 
    id: 'frontpage', 
    type: 'conceptNode', 
    position: { x: 380, y: 400 }, 
    data: { 
      label: 'Frontpage', 
      desc: 'Public portal for exploring curated publications.', 
      purpose: 'Renders the landing view, editorial picks, headlines, and calligraphic tag seals.', 
      spec: 'SPEC-013', 
      dbEntity: 'entries (Published status), systemSettings', 
      files: ['src/components/FrontpageView.tsx', 'src/components/LandingView.tsx'] 
    } 
  },
  { 
    id: 'folio', 
    type: 'conceptNode', 
    position: { x: 120, y: 450 }, 
    data: { 
      label: 'Folio', 
      desc: 'Author-specific continuous archive timeline.', 
      purpose: 'Displays a chronological feed of a single scholar\'s verified publications and biography.', 
      spec: 'SPEC-009', 
      dbEntity: 'entries (Published status)', 
      files: ['src/components/FolioView.tsx'] 
    } 
  },
  { 
    id: 'rbac', 
    type: 'conceptNode', 
    position: { x: 620, y: 50 }, 
    data: { 
      label: 'RBAC Policies', 
      desc: 'Role-Based Access Control configuration.', 
      purpose: 'Defines roles (Chief Editor, Editor, Writer, Visitor) and maps permissions to platform actions.', 
      spec: 'SPEC-014', 
      dbEntity: 'systemSettings.rolePermissions', 
      files: ['src/App.tsx'] 
    } 
  },
  { 
    id: 'biography', 
    type: 'conceptNode', 
    position: { x: 120, y: -100 }, 
    data: { 
      label: 'Biography', 
      desc: 'Author biographical narrative and timeline.', 
      purpose: 'Stores educational background, academic affiliations, and scholarship statements.', 
      spec: 'SPEC-010', 
      dbEntity: 'profiles', 
      files: ['src/components/BiographyView.tsx'] 
    } 
  },
  { 
    id: 'search-index', 
    type: 'conceptNode', 
    position: { x: 620, y: 450 }, 
    data: { 
      label: 'Search Index', 
      desc: 'Cross-document scholarly directory index.', 
      purpose: 'Allows searching publications by keywords, tags, or cross-referenced authors.', 
      spec: 'SPEC-012', 
      dbEntity: 'entries', 
      files: ['src/components/EditorialIndex.tsx'] 
    } 
  },
  { 
    id: 'metadata', 
    type: 'conceptNode', 
    position: { x: 380, y: -60 }, 
    data: { 
      label: 'Metadata Schema', 
      desc: 'Scholarly cataloging schema standards.', 
      purpose: 'Governs tags, citation styles (Harvard, APA, MLA), reading times, and XML export formats.', 
      spec: 'SPEC-017', 
      dbEntity: 'citations', 
      files: ['src/utils.tsx'] 
    } 
  }
];

const initialEdges: Edge[] = [
  { id: 'e-pub-author', source: 'publication', target: 'author', label: 'belongs to', style: { stroke: '#802334', strokeWidth: 1.5 }, animated: true },
  { id: 'e-pub-desk', source: 'publication', target: 'writing-desk', label: 'edited by', style: { stroke: '#802334', strokeWidth: 1.5 } },
  { id: 'e-pub-editorium', source: 'publication', target: 'editorium', label: 'governed by', style: { stroke: '#802334', strokeWidth: 1.5 } },
  { id: 'e-pub-frontpage', source: 'publication', target: 'frontpage', label: 'displayed in', style: { stroke: '#802334', strokeWidth: 1.5 } },
  { id: 'e-pub-folio', source: 'publication', target: 'folio', label: 'displayed in', style: { stroke: '#802334', strokeWidth: 1.5 } },
  { id: 'e-pub-rbac', source: 'publication', target: 'rbac', label: 'protected by', style: { stroke: '#802334', strokeWidth: 1.5 } },
  { id: 'e-pub-search', source: 'publication', target: 'search-index', label: 'indexed by', style: { stroke: '#802334', strokeWidth: 1.5 } },
  { id: 'e-pub-metadata', source: 'publication', target: 'metadata', label: 'described by', style: { stroke: '#802334', strokeWidth: 1.5 } },
  { id: 'e-author-bio', source: 'author', target: 'biography', label: 'has narrative', style: { stroke: '#a8a29e' } },
  { id: 'e-author-folio', source: 'author', target: 'folio', label: 'has timeline', style: { stroke: '#a8a29e' } },
  { id: 'e-desk-editorium', source: 'writing-desk', target: 'editorium', label: 'monitored by', style: { stroke: '#d6d3d1', strokeDasharray: '5,5' } },
  { id: 'e-editorium-rbac', source: 'editorium', target: 'rbac', label: 'configures', style: { stroke: '#a8a29e' } }
];

// --- IMPACT MAP DEFINITION ---

const IMPACT_MAP: Record<string, { affected: string[]; level: 'Low' | 'Medium' | 'High'; warning: string }> = {
  publication: {
    affected: ['Frontpage', 'Folio', 'Search Index', 'Writing Desk', 'Editorium'],
    level: 'High',
    warning: 'CRITICAL: Modifying Publication core structure affects drafting, indexing, routing, and all frontend rendering cards.'
  },
  author: {
    affected: ['Biography', 'Folio', 'Publication', 'RBAC Policies'],
    level: 'High',
    warning: 'CRITICAL: Deleting or modifying the Author entity breaks user identity verification, public folios, signatures, and associated publications ownership.'
  },
  'writing-desk': {
    affected: ['Publication (Drafts)', 'Editorium (Audit Logs)'],
    level: 'Medium',
    warning: 'WARNING: Modifying the Writing Desk affects manuscript editing experience and auto-saving integrations.'
  },
  editorium: {
    affected: ['RBAC Policies', 'Frontpage Curation', 'System Log Registry'],
    level: 'High',
    warning: 'CRITICAL: Modifying Editorium controls alters the administrative settings, logs database access, and curation selectors.'
  },
  frontpage: {
    affected: ['Platform Landing View', 'Featured Curation Selector'],
    level: 'Medium',
    warning: 'WARNING: Altering Frontpage affects user entry discoverability, accent seals, and announcement delivery.'
  },
  folio: {
    affected: ['Author Profile View', 'Timeline milestones feed'],
    level: 'Low',
    warning: 'INFO: Altering Folio structures will affect the chronological rendering of verified author essays and notes.'
  },
  rbac: {
    affected: ['Editorium', 'Writing Desk', 'Publication Visibility'],
    level: 'High',
    warning: 'CRITICAL: Altering Role-Based Access Control affects system security and can lead to unauthorized edit access or lockout.'
  },
  biography: {
    affected: ['Author Profile', 'Folio View', 'Metadata schema'],
    level: 'Low',
    warning: 'INFO: Biography modification changes author narrative detail but does not impact structural platform services.'
  },
  'search-index': {
    affected: ['Editorial Index View', 'Cross-citation referencer'],
    level: 'Medium',
    warning: 'WARNING: Re-indexing or modifying Search Index structures impacts cross-reference lookups and public directory searches.'
  },
  metadata: {
    affected: ['Publication Catalogs', 'Citation references', 'XML/PDF Export'],
    level: 'High',
    warning: 'CRITICAL: Changing the Metadata Schema structure will break existing XML exports and Harvard/APA citation referencing rules.'
  }
};

export const ArchitectureStudio: React.FC = () => {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId);
  }, [nodes, selectedNodeId]);

  const impactData = useMemo(() => {
    if (!selectedNodeId) return null;
    return IMPACT_MAP[selectedNodeId] || null;
  }, [selectedNodeId]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  return (
    <div className="w-full flex flex-col lg:flex-row border border-stone-200 rounded-md shadow-inner bg-stone-50 overflow-hidden relative min-h-[70vh] text-left">
      {/* 1. KNOWLEDGE GRAPH VIEW (Left Side) */}
      <div className="flex-1 h-[70vh] relative min-w-0">
        <div className="absolute top-4 left-4 z-10 p-4 bg-white/90 backdrop-blur-sm border border-stone-200 shadow-sm rounded max-w-xs font-sans text-xs text-stone-600 space-y-1 select-none pointer-events-none">
          <h2 className="font-serif text-sm font-semibold text-stone-900 uppercase tracking-wide">Adjung Digital Twin</h2>
          <p className="font-serif text-stone-500 italic">Conceptual Knowledge Graph</p>
          <p className="text-[10px] text-stone-400 mt-2 leading-relaxed">
            Click on any platform concept node to run an interactive **Impact Analysis** and view active development routes.
          </p>
        </div>
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-right"
          minZoom={0.2}
          maxZoom={1.5}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#d6d3d1" />
          <Controls className="bg-white border-stone-200 shadow-sm" />
        </ReactFlow>
      </div>

      {/* 2. DETAIL PANEL & IMPACT DRAWER (Right Side) */}
      <div className="w-full lg:w-[350px] border-t lg:border-t-0 lg:border-l border-stone-200 bg-white p-5 flex flex-col gap-5 overflow-y-auto max-h-[70vh] lg:max-h-none font-sans text-xs">
        {selectedNode ? (
          <div className="space-y-5 animate-fade-in">
            {/* Concept Header */}
            <div className="border-b border-stone-100 pb-3">
              <span className="font-mono text-[8px] uppercase tracking-widest text-[#802334] font-bold">Concept details</span>
              <h3 className="font-serif text-xl font-bold text-stone-950 mt-1">{selectedNode.data.label}</h3>
              <p className="text-stone-500 mt-1 leading-relaxed">{selectedNode.data.desc}</p>
            </div>

            {/* Purpose */}
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1">Concept Purpose</span>
              <p className="text-stone-700 leading-relaxed font-serif text-[13px] bg-stone-50 p-2.5 rounded border border-stone-200/40">
                {selectedNode.data.purpose}
              </p>
            </div>

            {/* Specs & Source Files */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1">Specification</span>
                <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#802334] hover:underline cursor-pointer">
                  <BookOpen className="w-3 h-3" />
                  {selectedNode.data.spec}
                </span>
              </div>
              <div>
                <span className="block font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1">Database Model</span>
                <span className="font-mono text-[10px] text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded">
                  {selectedNode.data.dbEntity}
                </span>
              </div>
            </div>

            {/* Linked Files */}
            <div>
              <span className="block font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold mb-1">Implementation Artifacts</span>
              <div className="flex flex-col gap-1 mt-1.5">
                {(selectedNode.data.files as string[]).map((f) => (
                  <span key={f} className="flex items-center gap-1.5 font-mono text-[9px] text-stone-500 bg-stone-50 p-1.5 rounded border border-stone-150/50">
                    <FileCode className="w-3.5 h-3.5 text-stone-400" />
                    {f.split('/').pop()}
                  </span>
                ))}
              </div>
            </div>

            {/* Impact Analysis (Phase 3 Prototype) */}
            {impactData && (
              <div className="pt-4 border-t border-stone-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="block font-mono text-[9px] uppercase tracking-wider text-stone-400 font-bold">Impact Analysis</span>
                  <span className={`px-1.5 py-0.5 rounded font-mono text-[8px] uppercase tracking-widest font-bold ${
                    impactData.level === 'High' 
                      ? 'bg-red-50 text-red-800 border border-red-200' 
                      : impactData.level === 'Medium'
                      ? 'bg-amber-55 text-amber-900 border border-amber-250'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  }`}>
                    {impactData.level} Impact
                  </span>
                </div>

                <div>
                  <span className="block text-[10px] text-stone-500 font-medium mb-1">Downstream Dependencies</span>
                  <div className="flex flex-wrap gap-1">
                    {impactData.affected.map((a) => (
                      <span key={a} className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px] text-stone-600 font-medium">{a}</span>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 p-3 rounded bg-red-50/30 border border-red-100 font-serif text-[11px] text-red-900 leading-normal">
                  <AlertTriangle className="w-4 h-4 text-red-700 flex-shrink-0 mt-0.5" />
                  <div>
                    {impactData.warning}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-stone-400 space-y-3">
            <Info className="w-8 h-8 text-stone-300 font-light" />
            <div className="font-serif italic text-sm">
              No platform concept selected.
            </div>
            <p className="text-[10px] leading-relaxed max-w-[220px]">
              Click on any node in the graph map to inspect its specifications and analyze downstream system dependencies.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
