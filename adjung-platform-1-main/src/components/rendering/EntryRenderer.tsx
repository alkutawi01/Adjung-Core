import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Entry, EntryType, EntryStatus, EntryVisibility, Citation, Revision, VectorStroke, Footnote, DigitalSignature } from '../../types';
import { SignatureRenderer } from '../desk/SignatureRenderer';
import { SignatureLayout } from '../desk/SignatureLayout';
import { ElasticMarginRow } from './ElasticMarginRow';
import { isArabicText, parseInlineFormatting, ContentBlock, parseContentToBlocks, DocumentExporter, HeadingBlock, serializeBlocks, ImageBlock, stripMarkdown, markdownToHtml, htmlToMarkdown, getReadingTime, getWordCount } from '../../utils';
import { EntryImage, EntryImageEditor } from '../desk/EntryImage';
import { Tag, Calendar, Globe, Lock, Trash2, Plus, Info, Settings, BookOpen, ArrowUp, ArrowDown, Copy, Check, Loader2, AlertTriangle, RefreshCw, Edit3 } from 'lucide-react';
import { db } from '../../db/mockDb';
import { useAppContext } from '../../context/AppContext';
import { PresentationSpec, getPresentationSpec } from '../../presentation';
import { RichTextEditable } from './RichTextEditable';
import { FloatingFormatToolbar } from './FloatingFormatToolbar';

interface EntryRendererProps {
  entry: Entry;
  mode: 'view' | 'edit';
  viewMode?: 'preview' | 'editor';
  onSave?: (updatedEntry: Entry) => void;
  onDelete?: (id: string) => void;
  authorName: string;
  authorSignature: string;
  authorSignatureStrokes?: VectorStroke[][];
  authorSignatureFont?: string;
  authorDigitalSignature?: DigitalSignature;
  preventScrollToTop?: boolean;
  presentationSpec?: PresentationSpec;
}

