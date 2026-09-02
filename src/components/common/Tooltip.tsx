import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  // ReactNode (bukan string sahaja) — beberapa pemanggil (cth IndeksConsole.tsx) menghantar
  // kandungan editorial yang sudah dihurai (safeParseInline()) supaya *condong*/istilah gloss
  // terpapar betul dalam gelembung ni juga, bukan asterisk mentah.
  text: React.ReactNode;
  children: React.ReactElement<any>;
  placement?: 'top' | 'bottom';
}

const TRIGGER_ATTR = 'data-tooltip-trigger';

// Adjung's single tooltip implementation. Replaces the native `title=` attribute, which the
// browser renders as OS chrome (opaque box, square corners, black border) that CSS cannot touch
// — no border-radius, opacity, blur, or color is possible on it. This portals a fully-styled
// bubble to document.body instead, positioned from the trigger's live bounding rect.
//
// Clones the trigger element directly (no wrapper span/div) rather than wrapping it — several
// call sites are <tr>/<td> where an extra wrapper element would break table structure. A
// Fragment return keeps the trigger as a direct child of its real parent (tbody/tr).
//
// Nesting (e.g. a per-city weather Tooltip inside WorldClockStrip's own container Tooltip): each
// trigger is marked with data-tooltip-trigger so an outer Tooltip can tell, via e.target.closest,
// whether the actually-hovered element belongs to a MORE NESTED trigger than itself — if so it
// defers instead of showing, so only the innermost tooltip under the cursor is ever visible (same
// as native title= only ever showing one tooltip at a time). Uses onMouseOver/Out (bubbling, unlike
// onMouseEnter/Leave) so an inner trigger's own handling only needs to stop there.
export const Tooltip: React.FC<TooltipProps> = ({ text, children, placement = 'top' }) => {
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLElement | null>(null);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

  const show = () => setVisible(true);
  const hide = () => setVisible(false);

  useLayoutEffect(() => {
    if (!visible || !triggerRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const bubbleRect = bubbleRef.current?.getBoundingClientRect();
    const bubbleWidth = bubbleRect?.width || 0;
    const bubbleHeight = bubbleRect?.height || 0;
    const margin = 8;

    let left = triggerRect.left + triggerRect.width / 2 - bubbleWidth / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - bubbleWidth - margin));

    let top = placement === 'top'
      ? triggerRect.top - bubbleHeight - margin
      : triggerRect.bottom + margin;
    if (placement === 'top' && top < margin) top = triggerRect.bottom + margin; // flip if it'd go off the top

    setStyle({ top, left });
  }, [visible, placement, text]);

  const existingRef = (children as any).ref;
  const child = React.cloneElement(children, {
    [TRIGGER_ATTR]: true,
    ref: (node: HTMLElement) => {
      triggerRef.current = node;
      if (typeof existingRef === 'function') existingRef(node);
      else if (existingRef) existingRef.current = node;
    },
    onMouseOver: (e: React.MouseEvent) => {
      children.props.onMouseOver?.(e);
      const target = e.target as HTMLElement;
      const nearestTrigger = target.closest(`[${TRIGGER_ATTR}]`);
      if (nearestTrigger && nearestTrigger !== triggerRef.current) return; // a more nested trigger owns this hover
      show();
    },
    onMouseOut: (e: React.MouseEvent) => {
      children.props.onMouseOut?.(e);
      const related = e.relatedTarget as Node | null;
      if (related && triggerRef.current?.contains(related)) return; // moved to a still-inside descendant
      hide();
    },
    onFocus: (e: React.FocusEvent) => { children.props.onFocus?.(e); show(); },
    onBlur: (e: React.FocusEvent) => { children.props.onBlur?.(e); hide(); },
  });

  return (
    <>
      {child}
      {visible && text && createPortal(
        <div
          ref={bubbleRef}
          className="fixed z-[9999] px-3 py-1.5 rounded-lg bg-[#FDFDFD]/70 backdrop-blur-md text-black text-[10px] font-sans leading-snug max-w-xs text-center pointer-events-none shadow-lg"
          style={style}
        >
          {text}
        </div>,
        document.body
      )}
    </>
  );
};
