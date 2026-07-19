import React, { useRef, useState, useEffect } from 'react';
import { DigitalSignature, VectorStroke } from '../../types';
import { Settings, Trash2, Sliders, Sparkles, Paintbrush, FileText, Info, Type, PenTool } from 'lucide-react';
import { db } from '../../db/mockDb';

interface SignaturePadProps {
  onSave: (data: Partial<DigitalSignature>) => void;
  onCancel?: () => void;
  defaultName?: string;
  existingSignature?: DigitalSignature;
}

type PaperTexture = 'Smooth' | 'Laid' | 'Vintage';
type InkColor = 'Maroon' | 'Charcoal' | 'Midnight' | 'Spruce';

interface ColorOption {
  value: string;
  name: string;
  class: string;
}

const INK_COLORS: Record<InkColor, ColorOption> = {
  Maroon: { value: '#802334', name: 'Adjung Maroon', class: 'bg-[#802334]' },
  Charcoal: { value: '#1c1917', name: 'Charcoal Black', class: 'bg-[#1c1917]' },
  Midnight: { value: '#1e1b4b', name: 'Royal Indigo', class: 'bg-[#1e1b4b]' },
  Spruce: { value: '#064e3b', name: 'Forest Spruce', class: 'bg-[#064e3b]' }
};

const getFontSize = (text: string) => {
  if (!text) return '48px';
  if (text.length > 25) return '24px';
  if (text.length > 18) return '32px';
  if (text.length > 12) return '40px';
  return '48px';
};

const PAPER_STYLES = {
  Smooth: {
    backgroundColor: '#fafaf9',
    backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
    backgroundSize: '24px 24px',
  },
  Laid: {
    backgroundColor: '#fdfbf7',
    backgroundImage: 'linear-gradient(rgba(139, 92, 26, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139, 92, 26, 0.02) 1px, transparent 1px)',
    backgroundSize: '100% 14px, 120px 100%',
  },
  Vintage: {
    backgroundColor: '#f6f1e5',
    backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(212, 163, 115, 0.12) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(188, 108, 37, 0.1) 0%, transparent 40%)',
    backgroundSize: '100% 100%',
    boxShadow: 'inset 0 0 40px rgba(139, 92, 26, 0.08)'
  }
};