export function EntryRenderer({
  entry,
  mode,
  viewMode,
  onSave,
  onDelete,
  authorName,
  authorSignature,
  authorSignatureStrokes,
  authorSignatureFont,
  authorDigitalSignature,
  preventScrollToTop,
  presentationSpec
}: EntryRendererProps) {
  const { currentUser, refreshDbState } = useAppContext();
  const [title, setTitle] = useState(entry.title || '');
  const [contentType, setContentType] = useState<EntryType>(entry.contentType);
  const [status, setStatus] = useState<EntryStatus>(entry.status);
  const [visibility, setVisibility] = useState<EntryVisibility>(entry.visibility);
  const [tags, setTags] = useState<string[]>(entry.tags);
  const [newTag, setNewTag] = useState('');
  const [slug, setSlug] = useState(entry.slug);
  const [showSettings, setShowSettings] = useState(false);
  const [activeQuoteInsert, setActiveQuoteInsert] = useState<'latin' | 'arabic' | null>(null);
  const [quoteInsertDir, setQuoteInsertDir] = useState<'ltr' | 'rtl'>('ltr');
  const [excerpt, setExcerpt] = useState(entry.excerpt || '');
  const [featuredImage, setFeaturedImage] = useState(entry.featuredImage || '');
  const [revisions, setRevisions] = useState<Revision[]>(entry.revisions || []);
  const [showXmlView, setShowXmlView] = useState(false);
  const activeSpec = presentationSpec || getPresentationSpec(contentType);
  const [citations, setCitations] = useState<Citation[]>(entry.citations || []);
  const [referenceSortOrder, setReferenceSortOrder] = useState<'alphabetical' | 'appearance'>(entry.referenceSortOrder || 'alphabetical');

  const getCanonicalUrl = () => {
    if (entry.publicationClass === 'Institutional') {
      const typeSlug = entry.contentType === 'Notice' ? 'notice' : 'editorial';
      return `https://adjung.com/${typeSlug}/${entry.slug}`;
    } else {
      const author = db.getUsers().find(u => u.id === entry.authorId);
      const username = author ? author.username : 'scholar';
      return `https://${username}.adjung.com/${entry.contentType.toLowerCase()}/${entry.slug}`;
    }
  };

  const handleReportEntry = () => {
    const confirmReport = window.confirm("Are you sure you want to report this writing for review by the Editorial Board?");
    if (!confirmReport) return;
    
    fetch(`/api/entries/${entry.id}/report`, { method: 'POST' })
      .then(res => {
        if (res.ok) {
          if (currentUser) {
            fetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: `log-${Date.now()}`,
                timestamp: new Date().toISOString(),
                operator: currentUser.penName,
                role: currentUser.role,
                action: `Reported entry "${entry.title}" (ID: ${entry.id}) for moderation.`
              })
            }).then(() => refreshDbState());
          } else {
            refreshDbState();
          }
          showToast('Report sent. The article is now under review by the Editorial Board.', 'info');
        }
      })
      .catch(err => console.error('Failed to report entry:', err));
  };

  // Editor tab and validation states
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [isValidationRunning, setIsValidationRunning] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationSuccess, setValidationSuccess] = useState(false);
  const [hasValidated, setHasValidated] = useState(false);

  // Visual Builders States
  const [activeTableInsert, setActiveTableInsert] = useState(false);
  const [activeCitationInsert, setActiveCitationInsert] = useState(false);

  // Table Grid Builders States
  const [tableHeaders, setTableHeaders] = useState<string[]>(['Header 1', 'Header 2', 'Header 3']);
  const [tableData, setTableData] = useState<string[][]>([
    ['Cell 1.1', 'Cell 1.2', 'Cell 1.3'],
    ['Cell 2.1', 'Cell 2.2', 'Cell 2.3']
  ]);
  const [tableAlignments, setTableAlignments] = useState<Array<'left' | 'center' | 'right'>>(['left', 'left', 'left']);

  // For Essay:
  const [footnotes, setFootnotes] = useState<string[]>(entry.footnotes || []);
  const [footnotesData, setFootnotesData] = useState<Footnote[]>(entry.footnotesData || []);

  // For Article and general content:
  const [content, setContent] = useState(entry.content);
  // Split content into paragraphs to align with margin notes
  const [paragraphs, setParagraphs] = useState<string[]>(() => {
    const parts = entry.content.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    return parts.length > 0 ? parts : [entry.content];
  });
  const [marginNotes, setMarginNotes] = useState<{ [key: number]: string }>(entry.marginNotes || {});
  const [prevEntryId, setPrevEntryId] = useState(entry.id);
  const [showInterlinearLocal, setShowInterlinearLocal] = useState(true);
  const [showGlossInput, setShowGlossInput] = useState(false);
  const [glossText, setGlossText] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const [marginNotesData, setMarginNotesData] = useState<Record<string, string>>(entry.marginNotesData || {});
  const [marginOffsets, setMarginOffsets] = useState<Record<string, number>>({});
  const [activeMarginNoteId, setActiveMarginNoteId] = useState<string | null>(null);
  const [selectionRange, setSelectionRange] = useState<Range | null>(null);
  const [toolbarCoords, setToolbarCoords] = useState<{ x: number; y: number } | null>(null);
  const [contextCoords, setContextCoords] = useState<{ x: number; y: number } | null>(null);
  const [contextRange, setContextRange] = useState<Range | null>(null);

  console.log("EntryRenderer Render - content:", content, "marginNotesData:", marginNotesData, "activeMarginNoteId:", activeMarginNoteId);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1280);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const [showQuoteTypes, setShowQuoteTypes] = useState(false);

  const getFootnotesReadingOrderMap = () => {
    const map: Record<string, number> = {};
    const occurrences: string[] = [];
    const fnRegex = /\[\^(fn-[a-zA-Z0-9-]+)\]|\[\^(\d+)\]/g;
    
    const blocks = parseContentToBlocks(content);
    blocks.forEach(b => {
      let text = '';
      if (b.type === 'paragraph') {
        text = b.text || '';
      } else if (b.type === 'heading') {
        text = b.text || '';
      } else if (b.type === 'latin-quote') {
        text = (b.text || '') + ' ' + (b.translation || '');
      } else if (b.type === 'arabic-quote') {
        text = (b.arabic || '') + ' ' + (b.translation || '');
      } else if (b.type === 'list') {
        text = (b.items || []).map((it: any) => it.text).join(' ');
      } else if (b.type === 'table') {
        text = (b.headers || []).join(' ') + ' ' + (b.rows || []).map((r: string[]) => r.join(' ')).join(' ');
      }
      
      let match;
      fnRegex.lastIndex = 0;
      while ((match = fnRegex.exec(text)) !== null) {
        const fnId = match[1] || match[2];
        if (fnId && !occurrences.includes(fnId)) {
          occurrences.push(fnId);
        }
      }
    });

    occurrences.forEach((fnId, idx) => {
      map[fnId] = idx + 1;
    });

    return { map, occurrences };
  };

  const getMarginNotesReadingOrderMap = () => {
    const map: Record<string, number> = {};
    const occurrences: string[] = [];
    const mnRegex = /\[\^(mn-[a-zA-Z0-9-]+)\]/g;
    
    let match;
    mnRegex.lastIndex = 0;
    while ((match = mnRegex.exec(content)) !== null) {
      const mnId = match[1];
      if (!occurrences.includes(mnId)) {
        occurrences.push(mnId);
      }
    }
    
    occurrences.forEach((mnId, idx) => {
      map[mnId] = idx + 1;
    });
    
    return { map, occurrences };
  };

  const getOrderedFootnotesToRender = () => {
    const { map, occurrences } = getFootnotesReadingOrderMap();
    const renderedList: { displayNum: number; originalId: string; text: string }[] = [];
    
    occurrences.forEach((id, index) => {
      let text = '';
      const fnItem = footnotesData.find(f => f.id === id);
      if (fnItem) {
        text = fnItem.content;
      } else {
        const isLegacy = !isNaN(Number(id));
        if (isLegacy) {
          text = footnotes[parseInt(id, 10) - 1] || '';
        } else if (id.startsWith('fn-legacy-')) {
          const numStr = id.replace('fn-legacy-', '');
          text = footnotes[parseInt(numStr, 10) - 1] || '';
        }
      }
      renderedList.push({
        displayNum: index + 1,
        originalId: id,
        text
      });
    });
    
    return renderedList;
  };

  // Scroll to the absolute top of the page immediately when mounting or switching entries in view mode
  useEffect(() => {
    if (mode === 'view' && !preventScrollToTop) {
      window.scrollTo(0, 0);
      const handle = requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
      return () => cancelAnimationFrame(handle);
    }
  }, [entry.id, mode, preventScrollToTop]);

  // Toast notifications for action feedback:
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  // Sprint 1 Typing Stats & Autosave state
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<string>('');
  const [activeTextareaIdx, setActiveTextareaIdx] = useState<number | null>(null);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stateRef = useRef({ content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, citations, referenceSortOrder, marginNotesData, footnotesData });

  useEffect(() => {
    stateRef.current = { content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, citations, referenceSortOrder, marginNotesData, footnotesData };
  }, [content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, citations, referenceSortOrder, marginNotesData, footnotesData]);

  // Unified editor helpers
  const updateCanvasBadges = (el: HTMLElement) => {
    // Badges are now styled via CSS counters in index.css
    // We keep this function in case we need to trigger any other DOM updates
  };

  const triggerEditorChange = (
    customFootnotes?: string[],
    customMarginNotesData?: any,
    customFootnotesData?: Footnote[]
  ) => {
    const editorEl = document.getElementById('editorial-canvas-editor');
    if (editorEl) {
      updateCanvasBadges(editorEl);
      const html = editorEl.innerHTML;
      const md = htmlToMarkdown(html);
      setContent(md);
      
      const fns = customFootnotes !== undefined ? customFootnotes : stateRef.current.footnotes;
      const mnd = customMarginNotesData !== undefined ? customMarginNotesData : stateRef.current.marginNotesData;
      const fnd = customFootnotesData !== undefined ? customFootnotesData : stateRef.current.footnotesData;
      
      triggerSave(
        md,
        fns,
        stateRef.current.marginNotes,
        stateRef.current.contentType,
        stateRef.current.status,
        stateRef.current.visibility,
        stateRef.current.tags,
        stateRef.current.slug,
        stateRef.current.title,
        stateRef.current.excerpt,
        stateRef.current.featuredImage,
        stateRef.current.revisions,
        stateRef.current.citations,
        stateRef.current.referenceSortOrder,
        mnd,
        fnd
      );
    }
  };

  const applyFormat = (format: string) => {
    document.execCommand(format, false);
    triggerEditorChange();
  };

  const applyBlockFormat = (tag: string) => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && tag !== 'P' && tag !== 'p') {
      let parent: HTMLElement | null = selection.getRangeAt(0).startContainer.parentElement;
      let isInsideTarget = false;
      while (parent && parent.id !== 'editorial-canvas-editor') {
        if (parent.tagName.toLowerCase() === tag.toLowerCase()) {
          isInsideTarget = true;
          break;
        }
        parent = parent.parentElement;
      }
      
      if (isInsideTarget) {
        document.execCommand('formatBlock', false, 'p');
      } else {
        document.execCommand('formatBlock', false, tag);
      }
    } else {
      document.execCommand('formatBlock', false, tag);
    }
    triggerEditorChange();
  };

  const insertNote = (type: 'footnote' | 'margin-note') => {
    const id = `${type === 'footnote' ? 'fn' : 'mn'}-${generateUUID()}`;
    const span = document.createElement('span');
    span.className = type === 'footnote' ? 'footnote-badge' : 'margin-note-badge';
    span.setAttribute('data-id', id);
    span.setAttribute('contenteditable', 'false');
    span.textContent = '\u200B'; // Zero-width space so it's not totally empty for the cursor, but relies on CSS for display

    const sel = window.getSelection();
    const range = contextRange || (sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null);
    if (range) {
      range.deleteContents();
      range.insertNode(span);
      range.collapse(false);
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }

    let updatedFootnotes = footnotes;
    let updatedFootnotesData = footnotesData;
    let updatedMarginNotesData = marginNotesData;

    if (type === 'footnote') {
      const newText = 'New footnote description text.';
      updatedFootnotesData = [...footnotesData, { id, content: newText }];
      setFootnotesData(updatedFootnotesData);
    } else {
      updatedMarginNotesData = { ...marginNotesData, [id]: 'New margin note content.' };
      setMarginNotesData(updatedMarginNotesData);
      setActiveMarginNoteId(id);
    }

    setContextRange(null);

    // Force React to render and update canvas badges
    setTimeout(() => {
      triggerEditorChange(
        type === 'footnote' ? updatedFootnotes : undefined,
        type === 'margin-note' ? updatedMarginNotesData : undefined,
        type === 'footnote' ? updatedFootnotesData : undefined
      );
    }, 50);
  };

  const deleteNote = (id: string, type: 'footnote' | 'margin-note') => {
    const editorEl = document.getElementById('editorial-canvas-editor');
    if (editorEl) {
      const badge = editorEl.querySelector(`[data-id="${id}"]`);
      if (badge) {
        badge.remove();
      }
      
      let updatedFootnotes = footnotes;
      let updatedFootnotesData = footnotesData;
      let updatedMarginNotesData = marginNotesData;

      if (type === 'footnote') {
        const { occurrences } = getFootnotesReadingOrderMap();
        const orderIdx = occurrences.indexOf(id);
        if (orderIdx !== -1) {
          updatedFootnotes = footnotes.filter((_, i) => i !== orderIdx);
          setFootnotes(updatedFootnotes);
        }
        updatedFootnotesData = footnotesData.filter(f => f.id !== id);
        setFootnotesData(updatedFootnotesData);
      } else {
        updatedMarginNotesData = { ...marginNotesData };
        delete updatedMarginNotesData[id];
        setMarginNotesData(updatedMarginNotesData);
      }
      
      triggerEditorChange(
        type === 'footnote' ? updatedFootnotes : undefined,
        type === 'margin-note' ? updatedMarginNotesData : undefined,
        type === 'footnote' ? updatedFootnotesData : undefined
      );
    }
  };

  const handleSelectionChange = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      setToolbarCoords(null);
      setSelectionRange(null);
      return;
    }
    
    try {
      const range = sel.getRangeAt(0);
      const editorEl = document.getElementById('editorial-canvas-editor');
      if (editorEl && editorEl.contains(range.commonAncestorContainer)) {
        const rect = range.getBoundingClientRect();
        const parentRect = editorEl.getBoundingClientRect();
        
        setToolbarCoords({
          x: rect.left + rect.width / 2 - parentRect.left,
          y: rect.top - parentRect.top - 45
        });
        setSelectionRange(range);
      } else {
        setToolbarCoords(null);
        setSelectionRange(null);
      }
    } catch (e) {
      setToolbarCoords(null);
      setSelectionRange(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    const editorEl = document.getElementById('editorial-canvas-editor');
    if (editorEl && editorEl.contains(e.target as Node)) {
      e.preventDefault();
      
      let range: Range | null = null;
      if (document.caretRangeFromPoint) {
        range = document.caretRangeFromPoint(e.clientX, e.clientY);
      } else if ((document as any).caretPositionFromPoint) {
        const position = (document as any).caretPositionFromPoint(e.clientX, e.clientY);
        if (position) {
          range = document.createRange();
          range.setStart(position.offsetNode, position.offset);
          range.collapse(true);
        }
      }
      
      if (range && editorEl.contains(range.commonAncestorContainer)) {
        setContextRange(range);
      } else {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
          const fallbackRange = sel.getRangeAt(0).cloneRange();
          if (editorEl.contains(fallbackRange.commonAncestorContainer)) {
            setContextRange(fallbackRange);
          } else {
            setContextRange(null);
          }
        } else {
          setContextRange(null);
        }
      }

      const parentRect = editorEl.getBoundingClientRect();
      setContextCoords({
        x: e.clientX - parentRect.left,
        y: e.clientY - parentRect.top
      });
    }
  };

  // Sync selection events
  useEffect(() => {
    if (mode === 'edit') {
      const handler = () => handleSelectionChange();
      document.addEventListener('selectionchange', handler);
      return () => document.removeEventListener('selectionchange', handler);
    }
  }, [mode]);

  // Close context menu on any global click
  useEffect(() => {
    const closeContext = () => setContextCoords(null);
    document.addEventListener('click', closeContext);
    return () => document.removeEventListener('click', closeContext);
  }, []);

  // Update visual badge contents whenever content loads
  useEffect(() => {
    const editorEl = document.getElementById('editorial-canvas-editor');
    if (editorEl) {
      updateCanvasBadges(editorEl);
    }
  }, [content, mode]);

  // Update margin offsets dynamically with collision avoidance
  useEffect(() => {
    const updateOffsets = () => {
      const { occurrences } = getMarginNotesReadingOrderMap();
      const rawOffsets: Record<string, number> = {};
      const containerEl = document.getElementById('article-container-grid');
      if (!containerEl) return;
      const containerRect = containerEl.getBoundingClientRect();
      
      occurrences.forEach((id) => {
        const markerEl = document.getElementById(`mn-marker-${id}`) || document.querySelector(`.margin-note-badge[data-id="${id}"]`);
        if (markerEl) {
          const markerRect = markerEl.getBoundingClientRect();
          rawOffsets[id] = markerRect.top - containerRect.top;
        }
      });

      // Sort occurrences by natural top position
      const sortedIds = [...occurrences].sort((a, b) => (rawOffsets[a] || 0) - (rawOffsets[b] || 0));
      
      const resolvedOffsets: Record<string, number> = {};
      let lastBottom = 0;
      
      sortedIds.forEach((id) => {
        const naturalTop = rawOffsets[id] || 0;
        const noteEl = document.getElementById(`mn-note-card-${id}`);
        let noteHeight = 45; // Default view mode estimate
        
        if (noteEl) {
          noteHeight = noteEl.getBoundingClientRect().height;
        } else if (mode === 'edit') {
          noteHeight = id === activeMarginNoteId ? 130 : 38;
        }
        
        let resolvedTop = naturalTop;
        if (resolvedTop < lastBottom) {
          resolvedTop = lastBottom + 8; // Collapsible spacing
        }
        resolvedOffsets[id] = resolvedTop;
        lastBottom = resolvedTop + noteHeight;
      });

      setMarginOffsets(resolvedOffsets);
      console.log("DEBUG margin note offsets: occurrences =", occurrences, "rawOffsets =", rawOffsets, "resolvedOffsets =", resolvedOffsets);
    };

    updateOffsets();
    const timeout = setTimeout(updateOffsets, 100);
    const timeout2 = setTimeout(updateOffsets, 600);
    window.addEventListener('resize', updateOffsets);
    return () => {
      clearTimeout(timeout);
      clearTimeout(timeout2);
      window.removeEventListener('resize', updateOffsets);
    };
  }, [content, marginNotesData, mode, activeMarginNoteId]);

  // Floating selection-formatting toolbar states
  const [selectionState, setSelectionState] = useState<{
    show: boolean;
    start: number;
    end: number;
    x: number;
    y: number;
    text: string;
    textareaId: string;
  } | null>(null);

  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [showInsertMenu, setShowInsertMenu] = useState(false);

  useEffect(() => {
    if (mode !== 'edit') return;

    const getTextareaSelectionCoords = (textarea: HTMLTextAreaElement) => {
      const { selectionStart, selectionEnd } = textarea;
      if (selectionStart === null || selectionEnd === null) return null;

      // Create a mirror div to calculate coordinates
      const div = document.createElement('div');
      const style = window.getComputedStyle(textarea);

      // Copy essential layout and typography styles
      const stylesToCopy = [
        'fontFamily', 'fontSize', 'fontWeight', 'lineHeight',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'borderWidth', 'borderStyle', 'boxSizing', 'whiteSpace',
        'wordBreak', 'wordWrap', 'width', 'textAlign', 'direction'
      ];

      stylesToCopy.forEach(prop => {
        (div.style as any)[prop] = (style as any)[prop];
      });

      div.style.position = 'absolute';
      div.style.visibility = 'hidden';
      div.style.left = '-9999px';
      div.style.top = '-9999px';
      div.style.height = 'auto';

      const text = textarea.value;
      const beforeText = text.substring(0, selectionStart);
      const selectedText = text.substring(selectionStart, selectionEnd);

      const beforeSpan = document.createElement('span');
      beforeSpan.textContent = beforeText;

      const selectSpan = document.createElement('span');
      selectSpan.textContent = selectedText;

      div.appendChild(beforeSpan);
      div.appendChild(selectSpan);

      document.body.appendChild(div);

      const textareaRect = textarea.getBoundingClientRect();
      const selectRect = selectSpan.getBoundingClientRect();
      const divRect = div.getBoundingClientRect();

      const relativeTop = selectRect.top - divRect.top;
      const relativeLeft = selectRect.left - divRect.left;
      const selectWidth = selectRect.width;

      document.body.removeChild(div);

      return {
        left: textareaRect.left + relativeLeft - textarea.scrollLeft,
        top: textareaRect.top + relativeTop - textarea.scrollTop,
        width: selectWidth,
        height: selectRect.height
      };
    };

    const handleSelection = () => {
      const activeEl = document.activeElement;
      if (activeEl instanceof HTMLTextAreaElement && activeEl.id.startsWith('editorial-content-textarea')) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        if (start !== null && end !== null && start !== end) {
          const text = activeEl.value.substring(start, end);
          
          const selectionCoords = getTextareaSelectionCoords(activeEl);
          if (selectionCoords) {
            // Horizontal center of selection
            const selectionViewportX = selectionCoords.left + selectionCoords.width / 2;
            
            // Prioritize positioning above selection (using a 12px gap)
            // Height of the toolbar is ~38px, let's set y relative to selection top
            let selectionViewportY = selectionCoords.top - 38 - 12; // 12px gap above selection
            
            // If too close to the top of the viewport (< 70px), place 12px below the selection instead
            if (selectionCoords.top < 70) {
              selectionViewportY = selectionCoords.top + selectionCoords.height + 12; // 12px gap below selection
            }

            // Map viewport coordinates to the relative container of the absolute-positioned toolbar
            const container = activeEl.closest('.relative.max-w-4xl.mx-auto') || activeEl.offsetParent;
            const containerRect = container ? container.getBoundingClientRect() : { left: 0, top: 0 };

            setSelectionState({
              show: true,
              start,
              end,
              x: selectionViewportX - containerRect.left,
              y: selectionViewportY - containerRect.top,
              text,
              textareaId: activeEl.id
            });
            return;
          }
        }
      }
      if (!showLinkInput) {
        setSelectionState(null);
      }
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, [mode, showLinkInput]);

  const updateVisualBlockText = (textareaId: string, newValue: string) => {
    let blockIdx = -1;
    let field: 'text' | 'arabic' | 'translation' = 'text';

    if (textareaId.startsWith('editorial-content-textarea-visual-latin-')) {
      blockIdx = parseInt(textareaId.replace('editorial-content-textarea-visual-latin-', ''), 10);
      field = 'text';
    } else if (textareaId.startsWith('editorial-content-textarea-visual-arabic-')) {
      blockIdx = parseInt(textareaId.replace('editorial-content-textarea-visual-arabic-', ''), 10);
      field = 'arabic';
    } else if (textareaId.startsWith('editorial-content-textarea-visual-trans-')) {
      blockIdx = parseInt(textareaId.replace('editorial-content-textarea-visual-trans-', ''), 10);
      field = 'translation';
    } else if (textareaId.startsWith('editorial-content-textarea-visual-')) {
      blockIdx = parseInt(textareaId.replace('editorial-content-textarea-visual-', ''), 10);
      field = 'text';
    }

    if (blockIdx === -1) return;

    let block: ContentBlock;
    if (contentType === 'Article') {
      const para = paragraphs[blockIdx];
      block = parseContentToBlocks(para)[0] || { type: 'paragraph', text: para };
    } else {
      const blocks = parseContentToBlocks(content);
      block = blocks[blockIdx];
    }

    if (block) {
      if (field === 'text') {
        (block as any).text = newValue;
      } else if (field === 'arabic') {
        (block as any).arabic = newValue;
      } else if (field === 'translation') {
        (block as any).translation = newValue;
      }
      handleVisualBlockChange(blockIdx, block);
    }
  };

  const handleValueChange = (textareaId: string, newValue: string, footnotesToSave = footnotes) => {
    if (textareaId.startsWith('editorial-content-textarea-visual-')) {
      updateVisualBlockText(textareaId, newValue);
    } else if (contentType === 'Article' && textareaId.startsWith('editorial-content-textarea-')) {
      const blockIdx = parseInt(textareaId.replace('editorial-content-textarea-', ''), 10);
      handleContentChange(blockIdx, newValue);
    } else {
      setContent(newValue);
      triggerSave(newValue, footnotesToSave, marginNotes);
    }
  };

  const applyBold = () => {
    if (!selectionState) return;
    const textarea = document.getElementById(selectionState.textareaId) as HTMLTextAreaElement;
    if (!textarea) return;
    
    const val = textarea.value;
    const { start, end, text } = selectionState;
    let newValue = '';
    let newStart = start;
    let newEnd = end;

    if (text.startsWith('**') && text.endsWith('**') && text.length >= 4) {
      const unwrapped = text.substring(2, text.length - 2);
      newValue = val.substring(0, start) + unwrapped + val.substring(end);
      newStart = start;
      newEnd = start + unwrapped.length;
    } else {
      const wrapped = `**${text}**`;
      newValue = val.substring(0, start) + wrapped + val.substring(end);
      newStart = start;
      newEnd = start + wrapped.length;
    }

    handleValueChange(selectionState.textareaId, newValue);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }, 50);
  };

  const applyItalic = () => {
    if (!selectionState) return;
    const textarea = document.getElementById(selectionState.textareaId) as HTMLTextAreaElement;
    if (!textarea) return;
    
    const val = textarea.value;
    const { start, end, text } = selectionState;
    let newValue = '';
    let newStart = start;
    let newEnd = end;

    if (text.startsWith('*') && text.endsWith('*') && text.length >= 2) {
      const unwrapped = text.substring(1, text.length - 1);
      newValue = val.substring(0, start) + unwrapped + val.substring(end);
      newStart = start;
      newEnd = start + unwrapped.length;
    } else {
      const wrapped = `*${text}*`;
      newValue = val.substring(0, start) + wrapped + val.substring(end);
      newStart = start;
      newEnd = start + wrapped.length;
    }

    handleValueChange(selectionState.textareaId, newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }, 50);
  };

  const applyUnderline = () => {
    if (!selectionState) return;
    const textarea = document.getElementById(selectionState.textareaId) as HTMLTextAreaElement;
    if (!textarea) return;
    
    const val = textarea.value;
    const { start, end, text } = selectionState;
    let newValue = '';
    let newStart = start;
    let newEnd = end;

    if (text.startsWith('<u>') && text.endsWith('</u>') && text.length >= 7) {
      const unwrapped = text.substring(3, text.length - 4);
      newValue = val.substring(0, start) + unwrapped + val.substring(end);
      newStart = start;
      newEnd = start + unwrapped.length;
    } else if (text.startsWith('++') && text.endsWith('++') && text.length >= 4) {
      const unwrapped = text.substring(2, text.length - 2);
      newValue = val.substring(0, start) + unwrapped + val.substring(end);
      newStart = start;
      newEnd = start + unwrapped.length;
    } else {
      const wrapped = `<u>${text}</u>`;
      newValue = val.substring(0, start) + wrapped + val.substring(end);
      newStart = start;
      newEnd = start + wrapped.length;
    }

    handleValueChange(selectionState.textareaId, newValue);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newStart, newEnd);
    }, 50);
  };

  const applyLink = (url: string) => {
    if (!selectionState || !url) return;
    const textarea = document.getElementById(selectionState.textareaId) as HTMLTextAreaElement;
    if (!textarea) return;
    
    const val = textarea.value;
    const { start, end, text } = selectionState;
    
    const wrapped = `[${text}](${url})`;
    const newValue = val.substring(0, start) + wrapped + val.substring(end);

    handleValueChange(selectionState.textareaId, newValue);

    setShowLinkInput(false);
    setLinkUrl('');
    setSelectionState(null);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1 + text.length);
    }, 50);
  };

  const applyInterlinear = (gloss: string) => {
    if (!selectionState || !gloss) return;
    const textarea = document.getElementById(selectionState.textareaId) as HTMLTextAreaElement;
    if (!textarea) return;
    
    const val = textarea.value;
    const { start, end, text } = selectionState;
    
    const cleanGloss = gloss.trim().toLowerCase();
    const wrapped = `[${text}](gloss:${cleanGloss})`;
    const newValue = val.substring(0, start) + wrapped + val.substring(end);

    handleValueChange(selectionState.textareaId, newValue);

    setShowGlossInput(false);
    setGlossText('');
    setSelectionState(null);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + 1, start + 1 + text.length);
    }, 50);
  };

  const applyFootnote = () => {
    if (!selectionState) return;
    const textarea = document.getElementById(selectionState.textareaId) as HTMLTextAreaElement;
    if (!textarea) return;
    
    const val = textarea.value;
    const { start, end, text } = selectionState;
    
    const footnoteText = text ? `Rujukan untuk "${text}": ` : "Rujukan nota kaki baharu.";
    const updatedFootnotes = [...footnotes, footnoteText];
    setFootnotes(updatedFootnotes);

    const footnoteNum = updatedFootnotes.length;
    const marker = `[^${footnoteNum}]`;
    const wrapped = `${text}${marker}`;
    const newValue = val.substring(0, start) + wrapped + val.substring(end);

    handleValueChange(selectionState.textareaId, newValue, updatedFootnotes);

    setSelectionState(null);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start, start + wrapped.length);
    }, 50);
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setToastVisible(true);
  };

  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => {
        setToastVisible(false);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  // Update states when entry changes
  useEffect(() => {
    setTitle(entry.title || '');
    setContentType(entry.contentType);
    setStatus(entry.status);
    setVisibility(entry.visibility);
    setTags(entry.tags);
    setSlug(entry.slug);
    setFootnotes(entry.footnotes || []);
    setFootnotesData(entry.footnotesData || []);
    setContent(entry.content);
    setMarginNotes(entry.marginNotes || {});
    setExcerpt(entry.excerpt || '');
    setFeaturedImage(entry.featuredImage || '');
    setRevisions(entry.revisions || []);
    setCitations(entry.citations || []);
    setReferenceSortOrder(entry.referenceSortOrder || 'alphabetical');
    setMarginNotesData(entry.marginNotesData || {});

    // Only re-split content if a completely different entry was loaded!
    if (entry.id !== prevEntryId) {
      setPrevEntryId(entry.id);
      const parts = entry.content.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      setParagraphs(parts.length > 0 ? parts : [entry.content]);
    }
  }, [entry, prevEntryId]);

  // Synchronize paragraphs array from content string for all modes
  useEffect(() => {
    const parts = content.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    setParagraphs(parts.length > 0 ? parts : [content]);
  }, [content]);

  // Document Stats Helpers
  const getCharCount = (text: string) => {
    return text ? text.length : 0;
  };

  const getFullContentString = () => {
    if (contentType === 'Article') {
      return paragraphs.join('\n\n');
    }
    return content;
  };

  const validateLimits = (
    currentContent = content,
    currentFootnotes = footnotes,
    currentMarginNotes = marginNotes,
    currentType = contentType
  ): string | null => {
    // 1. Check entry content limit
    const cleanContent = currentType === 'Article' 
      ? paragraphs.join('\n\n') 
      : currentContent;
    const strippedContent = cleanContent.replace(/<[^>]*>/g, ' ');
    const wordCount = getWordCount(strippedContent);

    if (currentType === 'Note' && wordCount > 100) {
      return `Note exceeds the maximum limit of 100 words (Current: ${wordCount} words). Please shorten your note.`;
    }
    if (currentType === 'Essay' && wordCount > 1000) {
      return `Essay exceeds the maximum limit of 1000 words (Current: ${wordCount} words). Please shorten your essay.`;
    }
    if (currentType === 'Article' && wordCount > 10000) {
      return `Article exceeds the maximum limit of 10,000 words (Current: ${wordCount} words). Please shorten your article.`;
    }

    // 2. Check each footnote limit
    if (currentType === 'Essay' || currentType === 'Article') {
      for (let i = 0; i < currentFootnotes.length; i++) {
        const fnWords = getWordCount(currentFootnotes[i]);
        if (fnWords > 1000) {
          return `Footnote #[${i + 1}] exceeds the maximum limit of 1000 words (Current: ${fnWords} words). Please shorten this footnote.`;
        }
      }
    }

    // 3. Check each margin note limit
    if (currentType === 'Article') {
      const keys = Object.keys(currentMarginNotes);
      for (const key of keys) {
        const idx = parseInt(key, 10);
        const marginNoteText = currentMarginNotes[idx] || '';
        const mnWords = getWordCount(marginNoteText);
        if (mnWords > 50) {
          return `Margin Note for Block #${idx + 1} exceeds the maximum limit of 50 words (Current: ${mnWords} words). Please shorten this margin note.`;
        }
      }
    }

    return null;
  };

  // Keyboard Formatting Inserters
  const insertMarkdownText = (beforeText: string, afterText: string = '') => {
    const id = activeTextareaIdx !== null ? `editorial-content-textarea-${activeTextareaIdx}` : 'editorial-content-textarea';
    const textarea = document.getElementById(id) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;

    const selectedText = val.substring(start, end);
    const inserted = beforeText + selectedText + afterText;
    const newValue = val.substring(0, start) + inserted + val.substring(end);

    if (contentType === 'Article' && activeTextareaIdx !== null) {
      handleContentChange(activeTextareaIdx, newValue);
    } else {
      setContent(newValue);
      triggerSave(newValue, footnotes, marginNotes);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + beforeText.length, start + beforeText.length + selectedText.length);
    }, 50);
  };

  const insertLinePrefix = (prefix: string) => {
    const id = activeTextareaIdx !== null ? `editorial-content-textarea-${activeTextareaIdx}` : 'editorial-content-textarea';
    const textarea = document.getElementById(id) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const val = textarea.value;
    const lineStart = val.lastIndexOf('\n', start - 1) + 1;
    const before = val.substring(0, lineStart);
    const after = val.substring(lineStart);

    const newValue = before + prefix + after;
    if (contentType === 'Article' && activeTextareaIdx !== null) {
      handleContentChange(activeTextareaIdx, newValue);
    } else {
      setContent(newValue);
      triggerSave(newValue, footnotes, marginNotes);
    }

    setTimeout(() => {
      textarea.focus();
      const newCursor = start + prefix.length;
      textarea.setSelectionRange(newCursor, newCursor);
    }, 50);
  };

  // Global shortcut handler for Bold (Ctrl+B), Italic (Ctrl+I), Headings (Ctrl+Shift+1/2/3), Inline Code (Ctrl+Shift+K)
  useEffect(() => {
    if (mode !== 'edit') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const isB = (event.key === 'b' || event.key === 'B') && (event.ctrlKey || event.metaKey);
      const isI = (event.key === 'i' || event.key === 'I') && (event.ctrlKey || event.metaKey);
      const isH1 = event.shiftKey && (event.key === '!' || event.key === '1') && (event.ctrlKey || event.metaKey);
      const isH2 = event.shiftKey && (event.key === '@' || event.key === '2') && (event.ctrlKey || event.metaKey);
      const isH3 = event.shiftKey && (event.key === '#' || event.key === '3') && (event.ctrlKey || event.metaKey);
      const isCode = event.shiftKey && (event.key === 'k' || event.key === 'K') && (event.ctrlKey || event.metaKey);

      if (!isB && !isI && !isH1 && !isH2 && !isH3 && !isCode) return;

      const activeEl = document.activeElement;
      if (!activeEl) return;

      const isTextArea = activeEl instanceof HTMLTextAreaElement;
      const isInput = activeEl instanceof HTMLInputElement;
      if (!isTextArea && !isInput) return;

      const inputEl = activeEl as HTMLTextAreaElement | HTMLInputElement;
      
      const start = inputEl.selectionStart;
      const end = inputEl.selectionEnd;
      if (start === null || end === null) return;

      event.preventDefault();

      const value = inputEl.value;

      const updateInputValue = (val: string, newStart: number, newEnd: number) => {
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(inputEl),
          'value'
        )?.set;
        
        if (nativeInputValueSetter) {
          nativeInputValueSetter.call(inputEl, val);
        } else {
          inputEl.value = val;
        }

        inputEl.setSelectionRange(newStart, newEnd);
        const inputEvent = new Event('input', { bubbles: true });
        inputEl.dispatchEvent(inputEvent);
      };

      if (isB || isI) {
        const selectedText = value.substring(start, end);
        const marker = isB ? '**' : '*';
        let newValue = '';
        let newStart = start;
        let newEnd = end;

        if (selectedText.startsWith(marker) && selectedText.endsWith(marker) && selectedText.length >= marker.length * 2) {
          const unwrapped = selectedText.substring(marker.length, selectedText.length - marker.length);
          newValue = value.substring(0, start) + unwrapped + value.substring(end);
          newStart = start;
          newEnd = start + unwrapped.length;
        } else {
          const wrapped = marker + selectedText + marker;
          newValue = value.substring(0, start) + wrapped + value.substring(end);
          newStart = start + marker.length;
          newEnd = end + marker.length;
        }
        updateInputValue(newValue, newStart, newEnd);
      } else if (isH1 || isH2 || isH3) {
        const level = isH1 ? 1 : isH2 ? 2 : 3;
        const prefix = '#'.repeat(level) + ' ';
        const lineStart = value.lastIndexOf('\n', start - 1) + 1;
        const lineEnd = value.indexOf('\n', start);
        const actualLineEnd = lineEnd === -1 ? value.length : lineEnd;
        const lineText = value.substring(lineStart, actualLineEnd);

        let newLineText = lineText;
        if (lineText.startsWith(prefix)) {
          newLineText = lineText.substring(prefix.length);
        } else {
          const cleanLine = lineText.replace(/^#{1,3}\s+/, '');
          newLineText = prefix + cleanLine;
        }

        const newValue = value.substring(0, lineStart) + newLineText + value.substring(actualLineEnd);
        const newCursorPos = lineStart + newLineText.length;
        updateInputValue(newValue, newCursorPos, newCursorPos);
      } else if (isCode) {
        const selectedText = value.substring(start, end);
        const marker = '`';
        let newValue = '';
        let newStart = start;
        let newEnd = end;

        if (selectedText.startsWith(marker) && selectedText.endsWith(marker)) {
          const unwrapped = selectedText.substring(1, selectedText.length - 1);
          newValue = value.substring(0, start) + unwrapped + value.substring(end);
          newStart = start;
          newEnd = start + unwrapped.length;
        } else {
          const wrapped = marker + selectedText + marker;
          newValue = value.substring(0, start) + wrapped + value.substring(end);
          newStart = start + 1;
          newEnd = end + 1;
        }
        updateInputValue(newValue, newStart, newEnd);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mode]);

  // Debounced Autosave engine
  const triggerAutosave = (
    updatedContent = stateRef.current.content,
    updatedFootnotes = stateRef.current.footnotes,
    updatedMarginNotes = stateRef.current.marginNotes,
    updatedType = stateRef.current.contentType,
    updatedStatus = stateRef.current.status,
    updatedVisibility = stateRef.current.visibility,
    updatedTags = stateRef.current.tags,
    updatedSlug = stateRef.current.slug,
    updatedTitle = stateRef.current.title,
    updatedExcerpt = stateRef.current.excerpt,
    updatedFeaturedImage = stateRef.current.featuredImage,
    updatedRevisions = stateRef.current.revisions,
    updatedCitations = stateRef.current.citations,
    updatedReferenceSortOrder = stateRef.current.referenceSortOrder,
    updatedMarginNotesData = stateRef.current.marginNotesData,
    updatedFootnotesData = stateRef.current.footnotesData
  ) => {
    setSaveStatus('saving');
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      if (!onSave) return;
      try {
        const savedEntry: Entry = {
          ...entry,
          title: updatedTitle,
          contentType: updatedType,
          status: updatedStatus,
          visibility: updatedVisibility,
          tags: updatedTags,
          slug: updatedSlug,
          content: updatedContent,
          footnotes: (updatedType === 'Essay' || updatedType === 'Article') ? updatedFootnotes : undefined,
          footnotesData: (updatedType === 'Essay' || updatedType === 'Article') ? updatedFootnotesData : undefined,
          marginNotes: updatedType === 'Article' ? updatedMarginNotes : undefined,
          marginNotesData: updatedMarginNotesData,
          excerpt: updatedExcerpt,
          featuredImage: updatedFeaturedImage,
          revisions: updatedRevisions,
          citations: updatedCitations,
          referenceSortOrder: updatedReferenceSortOrder,
          publishedDate: updatedStatus === 'Published' ? (entry.publishedDate || new Date().toISOString()) : null,
          updatedDate: new Date().toISOString(),
          canonicalUrl: entry.publicationClass === 'Institutional' ? `https://adjung.com/${updatedType === 'Notice' ? 'notice' : 'editorial'}/${updatedSlug}` : `https://${authorName.toLowerCase().replace(/\s+/g, '')}.Adjung.com/${updatedType.toLowerCase()}/${updatedSlug}`
        };
        onSave(savedEntry);
        setSaveStatus('saved');
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (e) {
        setSaveStatus('error');
      }
    }, 1500);
  };

  const forceImmediateSave = (updatedStatus = status, updatedVisibility = visibility, customRevisions?: Revision[]) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    if (!onSave) return;
    try {
      setSaveStatus('saving');
      
      let nextRevisions = customRevisions || stateRef.current.revisions;
      if (!customRevisions) {
        // Create manual action snapshot
        const newRev: Revision = {
          id: generateUUID(),
          timestamp: new Date().toISOString(),
          title: stateRef.current.title,
          content: stateRef.current.content,
          excerpt: stateRef.current.excerpt,
          featuredImage: stateRef.current.featuredImage,
          footnotes: (stateRef.current.contentType === 'Essay' || stateRef.current.contentType === 'Article') ? stateRef.current.footnotes : undefined,
          marginNotes: stateRef.current.contentType === 'Article' ? stateRef.current.marginNotes : undefined,
          marginNotesData: stateRef.current.marginNotesData,
          status: updatedStatus,
          visibility: updatedVisibility,
          tags: stateRef.current.tags,
          slug: stateRef.current.slug,
          citations: stateRef.current.citations,
          referenceSortOrder: stateRef.current.referenceSortOrder
        };
        nextRevisions = [...nextRevisions, newRev];
        setRevisions(nextRevisions);
      }

      const savedEntry: Entry = {
        ...entry,
        title: stateRef.current.title,
        contentType: stateRef.current.contentType,
        status: updatedStatus,
        visibility: updatedVisibility,
        tags: stateRef.current.tags,
        slug: stateRef.current.slug,
        content: stateRef.current.content,
        footnotes: (stateRef.current.contentType === 'Essay' || stateRef.current.contentType === 'Article') ? stateRef.current.footnotes : undefined,
        marginNotes: stateRef.current.contentType === 'Article' ? stateRef.current.marginNotes : undefined,
        marginNotesData: stateRef.current.marginNotesData,
        excerpt: stateRef.current.excerpt,
        featuredImage: stateRef.current.featuredImage,
        revisions: nextRevisions,
        citations: stateRef.current.citations,
        referenceSortOrder: stateRef.current.referenceSortOrder,
        publishedDate: updatedStatus === 'Published' ? (entry.publishedDate || new Date().toISOString()) : null,
        updatedDate: new Date().toISOString(),
        canonicalUrl: entry.publicationClass === 'Institutional' ? `https://adjung.com/${stateRef.current.contentType === 'Notice' ? 'notice' : 'editorial'}/${stateRef.current.slug}` : `https://${authorName.toLowerCase().replace(/\s+/g, '')}.Adjung.com/${stateRef.current.contentType.toLowerCase()}/${stateRef.current.slug}`
      };
      onSave(savedEntry);
      setSaveStatus('saved');
      setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (e) {
      setSaveStatus('error');
    }
  };

  const triggerSave = (
    updatedContent: string,
    updatedFootnotes: string[],
    updatedMarginNotes: { [key: number]: string },
    updatedType = contentType,
    updatedStatus = status,
    updatedVisibility = visibility,
    updatedTags = tags,
    updatedSlug = slug,
    updatedTitle = title,
    updatedExcerpt = excerpt,
    updatedFeaturedImage = featuredImage,
    updatedRevisions = revisions,
    updatedCitations = citations,
    updatedReferenceSortOrder = referenceSortOrder,
    updatedMarginNotesData = marginNotesData,
    updatedFootnotesData = footnotesData
  ) => {
    triggerAutosave(
      updatedContent,
      updatedFootnotes,
      updatedMarginNotes,
      updatedType,
      updatedStatus,
      updatedVisibility,
      updatedTags,
      updatedSlug,
      updatedTitle,
      updatedExcerpt,
      updatedFeaturedImage,
      updatedRevisions,
      updatedCitations,
      updatedReferenceSortOrder,
      updatedMarginNotesData,
      updatedFootnotesData
    );
  };

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (mode === 'edit') {
      const generatedSlug = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
      setSlug(generatedSlug);
      triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, generatedSlug, val, excerpt, featuredImage);
    }
  };

  const handleExcerptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setExcerpt(val);
    triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, val, featuredImage);
  };

  const handleFeaturedImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFeaturedImage(val);
    triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, val);
  };

  const generateUUID = () => {
    return 'rev-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  const handleCreateManualRevision = () => {
    const newRev: Revision = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      title: stateRef.current.title,
      content: stateRef.current.content,
      excerpt: stateRef.current.excerpt,
      featuredImage: stateRef.current.featuredImage,
      footnotes: stateRef.current.contentType === 'Essay' ? stateRef.current.footnotes : undefined,
      marginNotes: stateRef.current.contentType === 'Article' ? stateRef.current.marginNotes : undefined,
      status: stateRef.current.status,
      visibility: stateRef.current.visibility,
      tags: stateRef.current.tags,
      slug: stateRef.current.slug
    };

    const updated = [...revisions, newRev];
    setRevisions(updated);
    forceImmediateSave(status, visibility, updated);
    showToast('Revision snapshot captured', 'success');
  };

  const handleRestoreRevision = (rev: Revision) => {
    const confirmRestore = window.confirm(
      `Are you sure you want to restore revision from ${new Date(rev.timestamp).toLocaleString()}? Your current edits will be saved as a backup snapshot.`
    );
    if (!confirmRestore) return;

    // 1. Create a backup snapshot of current state
    const backupRev: Revision = {
      id: generateUUID(),
      timestamp: new Date().toISOString(),
      title: stateRef.current.title,
      content: stateRef.current.content,
      excerpt: stateRef.current.excerpt,
      featuredImage: stateRef.current.featuredImage,
      footnotes: (stateRef.current.contentType === 'Essay' || stateRef.current.contentType === 'Article') ? stateRef.current.footnotes : undefined,
      footnotesData: (stateRef.current.contentType === 'Essay' || stateRef.current.contentType === 'Article') ? stateRef.current.footnotesData : undefined,
      marginNotes: stateRef.current.contentType === 'Article' ? stateRef.current.marginNotes : undefined,
      marginNotesData: stateRef.current.marginNotesData,
      status: stateRef.current.status,
      visibility: stateRef.current.visibility,
      tags: stateRef.current.tags,
      slug: stateRef.current.slug
    };

    // 2. Restore states
    setTitle(rev.title);
    setContent(rev.content);
    setExcerpt(rev.excerpt || '');
    setFeaturedImage(rev.featuredImage || '');
    setFootnotes(rev.footnotes || []);
    setFootnotesData(rev.footnotesData || []);
    setMarginNotes(rev.marginNotes || {});
    setMarginNotesData(rev.marginNotesData || {});
    setStatus(rev.status);
    setVisibility(rev.visibility);
    setTags(rev.tags);
    setSlug(rev.slug);

    if (contentType === 'Article') {
      const parts = rev.content.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      setParagraphs(parts.length > 0 ? parts : [rev.content]);
    }

    const updatedRevisions = [...revisions, backupRev];
    setRevisions(updatedRevisions);

    // Save immediately
    const savedEntry: Entry = {
      ...entry,
      title: rev.title,
      contentType,
      status: rev.status,
      visibility: rev.visibility,
      tags: rev.tags,
      slug: rev.slug,
      content: rev.content,
      footnotes: (contentType === 'Essay' || contentType === 'Article') ? rev.footnotes : undefined,
      footnotesData: (contentType === 'Essay' || contentType === 'Article') ? rev.footnotesData : undefined,
      marginNotes: contentType === 'Article' ? rev.marginNotes : undefined,
      marginNotesData: rev.marginNotesData,
      excerpt: rev.excerpt,
      featuredImage: rev.featuredImage,
      revisions: updatedRevisions,
      publishedDate: rev.status === 'Published' ? (entry.publishedDate || new Date().toISOString()) : null,
      updatedDate: new Date().toISOString(),
      canonicalUrl: entry.publicationClass === 'Institutional' ? `https://adjung.com/${contentType === 'Notice' ? 'notice' : 'editorial'}/${rev.slug}` : `https://${authorName.toLowerCase().replace(/\s+/g, '')}.Adjung.com/${contentType.toLowerCase()}/${rev.slug}`
    };

    if (onSave) {
      onSave(savedEntry);
    }
    setSaveStatus('saved');
    setLastSavedTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    showToast('Revision restored successfully', 'success');
  };

  const getXmlString = () => {
    return DocumentExporter.exportToXml(
      {
        ...entry,
        title,
        contentType,
        content: getFullContentString(),
        excerpt,
        tags,
        slug,
        citations,
        referenceSortOrder
      },
      authorName
    );
  };

  const handleAddCitation = (cit: Omit<Citation, 'id'>) => {
    const newCitation: Citation = {
      ...cit,
      id: 'cite-' + Math.random().toString(36).substring(2, 11)
    };
    const updated = [...citations, newCitation];
    setCitations(updated);
    triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, updated);
    showToast('Citation registered', 'success');
  };

  const handleDeleteCitation = (id: string) => {
    const updated = citations.filter(c => c.id !== id);
    setCitations(updated);
    triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, updated);
    showToast('Citation removed', 'info');
  };

  const handleContentChange = (index: number, newText: string) => {
    const updatedParagraphs = [...paragraphs];
    updatedParagraphs[index] = newText;
    setParagraphs(updatedParagraphs);
    const newContentString = updatedParagraphs.join('\n\n');
    setContent(newContentString);
    triggerSave(newContentString, footnotes, marginNotes);
  };

  const handleBlockTypeChange = (index: number, newType: 'paragraph' | 'latin-quote' | 'arabic-quote') => {
    let serialized = '';
    if (newType === 'paragraph') {
      serialized = 'New paragraph text.';
    } else if (newType === 'latin-quote') {
      serialized = '<quote type="latin"><text>New Latin quote text.</text></quote>';
    } else if (newType === 'arabic-quote') {
      serialized = '<quote type="arabic">\n  <arabic>اكتب النص العربي هنا</arabic>\n</quote>';
    }
    handleContentChange(index, serialized);
  };

  const insertQuoteAtCursor = (quoteText: string) => {
    const textarea = document.getElementById('editorial-content-textarea') as HTMLTextAreaElement;
    if (!textarea) {
      const updated = content ? `${content}\n\n${quoteText}` : quoteText;
      setContent(updated);
      triggerSave(updated, footnotes, marginNotes);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const val = textarea.value;

    const before = val.substring(0, start);
    const after = val.substring(end);

    const spacingBefore = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
    const spacingAfter = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';

    const inserted = spacingBefore + quoteText + spacingAfter;
    const newValue = before + inserted + after;

    setContent(newValue);
    triggerSave(newValue, footnotes, marginNotes);

    setTimeout(() => {
      textarea.focus();
      const cursorIdx = start + inserted.length;
      textarea.setSelectionRange(cursorIdx, cursorIdx);
    }, 50);
  };

  const handleAddParagraph = () => {
    const updatedParagraphs = [...paragraphs, ''];
    setParagraphs(updatedParagraphs);
    const newContentString = updatedParagraphs.join('\n\n');
    setContent(newContentString);
    triggerSave(newContentString, footnotes, marginNotes);
  };

  const handleRemoveParagraph = (index: number) => {
    if (paragraphs.length <= 1) return;
    const updatedParagraphs = paragraphs.filter((_, i) => i !== index);
    setParagraphs(updatedParagraphs);
    const newContentString = updatedParagraphs.join('\n\n');
    setContent(newContentString);

    // Shift margin notes as well
    const newMarginNotes: { [key: number]: string } = {};
    Object.keys(marginNotes).forEach(key => {
      const k = parseInt(key);
      if (k < index) {
        newMarginNotes[k] = marginNotes[k];
      } else if (k > index) {
        newMarginNotes[k - 1] = marginNotes[k];
      }
    });
    setMarginNotes(newMarginNotes);

    triggerSave(newContentString, footnotes, newMarginNotes);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const updatedParagraphs = [...paragraphs];
    const temp = updatedParagraphs[index];
    updatedParagraphs[index] = updatedParagraphs[index - 1];
    updatedParagraphs[index - 1] = temp;
    
    // Also swap margin notes!
    const updatedMarginNotes = { ...marginNotes };
    const tempNote = updatedMarginNotes[index];
    if (updatedMarginNotes[index - 1] !== undefined) {
      updatedMarginNotes[index] = updatedMarginNotes[index - 1];
    } else {
      delete updatedMarginNotes[index];
    }
    if (tempNote !== undefined) {
      updatedMarginNotes[index - 1] = tempNote;
    } else {
      delete updatedMarginNotes[index - 1];
    }

    setParagraphs(updatedParagraphs);
    setMarginNotes(updatedMarginNotes);
    const newContentString = updatedParagraphs.join('\n\n');
    setContent(newContentString);
    triggerSave(newContentString, footnotes, updatedMarginNotes);
  };

  const handleMoveDown = (index: number) => {
    if (index === paragraphs.length - 1) return;
    const updatedParagraphs = [...paragraphs];
    const temp = updatedParagraphs[index];
    updatedParagraphs[index] = updatedParagraphs[index + 1];
    updatedParagraphs[index + 1] = temp;

    // Also swap margin notes!
    const updatedMarginNotes = { ...marginNotes };
    const tempNote = updatedMarginNotes[index];
    if (updatedMarginNotes[index + 1] !== undefined) {
      updatedMarginNotes[index] = updatedMarginNotes[index + 1];
    } else {
      delete updatedMarginNotes[index];
    }
    if (tempNote !== undefined) {
      updatedMarginNotes[index + 1] = tempNote;
    } else {
      delete updatedMarginNotes[index + 1];
    }

    setParagraphs(updatedParagraphs);
    setMarginNotes(updatedMarginNotes);
    const newContentString = updatedParagraphs.join('\n\n');
    setContent(newContentString);
    triggerSave(newContentString, footnotes, updatedMarginNotes);
  };

  const handleDuplicateParagraph = (index: number) => {
    const updatedParagraphs = [...paragraphs];
    const blockToCopy = updatedParagraphs[index];
    updatedParagraphs.splice(index + 1, 0, blockToCopy);

    // Also copy margin note to the duplicated block, and shift any subsequent notes
    const updatedMarginNotes: { [key: number]: string } = {};
    Object.keys(marginNotes).forEach(key => {
      const k = parseInt(key);
      if (k <= index) {
        updatedMarginNotes[k] = marginNotes[k];
      } else {
        updatedMarginNotes[k + 1] = marginNotes[k];
      }
    });
    // Duplicate the margin note if it exists
    if (marginNotes[index] !== undefined) {
      updatedMarginNotes[index + 1] = marginNotes[index];
    }

    setParagraphs(updatedParagraphs);
    setMarginNotes(updatedMarginNotes);
    const newContentString = updatedParagraphs.join('\n\n');
    setContent(newContentString);
    triggerSave(newContentString, footnotes, updatedMarginNotes);
  };

  const handleInsertBelow = (index: number) => {
    const updatedParagraphs = [...paragraphs];
    updatedParagraphs.splice(index + 1, 0, '');

    // Shift margin notes for any subsequent blocks
    const updatedMarginNotes: { [key: number]: string } = {};
    Object.keys(marginNotes).forEach(key => {
      const k = parseInt(key);
      if (k <= index) {
        updatedMarginNotes[k] = marginNotes[k];
      } else {
        updatedMarginNotes[k + 1] = marginNotes[k];
      }
    });

    setParagraphs(updatedParagraphs);
    setMarginNotes(updatedMarginNotes);
    const newContentString = updatedParagraphs.join('\n\n');
    setContent(newContentString);
    triggerSave(newContentString, footnotes, updatedMarginNotes);
  };

  const handleUpdateContentImage = (blockIndex: number, newUrl: string, newAlt: string) => {
    if (contentType === 'Article') {
      const updated = [...paragraphs];
      updated[blockIndex] = `![${newAlt.trim()}](${newUrl.trim()})`;
      setParagraphs(updated);
      const newContentString = updated.join('\n\n');
      setContent(newContentString);
      triggerSave(newContentString, footnotes, marginNotes);
    } else {
      const blocks = parseContentToBlocks(content);
      if (blocks[blockIndex] && blocks[blockIndex].type === 'image') {
        const imgBlock = blocks[blockIndex] as ImageBlock;
        imgBlock.url = newUrl.trim();
        imgBlock.alt = newAlt.trim();
        const serialized = serializeBlocks(blocks);
        setContent(serialized);
        triggerSave(serialized, footnotes, marginNotes);
      }
    }
  };

  const runImageValidation = async () => {
    setIsValidationRunning(true);
    setValidationErrors([]);
    setValidationSuccess(false);
    setHasValidated(true);

    const imagesToCheck: { label: string; url: string }[] = [];
    if (featuredImage && featuredImage.trim()) {
      imagesToCheck.push({ label: 'Featured Image', url: featuredImage.trim() });
    }

    const blocks = parseContentToBlocks(content);
    let imageIdx = 1;
    blocks.forEach(block => {
      if (block.type === 'image') {
        imagesToCheck.push({
          label: `Figure ${imageIdx}: ${block.alt || 'Untitled'}`,
          url: block.url
        });
        imageIdx++;
      }
    });

    if (imagesToCheck.length === 0) {
      setIsValidationRunning(false);
      setValidationSuccess(true);
      return;
    }

    const errors: string[] = [];
    const checks = imagesToCheck.map(async (img) => {
      const isOk = await new Promise<boolean>((resolve) => {
        if (!img.url) {
          resolve(false);
          return;
        }
        if (img.url.startsWith('data:') || img.url.startsWith('blob:') || !img.url.startsWith('http')) {
          resolve(true);
          return;
        }
        const tester = new Image();
        tester.onload = () => resolve(true);
        tester.onerror = () => resolve(false);
        tester.src = img.url;
      });
      if (!isOk) {
        errors.push(`${img.label} (${img.url})`);
      }
    });

    await Promise.all(checks);
    setIsValidationRunning(false);
    if (errors.length > 0) {
      setValidationErrors(errors);
      setValidationSuccess(false);
    } else {
      setValidationSuccess(true);
    }
  };

  const handleMarginNoteChange = (index: number, val: string) => {
    const updated = { ...marginNotes };
    if (!val.trim()) {
      delete updated[index];
    } else {
      updated[index] = val;
    }
    setMarginNotes(updated);
    triggerSave(content, footnotes, updated);
  };

  const handleFootnoteChange = (originalId: string, val: string) => {
    let updatedData = [...footnotesData];
    const itemIdx = updatedData.findIndex(f => f.id === originalId);
    if (itemIdx !== -1) {
      updatedData[itemIdx] = { ...updatedData[itemIdx], content: val };
    } else {
      updatedData.push({ id: originalId, content: val });
    }
    setFootnotesData(updatedData);

    const ordered = getOrderedFootnotesToRender();
    const orderedItem = ordered.find(o => o.originalId === originalId);
    let updatedFootnotes = [...footnotes];
    if (orderedItem) {
      const displayIdx = orderedItem.displayNum - 1;
      while (updatedFootnotes.length <= displayIdx) {
        updatedFootnotes.push('');
      }
      updatedFootnotes[displayIdx] = val;
    } else {
      const isLegacy = !isNaN(Number(originalId));
      if (isLegacy) {
        const idx = parseInt(originalId, 10) - 1;
        if (idx >= 0) {
          while (updatedFootnotes.length <= idx) {
            updatedFootnotes.push('');
          }
          updatedFootnotes[idx] = val;
        }
      }
    }
    setFootnotes(updatedFootnotes);

    triggerSave(
      content,
      updatedFootnotes,
      marginNotes,
      contentType,
      status,
      visibility,
      tags,
      slug,
      title,
      excerpt,
      featuredImage,
      revisions,
      citations,
      referenceSortOrder,
      marginNotesData,
      updatedData
    );
  };

  const handleAddFootnote = () => {
    const id = `fn-${generateUUID()}`;
    const newText = 'New footnote citation text.';
    const updatedFootnotes = [...footnotes, newText];
    const updatedData = [...footnotesData, { id, content: newText }];
    setFootnotes(updatedFootnotes);
    setFootnotesData(updatedData);
    triggerSave(content, updatedFootnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, citations, referenceSortOrder, marginNotesData, updatedData);
  };

  const handleRemoveFootnote = (originalId: string) => {
    const updatedData = footnotesData.filter(f => f.id !== originalId);
    setFootnotesData(updatedData);

    const ordered = getOrderedFootnotesToRender();
    const orderedItem = ordered.find(o => o.originalId === originalId);
    let updatedFootnotes = footnotes;
    if (orderedItem) {
      const idx = orderedItem.displayNum - 1;
      updatedFootnotes = footnotes.filter((_, i) => i !== idx);
      setFootnotes(updatedFootnotes);
    } else {
      const isLegacy = !isNaN(Number(originalId));
      if (isLegacy) {
        const idx = parseInt(originalId, 10) - 1;
        updatedFootnotes = footnotes.filter((_, i) => i !== idx);
        setFootnotes(updatedFootnotes);
      }
    }

    const isLegacy = !isNaN(Number(originalId));
    let targetRegex: RegExp;
    if (isLegacy) {
      targetRegex = new RegExp(`\\[\\^${originalId}\\]`, 'g');
    } else {
      targetRegex = new RegExp(`\\[\\^${originalId.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\]`, 'g');
    }

    let newContent = content.replace(targetRegex, '');

    if (isLegacy) {
      const index = parseInt(originalId, 10) - 1;
      newContent = newContent.replace(/\[\^(\d+)\]/g, (match, fnNumStr) => {
        const num = parseInt(fnNumStr, 10);
        if (num > index + 1) {
          return `[^${num - 1}]`;
        }
        return match;
      });
    }

    setContent(newContent);
    const parts = newContent.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    setParagraphs(parts.length > 0 ? parts : [newContent]);

    const editorEl = document.getElementById('editorial-canvas-editor');
    if (editorEl) {
      const badge = editorEl.querySelector(`[data-id="${originalId}"]`);
      if (badge) {
        badge.remove();
      }
    }

    triggerSave(
      newContent,
      updatedFootnotes,
      marginNotes,
      contentType,
      status,
      visibility,
      tags,
      slug,
      title,
      excerpt,
      featuredImage,
      revisions,
      citations,
      referenceSortOrder,
      marginNotesData,
      updatedData
    );
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const updated = tags.filter(t => t !== tagToRemove);
    setTags(updated);
    triggerSave(content, footnotes, marginNotes, contentType, status, visibility, updated);
  };

  // Format date elegantly
  const formatDate = (isoString: string | null) => {
    if (!isoString) return 'Unpublished';
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  /**
   * Renders a ContentBlock semantically according to strict, restrained editorial standards.
   */
  const getCitationsMap = () => {
    const map: { [id: string]: number } = {};
    const allBlocks = parseContentToBlocks(getFullContentString());
    let index = 1;
    allBlocks.forEach(b => {
      let txt = '';
      if (b.type === 'paragraph') txt = b.text;
      else if (b.type === 'heading') txt = b.text;
      else if (b.type === 'latin-quote') txt = b.text;
      else if (b.type === 'arabic-quote') txt = b.arabic + ' ' + (b.translation || '');
      else if (b.type === 'callout') txt = b.text;
      else if (b.type === 'list') txt = b.items.map(i => i.text).join(' ');
      else if (b.type === 'table') txt = b.headers.join(' ') + ' ' + b.rows.map(r => r.join(' ')).join(' ');
      
      const citeRegex = /\[cite:([^\]]+)\]/g;
      let match;
      while ((match = citeRegex.exec(txt)) !== null) {
        const id = match[1];
        if (!map[id]) {
          map[id] = index++;
        }
      }
    });
    return map;
  };

  const getFigureNumber = (currentIdx: number) => {
    let figCount = 0;
    const allBlocks = parseContentToBlocks(getFullContentString());
    for (let i = 0; i <= currentIdx && i < allBlocks.length; i++) {
      if (allBlocks[i].type === 'image') {
        figCount++;
      }
    }
    return figCount;
  };

  const toRoman = (num: number): string => {
    const val = [10, 9, 5, 4, 1];
    const syb = ["x", "ix", "v", "iv", "i"];
    let roman = "";
    let n = num;
    for (let i = 0; i < val.length; i++) {
      while (n >= val[i]) {
        roman += syb[i];
        n -= val[i];
      }
    }
    return roman;
  };

  const renderBlock = (block: ContentBlock, idx: number, marginNoteNum?: number, marginNoteText?: string) => {
    const citeMap = getCitationsMap();
    const fMap = getFootnotesReadingOrderMap().map;
    const mOrderMap = getMarginNotesReadingOrderMap().map;

    const renderSuperscriptWithNote = (num: number, text?: string) => {
      const roman = toRoman(num).toLowerCase();
      return (
        <span className="inline select-none ml-1 relative">
          <span className="margin-note-ref text-[10px] font-medium align-super select-none text-Adjung-maroon font-sans px-0.5 cursor-default" title={`Margin Note ${roman}`}>
            ({roman})
          </span>
          {text && (
            <span className="absolute top-0 left-[calc(100%+24px)] xl:left-[calc(100%+32px)] w-[190px] xl:w-[240px] pl-2 flex flex-col justify-start text-left font-sans text-[11px] xl:text-xs text-stone-650 xl:text-stone-600 leading-relaxed pointer-events-auto select-text normal-case not-italic font-normal">
              <span className="block">
                <span className="font-sans text-[10px] font-medium align-super text-Adjung-maroon mr-1.5 select-none">({roman})</span>
                {parseInlineFormatting(text, citations, referenceSortOrder, citeMap, fMap, undefined, undefined, mOrderMap)}
              </span>
            </span>
          )}
        </span>
      );
    };

    if (block.type === 'heading') {
      const isAr = isArabicText(block.text);
      const textNode = parseInlineFormatting(block.text, citations, referenceSortOrder, citeMap, fMap);
      if (block.level === 1) {
        return (
          <h2 
            key={idx} 
            id={`heading-${idx}`}
            dir={isAr ? 'rtl' : 'ltr'} 
            className={`font-serif text-stone-900 font-light mt-8 mb-4 border-b border-stone-200/50 pb-2 relative overflow-visible ${
              isAr ? 'text-right text-2xl font-arabic leading-loose' : 'text-left text-xl md:text-2xl tracking-tight'
            }`}
          >
            {textNode}
            {marginNoteNum !== undefined && renderSuperscriptWithNote(marginNoteNum, marginNoteText)}
          </h2>
        );
      } else if (block.level === 2) {
        return (
          <h3 
            key={idx} 
            id={`heading-${idx}`}
            dir={isAr ? 'rtl' : 'ltr'} 
            className={`font-serif text-stone-850 font-normal mt-6 mb-3 relative overflow-visible ${
              isAr ? 'text-right text-xl font-arabic leading-loose' : 'text-left text-lg md:text-xl'
            }`}
          >
            {textNode}
            {marginNoteNum !== undefined && renderSuperscriptWithNote(marginNoteNum, marginNoteText)}
          </h3>
        );
      } else {
        return (
          <h4 
            key={idx} 
            id={`heading-${idx}`}
            dir={isAr ? 'rtl' : 'ltr'} 
            className={`font-serif text-stone-700 font-medium mt-4 mb-2 relative overflow-visible ${
              isAr ? 'text-right text-base font-arabic leading-loose' : 'text-left text-base'
            }`}
          >
            {textNode}
            {marginNoteNum !== undefined && renderSuperscriptWithNote(marginNoteNum, marginNoteText)}
          </h4>
        );
      }
    }

    if (block.type === 'list') {
      const listItems = block.items.map((item, itemIdx) => {
        const isAr = isArabicText(item.text);
        const isChecklist = item.checked !== undefined;
        const textNode = parseInlineFormatting(item.text, citations, referenceSortOrder, citeMap, fMap);
        if (isChecklist) {
          return (
            <li 
              key={itemIdx} 
              dir={isAr ? 'rtl' : 'ltr'} 
              className={`flex items-start gap-2.5 my-1.5 ${isAr ? 'justify-start flex-row-reverse text-right' : 'text-left'}`}
            >
              <input
                type="checkbox"
                checked={item.checked}
                disabled
                className="mt-1 h-3.5 w-3.5 rounded border-stone-300 text-Adjung-maroon focus:ring-Adjung-maroon accent-Adjung-maroon cursor-default"
              />
              <span className={`${item.checked ? 'line-through text-stone-400' : 'text-stone-700'} ${isAr ? 'font-arabic text-[17px] leading-loose' : 'font-serif text-[15px] md:text-base leading-relaxed'}`}>
                {textNode}
              </span>
            </li>
          );
        }
        return (
          <li 
            key={itemIdx} 
            className={`my-1 ${isAr ? 'font-arabic text-right text-[17px] leading-loose' : 'font-serif text-left text-[15px] md:text-base leading-relaxed'} text-stone-700`}
          >
            {textNode}
          </li>
        );
      });

      const isChecklist = block.items.some(i => i.checked !== undefined);
      if (block.ordered) {
        return (
          <ol key={idx} className={`my-4 pl-6 ${isChecklist ? 'list-none pl-0 space-y-1' : 'list-decimal space-y-1.5'}`}>
            {listItems}
          </ol>
        );
      } else {
        return (
          <ul key={idx} className={`my-4 pl-6 ${isChecklist ? 'list-none pl-0 space-y-1' : 'list-disc space-y-1.5'}`}>
            {listItems}
          </ul>
        );
      }
    }

    if (block.type === 'table') {
      return (
        <div key={idx} className="my-6 overflow-x-auto border border-stone-200/60 rounded">
          <table className="w-full text-left font-serif text-sm border-collapse bg-white">
            <thead>
              <tr className="bg-stone-50/50 border-b border-stone-200">
                {block.headers.map((h, hIdx) => {
                  const align = block.alignments?.[hIdx] || 'left';
                  const alignClass = align === 'center' ? 'text-center' : (align === 'right' ? 'text-right' : 'text-left');
                  return (
                    <th key={hIdx} className={`p-3 font-mono text-[9px] uppercase tracking-wider text-stone-500 font-semibold border-r border-stone-200 last:border-r-0 ${alignClass}`}>
                      {h}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rIdx) => (
                <tr key={rIdx} className="border-b border-stone-100 last:border-b-0 hover:bg-stone-50/30 transition-colors">
                  {row.map((cell, cIdx) => {
                    const align = block.alignments?.[cIdx] || 'left';
                    const alignClass = align === 'center' ? 'text-center' : (align === 'right' ? 'text-right' : 'text-left');
                    return (
                      <td key={cIdx} className={`p-3 text-stone-700 border-r border-stone-200 last:border-r-0 leading-relaxed font-sans text-xs md:text-sm ${alignClass}`}>
                        {parseInlineFormatting(cell, citations, referenceSortOrder, citeMap, fMap)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (block.type === 'image') {
      const figNum = getFigureNumber(idx);
      return (
        <EntryImage
          key={idx}
          url={block.url}
          alt={block.alt}
          figNum={figNum}
          isAuthor={mode === 'edit'}
          onUpdateImage={(newUrl, newAlt) => {
            handleUpdateContentImage(idx, newUrl, newAlt);
          }}
        />
      );
    }

    if (block.type === 'divider') {
      return <hr key={idx} className="my-8 border-t border-stone-200/60" />;
    }

    if (block.type === 'code-block') {
      return (
        <div key={idx} className="my-6 relative group text-left">
          {block.language && (
            <span className="absolute top-2 right-3 font-mono text-[8px] uppercase tracking-wider text-stone-400 select-none bg-stone-100/60 px-1 py-0.5 rounded border border-stone-200/40">
              {block.language}
            </span>
          )}
          <pre className="p-4 bg-stone-50 border border-stone-200/80 rounded font-mono text-xs overflow-x-auto text-stone-850 leading-relaxed">
            <code>{block.code}</code>
          </pre>
        </div>
      );
    }

    if (block.type === 'latin-quote') {
      return (
        <blockquote 
          key={idx} 
          className="my-8 pl-6 border-l-2 border-Adjung-maroon/20 text-left bg-transparent relative overflow-visible mx-auto max-w-[90%]"
        >
          <p className="font-serif italic text-[14.5px] md:text-[15.5px] text-stone-600 leading-relaxed my-1 relative overflow-visible">
            {parseInlineFormatting(block.text, citations, referenceSortOrder, citeMap, fMap)}
            {marginNoteNum !== undefined && renderSuperscriptWithNote(marginNoteNum, marginNoteText)}
          </p>
          {block.translation && (
            <div className="mt-2 text-stone-550 font-serif italic text-xs leading-relaxed">
              {parseInlineFormatting(block.translation, citations, referenceSortOrder, citeMap, fMap)}
            </div>
          )}
        </blockquote>
      );
    }

    if (block.type === 'arabic-quote') {
      return (
        <blockquote 
          key={idx} 
          className="my-8 pr-6 border-r-2 border-Adjung-maroon/20 text-right bg-transparent relative overflow-visible mx-auto max-w-[90%]"
        >
          <div dir="rtl">
            <p className="font-arabic text-[18.5px] md:text-[20px] text-stone-900 leading-loose relative overflow-visible">
              {parseInlineFormatting(block.arabic, citations, referenceSortOrder, citeMap, fMap)}
              {marginNoteNum !== undefined && renderSuperscriptWithNote(marginNoteNum, marginNoteText)}
            </p>
          </div>

          {block.translation && (
            <div dir="ltr" className="mt-4 pt-4 border-t border-stone-200/40 text-left">
              <p className="font-serif italic text-[13.5px] md:text-[14.5px] text-stone-500 leading-relaxed">
                {parseInlineFormatting(block.translation, citations, referenceSortOrder, citeMap, fMap)}
              </p>
            </div>
          )}
        </blockquote>
      );
    }

    if (block.type === 'callout') {
      const styles = {
        note: 'bg-stone-50 border-stone-300 text-stone-855',
        warning: 'bg-red-50/50 border-red-200 text-stone-850',
        tip: 'bg-emerald-50/20 border-emerald-200 text-stone-800',
        important: 'bg-stone-100/60 border-stone-800 text-stone-900',
        definition: 'bg-[#802334]/5 border-[#802334]/20 text-stone-855'
      };
      const titleStyles = {
        note: 'text-stone-700 font-bold font-mono',
        warning: 'text-red-950 font-bold font-mono',
        tip: 'text-emerald-950 font-bold font-mono',
        important: 'text-stone-900 font-bold font-mono',
        definition: 'text-[#802334] font-bold font-mono'
      };
      const typeLabels = {
        note: 'Note',
        warning: 'Warning',
        tip: 'Tip',
        important: 'Important',
        definition: 'Definition'
      };
      
      const themeClass = styles[block.calloutType] || styles.note;
      const titleTheme = titleStyles[block.calloutType] || titleStyles.note;
      const label = typeLabels[block.calloutType] || typeLabels.note;
      
      return (
        <div key={idx} className={`my-6 p-4 border-l-2 rounded-sm text-left relative overflow-visible ${themeClass}`}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className={`text-[10px] uppercase tracking-wider ${titleTheme}`}>
              {block.title ? `${label}: ${block.title}` : label}
            </span>
          </div>
          <p className="font-serif text-sm md:text-[15px] leading-relaxed my-0 whitespace-pre-wrap relative overflow-visible">
            {parseInlineFormatting(block.text, citations, referenceSortOrder, citeMap, fMap, undefined, undefined, mOrderMap)}
            {marginNoteNum !== undefined && renderSuperscriptWithNote(marginNoteNum, marginNoteText)}
          </p>
        </div>
      );
    }

    const isAr = isArabicText(block.text);
    const isNote = contentType === 'Note';

    if (contentType === 'Essay' && idx === 0 && !isAr) {
      const plainText = block.text;
      if (plainText.length > 0) {
        const firstLetter = plainText.charAt(0);
        const restText = plainText.substring(1);
        return (
          <p
            key={idx}
            className={`leading-relaxed text-left whitespace-pre-wrap relative overflow-visible ${activeSpec.typography.bodyFont}`}
          >
            <span className="float-left text-5xl md:text-6xl font-light text-[#802334] mr-2 mt-1 leading-none font-serif select-none">
              {firstLetter}
            </span>
            {parseInlineFormatting(restText, citations, referenceSortOrder, citeMap, fMap, undefined, undefined, mOrderMap)}
            {marginNoteNum !== undefined && renderSuperscriptWithNote(marginNoteNum, marginNoteText)}
          </p>
        );
      }
    }

    return (
      <p
        key={idx}
        dir={isAr ? 'rtl' : 'ltr'}
        className={`leading-relaxed whitespace-pre-wrap relative overflow-visible ${
          isAr 
            ? 'font-arabic text-right text-lg leading-loose' 
            : `${activeSpec.typography.bodyFont} text-left`
        }`}
        style={undefined}
      >
        {parseInlineFormatting(block.text, citations, referenceSortOrder, citeMap, fMap, undefined, undefined, mOrderMap)}
        {marginNoteNum !== undefined && renderSuperscriptWithNote(marginNoteNum, marginNoteText)}
      </p>
    );
  };

  const renderTableOfContents = () => {
    if (contentType === 'Note') return null;
    
    const allBlocks = parseContentToBlocks(getFullContentString());
    const headings = allBlocks.filter(b => b.type === 'heading') as HeadingBlock[];
    
    if (headings.length === 0) return null;
    
    return (
      <div className="mb-8 border border-stone-200/80 p-4 rounded bg-stone-50/20 text-left font-sans text-xs">
        <details className="group" open>
          <summary className="font-mono text-[9px] uppercase tracking-wider text-Adjung-maroon font-bold cursor-pointer list-none flex items-center justify-between">
            <span>Table of Contents Outline</span>
            <span className="text-stone-400 group-open:hidden">show</span>
            <span className="text-stone-400 hidden group-open:inline">hide</span>
          </summary>
          
          <ul className="mt-3.5 space-y-2 border-t border-stone-200/50 pt-3">
            {headings.map((h, hIdx) => {
              const levelIndent = h.level === 1 ? '' : (h.level === 2 ? 'pl-4 border-l border-stone-200' : 'pl-8 border-l border-stone-200');
              const levelMarker = h.level === 1 ? '§' : (h.level === 2 ? '•' : '◦');
              
              return (
                <li key={`toc-${hIdx}`} className={`${levelIndent} text-stone-600 hover:text-Adjung-maroon font-serif`}>
                  <a href={`#heading-${hIdx}`} className="flex items-baseline gap-1.5 transition-colors">
                    <span className="font-mono text-[9px] text-Adjung-maroon/60 select-none">{levelMarker}</span>
                    <span className="text-xs">{parseInlineFormatting(h.text)}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </details>
      </div>
    );
  };

  // Visual Mode Helper Actions
  const handleVisualBlockChange = (blockIdx: number, updatedBlock: ContentBlock) => {
    if (contentType === 'Article') {
      const serialized = serializeBlocks([updatedBlock]);
      const updatedParagraphs = [...paragraphs];
      updatedParagraphs[blockIdx] = serialized;
      setParagraphs(updatedParagraphs);
      const newContent = updatedParagraphs.join('\n\n');
      setContent(newContent);
      triggerSave(newContent, footnotes, marginNotes);
    } else {
      const blocks = parseContentToBlocks(content);
      blocks[blockIdx] = updatedBlock;
      const serialized = serializeBlocks(blocks);
      setContent(serialized);
      const parts = serialized.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      setParagraphs(parts.length > 0 ? parts : [serialized]);
      triggerSave(serialized, footnotes, marginNotes);
    }
  };

  const handleMoveBlockUp = (idx: number) => {
    if (idx === 0) return;
    if (contentType === 'Article') {
      const updated = [...paragraphs];
      const temp = updated[idx];
      updated[idx] = updated[idx - 1];
      updated[idx - 1] = temp;
      setParagraphs(updated);
      const newContent = updated.join('\n\n');
      setContent(newContent);
      triggerSave(newContent, footnotes, marginNotes);
    } else {
      const blocks = parseContentToBlocks(content);
      const temp = blocks[idx];
      blocks[idx] = blocks[idx - 1];
      blocks[idx - 1] = temp;
      const serialized = serializeBlocks(blocks);
      setContent(serialized);
      const parts = serialized.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      setParagraphs(parts.length > 0 ? parts : [serialized]);
      triggerSave(serialized, footnotes, marginNotes);
    }
    if (editingBlockIndex === idx) setEditingBlockIndex(idx - 1);
    else if (editingBlockIndex === idx - 1) setEditingBlockIndex(idx);
  };

  const handleMoveBlockDown = (idx: number) => {
    if (contentType === 'Article') {
      if (idx === paragraphs.length - 1) return;
      const updated = [...paragraphs];
      const temp = updated[idx];
      updated[idx] = updated[idx + 1];
      updated[idx + 1] = temp;
      setParagraphs(updated);
      const newContent = updated.join('\n\n');
      setContent(newContent);
      triggerSave(newContent, footnotes, marginNotes);
    } else {
      const blocks = parseContentToBlocks(content);
      if (idx === blocks.length - 1) return;
      const temp = blocks[idx];
      blocks[idx] = blocks[idx + 1];
      blocks[idx + 1] = temp;
      const serialized = serializeBlocks(blocks);
      setContent(serialized);
      const parts = serialized.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      setParagraphs(parts.length > 0 ? parts : [serialized]);
      triggerSave(serialized, footnotes, marginNotes);
    }
    if (editingBlockIndex === idx) setEditingBlockIndex(idx + 1);
    else if (editingBlockIndex === idx + 1) setEditingBlockIndex(idx);
  };

  const handleDuplicateBlock = (idx: number) => {
    if (contentType === 'Article') {
      const updated = [...paragraphs];
      updated.splice(idx + 1, 0, paragraphs[idx]);
      setParagraphs(updated);
      const newContent = updated.join('\n\n');
      setContent(newContent);
      triggerSave(newContent, footnotes, marginNotes);
    } else {
      const blocks = parseContentToBlocks(content);
      blocks.splice(idx + 1, 0, JSON.parse(JSON.stringify(blocks[idx])));
      const serialized = serializeBlocks(blocks);
      setContent(serialized);
      const parts = serialized.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      setParagraphs(parts.length > 0 ? parts : [serialized]);
      triggerSave(serialized, footnotes, marginNotes);
    }
  };

  const handleInsertBlockBelow = (idx: number) => {
    if (contentType === 'Article') {
      const updated = [...paragraphs];
      updated.splice(idx + 1, 0, 'New paragraph content.');
      setParagraphs(updated);
      const newContent = updated.join('\n\n');
      setContent(newContent);
      triggerSave(newContent, footnotes, marginNotes);
      setEditingBlockIndex(idx + 1);
    } else {
      const blocks = parseContentToBlocks(content);
      blocks.splice(idx + 1, 0, { type: 'paragraph', text: 'New paragraph content.' });
      const serialized = serializeBlocks(blocks);
      setContent(serialized);
      const parts = serialized.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      setParagraphs(parts.length > 0 ? parts : [serialized]);
      triggerSave(serialized, footnotes, marginNotes);
      setEditingBlockIndex(idx + 1);
    }
  };

  const handleDeleteBlock = (idx: number) => {
    if (contentType === 'Article') {
      if (paragraphs.length <= 1) return;
      const updated = paragraphs.filter((_, i) => i !== idx);
      setParagraphs(updated);
      const newContent = updated.join('\n\n');
      setContent(newContent);
      triggerSave(newContent, footnotes, marginNotes);
    } else {
      const blocks = parseContentToBlocks(content);
      if (blocks.length <= 1) return;
      const updatedBlocks = blocks.filter((_, i) => i !== idx);
      const serialized = serializeBlocks(updatedBlocks);
      setContent(serialized);
      const parts = serialized.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      setParagraphs(parts.length > 0 ? parts : [serialized]);
      triggerSave(serialized, footnotes, marginNotes);
    }
    setEditingBlockIndex(null);
  };

  const handleInsertNewBlock = (type: 'paragraph' | 'heading' | 'latin-quote' | 'arabic-quote') => {
    let newBlockText = '';
    let newBlock: ContentBlock;
    
    if (type === 'paragraph') {
      newBlock = { type: 'paragraph', text: 'Kandungan perenggan baharu.' };
      newBlockText = 'Kandungan perenggan baharu.';
    } else if (type === 'heading') {
      newBlock = { type: 'heading', text: 'Tajuk Baharu', level: 2 };
      newBlockText = '## Tajuk Baharu';
    } else if (type === 'latin-quote') {
      newBlock = { 
        type: 'latin-quote', 
        text: 'Enter LTR quote here...', 
        translation: 'Terjemahan di sini...'
      };
      newBlockText = '<quote type="latin">\n  <text>Enter LTR quote here...</text>\n  <translation>Terjemahan di sini...</translation>\n</quote>';
    } else {
      newBlock = { 
        type: 'arabic-quote', 
        arabic: 'اكتب النص العربي هنا', 
        translation: 'Terjemahan di sini...'
      };
      newBlockText = '<quote type="arabic">\n  <arabic>اكتب النص العربي هنا</arabic>\n  <translation>Terjemahan di sini...</translation>\n</quote>';
    }

    if (contentType === 'Article') {
      const updated = [...paragraphs, newBlockText];
      setParagraphs(updated);
      const newContent = updated.join('\n\n');
      setContent(newContent);
      triggerSave(newContent, footnotes, marginNotes);
      setEditingBlockIndex(updated.length - 1);
    } else {
      const blocks = parseContentToBlocks(content);
      blocks.push(newBlock);
      const serialized = serializeBlocks(blocks);
      setContent(serialized);
      const parts = serialized.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      setParagraphs(parts.length > 0 ? parts : [serialized]);
      triggerSave(serialized, footnotes, marginNotes);
      setEditingBlockIndex(blocks.length - 1);
    }
  };

  // Inline Block Editor in Visual Mode
  const renderInlineBlockEditor = (
    block: ContentBlock,
    idx: number,
    hasMarginNote: boolean = false,
    marginNoteNum?: number,
    marginNoteText?: string
  ) => {
    const blockText = ('text' in block) ? (block as any).text : '';
    const blockArabic = ('arabic' in block) ? (block as any).arabic : '';
    const isAr = isArabicText(blockText || blockArabic || '');

    if (block.type === 'paragraph' || block.type === 'heading') {
      const hClass = block.type === 'heading'
        ? (block.level === 1 ? 'text-xl md:text-2xl tracking-tight font-medium' : (block.level === 2 ? 'text-lg md:text-xl font-medium' : 'text-base font-medium'))
        : '';

      return (
        <div key={idx} className="bg-stone-50/50 p-4 border border-dashed border-Adjung-maroon/30 rounded-lg space-y-3 relative animate-fade-in text-left">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-2 select-none">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] font-bold text-Adjung-maroon uppercase tracking-wider bg-Adjung-maroon/10 px-2 py-0.5 rounded">
                {block.type === 'heading' ? `Heading H${block.level}` : block.type.replace('-', ' ')} Block
              </span>
              <select
                value={block.type === 'heading' ? `heading-${block.level}` : block.type}
                onChange={(e) => {
                  const val = e.target.value;
                  const blockAny = block as any;
                  const currentText = blockAny.text || blockAny.arabic || blockAny.code || '';
                  let newBlock: ContentBlock;
                  
                  if (val.startsWith('heading-')) {
                    const level = parseInt(val.split('-')[1]) as 1 | 2 | 3;
                    newBlock = { type: 'heading', text: currentText || '', level };
                  } else if (val === 'latin-quote') {
                    newBlock = { type: 'latin-quote', text: currentText || '', translation: '' };
                  } else if (val === 'arabic-quote') {
                    newBlock = { type: 'arabic-quote', arabic: currentText || '', translation: '' };
                  } else if (val === 'callout') {
                    newBlock = { type: 'callout', calloutType: 'note', text: currentText || '', title: '' };
                  } else if (val === 'image') {
                    newBlock = { type: 'image', url: '', alt: '' };
                  } else if (val === 'list') {
                    newBlock = { type: 'list', ordered: false, items: [{ text: currentText || '' }] };
                  } else if (val === 'code-block') {
                    newBlock = { type: 'code-block', code: currentText || '', language: '' };
                  } else if (val === 'divider') {
                    newBlock = { type: 'divider' };
                  } else {
                    newBlock = { type: 'paragraph', text: currentText || '' };
                  }
                  
                  handleVisualBlockChange(idx, newBlock);
                }}
                className="border border-stone-200 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase bg-white focus:outline-none focus:border-Adjung-maroon text-stone-600"
              >
                <option value="paragraph">Paragraph</option>
                <option value="heading-1">Heading 1</option>
                <option value="heading-2">Heading 2</option>
                <option value="heading-3">Heading 3</option>
                <option value="latin-quote">Latin Quote</option>
                <option value="arabic-quote">Arabic Quote</option>
                <option value="callout">Callout</option>
                <option value="image">Image</option>
                <option value="list">List</option>
                <option value="code-block">Code Block</option>
                <option value="divider">Divider</option>
              </select>
            </div>
            
            <button
              type="button"
              onClick={() => setEditingBlockIndex(null)}
              className="px-2.5 py-1 bg-stone-900 hover:bg-Adjung-maroon text-white rounded transition font-sans text-[10px] uppercase font-bold cursor-pointer"
            >
              ✓ Done
            </button>
          </div>

          <div className="relative">
            <RichTextEditable
              tagName="div"
              html={markdownToHtml(block.text || '')}
              dir={isAr ? 'rtl' : 'ltr'}
              onChange={(newHtml: string) => {
                const val = htmlToMarkdown(newHtml);
                handleVisualBlockChange(idx, { ...block, text: val });
              }}
              placeholder={block.type === 'heading' ? "Enter Heading text..." : "Begin writing your manuscript here..."}
              className={`w-full bg-transparent border-none focus:outline-none outline-none resize-none p-0 overflow-hidden ${
                block.type === 'heading' 
                  ? `font-serif text-stone-900 ${hClass}` 
                  : 'font-serif text-[15px] md:text-base text-stone-900 leading-relaxed'
              } ${isAr ? 'text-right font-arabic leading-loose text-lg font-medium' : 'text-left'}`}
            />
          </div>
          
          {contentType === 'Article' && (
            <div className="border-t border-stone-200/50 pt-2.5 mt-2.5 text-left">
              <label className="block text-[8.5px] font-mono uppercase tracking-widest text-stone-400 mb-1">
                Horizontal Margin Note (Aligned with Block)
              </label>
              <textarea
                value={marginNotes[idx] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const updatedNotes = { ...marginNotes, [idx]: val };
                  setMarginNotes(updatedNotes);
                  triggerSave(content, footnotes, updatedNotes);
                }}
                placeholder="Write aligned scholarly margin commentary or cross-reference..."
                rows={1}
                className="w-full bg-transparent font-sans text-xs text-stone-600 focus:outline-none border-b border-dashed border-stone-200 hover:border-stone-300 focus:border-Adjung-maroon py-0.5 resize-y"
              />
            </div>
          )}
        </div>
      );
    }

    if (block.type === 'latin-quote' || block.type === 'arabic-quote') {
      return (
        <div key={idx} className="bg-stone-50/50 p-4 border border-dashed border-Adjung-maroon/30 rounded-lg space-y-3 relative animate-fade-in text-left font-sans">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-2 select-none">
            <span className="font-mono text-[9px] font-bold text-Adjung-maroon uppercase tracking-wider bg-Adjung-maroon/10 px-2 py-0.5 rounded">
              Quote ({block.type === 'latin-quote' ? 'Latin' : 'Arabic'}) Block
            </span>
            <button
              type="button"
              onClick={() => setEditingBlockIndex(null)}
              className="px-2.5 py-1 bg-stone-900 hover:bg-Adjung-maroon text-white rounded transition font-sans text-[10px] uppercase font-bold cursor-pointer"
            >
              ✓ Done
            </button>
          </div>

          {block.type === 'latin-quote' ? (
            <div className="space-y-2 font-serif">
              <div>
                <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">Original Quote</label>
                <textarea
                  id={`editorial-content-textarea-visual-latin-${idx}`}
                  autoFocus
                  value={block.text || ''}
                  onChange={(e) => handleVisualBlockChange(idx, { ...block, text: e.target.value })}
                  className="w-full bg-transparent border-none focus:outline-none resize-none p-0 italic text-sm text-stone-750 leading-relaxed text-left"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">Translation</label>
                <textarea
                  id={`editorial-content-textarea-visual-trans-${idx}`}
                  value={block.translation || ''}
                  onChange={(e) => handleVisualBlockChange(idx, { ...block, translation: e.target.value })}
                  placeholder="Translation..."
                  className="w-full bg-transparent border-none focus:outline-none resize-none p-0 text-stone-550 leading-relaxed text-xs text-left"
                  rows={1}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5 text-right">Original Quote (Arabic/RTL)</label>
                <textarea
                  id={`editorial-content-textarea-visual-arabic-${idx}`}
                  autoFocus
                  value={block.arabic || ''}
                  dir="rtl"
                  onChange={(e) => handleVisualBlockChange(idx, { ...block, arabic: e.target.value })}
                  className="w-full bg-transparent border-none focus:outline-none resize-none p-0 font-arabic text-right text-stone-900 leading-loose text-lg"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5 text-left font-sans">Translation</label>
                <textarea
                  id={`editorial-content-textarea-visual-trans-${idx}`}
                  value={block.translation || ''}
                  onChange={(e) => handleVisualBlockChange(idx, { ...block, translation: e.target.value })}
                  placeholder="Translation..."
                  className="w-full bg-transparent border-none focus:outline-none resize-none p-0 font-serif italic text-xs text-stone-500 leading-relaxed text-left"
                  rows={1}
                />
              </div>
            </div>
          )}
          
          {contentType === 'Article' && (
            <div className="border-t border-stone-200/50 pt-2.5 mt-2.5 text-left">
              <label className="block text-[8.5px] font-mono uppercase tracking-widest text-stone-400 mb-1">
                Horizontal Margin Note (Aligned with Block)
              </label>
              <textarea
                value={marginNotes[idx] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const updatedNotes = { ...marginNotes, [idx]: val };
                  setMarginNotes(updatedNotes);
                  triggerSave(content, footnotes, updatedNotes);
                }}
                placeholder="Write aligned scholarly margin commentary or cross-reference..."
                rows={1}
                className="w-full bg-transparent font-sans text-xs text-stone-600 focus:outline-none border-b border-dashed border-stone-200 hover:border-stone-300 focus:border-Adjung-maroon py-0.5 resize-y"
              />
            </div>
          )}
        </div>
      );
    }

    if (block.type === 'callout') {
      return (
        <div key={idx} className="bg-stone-50/50 p-4 border border-dashed border-Adjung-maroon/30 rounded-lg space-y-3 relative animate-fade-in text-left font-sans">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-2 select-none">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] font-bold text-Adjung-maroon uppercase tracking-wider bg-Adjung-maroon/10 px-2 py-0.5 rounded">
                Callout Block
              </span>
              <select
                value={block.calloutType}
                onChange={(e) => handleVisualBlockChange(idx, { ...block, calloutType: e.target.value as any })}
                className="border border-stone-200 rounded px-1.5 py-0.5 text-[10px] font-mono uppercase bg-white focus:outline-none focus:border-Adjung-maroon text-stone-600"
              >
                <option value="note">Note</option>
                <option value="tip">Tip</option>
                <option value="warning">Warning</option>
                <option value="important">Important</option>
                <option value="definition">Definition</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => setEditingBlockIndex(null)}
              className="px-2.5 py-1 bg-stone-900 hover:bg-Adjung-maroon text-white rounded transition font-sans text-[10px] uppercase font-bold cursor-pointer"
            >
              ✓ Done
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5 text-left">Callout Title (Optional)</label>
              <input
                type="text"
                value={block.title || ''}
                onChange={(e) => handleVisualBlockChange(idx, { ...block, title: e.target.value })}
                placeholder="Title..."
                className="w-full bg-transparent border-b border-stone-200 focus:border-Adjung-maroon focus:outline-none p-1 text-sm font-bold font-mono uppercase tracking-wider text-stone-850"
              />
            </div>
            <div>
              <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5 text-left">Callout Body</label>
              <textarea
                autoFocus
                value={block.text || ''}
                onChange={(e) => handleVisualBlockChange(idx, { ...block, text: e.target.value })}
                placeholder="Callout content..."
                rows={3}
                className="w-full bg-transparent border-none focus:outline-none resize-none font-serif text-sm md:text-[15px] leading-relaxed text-stone-800"
              />
            </div>
          </div>
          
          {contentType === 'Article' && (
            <div className="border-t border-stone-200/50 pt-2.5 mt-2.5 text-left">
              <label className="block text-[8.5px] font-mono uppercase tracking-widest text-stone-400 mb-1">
                Horizontal Margin Note (Aligned with Block)
              </label>
              <textarea
                value={marginNotes[idx] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const updatedNotes = { ...marginNotes, [idx]: val };
                  setMarginNotes(updatedNotes);
                  triggerSave(content, footnotes, updatedNotes);
                }}
                placeholder="Write aligned scholarly margin commentary or cross-reference..."
                rows={1}
                className="w-full bg-transparent font-sans text-xs text-stone-600 focus:outline-none border-b border-dashed border-stone-200 hover:border-stone-300 focus:border-Adjung-maroon py-0.5 resize-y"
              />
            </div>
          )}
        </div>
      );
    }

    if (block.type === 'image') {
      return (
        <div key={idx} className="bg-stone-50/50 p-4 border border-dashed border-Adjung-maroon/30 rounded-lg space-y-3 relative animate-fade-in text-left font-sans">
          <div className="flex items-center justify-between border-b border-stone-200/50 pb-2 select-none">
            <span className="font-mono text-[9px] font-bold text-Adjung-maroon uppercase tracking-wider bg-Adjung-maroon/10 px-2 py-0.5 rounded">
              Figure Image Block
            </span>
            <button
              type="button"
              onClick={() => setEditingBlockIndex(null)}
              className="px-2.5 py-1 bg-stone-900 hover:bg-Adjung-maroon text-white rounded transition font-sans text-[10px] uppercase font-bold cursor-pointer"
            >
              ✓ Done
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5 text-left">Image URL</label>
              <input
                type="text"
                autoFocus
                value={block.url || ''}
                onChange={(e) => handleVisualBlockChange(idx, { ...block, url: e.target.value })}
                placeholder="https://example.com/illustration.jpg"
                className="w-full bg-transparent border-b border-stone-200 focus:border-Adjung-maroon focus:outline-none p-1 text-xs font-mono text-stone-700"
              />
            </div>
            <div>
              <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5 text-left">Caption / Alt Text</label>
              <input
                type="text"
                value={block.alt || ''}
                onChange={(e) => handleVisualBlockChange(idx, { ...block, alt: e.target.value })}
                placeholder="Figure description..."
                className="w-full bg-transparent border-b border-stone-200 focus:border-Adjung-maroon focus:outline-none p-1 text-xs text-stone-700"
              />
            </div>
            {block.url && (
              <div className="mt-2 text-center">
                <img src={block.url} alt={block.alt} className="max-h-32 mx-auto rounded border border-stone-200 p-1 bg-white" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              </div>
            )}
          </div>
          
          {contentType === 'Article' && (
            <div className="border-t border-stone-200/50 pt-2.5 mt-2.5 text-left">
              <label className="block text-[8.5px] font-mono uppercase tracking-widest text-stone-400 mb-1">
                Horizontal Margin Note (Aligned with Block)
              </label>
              <textarea
                value={marginNotes[idx] || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  const updatedNotes = { ...marginNotes, [idx]: val };
                  setMarginNotes(updatedNotes);
                  triggerSave(content, footnotes, updatedNotes);
                }}
                placeholder="Write aligned scholarly margin commentary or cross-reference..."
                rows={1}
                className="w-full bg-transparent font-sans text-xs text-stone-600 focus:outline-none border-b border-dashed border-stone-200 hover:border-stone-300 focus:border-Adjung-maroon py-0.5 resize-y"
              />
            </div>
          )}
        </div>
      );
    }

    const rawMarkup = serializeBlocks([block]);
    return (
      <div key={idx} className="bg-stone-50/50 p-4 border border-dashed border-Adjung-maroon/30 rounded-lg space-y-3 relative animate-fade-in text-left font-sans">
        <div className="flex items-center justify-between border-b border-stone-200/50 pb-2 select-none">
          <span className="font-mono text-[9px] font-bold text-Adjung-maroon uppercase tracking-wider bg-Adjung-maroon/10 px-2 py-0.5 rounded">
            {block.type.toUpperCase()} Block
          </span>
          <button
            type="button"
            onClick={() => setEditingBlockIndex(null)}
            className="px-2.5 py-1 bg-stone-900 hover:bg-Adjung-maroon text-white rounded transition font-sans text-[10px] uppercase font-bold cursor-pointer"
          >
            ✓ Done
          </button>
        </div>
        
        <div className="space-y-2">
          <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider">Edit Block Markdown Markup</label>
          <textarea
            autoFocus
            value={rawMarkup}
            onChange={(e) => {
              const val = e.target.value;
              const parsed = parseContentToBlocks(val)[0];
              if (parsed) {
                handleVisualBlockChange(idx, parsed);
              }
            }}
            placeholder={`Edit ${block.type} markup...`}
            rows={5}
            className="w-full bg-white border border-stone-200 rounded p-2 font-mono text-xs text-stone-850 leading-relaxed focus:outline-none focus:border-Adjung-maroon resize-y"
          />
        </div>
      </div>
    );
  };

  // Visual Mode Hover/Click Wrapper
  const renderVisualBlockWrapper = (
    block: ContentBlock,
    idx: number,
    hasMarginNote: boolean = false,
    marginNoteNum?: number,
    marginNoteText?: string
  ) => {
    const isEditingThisBlock = editingBlockIndex === idx;

    if (isEditingThisBlock) {
      return renderInlineBlockEditor(block, idx, hasMarginNote, marginNoteNum, marginNoteText);
    }

    return (
      <div 
        key={idx}
        onClick={() => setEditingBlockIndex(idx)}
        className="group relative cursor-pointer hover:bg-stone-50/70 p-3 -m-3 rounded-md transition-all duration-200 text-left"
        title="Click to edit block"
      >
        <div className="absolute -left-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none hidden md:block">
          <Edit3 className="w-4 h-4 text-Adjung-maroon/60" />
        </div>

        {renderBlock(block, idx, marginNoteNum, marginNoteText)}

        <div className="absolute top-1 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-white border border-stone-200/60 rounded px-1.5 py-0.5 shadow-sm text-stone-400 pointer-events-auto transition-opacity duration-150">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleMoveBlockUp(idx);
            }}
            disabled={idx === 0}
            className="p-1 hover:text-Adjung-maroon hover:bg-stone-50 rounded transition disabled:opacity-30 disabled:hover:bg-transparent"
            title="Move up"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleMoveBlockDown(idx);
            }}
            disabled={idx === (contentType === 'Article' ? paragraphs.length - 1 : parseContentToBlocks(content).length - 1)}
            className="p-1 hover:text-Adjung-maroon hover:bg-stone-50 rounded transition disabled:opacity-30 disabled:hover:bg-transparent"
            title="Move down"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDuplicateBlock(idx);
            }}
            className="p-1 hover:text-Adjung-maroon hover:bg-stone-50 rounded transition"
            title="Duplicate block"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleInsertBlockBelow(idx);
            }}
            className="p-1 hover:text-Adjung-maroon hover:bg-stone-50 rounded transition"
            title="Insert block below"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteBlock(idx);
            }}
            className="p-1 hover:text-red-650 hover:bg-red-50 rounded transition text-stone-400"
            title="Delete block"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  };

  // Source Mode Canvas
  const renderSourceContent = () => {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 bg-white border border-stone-200/50 rounded-md py-8 md:py-12 shadow-sm text-left relative animate-fade-in">
        <div className="mb-6 pb-4 border-b border-stone-150 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#802334]" />
            <h3 className="font-mono text-xs uppercase tracking-wider text-stone-600 font-semibold">
              Source Editor (Markdown / XML)
            </h3>
          </div>
          <div className="text-[10px] font-mono text-stone-400">
            Characters: {content.length} | Words: {getWordCount(content)}/{(contentType === 'Note' ? 100 : contentType === 'Essay' ? 1000 : 10000).toLocaleString()}
          </div>
        </div>

        <div className="space-y-4">
          <textarea
            id="editorial-content-textarea"
            value={content}
            onChange={(e) => {
              const val = e.target.value;
              setContent(val);
              const parts = val.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
              setParagraphs(parts.length > 0 ? parts : [val]);
              triggerSave(val, footnotes, marginNotes);
            }}
            placeholder="Write your raw Markdown or structured XML markup here..."
            className="w-full min-h-[180px] bg-stone-50/40 hover:bg-stone-50/70 focus:bg-white border border-stone-200/85 focus:border-Adjung-maroon p-6 rounded-md font-mono text-xs md:text-sm leading-relaxed text-stone-900 focus:outline-none resize-y transition-all"
          />

          {contentType === 'Article' && (
            <div className="mt-10 pt-6 border-t border-stone-200/60 text-left font-sans text-xs">
              <h4 className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-bold mb-4">
                Article Margin Notes Registry (Source Mode)
              </h4>
              {(() => {
                const { occurrences, map: mMap } = getMarginNotesReadingOrderMap();
                if (occurrences.length === 0) {
                  return <p className="text-xs text-stone-400 italic select-none">No margin notes registered yet. Insert [^mn-1], [^mn-2], etc. inside the source text.</p>;
                }
                return (
                  <div className="space-y-4">
                    {occurrences.map((id) => {
                      return (
                        <div key={id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start bg-stone-50/50 p-3 rounded border border-stone-200/40 animate-fade-in">
                          <div className="md:col-span-4 font-mono text-[10px] text-stone-500 select-none">
                            <span className="font-bold text-Adjung-maroon">Margin Note ({toRoman(mMap[id]).toLowerCase()})</span>
                            <p className="font-mono text-stone-400 mt-1 select-all">[^ {id}]</p>
                          </div>
                          <div className="md:col-span-8">
                            <textarea
                              value={marginNotesData[id] || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const updated = { ...marginNotesData, [id]: val };
                                setMarginNotesData(updated);
                                triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, citations, referenceSortOrder, updated);
                              }}
                              placeholder="Side note description text..."
                              rows={2}
                              className="w-full bg-white border border-stone-200 focus:border-Adjung-maroon rounded p-1.5 focus:outline-none text-xs font-serif text-stone-750"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {(contentType === 'Essay' || contentType === 'Article') && (
            <div className="mt-10 pt-6 border-t border-stone-200/60 text-left font-sans text-xs">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-mono text-[10px] uppercase tracking-wider text-stone-500 font-bold">
                  Footnotes Registry (Source Mode)
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const updated = [...footnotes, 'New footnote content.'];
                    setFootnotes(updated);
                    triggerSave(content, updated, marginNotes);
                  }}
                  className="px-2.5 py-1 border border-stone-200 hover:border-Adjung-maroon text-stone-600 hover:text-Adjung-maroon rounded font-mono text-[9px] uppercase tracking-wider transition cursor-pointer"
                >
                  + Add Footnote
                </button>
              </div>
              
              {footnotes.length === 0 ? null : (
                <div className="space-y-3">
                  {footnotes.map((fn, index) => (
                    <div key={index} className="flex gap-3 items-start bg-stone-50/50 p-3 rounded border border-stone-200/40 animate-fade-in">
                      <span className="font-mono text-[10px] font-bold text-Adjung-maroon mt-1">[^{index + 1}]</span>
                      <div className="flex-1">
                        <textarea
                          value={fn}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = [...footnotes];
                            updated[index] = val;
                            setFootnotes(updated);
                            triggerSave(content, updated, marginNotes);
                          }}
                          placeholder="Footnote reference text..."
                          rows={1}
                          className="w-full bg-white border border-stone-200 focus:border-Adjung-maroon rounded p-1.5 focus:outline-none text-xs font-serif"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFootnote(index)}
                        className="p-1.5 hover:bg-red-50 hover:text-red-700 rounded text-stone-400 transition"
                        title="Remove footnote"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFloatingToolbar = () => {
    return (
      <FloatingFormatToolbar
        selectionState={selectionState}
        showLinkInput={showLinkInput}
        setShowLinkInput={setShowLinkInput}
        linkUrl={linkUrl}
        setLinkUrl={setLinkUrl}
        showGlossInput={showGlossInput}
        setShowGlossInput={setShowGlossInput}
        glossText={glossText}
        setGlossText={setGlossText}
        applyBold={applyBold}
        applyItalic={applyItalic}
        applyUnderline={applyUnderline}
        applyLink={applyLink}
        applyInterlinear={applyInterlinear}
        applyFootnote={applyFootnote}
      />
    );
  };

  /**
   * Renders the complete, beautiful published layout.
   * This is used for BOTH reading/viewing and the Writing Desk's live preview.
   */
  const renderPublishedContent = () => {
    const isArticle = contentType === 'Article';
    const isNote = contentType === 'Note';

    const isArContent = isArabicText(entry.content);
    const containerClass = `${activeSpec.spacing.canvasMaxWidth} mx-auto ${activeSpec.spacing.canvasPadding} bg-white border border-stone-200/50 rounded-md shadow-sm relative overflow-visible ${
      isArContent ? 'text-right' : 'text-left'
    } ${
      contentType === 'Note' ? 'bg-[#FAF8F5] text-[#3D2E2B]' : 'text-[#111111]'
    } ${
      isArticle ? 'select-none cursor-grab active:cursor-grabbing touch-pan-y' : 'select-text'
    }`;

    return (
      <motion.article
        drag={isMobile && isArticle ? "x" : false}
        dragConstraints={isMobile && isArticle ? { left: -240, right: 0 } : undefined}
        dragElastic={isMobile && isArticle ? 0.15 : 0}
        dragSnapToOrigin={true}
        className={containerClass}
      >
        {entry.underReview && (
          <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded text-amber-900 text-xs font-sans flex items-center gap-3 select-none animate-pulse">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <strong className="font-semibold">Under Review:</strong> This entry has been flagged and is currently being evaluated by the Editorial Board.
            </div>
          </div>
        )}

        {/* Header Block */}
        {activeSpec.visibility.showTitle ? (
          <header className={activeSpec.spacing.headerBottomMargin}>
            {/* Metadata Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest text-stone-500 mb-6 border-b border-stone-300 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-Adjung-maroon">{contentType}</span>
                <span className="text-stone-300">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(entry.publishedDate || entry.createdDate)}
                </span>
                <span className="text-stone-300">|</span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-stone-400" />
                  {getReadingTime(getFullContentString())}
                </span>
              </div>
              
              <div className="flex items-center gap-2">
                {status === 'Draft' && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-medium lowercase">
                    draft
                  </span>
                )}
                {visibility === 'Private' && (
                  <span className="inline-flex items-center gap-1 text-red-800 text-[10px]">
                    <Lock className="w-3 h-3" /> private
                  </span>
                )}
                {visibility === 'Public' && (
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-stone-400 text-[10px]">
                      <Globe className="w-3 h-3" /> canonical public
                    </span>
                    {mode === 'view' && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const url = getCanonicalUrl();
                            navigator.clipboard.writeText(url);
                            showToast('Entry link copied to clipboard!', 'success');
                          }}
                          className="inline-flex items-center gap-1 text-[#802334] hover:text-[#4a1521] text-[10px] font-mono uppercase tracking-wider cursor-pointer border border-[#802334]/20 hover:border-[#802334]/40 px-2 py-0.5 rounded transition bg-white"
                          title="Copy permanent entry URL"
                        >
                          <Copy className="w-3 h-3" /> Copy Address
                        </button>
                        {currentUser?.id !== entry.authorId && !entry.underReview && (
                          <button
                            type="button"
                            onClick={handleReportEntry}
                            className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 text-[10px] font-mono uppercase tracking-wider cursor-pointer border border-amber-600/20 hover:border-amber-600/40 px-2 py-0.5 rounded transition bg-white"
                            title="Laporkan penulisan ini kepada Editorial Board"
                          >
                            <AlertTriangle className="w-3 h-3" /> Report
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Featured Image */}
            {featuredImage && (
              <div className="mb-6 w-full text-center bg-transparent animate-fade-in">
                <img 
                  src={featuredImage} 
                  alt={title || 'Featured Image'} 
                  className="max-w-full h-auto mx-auto border border-stone-200/50 p-2 bg-white shadow-sm rounded-sm max-h-[300px] object-cover"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
              </div>
            )}

            {/* Title Area */}
            {isEditingWorkspace ? (
              <RichTextEditable
                tagName="h1"
                html={markdownToHtml(title)}
                onChange={(newHtml: string) => {
                  const val = htmlToMarkdown(newHtml);
                  setTitle(val);
                  triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, val);
                }}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).blur();
                  }
                }}
                placeholder="Enter Title..."
                className="text-2xl md:text-3.5xl font-serif text-[#111111] font-medium tracking-tight leading-tight w-full bg-transparent border-b border-dashed border-stone-200/80 focus:border-Adjung-maroon focus:outline-none mb-3 py-1 text-left"
              />
            ) : (
              title && (
                <h1 className="text-2xl md:text-3.5xl font-serif text-[#111111] font-medium tracking-tight leading-tight mb-3 text-left">
                  {parseInlineFormatting(title)}
                </h1>
              )
            )}

            {/* Author / Signature Stamp Block */}
            <div className="mt-4 flex items-center gap-4 text-xs font-serif text-stone-600">
              <span className="font-mono text-[9px] uppercase tracking-widest text-stone-400">Published by</span>
              <div className="flex items-center gap-1.5 h-10">
                <span className="font-sans font-medium text-stone-900 border-b border-stone-200 pb-0.5 mt-2">{authorName}</span>
              </div>
            </div>
          </header>
        ) : (
          <header className="mb-6 pb-4 border-b border-stone-200/40 text-stone-400 font-mono text-[9px] uppercase tracking-widest flex items-center justify-between select-none font-sans">
            <span>Note</span>
            <div className="flex items-center gap-2">
              <span>{formatDate(entry.publishedDate || entry.createdDate)}</span>
              {mode === 'view' && visibility === 'Public' && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const url = getCanonicalUrl();
                      navigator.clipboard.writeText(url);
                      showToast('Entry link copied to clipboard!', 'success');
                    }}
                    className="inline-flex items-center gap-1 text-[#802334] hover:text-[#4a1521] text-[9px] font-mono uppercase tracking-wider cursor-pointer border border-[#802334]/20 hover:border-[#802334]/40 px-1.5 py-0.5 rounded transition bg-white normal-case font-mono"
                    title="Copy permanent entry URL"
                  >
                    <Copy className="w-2.5 h-2.5" /> Copy
                  </button>
                  {currentUser?.id !== entry.authorId && !entry.underReview && (
                    <button
                      type="button"
                      onClick={handleReportEntry}
                      className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 text-[9px] font-mono uppercase tracking-wider cursor-pointer border border-amber-600/20 hover:border-amber-600/40 px-1.5 py-0.5 rounded transition bg-white normal-case font-mono"
                      title="Laporkan penulisan ini kepada Editorial Board"
                    >
                      <AlertTriangle className="w-2.5 h-2.5" /> Report
                    </button>
                  )}
                </>
              )}
            </div>
          </header>
        )}

        {/* Excerpt Abstract Block */}
        {activeSpec.visibility.showAbstract && excerpt && (
          <div className="mb-8 border-l-2 border-Adjung-maroon/20 pl-4 py-1 text-stone-500 font-serif italic text-sm md:text-[15px] leading-relaxed text-left animate-fade-in">
            {excerpt}
          </div>
        )}
        {/* Outline-based TOC */}
        {renderTableOfContents()}

        {/* Content Area Grid */}
        <div id="article-container-grid" className={`${mode === 'edit' ? 'grid grid-cols-1 lg:grid-cols-12 gap-8' : (contentType === 'Article' ? 'max-w-5xl mx-auto' : 'max-w-3xl mx-auto')} relative`}>
          
          {/* Main content body */}
          <div className={`${mode === 'edit' ? (contentType === 'Article' ? 'lg:col-span-8' : 'lg:col-span-12') : 'w-full'} space-y-6 text-[#111111] text-[15px] md:text-base leading-relaxed tracking-normal font-serif relative`}>
            
            {/* Custom context menu trigger in edit mode */}
            {mode === 'edit' && contextCoords && (
              <div 
                style={{ position: 'absolute', top: `${contextCoords.y}px`, left: `${contextCoords.x}px` }}
                className="bg-white border border-stone-200 shadow-xl rounded py-1 w-44 z-50 text-left font-sans text-xs"
              >
                <button 
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertNote('footnote');
                    setContextCoords(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-stone-50 text-stone-700 hover:text-Adjung-maroon font-medium cursor-pointer transition-colors"
                >
                  Insert Footnote
                </button>
                {contentType === 'Article' && (
                  <button 
                    onMouseDown={(e) => {
                      e.preventDefault();
                      insertNote('margin-note');
                      setContextCoords(null);
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-stone-50 text-stone-700 hover:text-Adjung-maroon font-medium cursor-pointer transition-colors"
                  >
                    Insert Margin Note
                  </button>
                )}
              </div>
            )}

            {/* Custom floating formatting toolbar */}
            {mode === 'edit' && toolbarCoords && (
              <div 
                style={{ 
                  position: 'absolute', 
                  top: `${toolbarCoords.y}px`, 
                  left: `${toolbarCoords.x}px`, 
                  transform: 'translateX(-50%)' 
                }}
                className="bg-stone-900 text-white rounded shadow-lg p-1 flex items-center gap-1 z-50 text-[10px] uppercase tracking-wider font-semibold select-none animate-fade-in border border-stone-850 animate-fade-in"
              >
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('bold')} className="px-2 py-1 hover:bg-stone-800 rounded font-bold transition">B</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('italic')} className="px-2 py-1 hover:bg-stone-800 rounded italic transition">I</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyFormat('underline')} className="px-2 py-1 hover:bg-stone-800 rounded underline transition">U</button>
                <div className="h-4 w-px bg-stone-750 mx-1"></div>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlockFormat('H1')} className="px-1.5 py-1 hover:bg-stone-800 rounded transition">H1</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlockFormat('H2')} className="px-1.5 py-1 hover:bg-stone-800 rounded transition">H2</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlockFormat('blockquote')} className="px-1.5 py-1 hover:bg-stone-800 rounded transition">Quote</button>
                <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => applyBlockFormat('P')} className="px-1.5 py-1 hover:bg-stone-800 rounded transition">Para</button>
              </div>
            )}

            {mode === 'edit' ? (
              <div className="relative border-b border-dashed border-stone-200/55 pb-6">
                <RichTextEditable
                  tagName="div"
                  id="editorial-canvas-editor"
                  html={markdownToHtml(content)}
                  onChange={(newHtml) => {
                    const editorEl = document.getElementById('editorial-canvas-editor');
                    if (editorEl) {
                      updateCanvasBadges(editorEl);
                      const md = htmlToMarkdown(editorEl.innerHTML);
                      setContent(md);
                      triggerSave(md, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, citations, referenceSortOrder, marginNotesData);
                    }
                  }}
                  placeholder="Begin writing your manuscript here... Right-click to insert Footnotes and Margin Notes."
                  onContextMenu={handleContextMenu}
                  className="w-full min-h-[140px] bg-transparent border-none focus:outline-none resize-none font-serif text-[15.5px] md:text-[16.5px] leading-relaxed text-[#111111] outline-none"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const citeMap = getCitationsMap();
                  const fMap = getFootnotesReadingOrderMap().map;
                  const mOrderMap = getMarginNotesReadingOrderMap().map;
                  const showMarginNotes = contentType === 'Article';
                  
                  const viewParagraphs = content.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
                  return viewParagraphs.map((para, index) => {
                    const block = parseContentToBlocks(para)[0] || { type: 'paragraph', text: para };
                    
                    const mnMatches = showMarginNotes ? [...para.matchAll(/\[\^(mn-[a-zA-Z0-9-]+)\]/g)] : [];
                    if (mnMatches.length > 0) {
                      const firstMatchId = mnMatches[0][1];
                      const noteText = marginNotesData[firstMatchId] || '';
                      const romanNum = mOrderMap[firstMatchId] !== undefined ? toRoman(mOrderMap[firstMatchId]).toLowerCase() : '';
                      
                      const parsedNoteContent = parseInlineFormatting(noteText, citations, referenceSortOrder, citeMap, fMap, undefined, undefined, mOrderMap);
                      
                      return (
                        <ElasticMarginRow
                          key={index}
                          noteLabel="Margin Note"
                          noteContent={parsedNoteContent}
                          noteIndexRoman={romanNum}
                        >
                          {renderBlock(block, index, undefined, undefined)}
                        </ElasticMarginRow>
                      );
                    }
                    
                    if (showMarginNotes) {
                      return (
                        <ElasticMarginRow
                          key={index}
                        >
                          {renderBlock(block, index, undefined, undefined)}
                        </ElasticMarginRow>
                      );
                    }
                    
                    return (
                      <div key={index} className="py-2 text-[#111111] leading-relaxed select-text">
                        {renderBlock(block, index, undefined, undefined)}
                      </div>
                    );
                  });
                })()}
              </div>
            )}

          </div>

          {/* Right margin notes sidebar */}
          {contentType === 'Article' && mode === 'edit' && (
            <div className="hidden lg:block lg:col-span-4 relative">
              {(() => {
                const { occurrences, map: mMap } = getMarginNotesReadingOrderMap();
                const citeMap = getCitationsMap();
                const fMap = getFootnotesReadingOrderMap().map;
                
                if (mode === 'edit') {
                  return occurrences.map((id) => {
                    const top = marginOffsets[id] !== undefined ? marginOffsets[id] : 0;
                    const isExpanded = id === activeMarginNoteId;
                    
                    if (!isExpanded) {
                      return (
                        <div 
                          id={`mn-note-card-${id}`}
                          key={id}
                          style={{ position: 'absolute', top: `${top}px`, left: 0 }}
                          onClick={() => setActiveMarginNoteId(id)}
                          className="border-l-2 border-stone-250 hover:border-Adjung-maroon/50 pl-4 py-1 text-left w-full hover:bg-stone-50/60 rounded-r transition-all duration-200 cursor-pointer select-none"
                        >
                          <div className="flex items-center justify-between text-[8px] font-mono text-stone-400">
                            <span className="uppercase font-semibold text-stone-500">Margin Note ({toRoman(mMap[id]).toLowerCase()})</span>
                            <span className="text-[7.5px] uppercase tracking-wider text-Adjung-maroon font-medium font-mono animate-pulse opacity-75">● click to edit</span>
                          </div>
                          <p className="text-xs font-serif text-stone-500 truncate pr-2 mt-0.5 italic">
                            {marginNotesData[id] || 'Empty side note...'}
                          </p>
                        </div>
                      );
                    }
                    
                    return (
                      <div 
                        id={`mn-note-card-${id}`}
                        key={id}
                        style={{ position: 'absolute', top: `${top}px`, left: 0 }}
                        className="border-l-2 border-Adjung-maroon pl-4 py-1 text-left w-full space-y-1 transition-all duration-300 animate-fade-in bg-[#802334]/5 rounded-r"
                      >
                        <div className="flex items-center justify-between text-[8px] font-mono text-stone-400 select-none">
                          <span className="uppercase text-Adjung-maroon font-bold">Margin Note ({toRoman(mMap[id]).toLowerCase()})</span>
                          <button 
                            type="button" 
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNote(id, 'margin-note');
                            }}
                            className="hover:text-red-650 text-[10px]"
                          >
                            × delete
                          </button>
                        </div>
                        <textarea
                          value={marginNotesData[id] || ''}
                          onFocus={() => setActiveMarginNoteId(id)}
                          onChange={(e) => {
                            const val = e.target.value;
                            const updated = { ...marginNotesData, [id]: val };
                            setMarginNotesData(updated);
                            triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, citations, referenceSortOrder, updated);
                          }}
                          placeholder="Add side margin note here..."
                          rows={3}
                          autoFocus
                          className="w-full bg-white border border-Adjung-maroon/20 focus:border-Adjung-maroon rounded p-1.5 focus:outline-none text-xs font-serif text-stone-700 leading-relaxed shadow-sm"
                        />
                      </div>
                    );
                  });
                } else {
                  return occurrences.map((id) => {
                    const top = marginOffsets[id] !== undefined ? marginOffsets[id] : 0;
                    return (
                      <div 
                        id={`mn-note-card-${id}`}
                        key={id}
                        style={{ position: 'absolute', top: `${top}px`, left: 0 }}
                        className="border-l border-stone-300 pl-4 py-0.5 text-left text-stone-600 font-serif text-xs leading-relaxed w-full transition-all duration-300 animate-fade-in"
                      >
                        <span className="font-sans text-[10px] font-medium align-super text-Adjung-maroon mr-1.5 select-none">({toRoman(mMap[id]).toLowerCase()})</span>
                        {parseInlineFormatting(marginNotesData[id] || '(Empty Note)', citations, referenceSortOrder, citeMap, fMap, undefined, undefined, mMap)}
                      </div>
                    );
                  });
                }
              })()}
            </div>
          )}

        </div>

        
        {/* Signature Closure */}
        {/* Signature Closure */}
        {status === 'Published' && entry.isInstitutional && activeSpec.visibility.showSignatureClosure && (
          <div className="mt-16 pt-12 border-t border-stone-300 flex flex-col items-center justify-center relative pb-8 text-center animate-fade-in">
             <span className="w-2 h-2 bg-[#802334] rotate-45 mb-4"></span>
             <div className="font-serif text-stone-900 tracking-wide text-lg">Adjung Editorial Board</div>
             <div className="font-mono text-[9px] uppercase tracking-widest text-stone-400 mt-2">
                Published {formatDate(entry.publishedDate || new Date().toISOString())}
             </div>
          </div>
        )}
        {status === 'Published' && !entry.isInstitutional && activeSpec.visibility.showSignatureClosure && (
          <div className="mt-16 pt-12 flex flex-col items-center justify-center relative pb-8 text-center animate-fade-in">
            <div className="w-24 h-[1px] bg-stone-400 absolute top-0 mt-[-1px] mb-8"></div>
            
            {(() => {
              const authorIdentity = entry.authorId ? db.getIdentityByAccountId(entry.authorId) : undefined;
              const authorAffiliation = authorIdentity?.affiliation;

              if (authorDigitalSignature) {
                return (
                  <SignatureLayout
                    signature={authorDigitalSignature}
                    penName={authorName}
                    date={entry.publishedDate || new Date().toISOString()}
                    strokeWidth={3.0}
                    affiliation={authorAffiliation}
                  />
                );
              }
              if (authorSignatureStrokes && authorSignatureStrokes.length > 0) {
                return (
                  <SignatureLayout
                    strokes={authorSignatureStrokes}
                    penName={authorName}
                    date={entry.publishedDate || new Date().toISOString()}
                    strokeWidth={3.0}
                    affiliation={authorAffiliation}
                  />
                );
              }
              return (
                <div className="flex flex-col items-center">
                  <div className="text-5xl text-Adjung-maroon mb-2"
                       style={{ fontFamily: authorSignatureFont || 'var(--font-signature)' }}>
                    {authorSignature}
                  </div>
                  <div className="font-serif italic font-semibold text-stone-900 tracking-wide mt-2 text-center">
                    <div>{authorName}</div>
                    {authorAffiliation && (
                      <div className="font-sans font-normal not-italic text-[10px] text-stone-400 mt-0.5 select-all">
                        {authorAffiliation}
                      </div>
                    )}
                  </div>
                  <div className="font-mono text-[10px] uppercase tracking-widest text-stone-400 mt-2 select-none">
                    Published<br/>
                    {formatDate(entry.publishedDate || new Date().toISOString())}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* Margin Notes Fallback for Smaller Screens */}
        {contentType === 'Article' && (
          <div className="lg:hidden mt-16 pt-8 border-t border-stone-300 font-sans text-stone-700 animate-fade-in">
            <div className="flex items-center justify-between mb-6 pb-2 border-b border-stone-100 select-none">
              <h3 className="font-mono text-xs uppercase tracking-widest font-semibold text-stone-800">
                Scholarly Margin Notes
              </h3>
            </div>
            
            {(() => {
               const { occurrences, map: mMap } = getMarginNotesReadingOrderMap();
               const citeMap = getCitationsMap();
               const fMap = getFootnotesReadingOrderMap().map;
               if (occurrences.length === 0) {
                 return (
                   <div className="text-stone-400 font-serif italic text-sm py-4">
                     No margin notes registered yet. Right-click inside text editor to insert margin notes.
                   </div>
                 );
               }
               return (
                 <div className="space-y-4">
                   {occurrences.map(id => (
                     <div key={id} className="bg-white border border-stone-100 p-4 rounded-md shadow-sm relative">
                       <div className="absolute top-4 left-4 select-none">
                          <span className="font-sans text-[10px] font-medium align-super text-Adjung-maroon">
                            ({toRoman(mMap[id]).toLowerCase()})
                          </span>
                        </div>
                       <div className="pl-14">
                         {mode === 'edit' ? (
                           <div>
                             <textarea
                               value={marginNotesData[id] || ''}
                               onChange={(e) => {
                                 const val = e.target.value;
                                 const updated = { ...marginNotesData, [id]: val };
                                 setMarginNotesData(updated);
                                 triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, citations, referenceSortOrder, updated);
                               }}
                               placeholder="Add margin note here..."
                               rows={2}
                               className="w-full bg-stone-50 border border-stone-200 focus:border-Adjung-maroon rounded p-2 focus:outline-none text-xs font-serif text-stone-700 leading-relaxed"
                             />
                             <div className="mt-2 text-right">
                               <button 
                                 type="button" 
                                 onClick={() => deleteNote(id, 'margin-note')}
                                 className="text-stone-400 hover:text-red-600 text-[10px] font-mono uppercase tracking-wider transition-colors"
                               >
                                 Delete Note
                               </button>
                             </div>
                           </div>
                         ) : (
                           <div className="font-serif text-sm leading-relaxed text-stone-600">
                             {parseInlineFormatting(marginNotesData[id] || '(Empty Note)', citations, referenceSortOrder, citeMap, fMap, undefined, undefined, mMap)}
                           </div>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               );
            })()}
          </div>
        )}

        {/* Footnotes Section */}
        {activeSpec.visibility.showFootnotes && getOrderedFootnotesToRender().length > 0 && (
          <div className="mt-16 pt-8 border-t border-stone-300 font-sans text-stone-700">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-100 select-none">
              <h3 className="font-mono text-xs uppercase tracking-widest font-semibold text-stone-800">
                Scholarly Footnotes & Citations
              </h3>
              {mode === 'edit' && (
                <span className="text-[9px] font-mono text-stone-400">Total registered: {getOrderedFootnotesToRender().length}</span>
              )}
            </div>

            {mode === 'edit' ? (
              <div className="space-y-4">
                {getOrderedFootnotesToRender().map((item) => {
                  return (
                    <div key={item.originalId} className="flex gap-3 items-start bg-stone-50/50 p-3 border border-stone-200/50 rounded-md hover:bg-white transition-all">
                      <span className="font-mono text-xs text-Adjung-maroon font-semibold w-5 mt-1.5 select-none">
                        [{item.displayNum}]
                      </span>
                      <div className="flex-grow space-y-1">
                        <div className="flex items-center justify-between select-none">
                          <span className="text-[8px] font-mono uppercase text-stone-400">Footnote Text (Internal ID: [^{item.originalId}])</span>
                          <span className={getWordCount(item.text) > 1000 ? "text-red-600 font-semibold font-mono text-[9px]" : "text-stone-400 font-mono text-[9px]"}>
                            {getWordCount(item.text)}/1000 words
                          </span>
                        </div>
                        <textarea
                          value={item.text}
                          onChange={(e) => {
                            handleFootnoteChange(item.originalId, e.target.value);
                          }}
                          rows={2}
                          className="w-full bg-white border border-stone-200 p-2 rounded text-xs focus:outline-none focus:border-Adjung-maroon resize-y font-serif text-stone-700 leading-relaxed"
                          placeholder={`Enter footnote ${item.displayNum} text content...`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFootnote(item.originalId)}
                        className="text-stone-300 hover:text-red-700 p-1 rounded mt-1 select-none cursor-pointer"
                        title="Remove Footnote"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <ol className="space-y-3 font-serif text-[12.5px] leading-relaxed list-none pl-0">
                {getOrderedFootnotesToRender().map((item, idx) => {
                  const fMap = getFootnotesReadingOrderMap().map;
                  const citeMap = getCitationsMap();
                  return (
                    <li 
                      key={idx} 
                      id={item.originalId.startsWith('fn-') ? `footnote-dest-${item.originalId}` : `footnote-dest-legacy-${item.originalId}`} 
                      className="group flex gap-3 hover:bg-stone-50 p-1.5 rounded transition scroll-mt-24 duration-700"
                    >
                      <span 
                        className="font-sans text-[10px] font-medium align-super text-Adjung-maroon w-4 flex-shrink-0 select-none cursor-pointer hover:underline hover:text-Adjung-maroon/80"
                        title="Go back to citation"
                        onClick={() => {
                          const refId = item.originalId.startsWith('fn-') ? `fnref-${item.originalId}` : `fnref-legacy-${item.originalId}`;
                          const refEl = document.getElementById(refId);
                          if (refEl) {
                            refEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            refEl.classList.remove('citation-flash');
                            void refEl.offsetWidth; // Trigger reflow
                            refEl.classList.add('citation-flash');
                            setTimeout(() => refEl.classList.remove('citation-flash'), 2500);
                          }
                        }}
                      >
                        ({item.displayNum})
                      </span>
                      
                      <div className="flex-grow text-left text-stone-700">
                        {parseInlineFormatting(item.text, citations, referenceSortOrder, citeMap, fMap)}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        {/* References & Bibliography */}
        {activeSpec.visibility.showCitations && citations.length > 0 && (
          <div className="mt-16 pt-8 border-t border-stone-300 font-sans text-stone-700">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-100">
              <h3 className="font-mono text-xs uppercase tracking-widest font-semibold text-stone-850">
                References & Bibliography
              </h3>
              <span className="font-mono text-[9px] text-stone-400 uppercase">
                Sorted by {referenceSortOrder === 'alphabetical' ? 'Author' : 'Appearance'}
              </span>
            </div>

            <ul className="space-y-3 font-serif text-[12.5px] leading-relaxed list-none pl-0">
              {(() => {
                const citeMap = getCitationsMap();
                const sorted = [...citations].sort((a, b) => {
                  if (referenceSortOrder === 'alphabetical') {
                    return a.author.localeCompare(b.author);
                  } else {
                    const aIdx = citeMap[a.id] || 9999;
                    const bIdx = citeMap[b.id] || 9999;
                    return aIdx - bIdx;
                  }
                });

                return sorted.map((cit, idx) => {
                  const displayIdx = citeMap[cit.id] || idx + 1;
                  return (
                    <li 
                      key={cit.id} 
                      id={`reference-${cit.id}`}
                      className="text-stone-700 text-left hover:bg-stone-50/50 p-1.5 rounded transition flex items-baseline gap-2"
                    >
                      <span className="font-mono text-xs text-Adjung-maroon font-medium select-none">
                        {referenceSortOrder === 'appearance' ? `[${displayIdx}]` : '•'}
                      </span>
                      <div className="flex-grow">
                        <strong className="font-sans font-semibold text-stone-900">{cit.author}</strong> ({cit.year}). 
                        <span> "{cit.title}."</span> <em>{cit.publisher}</em>.
                        {cit.url && (
                          <a href={cit.url} target="_blank" rel="noopener noreferrer" className="text-Adjung-maroon hover:underline ml-1.5 font-mono text-[10px] break-all">
                            [Link]
                          </a>
                        )}
                        {cit.doi && (
                          <span className="text-stone-400 ml-1.5 font-mono text-[10px]">
                            doi:{cit.doi}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                });
              })()}
            </ul>
          </div>
        )}

        {/* Tags Block */}
        {tags.length > 0 && (
          <div className="mt-12 pt-6 border-t border-stone-300 flex flex-wrap gap-2 items-center">
            <Tag className="w-3.5 h-3.5 text-stone-400" />
            {tags.map((t) => (
              <span key={t} className="font-mono text-[10px] text-Adjung-maroon bg-stone-50 px-2 py-0.5 rounded border border-stone-200/30">
                #{t}
              </span>
            ))}
          </div>
        )}

        {activeSpec.visibility.showNoteFooter && (
          <footer 
            className={`mt-8 pt-4 border-t border-stone-300 flex items-center justify-between text-base text-stone-500 select-none ${
              isArContent ? 'flex-row-reverse text-right' : 'flex-row text-left font-sans'
            }`}
          >
            <span>— {authorName}</span>
            {authorDigitalSignature ? (
              <div className="w-24 h-12 flex items-center justify-end">
                <SignatureRenderer
                  strokes={authorDigitalSignature.strokes || []}
                  type={authorDigitalSignature.type || 'drawn'}
                  typedText={authorDigitalSignature.typedText || authorSignature}
                  fontFamily={authorDigitalSignature.fontFamily}
                  typographyStyle={authorDigitalSignature.typographyStyle}
                  penStyle={authorDigitalSignature.penStyle}
                  color="#802334"
                />
              </div>
            ) : authorSignatureStrokes && authorSignatureStrokes.length > 0 ? (
              <div className="w-24 h-12 flex items-center justify-end">
                <SignatureRenderer
                  strokes={authorSignatureStrokes}
                  type="drawn"
                  color="#802334"
                />
              </div>
            ) : authorSignature ? (
              <span className="font-signature text-2xl" style={{ fontFamily: authorSignatureFont || 'var(--font-signature)' }}>
                {authorSignature}
              </span>
            ) : null}
          </footer>
        )}

        {mode === 'edit' && renderFloatingToolbar()}
      </motion.article>
    );
  };

  /**
   * Renders the interactive editor canvas (Composer).
   * Fully wide, responsive inputs that make typing highly fluid.
   */
  /**
   * Renders the unified single-pane writing desk where the Entry itself IS the editor.
   * This is in line with SPEC-023's corrected philosophy: Adjung is NOT trying to simulate physical paper,
   * but rather having Draft and Published share the same gorgeous, high-contrast, distraction-free visual canvas.
   */
  const renderEditableContent = () => {
    const isArticle = contentType === 'Article';
    const citeMap = getCitationsMap();

    const PlusMenu = () => (
      <div className="relative inline-block text-left">
        <button
          type="button"
          onClick={() => setShowInsertMenu(!showInsertMenu)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-stone-850 hover:bg-[#802334] text-stone-200 hover:text-white shadow-sm text-[10.5px] font-mono uppercase tracking-wider cursor-pointer transition-all"
        >
          <Plus className={`w-3.5 h-3.5 transition-transform duration-200 ${showInsertMenu ? 'rotate-45 text-white' : ''}`} />
          Insert Object
        </button>

        {showInsertMenu && (
          <div className="absolute z-50 bottom-10 left-0 w-72 bg-[#1e1c18] border border-stone-800 rounded shadow-2xl p-4 text-left animate-fade-in font-sans text-stone-200">
            <div className="text-[9.5px] font-mono text-stone-400 uppercase tracking-widest border-b border-stone-800 pb-2 mb-3 select-none">
              Advanced Entry Objects
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setActiveQuoteInsert('latin');
                  setQuoteInsertDir('ltr');
                  setShowInsertMenu(false);
                }}
                className="p-2 bg-stone-900/50 hover:bg-stone-900 border border-stone-800 rounded text-left flex flex-col gap-0.5 text-xs text-stone-200 transition cursor-pointer"
              >
                <span className="font-medium font-sans text-stone-100">+ Quote (LTR)</span>
                <span className="text-[9px] text-stone-450 font-mono">Kiri ke Kanan (Latin, Tamil, dsb)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveQuoteInsert('arabic');
                  setQuoteInsertDir('rtl');
                  setShowInsertMenu(false);
                }}
                className="p-2 bg-stone-900/50 hover:bg-stone-900 border border-stone-800 rounded text-left flex flex-col gap-0.5 text-xs text-stone-200 transition cursor-pointer"
              >
                <span className="font-medium font-sans text-stone-100">+ Quote (RTL)</span>
                <span className="text-[9px] text-stone-450 font-mono">Kanan ke Kiri (Arabic, Jawi, dsb)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const nextNum = footnotes.length + 1;
                  const updated = [...footnotes, 'New footnote description text.'];
                  setFootnotes(updated);
                  insertMarkdownText(`[^${nextNum}]`);
                  triggerSave(content, updated, marginNotes);
                  setShowInsertMenu(false);
                }}
                className="p-2 bg-stone-900/50 hover:bg-stone-900 border border-stone-800 rounded text-left flex flex-col gap-0.5 text-xs text-stone-200 transition cursor-pointer"
              >
                <span className="font-medium font-sans text-stone-100">+ Footnote</span>
                <span className="text-[9px] text-stone-450 font-mono">Scholarly reference</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveCitationInsert(true);
                  setShowInsertMenu(false);
                }}
                className="p-2 bg-stone-900/50 hover:bg-stone-900 border border-stone-800 rounded text-left flex flex-col gap-0.5 text-xs text-stone-200 transition cursor-pointer"
              >
                <span className="font-medium font-sans text-stone-100">+ Citation</span>
                <span className="text-[9px] text-stone-450 font-mono">Bibliography registry</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTableInsert(true);
                  setShowInsertMenu(false);
                }}
                className="p-2 bg-stone-900/50 hover:bg-stone-900 border border-stone-800 rounded text-left flex flex-col gap-0.5 text-xs text-stone-200 transition cursor-pointer"
              >
                <span className="font-medium font-sans text-stone-100">+ Table</span>
                <span className="text-[9px] text-stone-450 font-mono">Tabular grid editor</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  insertMarkdownText('![Figure caption](', ')');
                  setShowInsertMenu(false);
                }}
                className="p-2 bg-stone-900/50 hover:bg-stone-900 border border-stone-800 rounded text-left flex flex-col gap-0.5 text-xs text-stone-200 transition cursor-pointer"
              >
                <span className="font-medium font-sans text-stone-100">+ Figure</span>
                <span className="text-[9px] text-stone-450 font-mono">Scholarly illustration</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = window.prompt("Sila masukkan URL (contoh: https://google.com):", "https://");
                  if (url === null) return;
                  const text = window.prompt("Sila masukkan teks pautan (Anchor Text):", "Pautan Rujukan");
                  if (text === null) return;
                  insertMarkdownText(`[${text}](${url})`);
                  setShowInsertMenu(false);
                }}
                className="p-2 bg-stone-900/50 hover:bg-stone-900 border border-stone-800 rounded text-left flex flex-col gap-0.5 text-xs text-stone-200 transition cursor-pointer"
              >
                <span className="font-medium font-sans text-stone-100">+ Hyperlink</span>
                <span className="text-[9px] text-stone-450 font-mono">External link anchor</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  insertMarkdownText('\n---\n');
                  setShowInsertMenu(false);
                }}
                className="p-2 bg-stone-900/50 hover:bg-stone-900 border border-stone-800 rounded text-left flex flex-col gap-0.5 text-xs text-stone-200 transition cursor-pointer"
              >
                <span className="font-medium font-sans text-stone-100">Divider</span>
                <span className="text-[9px] text-stone-450 font-mono">Horizontal separator</span>
              </button>
            </div>

            <div className="text-[8px] font-mono text-stone-550 uppercase tracking-wider border-t border-stone-850 pt-2 mt-3 mb-2 select-none">
              Basic Typography Markers
            </div>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => {
                  insertLinePrefix('# ');
                  setShowInsertMenu(false);
                }}
                className="px-2 py-1 bg-stone-900/40 hover:bg-stone-900 rounded font-mono text-[9px] text-stone-300 border border-stone-800/85 transition cursor-pointer"
              >
                H1
              </button>
              <button
                type="button"
                onClick={() => {
                  insertLinePrefix('## ');
                  setShowInsertMenu(false);
                }}
                className="px-2 py-1 bg-stone-900/40 hover:bg-stone-900 rounded font-mono text-[9px] text-stone-300 border border-stone-800/85 transition cursor-pointer"
              >
                H2
              </button>
              <button
                type="button"
                onClick={() => {
                  insertLinePrefix('### ');
                  setShowInsertMenu(false);
                }}
                className="px-2 py-1 bg-stone-900/40 hover:bg-stone-900 rounded font-mono text-[9px] text-stone-300 border border-stone-800/85 transition cursor-pointer"
              >
                H3
              </button>
              <button
                type="button"
                onClick={() => {
                  insertLinePrefix('- ');
                  setShowInsertMenu(false);
                }}
                className="px-2 py-1 bg-stone-900/40 hover:bg-stone-900 rounded font-mono text-[9px] text-stone-300 border border-stone-800/85 transition cursor-pointer"
              >
                Bullet
              </button>
              <button
                type="button"
                onClick={() => {
                  insertLinePrefix('1. ');
                  setShowInsertMenu(false);
                }}
                className="px-2 py-1 bg-stone-900/40 hover:bg-stone-900 rounded font-mono text-[9px] text-stone-300 border border-stone-800/85 transition cursor-pointer"
              >
                Numbered
              </button>
              <button
                type="button"
                onClick={() => {
                  insertLinePrefix('- [ ] ');
                  setShowInsertMenu(false);
                }}
                className="px-2 py-1 bg-stone-900/40 hover:bg-stone-900 rounded font-mono text-[9px] text-stone-300 border border-stone-800/85 transition cursor-pointer"
              >
                Checklist
              </button>
              <button
                type="button"
                onClick={() => {
                  insertMarkdownText('`', '`');
                  setShowInsertMenu(false);
                }}
                className="px-2 py-1 bg-stone-900/40 hover:bg-stone-900 rounded font-mono text-[9px] text-stone-300 border border-stone-800/85 transition cursor-pointer"
              >
                Code
              </button>
            </div>
          </div>
        )}
      </div>
    );

    return (
      <div className="relative max-w-4xl mx-auto">
        {/* Floating Formatting Selection Toolbar */}
        {renderFloatingToolbar()}

        <motion.article
          className="max-w-4xl mx-auto px-4 md:px-8 bg-white border border-stone-200/50 rounded-md py-8 md:py-12 shadow-sm text-left relative overflow-visible select-text"
        >
          {/* Header Block */}
          <header className="mb-10 border-b border-stone-200/70 pb-6 relative">
            
            {/* Metadata Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest text-stone-500 mb-6 border-b border-stone-100 pb-3">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-Adjung-maroon">{contentType}</span>
                <span className="text-stone-300">|</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {formatDate(entry.createdDate)}
                </span>
                <span className="text-stone-300">|</span>
                <span className="flex items-center gap-1">
                  <BookOpen className="w-3 h-3 text-stone-400" />
                  {getReadingTime(getFullContentString())}
                </span>
                {saveStatus && (
                  <>
                    <span className="text-stone-300">|</span>
                    <span className={`flex items-center gap-1 font-semibold ${saveStatus === 'saving' ? 'text-amber-600 animate-pulse' : saveStatus === 'error' ? 'text-red-600' : 'text-emerald-650'}`}>
                      {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'error' ? 'Save Error' : 'Saved'}
                    </span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {status === 'Draft' && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[9px] font-medium lowercase">
                    draft
                  </span>
                )}
                {visibility === 'Private' && (
                  <span className="inline-flex items-center gap-1 text-red-800 text-[10px]">
                    <Lock className="w-3 h-3" /> private
                  </span>
                )}
                {visibility === 'Public' && (
                  <span className="inline-flex items-center gap-1 text-stone-400 text-[10px]">
                    <Globe className="w-3 h-3" /> canonical public
                  </span>
                )}
              </div>
            </div>

            {/* Featured Image URL Input Field */}
            {contentType !== 'Note' && (
              <div className="mb-6 space-y-1 bg-stone-50/50 p-3 border border-stone-200/40 rounded transition">
                <label className="block text-[9px] font-mono uppercase tracking-widest text-stone-400">Featured Image URL</label>
                <input
                  type="text"
                  value={featuredImage}
                  onChange={(e) => {
                    setFeaturedImage(e.target.value);
                    triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, e.target.value);
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full bg-white border border-stone-200 p-1.5 rounded text-xs font-mono focus:outline-none focus:border-Adjung-maroon text-stone-700"
                />
                {featuredImage && (
                  <img 
                    src={featuredImage} 
                    alt="Featured preview" 
                    className="mt-2 max-h-32 rounded object-cover border border-stone-200"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                )}
              </div>
            )}

            {/* Title Input Field */}
            {contentType !== 'Note' ? (
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, e.target.value);
                }}
                placeholder="Enter Title..."
                className="text-2xl md:text-3.5xl font-serif text-[#111111] font-medium tracking-tight leading-tight w-full bg-transparent border-b border-dashed border-stone-200/80 focus:border-Adjung-maroon focus:outline-none mb-3 py-1"
              />
            ) : (
              <div className="text-stone-400 font-mono text-[10px] uppercase mb-4 tracking-widest">Note Canvas</div>
            )}

            {/* Author Stamp Row */}
            <div className="flex items-center gap-3 text-stone-600 mt-2 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#802334]" />
              <div className="font-serif italic text-[13px] text-stone-500">
                Author: <span className="font-sans font-semibold text-stone-850 not-italic">{authorName}</span>
              </div>
            </div>
          </header>

          {/* Abstract/Excerpt Field */}
          {contentType !== 'Note' && (
            <div className="mb-8">
              <textarea
                value={excerpt}
                onChange={(e) => {
                  setExcerpt(e.target.value);
                  triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, e.target.value);
                }}
                placeholder="Type a concise scholarly abstract or summary of this work..."
                rows={2}
                className="w-full bg-transparent border-l-2 border-Adjung-maroon/20 pl-4 py-1 text-stone-500 font-serif italic text-sm md:text-[15px] leading-relaxed focus:outline-none resize-none"
              />
            </div>
          )}

          {/* Active Builder Overlay Block */}
          {(activeTableInsert || activeCitationInsert || activeQuoteInsert) && (
            <div className="mb-8 p-4 border border-dashed border-Adjung-maroon/30 rounded bg-stone-50/50 relative animate-fade-in text-left">
              <div className="absolute top-2 right-2 z-10">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTableInsert(false);
                    setActiveCitationInsert(false);
                    setActiveQuoteInsert(null);
                  }}
                  className="text-stone-400 hover:text-stone-600 font-mono text-[9px] uppercase cursor-pointer"
                >
                  Close Builder ×
                </button>
              </div>

              {/* Table Builder */}
              {activeTableInsert && (
                <div className="space-y-3">
                  <div className="text-[10px] font-mono uppercase tracking-wider text-Adjung-maroon font-bold">Visual Table Editor</div>
                  <div className="flex flex-wrap items-center gap-3 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-stone-550 uppercase">Cols:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const nextCols = tableHeaders.length + 1;
                          setTableHeaders([...tableHeaders, `Header ${nextCols}`]);
                          setTableAlignments([...tableAlignments, 'left']);
                          setTableData(tableData.map(row => [...row, '']));
                        }}
                        className="px-1.5 py-0.5 border border-stone-200 hover:bg-stone-50 rounded"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (tableHeaders.length <= 1) return;
                          setTableHeaders(tableHeaders.slice(0, -1));
                          setTableAlignments(tableAlignments.slice(0, -1));
                          setTableData(tableData.map(row => row.slice(0, -1)));
                        }}
                        className="px-1.5 py-0.5 border border-stone-200 hover:bg-stone-50 rounded"
                      >
                        -
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-stone-550 uppercase">Rows:</span>
                      <button
                        type="button"
                        onClick={() => {
                          setTableData([...tableData, Array(tableHeaders.length).fill('')]);
                        }}
                        className="px-1.5 py-0.5 border border-stone-200 hover:bg-stone-50 rounded"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (tableData.length <= 1) return;
                          setTableData(tableData.slice(0, -1));
                        }}
                        className="px-1.5 py-0.5 border border-stone-200 hover:bg-stone-50 rounded"
                      >
                        -
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto border border-stone-200 rounded">
                    <table className="w-full text-left font-serif text-xs border-collapse">
                      <thead>
                        <tr className="bg-stone-50">
                          {tableHeaders.map((head, idx) => (
                            <th key={`th-${idx}`} className="p-1 border border-stone-150">
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={head}
                                  onChange={(e) => {
                                    const nextHeaders = [...tableHeaders];
                                    nextHeaders[idx] = e.target.value;
                                    setTableHeaders(nextHeaders);
                                  }}
                                  className="w-full p-1 border border-stone-100 bg-white font-bold focus:outline-none rounded text-stone-850 focus:border-Adjung-maroon"
                                />
                                <select
                                  value={tableAlignments[idx]}
                                  onChange={(e) => {
                                    const nextAlign = [...tableAlignments];
                                    nextAlign[idx] = e.target.value as 'left' | 'center' | 'right';
                                    setTableAlignments(nextAlign);
                                  }}
                                  className="w-full text-[9px] font-mono p-0.5 border border-stone-100 bg-white rounded text-stone-500"
                                >
                                  <option value="left">Left</option>
                                  <option value="center">Center</option>
                                  <option value="right">Right</option>
                                </select>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((row, rIdx) => (
                          <tr key={`tr-${rIdx}`}>
                            {row.map((cell, cIdx) => (
                              <td key={`td-${rIdx}-${cIdx}`} className="p-1 border border-stone-100">
                                <input
                                  type="text"
                                  value={cell}
                                  onChange={(e) => {
                                    const nextData = tableData.map((r, ri) => 
                                      ri === rIdx ? r.map((c, ci) => ci === cIdx ? e.target.value : c) : r
                                    );
                                    setTableData(nextData);
                                  }}
                                  className="w-full p-1 text-xs border border-stone-100 bg-white focus:outline-none rounded focus:border-Adjung-maroon text-stone-800"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex justify-end gap-2 text-[10px]">
                    <button
                      type="button"
                      onClick={() => {
                        const headerStr = '| ' + tableHeaders.join(' | ') + ' |';
                        const sepStr = '| ' + tableAlignments.map(align => {
                          if (align === 'center') return ':---:';
                          if (align === 'right') return '---:';
                          return '---';
                        }).join(' | ') + ' |';
                        const rowStrings = tableData.map(row => '| ' + row.join(' | ') + ' |');
                        const tableText = `\n${headerStr}\n${sepStr}\n${rowStrings.join('\n')}\n`;
                        
                        insertMarkdownText(tableText);
                        setActiveTableInsert(false);
                        showToast('Visual table block inserted', 'success');
                      }}
                      className="px-3 py-1 font-mono uppercase bg-Adjung-maroon text-white font-medium rounded hover:bg-[#962e41] shadow-sm cursor-pointer"
                    >
                      Insert Table
                    </button>
                  </div>
                </div>
              )}



              {/* Citation Registry */}
              {activeCitationInsert && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center pb-1 border-b border-stone-200">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-Adjung-maroon font-bold">Citation Registry</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-stone-500 uppercase">Sort Style:</span>
                      <select
                        value={referenceSortOrder}
                        onChange={(e) => {
                          const style = e.target.value;
                          setReferenceSortOrder(style);
                          triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, slug, title, excerpt, featuredImage, revisions, citations, style);
                          showToast(`Bibliography sorting style changed to ${style}`, 'success');
                        }}
                        className="p-1 text-[9.5px] border border-stone-200 bg-white font-mono rounded text-stone-850"
                      >
                        <option value="alphabetical">Alphabetical (Harvard)</option>
                        <option value="appearance">Appearance (Vancouver)</option>
                      </select>
                    </div>
                  </div>

                  <form 
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const author = form.elements.namedItem('cit_author').value.trim();
                      const title = form.elements.namedItem('cit_title').value.trim();
                      const year = parseInt(form.elements.namedItem('cit_year').value.trim());
                      const publisher = form.elements.namedItem('cit_publisher').value.trim();
                      const url = form.elements.namedItem('cit_url').value.trim() || undefined;
                      const doi = form.elements.namedItem('cit_doi').value.trim() || undefined;
                      
                      if (!author || !title || !year || !publisher) {
                        alert('Author, Title, Year, and Publisher are required fields.');
                        return;
                      }
                      
                      handleAddCitation({ author, title, year, publisher, url, doi });
                      form.reset();
                    }}
                    className="space-y-3 bg-white p-3 border border-stone-200 rounded text-[10px]"
                  >
                    <div className="text-[9.5px] font-mono text-stone-550 uppercase font-bold">Register New Bibliography Entry</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[9px] font-mono uppercase text-stone-400">Author</label>
                        <input name="cit_author" type="text" placeholder="Ibn Rushd" className="w-full p-1.5 border border-stone-200 rounded text-xs text-stone-700 focus:outline-none focus:border-Adjung-maroon" required />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-mono uppercase text-stone-400">Title</label>
                        <input name="cit_title" type="text" placeholder="Incoherence of the Incoherence" className="w-full p-1.5 border border-stone-200 rounded text-xs text-stone-700 focus:outline-none focus:border-Adjung-maroon" required />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-mono uppercase text-stone-400">Publication Year</label>
                        <input name="cit_year" type="number" placeholder="1179" className="w-full p-1.5 border border-stone-200 rounded text-xs text-stone-700 focus:outline-none focus:border-Adjung-maroon" required />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-mono uppercase text-stone-400">Publisher</label>
                        <input name="cit_publisher" type="text" placeholder="Cairo Press" className="w-full p-1.5 border border-stone-200 rounded text-xs text-stone-700 focus:outline-none focus:border-Adjung-maroon" required />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-mono uppercase text-stone-400">External URL (Optional)</label>
                        <input name="cit_url" type="text" placeholder="https://..." className="w-full p-1.5 border border-stone-200 rounded text-xs text-stone-700 focus:outline-none focus:border-Adjung-maroon" />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[9px] font-mono uppercase text-stone-400">DOI Reference (Optional)</label>
                        <input name="cit_doi" type="text" placeholder="10.1000/xyz123" className="w-full p-1.5 border border-stone-200 rounded text-xs text-stone-700 focus:outline-none focus:border-Adjung-maroon" />
                      </div>
                    </div>
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-Adjung-maroon text-[#FDFDFD] font-mono font-medium rounded hover:bg-[#962e41] shadow-sm uppercase cursor-pointer"
                      >
                        Add Source
                      </button>
                    </div>
                  </form>

                  {/* Registered Sources list with in-text insertion clicks */}
                  {citations.length > 0 && (
                    <div className="space-y-2 max-h-36 overflow-y-auto border border-stone-200/60 rounded p-2 bg-white">
                      <div className="text-[9px] font-mono uppercase text-stone-400">Registered Sources (Click to insert in-text citation marker):</div>
                      {citations.map((cit, cIdx) => (
                        <div key={cit.id} className="flex items-center justify-between p-2 hover:bg-stone-50 border border-stone-100 rounded text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              insertMarkdownText(`[cite:${cit.id}]`);
                              showToast('Citation marker inserted', 'success');
                            }}
                            className="font-serif text-stone-700 font-medium hover:text-Adjung-maroon cursor-pointer text-left flex-grow pr-4"
                          >
                            {cit.author} ({cit.year}) - "{cit.title}"
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteCitation(cit.id)}
                            className="text-stone-300 hover:text-red-700 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Universal Quotation Builder */}
              {activeQuoteInsert !== null && (
                <div className="space-y-4 p-4 border border-stone-200 bg-stone-50/50 rounded shadow-md animate-fade-in text-left">
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2 mb-2">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-Adjung-maroon font-bold">
                      Universal Quotation Builder &bull; Pembuat Petikan Universal
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveQuoteInsert(null)}
                      className="text-stone-400 hover:text-stone-600 font-mono text-[9px] uppercase transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Direction Switcher Toggle */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[9.5px] font-mono text-stone-550 uppercase tracking-wider">
                      Writing Direction &bull; Arah Tulisan
                    </label>
                    <div className="flex rounded bg-stone-100 p-0.5 border border-stone-200">
                      <button
                        type="button"
                        onClick={() => setQuoteInsertDir('ltr')}
                        className={`flex-1 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition cursor-pointer ${
                          quoteInsertDir === 'ltr'
                            ? 'bg-white text-Adjung-maroon font-semibold shadow-sm'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        Left-to-Right (LTR / Kiri ke Kanan)
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuoteInsertDir('rtl')}
                        className={`flex-1 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition cursor-pointer ${
                          quoteInsertDir === 'rtl'
                            ? 'bg-white text-Adjung-maroon font-semibold shadow-sm'
                            : 'text-stone-500 hover:text-stone-800'
                        }`}
                      >
                        Right-to-Left (RTL / Kanan ke Kiri)
                      </button>
                    </div>
                  </div>

                  {/* Original Quote Text */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[9.5px] font-mono text-stone-550 uppercase tracking-wider">
                        Original Quotation &bull; Petikan Asal
                      </label>
                      <span className="text-[8px] font-mono text-stone-400 uppercase tracking-wide">
                        {quoteInsertDir === 'rtl' ? 'RTL Mode Enabled' : 'LTR Mode Enabled'}
                      </span>
                    </div>
                    <textarea
                      id="universal-quote-input-text"
                      rows={3}
                      dir={quoteInsertDir === 'rtl' ? 'rtl' : 'ltr'}
                      placeholder={
                        quoteInsertDir === 'rtl'
                          ? 'اكتب النص هنا... (e.g., Arabic, Jawi, Hebrew, Tamil, Chinese, etc.)'
                          : 'Type quote text here... (e.g., English, Confucius, Tamil, etc.)'
                      }
                      className={`w-full p-2.5 text-xs border border-stone-200 rounded focus:outline-none focus:border-Adjung-maroon text-[#111111] bg-white leading-relaxed ${
                        quoteInsertDir === 'rtl'
                          ? 'font-arabic text-right text-base leading-loose'
                          : 'font-serif text-left'
                      }`}
                    />
                  </div>

                  {/* Translation Text (Optional) */}
                  <div className="space-y-1">
                    <label className="block text-[9.5px] font-mono text-stone-550 uppercase tracking-wider">
                      Translation &bull; Terjemahan (Optional)
                    </label>
                    <textarea
                      id="universal-quote-input-translation"
                      rows={2}
                      placeholder="Type English/Malay translation here... (mungkin petikan asal berhajat kepada terjemahan)"
                      className="w-full p-2.5 text-xs border border-stone-200 rounded focus:outline-none focus:border-Adjung-maroon font-serif text-[#111111] bg-white leading-relaxed text-left"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1 border-t border-stone-200/50 mt-2">
                    <button
                      type="button"
                      onClick={() => setActiveQuoteInsert(null)}
                      className="px-3 py-1 font-mono text-[9px] uppercase border border-stone-200 rounded text-stone-500 hover:text-stone-800 hover:bg-stone-50 cursor-pointer transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const txtInput = document.getElementById('universal-quote-input-text') as HTMLTextAreaElement | null;
                        const transInput = document.getElementById('universal-quote-input-translation') as HTMLTextAreaElement | null;

                        const quoteText = txtInput?.value || '';
                        const translationText = transInput?.value || '';

                        if (quoteText.trim()) {
                          const transPart = translationText.trim() ? `\n  <translation>${translationText.trim()}</translation>` : '';

                          let quoteStr = '';
                          if (quoteInsertDir === 'rtl') {
                            quoteStr = `<quote type="arabic">\n  <arabic>${quoteText.trim()}</arabic>${transPart}\n</quote>`;
                          } else {
                            quoteStr = `<quote type="latin">\n  <text>${quoteText.trim()}</text>${transPart}\n</quote>`;
                          }
                          insertMarkdownText(quoteStr);
                        }
                        setActiveQuoteInsert(null);
                      }}
                      className="px-3 py-1 font-mono text-[9px] uppercase bg-Adjung-maroon text-white rounded hover:bg-[#962e41] font-semibold cursor-pointer shadow-sm transition"
                    >
                      Insert Quote
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Core Writing Body */}
          <div className="text-[#111111] font-serif leading-relaxed tracking-normal text-[15px] md:text-base relative min-h-[350px]">
            
            {/* Note & Essay - Large unified editing viewport */}
            {(contentType === 'Note' || contentType === 'Essay') && (
              <div className="space-y-4">
                <textarea
                  id="editorial-content-textarea"
                  onFocus={() => setActiveTextareaIdx(null)}
                  value={content}
                  onChange={(e) => {
                    const val = e.target.value;
                    setContent(val);
                    triggerSave(val, footnotes, marginNotes);
                  }}
                  placeholder="Begin writing your manuscript here... Standard markdown markers are fully compiled in-canvas."
                  className="w-full min-h-[140px] bg-transparent border-none focus:outline-none resize-y font-serif text-[15.5px] md:text-[16.5px] leading-relaxed text-[#111111]"
                />

                {/* Lightweight insert popover trigger at the bottom of the textarea */}
                <div className="flex items-center justify-between pt-4 border-t border-stone-100 select-none">
                  <div className="flex items-center gap-1">
                    <PlusMenu />
                  </div>
                  <div className="text-[10px] font-mono text-stone-400">
                    Characters: {getCharCount(content)} | Words: {getWordCount(content)}/{(contentType === 'Note' ? 100 : contentType === 'Essay' ? 1000 : 10000).toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* Article - Sequenced modular block editor */}
            {contentType === 'Article' && (
              <div className="space-y-6">
                {paragraphs.map((para, index) => {
                  const blocksOfPara = parseContentToBlocks(para);
                  const currentBlock = blocksOfPara[0] || { type: 'paragraph', text: para };
                  const currentType = currentBlock.type;
                  const isAr = currentType === 'arabic-quote' || (currentType === 'paragraph' && isArabicText(currentBlock.text));

                  return (
                    <div 
                      key={index} 
                      className="group relative border border-dashed border-stone-200/55 hover:border-Adjung-maroon/30 p-4 rounded bg-stone-50/20 hover:bg-white focus-within:bg-white transition-all space-y-3"
                    >
                      {/* Floating Block controls header */}
                      <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 flex flex-wrap items-center justify-between border-b border-stone-100 pb-2 gap-2 transition-all duration-200">
                        <div className="flex items-center gap-1.5 select-none">
                          <span className="font-mono text-[9px] font-bold text-Adjung-maroon/60 uppercase">
                            Block #{index + 1}
                          </span>
                          <span className="text-stone-300 font-mono text-[9px]">|</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleBlockTypeChange(index, 'paragraph')}
                              className={`px-1.5 py-0.5 font-mono text-[8px] uppercase border rounded transition ${
                                currentType === 'paragraph'
                                  ? 'bg-Adjung-maroon/10 text-Adjung-maroon border-Adjung-maroon/20 font-semibold'
                                  : 'bg-white text-stone-400 border-stone-200 hover:text-stone-600'
                              }`}
                            >
                              Paragraph
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBlockTypeChange(index, 'latin-quote')}
                              className={`px-1.5 py-0.5 font-mono text-[8px] uppercase border rounded transition ${
                                currentType === 'latin-quote'
                                  ? 'bg-Adjung-maroon/10 text-Adjung-maroon border-Adjung-maroon/20 font-semibold'
                                  : 'bg-white text-stone-400 border-stone-200 hover:text-stone-600'
                              }`}
                            >
                              Latin Quote
                            </button>
                            <button
                              type="button"
                              onClick={() => handleBlockTypeChange(index, 'arabic-quote')}
                              className={`px-1.5 py-0.5 font-mono text-[8px] uppercase border rounded transition ${
                                currentType === 'arabic-quote'
                                  ? 'bg-Adjung-maroon/10 text-Adjung-maroon border-Adjung-maroon/20 font-semibold'
                                  : 'bg-white text-stone-400 border-stone-200 hover:text-stone-600'
                              }`}
                            >
                              Arabic Quote
                            </button>
                          </div>
                        </div>

                        {/* Order & Modification icons */}
                        <div className="flex items-center gap-1 select-none">
                          <button
                            type="button"
                            onClick={() => handleMoveUp(index)}
                            disabled={index === 0}
                            className="p-1 rounded text-stone-400 hover:text-Adjung-maroon hover:bg-stone-50 disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move Block Up"
                          >
                            <ArrowUp className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(index)}
                            disabled={index === paragraphs.length - 1}
                            className="p-1 rounded text-stone-400 hover:text-Adjung-maroon hover:bg-stone-50 disabled:opacity-30 disabled:hover:bg-transparent"
                            title="Move Block Down"
                          >
                            <ArrowDown className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicateParagraph(index)}
                            className="p-1 rounded text-stone-400 hover:text-Adjung-maroon hover:bg-stone-50"
                            title="Duplicate Block"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleInsertBelow(index)}
                            className="p-1 rounded text-stone-400 hover:text-Adjung-maroon hover:bg-stone-50"
                            title="Insert Empty Block Below"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          {paragraphs.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveParagraph(index)}
                              className="p-1 rounded text-stone-400 hover:text-red-700 hover:bg-red-50"
                              title="Delete Block"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Editorial Workspace Grid */}
                      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start relative overflow-visible">
                        {/* Writing Pane */}
                        <div className="xl:col-span-8 w-full">
                          {currentType === 'paragraph' && (
                            <textarea
                              id={`editorial-content-textarea-${index}`}
                              onFocus={() => setActiveTextareaIdx(index)}
                              value={currentBlock.text}
                              dir={isAr ? 'rtl' : 'ltr'}
                              onChange={(e) => handleContentChange(index, e.target.value)}
                              placeholder={`Paragraph ${index + 1} manuscript... Supports Arabic text & inline footnotes.`}
                              rows={3}
                              className={`w-full bg-transparent font-serif text-[15px] md:text-base text-stone-900 leading-relaxed border-none focus:outline-none resize-y p-0 ${
                                isAr ? 'text-right font-arabic leading-loose text-lg font-medium' : 'text-left'
                              }`}
                            />
                          )}

                          {currentType === 'latin-quote' && (
                            <div className="space-y-3 border-l-2 border-stone-300 pl-4 py-1">
                              <div>
                                <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">Original Quote (LTR)</label>
                                <textarea
                                  id={`editorial-content-textarea-${index}`}
                                  onFocus={() => setActiveTextareaIdx(index)}
                                  value={currentBlock.text}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const transPart = currentBlock.translation ? `\n  <translation>${currentBlock.translation}</translation>` : '';
                                    const serialized = `<quote type="latin">\n  <text>${val}</text>${transPart}\n</quote>`;
                                    handleContentChange(index, serialized);
                                  }}
                                  placeholder="Type quote text here... (e.g., English, Chinese, Tamil, etc.)"
                                  rows={2}
                                  className="w-full bg-transparent font-serif italic text-sm text-stone-750 leading-relaxed border-none focus:outline-none resize-y p-0 text-left"
                                />
                              </div>
                              <div>
                                <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">Translation (Optional)</label>
                                <textarea
                                  value={currentBlock.translation || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const transPart = val ? `\n  <translation>${val}</translation>` : '';
                                    const serialized = `<quote type="latin">\n  <text>${currentBlock.text}</text>${transPart}\n</quote>`;
                                    handleContentChange(index, serialized);
                                  }}
                                  placeholder="English / Malay translation..."
                                  rows={1}
                                  className="w-full bg-transparent font-serif text-stone-550 leading-relaxed border-none focus:outline-none resize-y p-0 text-xs text-left"
                                />
                              </div>
                            </div>
                          )}

                          {currentType === 'arabic-quote' && (
                            <div className="space-y-3 border-r-2 border-Adjung-maroon/20 pr-4 py-1">
                              <div>
                                <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5 text-right">Original Quote (RTL)</label>
                                <textarea
                                  id={`editorial-content-textarea-${index}`}
                                  onFocus={() => setActiveTextareaIdx(index)}
                                  value={currentBlock.arabic}
                                  dir="rtl"
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const transPart = currentBlock.translation ? `\n  <translation>${currentBlock.translation}</translation>` : '';
                                    const serialized = `<quote type="arabic">\n  <arabic>${val}</arabic>${transPart}\n</quote>`;
                                    handleContentChange(index, serialized);
                                  }}
                                  placeholder="اكتب النص هنا... (e.g., Arabic, Jawi, Hebrew, etc.)"
                                  rows={2}
                                  className="w-full bg-transparent font-arabic text-right text-stone-900 leading-loose border-none focus:outline-none resize-y p-0 text-lg"
                                />
                              </div>
                              <div>
                                <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">Translation (Optional)</label>
                                <textarea
                                  value={currentBlock.translation || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    const transPart = val ? `\n  <translation>${val}</translation>` : '';
                                    const serialized = `<quote type="arabic">\n  <arabic>${currentBlock.arabic}</arabic>${transPart}\n</quote>`;
                                    handleContentChange(index, serialized);
                                  }}
                                  placeholder="English / Malay translation..."
                                  rows={1}
                                  className="w-full bg-transparent font-serif text-stone-600 leading-relaxed border-none focus:outline-none resize-y p-0 text-xs"
                                />
                              </div>
                            </div>
                          )}

                          {currentType === 'image' && (
                            <EntryImageEditor
                              url={currentBlock.url}
                              alt={currentBlock.alt}
                              idx={index}
                              onUpdate={(newUrl, newAlt) => {
                                handleUpdateContentImage(index, newUrl, newAlt);
                              }}
                              onConvertToParagraph={() => {
                                handleContentChange(index, `![${currentBlock.alt}](${currentBlock.url})`);
                              }}
                            />
                          )}

                          {currentType !== 'paragraph' && currentType !== 'latin-quote' && currentType !== 'arabic-quote' && currentType !== 'image' && (
                            <div className="space-y-1">
                              <label className="block text-[8.5px] font-mono text-stone-400 uppercase tracking-wider mb-0.5">Raw Block Content ({currentType})</label>
                              <textarea
                                id={`editorial-content-textarea-${index}`}
                                onFocus={() => setActiveTextareaIdx(index)}
                                value={para}
                                onChange={(e) => handleContentChange(index, e.target.value)}
                                placeholder="Type block content here..."
                                rows={3}
                                className="w-full bg-transparent font-serif text-[15px] md:text-base text-stone-900 leading-relaxed border-none focus:outline-none resize-y p-0"
                              />
                            </div>
                          )}
                        </div>

                        {/* Margin Commentary Commentary Area */}
                        <div className="xl:col-span-4 pl-2 border-t xl:border-t-0 xl:border-l border-stone-200/50 pt-2 xl:pt-0 space-y-1">
                          <div className="flex items-center justify-between text-[9px] font-mono text-stone-400 select-none">
                            <span className="uppercase">Margin Note Commentary</span>
                            <span>{getWordCount(marginNotes[index] || '')}/50 words</span>
                          </div>
                          <textarea
                            value={marginNotes[index] || ''}
                            onChange={(e) => handleMarginNoteChange(index, e.target.value)}
                            placeholder="Add side margin note here..."
                            rows={5}
                            className="w-full min-h-[100px] bg-transparent font-sans text-xs text-stone-650 leading-relaxed border-none focus:outline-none resize-y p-0"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Add block button */}
                <div className="pt-2 select-none flex justify-between items-center">
                  <div className="flex items-center gap-1">
                    <PlusMenu />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddParagraph}
                    className="inline-flex items-center gap-1 px-4 py-1.5 border border-dashed border-stone-300 hover:border-Adjung-maroon text-stone-550 hover:text-Adjung-maroon font-mono text-[10px] uppercase tracking-wider rounded transition-all cursor-pointer bg-stone-50/20"
                  >
                    <Plus className="w-3.5 h-3.5" /> Append Paragraph Block
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Footnotes Workspace Section */}
          {(contentType === 'Essay' || contentType === 'Article') && footnotes.length > 0 && (
            <div className="mt-16 pt-8 border-t border-stone-300/60 font-sans text-stone-700">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-100 select-none">
                <h3 className="font-mono text-xs uppercase tracking-widest font-semibold text-stone-800">
                  Scholarly Footnotes & Citations
                </h3>
                <span className="text-[9px] font-mono text-stone-400">Total registered: {footnotes.length}</span>
              </div>

              <div className="space-y-4">
                {getOrderedFootnotesToRender().map((item) => {
                  return (
                    <div key={item.originalId} className="flex gap-3 items-start bg-stone-50/50 p-3 border border-stone-200/50 rounded-md hover:bg-white transition-all">
                      <span className="font-mono text-xs text-Adjung-maroon font-semibold w-5 mt-1.5 select-none">
                        [{item.displayNum}]
                      </span>
                      <div className="flex-grow space-y-1">
                        <div className="flex items-center justify-between select-none">
                          <span className="text-[8px] font-mono uppercase text-stone-400">Footnote Text (Internal ID: [^{item.originalId}])</span>
                          <span className={getWordCount(item.text) > 1000 ? "text-red-600 font-semibold font-mono text-[9px]" : "text-stone-400 font-mono text-[9px]"}>
                            {getWordCount(item.text)}/1000 words
                          </span>
                        </div>
                        <textarea
                          value={item.text}
                          onChange={(e) => {
                            handleFootnoteChange(item.originalId, e.target.value);
                          }}
                          rows={2}
                          className="w-full bg-white border border-stone-200 p-2 rounded text-xs focus:outline-none focus:border-Adjung-maroon resize-y font-serif text-stone-700 leading-relaxed"
                          placeholder={`Enter footnote ${item.displayNum} text content...`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFootnote(item.originalId)}
                        className="text-stone-300 hover:text-red-700 p-1 rounded mt-1 select-none cursor-pointer"
                        title="Remove Footnote"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* References & Bibliography */}
          {citations.length > 0 && (
            <div className="mt-16 pt-8 border-t border-stone-300/60 font-sans text-stone-700">
              <div className="flex items-center justify-between mb-4 pb-2 border-b border-stone-100 select-none">
                <h3 className="font-mono text-xs uppercase tracking-widest font-semibold text-stone-850">
                  References & Bibliography
                </h3>
                <span className="font-mono text-[9px] text-stone-400 uppercase">
                  Sorted by ${referenceSortOrder === 'alphabetical' ? 'Author' : 'Appearance'}
                </span>
              </div>

              <ul className="space-y-3 font-serif text-[12.5px] leading-relaxed list-none pl-0">
                {(() => {
                  const sorted = [...citations].sort((a, b) => {
                    if (referenceSortOrder === 'alphabetical') {
                      return a.author.localeCompare(b.author);
                    } else {
                      const aIdx = citeMap[a.id] || 9999;
                      const bIdx = citeMap[b.id] || 9999;
                      return aIdx - bIdx;
                    }
                  });

                  return sorted.map((cit, idx) => {
                    const displayIdx = citeMap[cit.id] || idx + 1;
                    return (
                      <li 
                        key={cit.id} 
                        className="text-stone-700 text-left hover:bg-stone-50/50 p-1.5 rounded transition flex items-baseline gap-2"
                      >
                        <span className="font-mono text-xs text-Adjung-maroon font-medium select-none">
                          {referenceSortOrder === 'appearance' ? `[${displayIdx}]` : '•'}
                        </span>
                        <div className="flex-grow">
                          <strong className="font-sans font-semibold text-stone-900">{cit.author}</strong> ({cit.year}). 
                          <span> "${cit.title}."</span> <em>{cit.publisher}</em>.
                          {cit.url && (
                            <a href={cit.url} target="_blank" rel="noopener noreferrer" className="text-Adjung-maroon hover:underline ml-1.5 font-mono text-[10px] break-all">
                              [Link]
                            </a>
                          )}
                          {cit.doi && (
                            <span className="text-stone-400 ml-1.5 font-mono text-[10px]">
                              doi:{cit.doi}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  });
                })()}
              </ul>
            </div>
          )}

          {/* Tags list */}
          {tags.length > 0 && (
            <div className="mt-12 pt-6 border-t border-stone-200/40 flex flex-wrap gap-2 items-center select-none">
              <Tag className="w-3.5 h-3.5 text-stone-400" />
              {tags.map((t) => (
                <span key={t} className="font-mono text-[10px] text-Adjung-maroon bg-stone-50 px-2 py-0.5 rounded border border-stone-200/30">
                  #{t}
                </span>
              ))}
            </div>
          )}
        </motion.article>
      </div>
    );
  };

  const isEditingWorkspace = mode === 'edit';
  const effectiveViewMode = isEditingWorkspace ? (viewMode || 'preview') : 'preview';

  const handleGlobalKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'b')) {
      const target = e.target as HTMLElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
        e.preventDefault();
        const start = target.selectionStart;
        const end = target.selectionEnd;
        if (start !== null && end !== null && start !== end) {
          const value = target.value;
          const selectedText = value.substring(start, end);
          const before = value.substring(0, start);
          const after = value.substring(end);
          
          const markdownChar = e.key.toLowerCase() === 'b' ? '**' : '*';
          const newVal = before + markdownChar + selectedText + markdownChar + after;
          
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
          
          if (target instanceof HTMLInputElement && nativeInputValueSetter) {
             nativeInputValueSetter.call(target, newVal);
          } else if (target instanceof HTMLTextAreaElement && nativeTextAreaValueSetter) {
             nativeTextAreaValueSetter.call(target, newVal);
          } else {
             target.value = newVal;
          }
          
          target.dispatchEvent(new Event('input', { bubbles: true }));
          
          setTimeout(() => {
            target.focus();
            target.setSelectionRange(start + markdownChar.length, end + markdownChar.length);
          }, 0);
        }
      }
    }
  };

  return (
    <div className={`w-full relative ${isEditingWorkspace ? 'pb-28' : ''}`} onKeyDown={handleGlobalKeyDown}>
      {!isEditingWorkspace ? (
        // Standard high-contrast reading layout
        renderPublishedContent()
      ) : (
        <>
          {effectiveViewMode === 'preview' ? (
            renderPublishedContent()
          ) : (
            renderSourceContent()
          )}

          {/* Collapsible Publishing Controls at the bottom */}
          <div className="max-w-4xl mx-auto mt-12 pt-6 border-t border-stone-200/60">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 mx-auto text-xs font-mono uppercase tracking-wider text-stone-600 hover:text-Adjung-maroon bg-stone-100 hover:bg-stone-200/70 rounded transition cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              {showSettings ? 'Hide Settings' : 'Publishing Settings'}
            </button>
            
            {showSettings && (
              <div className="mt-6 p-6 bg-white border border-Adjung-maroon/20 rounded shadow-sm space-y-6 animate-fade-in font-sans text-xs text-stone-700 scholarly-border text-left">
                <div className="flex items-center justify-between border-b border-Adjung-maroon/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-Adjung-maroon animate-pulse" />
                    <h4 className="font-mono font-medium text-stone-900 tracking-wider uppercase text-xs">Publishing Settings</h4>
                  </div>
                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('Are you sure you want to delete this entry permanently?')) {
                          onDelete(entry.id);
                        }
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 text-red-700 hover:bg-red-50 border border-transparent hover:border-red-200 rounded transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Entry
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Format Picker */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">Format</label>
                    <select
                      value={contentType}
                      onChange={(e) => {
                        const type = e.target.value as EntryType;
                        setContentType(type);
                        triggerSave(content, footnotes, marginNotes, type);
                      }}
                      className="w-full border border-stone-200 bg-white p-1.5 rounded focus:outline-none focus:border-Adjung-maroon font-serif text-sm"
                    >
                      <option value="Note">Note</option>
                      <option value="Essay">Essay (supports footnotes)</option>
                      <option value="Article">Article (supports margin notes & footnotes)</option>
                    </select>
                    <p className="text-[10px] text-stone-400 mt-1">
                      {contentType === 'Note' && 'Short form text (max 100 words). Supports Arabic/Jawi.'}
                      {contentType === 'Essay' && 'Classical long form (max 1000 words). Supports bottom footnotes (max 1000 words each).'}
                      {contentType === 'Article' && 'Highly structured (max 10,000 words). Supports side margin notes (max 50 words each) and bottom footnotes (max 1000 words each).'}
                    </p>
                  </div>

                  {/* Publishing Status */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => {
                        const s = e.target.value as EntryStatus;
                        setStatus(s);
                        triggerSave(content, footnotes, marginNotes, contentType, s);
                      }}
                      className="w-full border border-stone-200 bg-white p-1.5 rounded focus:outline-none focus:border-Adjung-maroon font-mono text-xs"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Published">Published</option>
                      <option value="Archived">Archived</option>
                    </select>
                  </div>

                  {/* Visibility */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">Visibility</label>
                    <select
                      value={visibility}
                      onChange={(e) => {
                        const v = e.target.value as EntryVisibility;
                        setVisibility(v);
                        triggerSave(content, footnotes, marginNotes, contentType, status, v);
                      }}
                      className="w-full border border-stone-200 bg-white p-1.5 rounded focus:outline-none focus:border-Adjung-maroon font-mono text-xs"
                    >
                      <option value="Public">Public (visible in Folio)</option>
                      <option value="Private">Private (unpublished/secret)</option>
                    </select>
                  </div>

                  {/* URL Slug */}
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">Slug</label>
                    <input
                      type="text"
                      value={slug}
                      onChange={(e) => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-');
                        setSlug(val);
                        triggerSave(content, footnotes, marginNotes, contentType, status, visibility, tags, val);
                      }}
                      placeholder="url-slug-here"
                      className="w-full border border-stone-200 bg-white p-1.5 rounded focus:outline-none focus:border-Adjung-maroon font-mono text-xs text-stone-600"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="border-t border-stone-200/60 pt-3">
                  <span className="block text-[10px] font-mono uppercase tracking-wider text-stone-500 mb-1">Tags</span>
                  <div className="flex flex-wrap items-center gap-1.5 mb-2">
                    {tags.map(t => (
                      <span key={t} className="inline-flex items-center gap-1 bg-stone-100 hover:bg-stone-200 text-stone-800 px-2 py-0.5 rounded font-mono text-[10px] transition">
                        {t}
                        <button type="button" onClick={() => handleRemoveTag(t)} className="text-stone-400 hover:text-red-700 font-bold ml-0.5 font-sans">×</button>
                      </span>
                    ))}
                    {tags.length === 0 && <span className="text-stone-400 italic text-[11px]">No tags associated yet.</span>}
                  </div>
                  <div className="flex gap-2 max-w-sm">
                    <input
                      type="text"
                      placeholder="Add tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      className="border border-stone-200 bg-white px-2 py-1 rounded focus:outline-none focus:border-Adjung-maroon text-xs flex-grow font-sans"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const val = newTag.trim();
                          if (val && !tags.includes(val)) {
                            const updated = [...tags, val];
                            setTags(updated);
                            setNewTag('');
                            triggerSave(content, footnotes, marginNotes, contentType, status, visibility, updated);
                          }
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = newTag.trim();
                        if (val && !tags.includes(val)) {
                          const updated = [...tags, val];
                          setTags(updated);
                          setNewTag('');
                          triggerSave(content, footnotes, marginNotes, contentType, status, visibility, updated);
                        }
                      }}
                      className="bg-Adjung-maroon text-[#FDFDFD] px-3 py-1 rounded text-xs hover:opacity-90 font-mono tracking-wider cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                </div>

                {/* Revision History Logs */}
                <div className="border-t border-stone-200/60 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-500">
                      Revision Log & Version Control
                    </label>
                    <button
                      type="button"
                      onClick={() => handleCreateManualRevision()}
                      className="text-[10px] text-Adjung-maroon border border-Adjung-maroon/20 hover:bg-Adjung-maroon/5 px-2 py-1 rounded transition font-mono uppercase tracking-wider cursor-pointer"
                    >
                      Take Snapshot
                    </button>
                  </div>

                  {revisions.length === 0 ? (
                    <p className="text-xs text-stone-400 italic">No revisions cataloged. Revisions are created on manual update/publish or taking a snapshot.</p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto border border-stone-200/60 rounded-md p-2 bg-stone-50/40">
                      {revisions.slice().reverse().map((rev, index) => {
                        const revTime = new Date(rev.timestamp).toLocaleString();
                        const words = getWordCount(rev.content);
                        const chars = getCharCount(rev.content);
                        return (
                          <div key={rev.id} className="flex flex-wrap items-center justify-between p-2 bg-white border border-stone-205/60 rounded text-[10.5px] gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-stone-450 font-medium">
                                #{revisions.length - index}
                              </span>
                              <span className="font-sans text-stone-600 font-medium">
                                {revTime}
                              </span>
                              <span className="text-[8.5px] font-mono uppercase px-1.5 py-0.5 rounded bg-stone-100 text-stone-600">
                                {rev.status}
                              </span>
                              <span className="text-stone-400 font-mono text-[9.5px]">
                                ({words} words, {chars} chars)
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRestoreRevision(rev)}
                                className="text-[10px] font-mono text-[#802334] hover:underline cursor-pointer uppercase font-semibold"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pre-Publication Image Verification */}
                <div className="border-t border-stone-200/60 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-500">
                      External Image Validation (Optional)
                    </label>
                    <button
                      type="button"
                      disabled={isValidationRunning}
                      onClick={() => runImageValidation()}
                      className="text-[10px] text-Adjung-maroon border border-Adjung-maroon/20 hover:bg-Adjung-maroon/5 disabled:opacity-50 px-2 py-1 rounded transition font-mono uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      {isValidationRunning ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Checking Assets...
                        </>
                      ) : (
                        <>
                          <Check className="w-3 h-3" />
                          Verify Image Links
                        </>
                      )}
                    </button>
                  </div>

                  {hasValidated && (
                    <div className="p-3 bg-stone-50 border border-stone-200/60 rounded text-[11px] space-y-2">
                      {isValidationRunning && (
                        <p className="text-stone-550 italic font-mono text-[10px] animate-pulse">Running checks on external image assets in the manuscript...</p>
                      )}

                      {!isValidationRunning && validationSuccess && (
                        <div className="flex gap-2 items-center text-emerald-800">
                          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          <span className="font-sans font-medium">All external images validated and online! Publication safe.</span>
                        </div>
                      )}

                      {!isValidationRunning && !validationSuccess && validationErrors.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="flex gap-2 items-center text-amber-800">
                            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <span className="font-sans font-semibold">Validation Warn: Some external image assets failed to load!</span>
                          </div>
                          <ul className="list-disc pl-5 space-y-1 text-stone-600 font-mono text-[10px] leading-relaxed">
                            {validationErrors.map((err, i) => (
                              <li key={i}>{err}</li>
                            ))}
                          </ul>
                          <p className="text-[10.5px] text-stone-400 italic pt-1 font-sans leading-relaxed">
                            Note: This check is completely optional and will not block publication. Any failed image will simply be omitted from the reader's folio view, ensuring a seamless experience.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* XML Canonical Schema Export */}
                <div className="border-t border-stone-200/60 pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-stone-500">
                      Semantic XML Export (SPEC-016 / SPEC-017)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const xmlStr = getXmlString();
                        navigator.clipboard.writeText(xmlStr);
                        showToast('XML copied to clipboard', 'success');
                      }}
                      className="text-[10px] text-Adjung-maroon border border-Adjung-maroon/20 hover:bg-Adjung-maroon/5 px-2 py-1 rounded transition font-mono uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                    >
                      <Copy className="w-3 h-3" /> Copy XML
                    </button>
                  </div>
                  <div className="relative">
                    <pre className="p-3 bg-stone-50 border border-stone-200/60 rounded text-[10px] font-mono text-stone-600 overflow-x-auto leading-relaxed max-h-48 whitespace-pre select-all select-text">
                      {getXmlString()}
                    </pre>
                  </div>
                </div>

                {/* Tips block */}
                <div className="border-t border-stone-100 pt-3 flex gap-2 text-[10.5px] text-[#802334] leading-normal bg-stone-50/40 p-2.5 rounded">
                  <Info className="w-3.5 h-3.5 text-Adjung-maroon flex-shrink-0 mt-0.5" />
                  <div>
                    {contentType === 'Note' && (
                      <span><strong>Note writing mode:</strong> Write your text freely. Notes are succinct, rapid reflections. Arabic/Jawi scripts are auto-formatted with dominant-language right-to-left layout alignment.</span>
                    )}
                    {contentType === 'Essay' && (
                      <span><strong>Essay writing mode:</strong> Ideal for long-form literature. Insert footnote markers using <code>[^1]</code>, <code>[^2]</code>, etc. inside paragraphs. Register bottom citations below.</span>
                    )}
                    {contentType === 'Article' && (
                      <span><strong>Article writing mode:</strong> Multi-paragraph publication. Write paragraph blocks with corresponding margin commentary notes that align horizontally on desktop screens.</span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Sticky Bottom/Fixed Footer Actions Bar */}
      {mode === 'edit' && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1e1c18] text-stone-100 border-t border-stone-800 shadow-2xl py-3.5 px-4 md:px-8 backdrop-blur-md bg-opacity-95">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Left section: Info/Metadata */}
            <div className="flex items-center gap-3">
              <div className="flex flex-col text-left">
                <span className="font-mono text-[9px] uppercase tracking-wider text-stone-400">Editing Entry</span>
                <span className="font-serif text-sm font-medium text-stone-200">
                  {contentType === 'Note' ? 'Philosophical Fragment (Note)' : (title || 'Untitled Entry')}
                </span>
              </div>
              <div className="flex items-center gap-1.5 bg-stone-800/85 px-2 py-1 rounded border border-stone-700/60">
                <span className={`w-1.5 h-1.5 rounded-full ${status === 'Published' ? 'bg-emerald-400' : status === 'Archived' ? 'bg-stone-500' : 'bg-amber-400 animate-pulse'}`} />
                <span className="font-mono text-[9px] uppercase tracking-wider text-stone-300">
                  {status} ({visibility.toLowerCase()})
                </span>
              </div>
            </div>

            {/* Right section: Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Save Draft Button */}
              <button
                type="button"
                onClick={() => {
                  const err = validateLimits();
                  if (err) {
                    showToast(err, 'error');
                    return;
                  }
                  setStatus('Draft');
                  forceImmediateSave('Draft', visibility);
                  showToast('Draft saved', 'success');
                }}
                className={`px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded transition-all font-medium border border-transparent cursor-pointer ${
                  status === 'Draft'
                    ? 'bg-stone-800 text-stone-450 border-stone-700/65 cursor-default opacity-85'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                }`}
              >
                Save Draft
              </button>

              {/* Publish Button */}
              <button
                type="button"
                onClick={() => {
                  const err = validateLimits();
                  if (err) {
                    showToast(err, 'error');
                    return;
                  }
                  setStatus('Published');
                  setVisibility('Public');
                  forceImmediateSave('Published', 'Public');
                  showToast('Entry published', 'success');
                }}
                className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-[#802334] text-[#FDFDFD] hover:bg-[#962e41] rounded transition-all font-medium cursor-pointer shadow-sm hover:shadow-md"
              >
                Publish
              </button>

              {/* Update Button */}
              <button
                type="button"
                onClick={() => {
                  const err = validateLimits();
                  if (err) {
                    showToast(err, 'error');
                    return;
                  }
                  forceImmediateSave(status, visibility);
                  showToast('Changes saved', 'success');
                }}
                className="px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-stone-700 hover:bg-stone-600 text-stone-100 rounded transition-all font-medium cursor-pointer"
              >
                Update
              </button>

              {/* Archive Button */}
              <button
                type="button"
                onClick={() => {
                  const err = validateLimits();
                  if (err) {
                    showToast(err, 'error');
                    return;
                  }
                  setStatus('Archived');
                  forceImmediateSave('Archived', visibility);
                  showToast('Changes saved', 'success');
                }}
                className={`px-3.5 py-1.5 text-[10px] font-mono uppercase tracking-wider rounded transition-all font-medium border border-transparent cursor-pointer ${
                  status === 'Archived'
                    ? 'bg-stone-800 text-stone-450 border-stone-700/65 cursor-default opacity-85'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                }`}
              >
                Archive
              </button>

              {/* Delete Button */}
              {onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to delete this canonical entry permanently?')) {
                      onDelete(entry.id);
                    }
                  }}
                  className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-900/40 hover:border-red-700/60 rounded transition-all font-medium cursor-pointer"
                >
                  Delete
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {/* Elegant Editorial Toast Notification */}
      {toast && (
        <div 
          onClick={() => setToastVisible(false)}
          className={`fixed bottom-6 right-6 z-50 transition-all duration-300 transform cursor-pointer select-none max-w-md w-auto ${
            toastVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 pointer-events-none'
          }`}
        >
          <div className={`border shadow-md px-4 py-3 rounded-sm flex items-start gap-2.5 font-serif text-[13px] hover:opacity-95 transition-all text-left ${
            toast.type === 'error' 
              ? 'bg-red-50 border-red-200 text-red-900 shadow-red-100/40' 
              : 'bg-[#FDFDFD] border-stone-200/80 text-stone-700 shadow-sm'
          }`}>
            <span className={`font-semibold text-base leading-none ${toast.type === 'error' ? 'text-red-600' : 'text-[#802334]'}`}>
              {toast.type === 'error' ? '⚠' : '✓'}
            </span>
            <span className="tracking-wide leading-snug">{toast.message}</span>
          </div>
        </div>
      )}
    </div>
  );
}