export function SignaturePad({ onSave, onCancel, defaultName, existingSignature }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<VectorStroke[][]>(existingSignature?.type === 'drawn' ? existingSignature.strokes || [] : []);
  const [currentStroke, setCurrentStroke] = useState<VectorStroke[]>([]);
  
  // Customization states
  const allowedFonts = [
    'Mrs Saint Delafield',
    'Pinyon Script',
    'Alex Brush',
    'Great Vibes',
    'Parisienne',
    'Allura',
    'Herr Von Muellerhoff'
  ];
  const dynamicFontOptions = allowedFonts.map(f => ({ name: f, value: `${f}, cursive` }));
  const [signatureMode, setSignatureMode] = useState<'draw' | 'type'>(existingSignature?.type || 'draw');
  const [typedText, setTypedText] = useState(existingSignature?.type === 'typed' ? existingSignature.typedText || existingSignature.label : (defaultName || '').slice(0, 15));
  const [selectedFont, setSelectedFont] = useState(existingSignature?.fontFamily ? `${existingSignature.fontFamily}, cursive` : (dynamicFontOptions[0]?.value || 'cursive'));
  const [inkFlowWeight, setInkFlowWeight] = useState<number>(existingSignature?.penStyle?.inkFlowWeight || 7.5);
  const [nibAngle, setNibAngle] = useState<number>(existingSignature?.penStyle?.nibAngle || 45); // 0 (round), 30, 45, 60
  const [paperTexture, setPaperTexture] = useState<PaperTexture>((existingSignature?.penStyle as any)?.paperTexture || 'Laid');
  const [inkColor, setInkColor] = useState<InkColor>((existingSignature?.penStyle as any)?.inkColor || 'Maroon');
  const [smoothingFactor, setSmoothingFactor] = useState<number>(0.22); // alpha parameter
  const [letterSpacing, setLetterSpacing] = useState<number>(existingSignature?.typographyStyle?.letterSpacing || 0);
  const [fontWeight, setFontWeight] = useState<number>(existingSignature?.typographyStyle?.fontWeight || 500);
  const [showSettings, setShowSettings] = useState<boolean>(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShowSettings(window.innerWidth >= 1280);
    }
  }, []);

  const [simulatedPressure, setSimulatedPressure] = useState<number>(2.0); // UI feedback
  const [slantAngle, setSlantAngle] = useState<number>(existingSignature?.typographyStyle?.slantAngle || 0); // Slant angle in degrees (-15 to 15)
  const [scale, setScale] = useState<number>(existingSignature?.typographyStyle?.scale || 1.0); // Size multiplier (0.5 to 2.2)
  const [yOffset, setYOffset] = useState<number>(existingSignature?.typographyStyle?.yOffset || 30); // Vertical position offset from center (aligns with baseline)

  // Physics & Smoothing Refs
  const lastPointRef = useRef<{ x: number, y: number } | null>(null);
  const lastTimeRef = useRef<number>(0);
  const lastVelocityRef = useRef<number>(0);
  const lastWidthRef = useRef<number>(2.0);
  const strokeLengthRef = useRef<number>(0);

  // ResizeObserver to track container dimension changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      setDimensions({ width, height });
    });

    resizeObserver.observe(container);
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  // Update canvas size and scale, and redraw all strokes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dimensions) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = window.devicePixelRatio || 1;
    canvas.width = dimensions.width * scale;
    canvas.height = dimensions.height * scale;
    ctx.scale(scale, scale);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK_COLORS[inkColor].value;
    
    redrawCanvas();
  }, [dimensions, strokes, inkColor]);

  // Re-draw all strokes whenever states change (especially inkColor or visual settings)
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = INK_COLORS[inkColor].value;

    strokes.forEach(stroke => {
      if (stroke.length === 0) return;
      
      // Draw first point as a pooling circle
      const firstPoint = stroke[0];
      ctx.beginPath();
      ctx.arc(firstPoint.x, firstPoint.y, (firstPoint.pressure || 2.0) * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = INK_COLORS[inkColor].value;
      ctx.fill();

      // Draw segments
      for (let i = 1; i < stroke.length; i++) {
        const p1 = stroke[i - 1];
        const p2 = stroke[i];
        
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        
        // Dynamic stroke width based on stored pressure
        ctx.lineWidth = p2.pressure || 2.0;
        ctx.stroke();
      }
    });
  };

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement> | PointerEvent): { x: number, y: number, pressure: number, pointerType: string } => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, pressure: 0.5, pointerType: 'mouse' };
    
    const rect = canvas.getBoundingClientRect();
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure,
      pointerType: e.pointerType
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    
    const coords = getCoordinates(e);
    
    // Physics initialization
    lastPointRef.current = { x: coords.x, y: coords.y };
    lastTimeRef.current = Date.now();
    lastVelocityRef.current = 0;
    
    const baseWidth = (inkFlowWeight / 4.0) * 2.0;
    lastWidthRef.current = baseWidth;
    strokeLengthRef.current = 0;

    // Draw ink pool at start point
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.arc(coords.x, coords.y, baseWidth * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = INK_COLORS[inkColor].value;
      ctx.fill();
    }
    
    setCurrentStroke([{ x: coords.x, y: coords.y, pressure: baseWidth }]);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPointRef.current) return;
    
    const coords = getCoordinates(e);
    const now = Date.now();
    const timeDelta = Math.max(1, now - lastTimeRef.current);
    
    // 1. Calculate Velocity & Direction
    const dx = coords.x - lastPointRef.current.x;
    const dy = coords.y - lastPointRef.current.y;
    const distance = Math.hypot(dx, dy);
    
    // Skip tiny sub-pixel tremors to stabilize lines
    if (distance < 0.5) return;
    
    const velocity = distance / timeDelta;
    strokeLengthRef.current += distance;
    
    // 2. Ink Flow Weight Multiplier
    const weightMultiplier = inkFlowWeight / 4.0;
    const velocityImpact = Math.max(
      0.35 * weightMultiplier, 
      Math.min(2.5 * weightMultiplier, (1.8 - (velocity * 0.54)) * weightMultiplier)
    );
    
    // 3. Stylus Pressure vs Mouse/Touch Physics
    let targetPressure = velocityImpact;
    if (coords.pointerType === 'pen' && coords.pressure > 0) {
      // Native stylus pressure integrated with velocity physics
      targetPressure = (velocityImpact * 0.4) + (coords.pressure * 2.0 * weightMultiplier);
    }
    
    // 4. Fountain Pen Nib Angle Impact (Chisel Nib Physics)
    if (nibAngle > 0) {
      const theta = Math.atan2(dy, dx);
      const angleRad = (nibAngle * Math.PI) / 180;
      const delta = theta - angleRad;
      // Perpendicular to nib angle is thickest, parallel is thinnest
      const nibMultiplier = 0.35 + 0.65 * Math.abs(Math.sin(delta));
      targetPressure = targetPressure * nibMultiplier;
    }

    // 5. Ink Depletion (fade slightly on extremely long continuous strokes)
    if (strokeLengthRef.current > 1500) {
      const depletion = Math.max(0.2, 1.0 - (strokeLengthRef.current - 1500) / 1000);
      targetPressure = targetPressure * depletion;
    }
    
    // 6. Double Exponential Smoothing (alpha parameter)
    const alpha = smoothingFactor;
    const smoothedPressure = lastWidthRef.current * (1 - alpha) + targetPressure * alpha;
    
    // Update live feedback state for UI dashboard
    setSimulatedPressure(smoothedPressure);

    // Draw the segment on canvas
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.strokeStyle = INK_COLORS[inkColor].value;
    ctx.lineWidth = smoothedPressure;
    ctx.stroke();
    
    // Store point
    const newPoint: VectorStroke = { 
      x: coords.x, 
      y: coords.y, 
      pressure: Number(smoothedPressure.toFixed(2)) 
    };
    setCurrentStroke(prev => [...prev, newPoint]);
    
    // Update refs
    lastPointRef.current = { x: coords.x, y: coords.y };
    lastTimeRef.current = now;
    lastVelocityRef.current = velocity;
    lastWidthRef.current = smoothedPressure;
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    
    try {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.releasePointerCapture(e.pointerId);
      }
    } catch (err) {
      // Ignore if pointerId is invalid
    }
    
    if (currentStroke.length > 0) {
      setStrokes(prev => [...prev, currentStroke]);
    }
    setCurrentStroke([]);
    lastPointRef.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setStrokes([]);
    setCurrentStroke([]);
  };

  const handlePresetSelect = (preset: 'fountain' | 'calligraphy' | 'gel') => {
    if (preset === 'fountain') {
      setNibAngle(45);
      setInkFlowWeight(4.5);
      setPaperTexture('Laid');
      setSmoothingFactor(0.22);
    } else if (preset === 'calligraphy') {
      setNibAngle(60);
      setInkFlowWeight(5.5);
      setPaperTexture('Vintage');
      setSmoothingFactor(0.18);
    } else {
      setNibAngle(45); // Gel Pen now defaults to 45 degrees
      setInkFlowWeight(7.5); // Gel Pen now defaults to 7.5x
      setPaperTexture('Smooth');
      setSmoothingFactor(0.3);
    }
  };

  const currentPaperStyle = PAPER_STYLES[paperTexture];

  const handleSaveSignature = () => {
    const containerHeight = containerRef.current?.clientHeight || 200;
    const baselineY = containerHeight - 64; // bottom-16 is 64px

    if (signatureMode === 'draw') {
      onSave({ 
        strokes, 
        type: 'drawn', 
        typographyStyle: { slantAngle, scale },
        penStyle: {
          nibAngle,
          inkFlowWeight,
          inkColor,
          paperTexture,
          baselineY,
          canvasHeight: containerHeight
        }
      });
    } else {
      onSave({ 
        strokes: [], 
        type: 'typed', 
        typedText, 
        fontFamily: selectedFont, 
        typographyStyle: { letterSpacing, fontWeight, slantAngle, scale, yOffset },
        penStyle: {
          baselineY: baselineY - yOffset,
          canvasHeight: containerHeight
        }
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 md:p-8 bg-stone-950/80 backdrop-blur-sm">
      <div className="flex flex-col xl:flex-row gap-4 xl:gap-6 bg-stone-900 border-0 sm:border border-stone-800 rounded-none sm:rounded-lg p-4 sm:p-5 shadow-2xl text-stone-200 w-full max-w-4xl h-full sm:h-auto xl:h-[480px] max-h-screen sm:max-h-[95vh] overflow-y-auto xl:overflow-hidden">
      
      {/* Settings Panel */}
      {showSettings && (
        <div className="w-full xl:w-72 flex flex-col gap-3 border-b xl:border-b-0 xl:border-r border-stone-850 pb-3 xl:pb-0 xl:pr-4 select-none overflow-y-auto max-h-[200px] xl:max-h-full scrollbar-none shrink-0">
          <div className="flex items-center justify-between border-b border-stone-850/50 pb-1.5">
            <h3 className="font-mono text-[9px] uppercase tracking-widest text-Adjung-maroon font-bold flex items-center gap-1">
              <Sliders className="w-3 h-3" /> Studio Controls
            </h3>
            <span className="font-mono text-[7px] uppercase bg-stone-850 px-1 py-0.5 rounded text-stone-400">
              {signatureMode === 'draw' ? 'Physics' : 'Typography'}
            </span>
          </div>

          {signatureMode === 'draw' ? (
            <div className="space-y-3">
              {/* Presets */}
              <div className="space-y-1">
                <span className="block font-mono text-[7px] uppercase tracking-wider text-stone-500">Preset Nib</span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('fountain')}
                    className={`py-0.5 text-[8px] font-mono rounded uppercase tracking-wider border transition ${
                      nibAngle === 45 && inkFlowWeight === 4.5
                        ? 'border-Adjung-maroon bg-Adjung-maroon/10 text-white' 
                        : 'border-stone-850 hover:bg-stone-850 text-stone-400'
                    }`}
                  >
                    Fountain
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('calligraphy')}
                    className={`py-0.5 text-[8px] font-mono rounded uppercase tracking-wider border transition ${
                      nibAngle === 60 && inkFlowWeight === 5.5
                        ? 'border-Adjung-maroon bg-Adjung-maroon/10 text-white' 
                        : 'border-stone-850 hover:bg-stone-850 text-stone-400'
                    }`}
                  >
                    Chisel
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePresetSelect('gel')}
                    className={`py-0.5 text-[8px] font-mono rounded uppercase tracking-wider border transition ${
                      nibAngle === 45 && inkFlowWeight === 7.5
                        ? 'border-Adjung-maroon bg-Adjung-maroon/10 text-white' 
                        : 'border-stone-850 hover:bg-stone-850 text-stone-400'
                    }`}
                  >
                    Gel Pen
                  </button>
                </div>
              </div>

              {/* Compact 2-column Slider Grid */}
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
                {/* Ink Flow */}
                <div className="space-y-0.5 col-span-1">
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-wider text-stone-400">
                    <span>Ink Flow</span>
                    <span className="text-Adjung-maroon font-bold">{inkFlowWeight.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={inkFlowWeight}
                    onChange={(e) => setInkFlowWeight(parseFloat(e.target.value))}
                    className="adjung-range"
                  />
                </div>

                {/* Smoothing */}
                <div className="space-y-0.5 col-span-1">
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-wider text-stone-400">
                    <span>Smooth</span>
                    <span className="text-Adjung-maroon font-bold">{Math.round((1 - smoothingFactor) * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.6"
                    step="0.01"
                    value={smoothingFactor}
                    onChange={(e) => setSmoothingFactor(parseFloat(e.target.value))}
                    className="adjung-range"
                  />
                </div>

                {/* Nib Angle */}
                <div className="space-y-0.5 col-span-1">
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-wider text-stone-400">
                    <span>Nib Angle</span>
                    <span className="text-Adjung-maroon font-bold">{nibAngle === 0 ? 'Round' : `${nibAngle}°`}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="90"
                    step="15"
                    value={nibAngle}
                    onChange={(e) => setNibAngle(parseInt(e.target.value))}
                    className="adjung-range"
                  />
                </div>

                {/* Slant */}
                <div className="space-y-0.5 col-span-1">
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-wider text-stone-400">
                    <span>Slant</span>
                    <span className="text-Adjung-maroon font-bold">{slantAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="1"
                    value={slantAngle}
                    onChange={(e) => setSlantAngle(parseInt(e.target.value))}
                    className="adjung-range"
                  />
                </div>

                {/* Size Scale */}
                <div className="space-y-0.5 col-span-2">
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-wider text-stone-400">
                    <span>Size Scale</span>
                    <span className="text-Adjung-maroon font-bold">{Math.round(scale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.2"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="adjung-range"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Select Font Style */}
              <div className="space-y-0.5">
                <label className="block font-mono text-[7px] uppercase tracking-wider text-stone-500">Font Family</label>
                <select
                  value={selectedFont}
                  onChange={(e) => setSelectedFont(e.target.value)}
                  className="w-full bg-stone-950 border border-stone-850 p-1 rounded text-stone-300 text-[10px] font-mono focus:outline-none focus:border-Adjung-maroon cursor-pointer"
                >
                  {allowedFonts.map((font) => (
                    <option key={font} value={`${font}, cursive`}>
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              {/* Typography Sliders in Grid */}
              <div className="grid grid-cols-2 gap-x-2.5 gap-y-2">
                {/* Font Weight */}
                <div className="space-y-0.5 col-span-2">
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-wider text-stone-400">
                    <span>Weight</span>
                    <span className="text-Adjung-maroon font-bold">{fontWeight}</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="900"
                    step="100"
                    value={fontWeight}
                    onChange={(e) => setFontWeight(parseInt(e.target.value))}
                    className="adjung-range"
                  />
                </div>

                {/* Letter Spacing */}
                <div className="space-y-0.5 col-span-1">
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-wider text-stone-400">
                    <span>Tracking</span>
                    <span className="text-Adjung-maroon font-bold">{letterSpacing}px</span>
                  </div>
                  <input
                    type="range"
                    min="-5"
                    max="15"
                    step="0.5"
                    value={letterSpacing}
                    onChange={(e) => setLetterSpacing(parseFloat(e.target.value))}
                    className="adjung-range"
                  />
                </div>

                {/* Slant Angle */}
                <div className="space-y-0.5 col-span-1">
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-wider text-stone-400">
                    <span>Slant</span>
                    <span className="text-Adjung-maroon font-bold">{slantAngle}°</span>
                  </div>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="1"
                    value={slantAngle}
                    onChange={(e) => setSlantAngle(parseInt(e.target.value))}
                    className="adjung-range"
                  />
                </div>

                {/* Size Scale */}
                <div className="space-y-0.5 col-span-2">
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-wider text-stone-400">
                    <span>Size Scale</span>
                    <span className="text-Adjung-maroon font-bold">{Math.round(scale * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.2"
                    step="0.05"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="adjung-range"
                  />
                </div>

                {/* Vertical Position Offset */}
                <div className="space-y-0.5 col-span-2">
                  <div className="flex justify-between font-mono text-[7px] uppercase tracking-wider text-stone-400">
                    <span>Vertical Position</span>
                    <span className="text-Adjung-maroon font-bold">{yOffset > 0 ? `+${yOffset}` : yOffset}px</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="75"
                    step="1"
                    value={yOffset}
                    onChange={(e) => setYOffset(parseInt(e.target.value))}
                    className="adjung-range"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Paper Texture Selector */}
          <div className="space-y-1 border-t border-stone-850/30 pt-2">
            <span className="block font-mono text-[7px] uppercase tracking-wider text-stone-500">Paper Texture</span>
            <div className="grid grid-cols-3 gap-1">
              {(['Smooth', 'Laid', 'Vintage'] as PaperTexture[]).map((tex) => (
                <button
                  key={tex}
                  type="button"
                  onClick={() => setPaperTexture(tex)}
                  className={`py-0.5 text-[8px] font-mono rounded uppercase tracking-wider border transition ${
                    paperTexture === tex 
                      ? 'border-Adjung-maroon bg-Adjung-maroon/10 text-white' 
                      : 'border-stone-850 hover:bg-stone-850 text-stone-400'
                  }`}
                >
                  {tex}
                </button>
              ))}
            </div>
          </div>

          {/* Mini Telemetry (At Bottom) */}
          <div className="mt-auto border-t border-stone-850/40 pt-1.5 bg-stone-950/20 p-1.5 rounded border border-stone-850 flex flex-col gap-0.5 text-[7px] font-mono text-stone-500">
            <div className="flex justify-between items-center text-[7px] text-stone-400 uppercase tracking-wider font-bold mb-0.5">
              <span>Status</span>
              <span className="h-1 w-1 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            </div>
            {signatureMode === 'draw' ? (
              <>
                <div className="flex justify-between">
                  <span>Stroke Width:</span>
                  <span className="text-stone-400">{simulatedPressure.toFixed(2)}px</span>
                </div>
                <div className="flex justify-between">
                  <span>Points:</span>
                  <span className="text-stone-400">
                    {strokes.reduce((acc, stroke) => acc + stroke.length, 0)}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between">
                  <span>Font:</span>
                  <span className="text-stone-400 truncate max-w-[120px]" title={selectedFont}>{selectedFont.split(',')[0]}</span>
                </div>
                <div className="flex justify-between">
                  <span>Length:</span>
                  <span className="text-stone-400">{typedText.length} chars</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 min-w-0 flex flex-col gap-4 xl:h-full">
        
        {/* Mode Toggle & Inline Typography Input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
          {/* Mode Toggle */}
          <div className="flex bg-stone-950/30 p-1 rounded border border-stone-850 w-fit shrink-0">
            <button 
              type="button"
              onClick={() => setSignatureMode('draw')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition ${
                signatureMode === 'draw' ? 'bg-stone-800 text-stone-200' : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" /> Draw
            </button>
            <button 
              type="button"
              onClick={() => setSignatureMode('type')}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition ${
                signatureMode === 'type' ? 'bg-stone-800 text-stone-200' : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              <Type className="w-3.5 h-3.5" /> Type
            </button>
          </div>

          {/* Quick Input for Typography Mode */}
          {signatureMode === 'type' && (
            <div className="flex-1 max-w-md flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={typedText}
                  maxLength={15}
                  onChange={(e) => {
                    const rawVal = e.target.value;
                    // Restrict to letters and spaces only (no numbers/symbols)
                    const filtered = rawVal.replace(/[^A-Za-z ]/g, '').slice(0, 15);
                    setTypedText(filtered);
                  }}
                  placeholder="Type your signature here..."
                  className="w-full bg-stone-950/40 border border-stone-850 p-1.5 px-3 rounded text-stone-200 text-xs focus:outline-none focus:border-Adjung-maroon font-serif"
                />
                <span className="font-mono text-[9px] text-stone-500 shrink-0 select-none bg-stone-950/20 px-1.5 py-1 rounded border border-stone-850">
                  {typedText.length}/15
                </span>
              </div>
              <span className="font-mono text-[8px] text-stone-500 italic">
                A-Z, a-z & spaces only (max. 15 characters)
              </span>
            </div>
          )}
        </div>

        {/* Canvas Toolbar Header */}
        <div className="flex justify-between items-center bg-stone-950/30 p-2 rounded border border-stone-850">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className={`p-1 rounded transition ${showSettings ? 'text-Adjung-maroon bg-Adjung-maroon/10' : 'text-stone-400 hover:text-stone-250'}`}
              title="Toggle settings panel"
            >
              <Settings className="w-4 h-4" />
            </button>
            <div className="text-[10px] font-mono tracking-widest uppercase text-stone-400 flex items-center gap-1.5">
              {signatureMode === 'draw' ? (
                <>
                  <Paintbrush className="w-3.5 h-3.5" /> Calligraphy Studio
                </>
              ) : (
                <>
                  <Type className="w-3.5 h-3.5 text-Adjung-maroon" /> Typography Studio
                </>
              )}
            </div>
          </div>
          
          {signatureMode === 'draw' && (
            <button 
              type="button"
              onClick={clearCanvas}
              className="flex items-center gap-1 px-2 py-1 text-[9px] font-mono text-stone-400 hover:text-red-400 uppercase tracking-wider transition bg-stone-900 border border-stone-800 rounded"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Paper Canvas & Preview Pad (Unified Container) */}
        <div 
          ref={containerRef}
          style={currentPaperStyle}
          className="relative flex-1 min-h-[160px] xs:min-h-[180px] sm:min-h-[200px] md:min-h-[220px] border border-stone-800 rounded-lg overflow-hidden transition-all duration-300 shadow-inner flex items-center justify-center cursor-crosshair select-none"
        >
          {/* Subtle Top Watermark Label */}
          <div className="absolute top-3 left-4 pointer-events-none select-none z-10">
            <span className="font-mono text-[8px] tracking-widest text-stone-400/30 uppercase">
              Adjung Signature Pad
            </span>
          </div>

          {signatureMode === 'draw' ? (
            <>
              <canvas
                ref={canvasRef}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                onPointerLeave={stopDrawing}
                className="w-full h-full touch-none absolute inset-0 z-0"
                style={{ transform: `rotate(${slantAngle}deg) scale(${scale})`, transformOrigin: 'center center' }}
              />
              
              {/* Elegant baseline guideline */}
              <div className="absolute left-6 right-6 bottom-16 border-b border-dashed border-stone-500/80 pointer-events-none flex justify-between items-end select-none">
                <span className="font-mono text-[8px] tracking-widest text-stone-600/80 uppercase pb-1">Signature baseline</span>
                <span className="font-serif text-[11px] italic text-stone-500/70 pb-0.5">Adjung studio</span>
              </div>

              {strokes.length === 0 && (
                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center opacity-20 transition-all select-none z-10">
                  <span className="font-serif text-3xl italic tracking-wide text-stone-600">Sign Here</span>
                  <span className="font-mono text-[8px] uppercase tracking-widest text-stone-500 mt-2">
                    Supports pressure & stylus velocity
                  </span>
                </div>
              )}
            </>
          ) : (
            <>
              <span 
                style={{ 
                  fontFamily: selectedFont, 
                  fontSize: getFontSize(typedText), 
                  color: INK_COLORS[inkColor].value, 
                  letterSpacing: `${letterSpacing}px`, 
                  fontWeight, 
                  textAlign: 'center',
                  transform: `translateY(${yOffset}px) rotate(${slantAngle}deg) scale(${scale})`,
                  transformOrigin: 'center center',
                  whiteSpace: 'nowrap'
                }}
                className={`transition-all text-center block max-w-full px-6 z-10 ${!typedText ? 'opacity-30' : ''}`}
              >
                {typedText || 'Sign Here'}
              </span>
              
              {/* Elegant baseline guideline (matches Draw mode) */}
              <div className="absolute left-6 right-6 bottom-16 border-b border-dashed border-stone-500/80 pointer-events-none flex justify-between items-end select-none">
                <span className="font-mono text-[8px] tracking-widest text-stone-600/80 uppercase pb-1">Signature baseline</span>
                <span className="font-serif text-[11px] italic text-stone-500/70 pb-0.5">Adjung studio</span>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex justify-between items-center mt-1">
          <div className="flex items-center gap-1.5 text-stone-500 text-[10px] font-mono">
            <Info className="w-3.5 h-3.5 text-stone-500" />
            <span>Draw slowly for thicker ink flow</span>
          </div>
          
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-stone-800 text-stone-400 rounded text-xs font-mono uppercase tracking-wider hover:bg-stone-850 hover:text-stone-200 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveSignature}
              disabled={signatureMode === 'draw' ? strokes.length === 0 : typedText.length === 0}
              className="px-4 py-2 bg-Adjung-maroon text-[#FDFDFD] rounded text-xs font-mono uppercase tracking-wider hover:bg-opacity-95 transition disabled:opacity-30 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
            >
              Save Signature
            </button>
          </div>
        </div>

      </div>
    </div>
    </div>
  );
}
