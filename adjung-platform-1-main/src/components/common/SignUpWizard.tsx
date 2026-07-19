import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, QrCode, Laptop, Smartphone, Check, RefreshCw, PenTool, Type, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { SignaturePad } from '../desk/SignaturePad';

// The steps of the wizard
const TOTAL_STEPS = 9;
const TITLES = [
  '',
  'Welcome',
  'The Philosophy',
  'Term of Use',
  'Your Identity',
  'Verification',
  'About You',
  'Your Personal Site',
  'Your Signature',
  'Welcome to Adjung'
];

interface SignUpWizardProps {
  onClose: () => void;
  onComplete: (data: any) => void;
}

export default function SignUpWizard({ onClose, onComplete }: SignUpWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [overlayTitle, setOverlayTitle] = useState('');
  const [showOverlay, setShowOverlay] = useState(false);
  const [overlayCount, setOverlayCount] = useState(1);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Form Data State
  const [formData, setFormData] = useState({
    displayName: '',
    penName: '',
    username: '',
    email: '',
    biography: '',
    domain: '',
    signatureType: 'draw',
    signatureData: ''
  });

  const goNext = (step: number) => {
    if (step < 1 || step > TOTAL_STEPS || isTransitioning) return;
    setIsTransitioning(true);
    
    // Trigger Overlay
    setOverlayTitle(TITLES[step]);
    setOverlayCount(1);
    setShowOverlay(true);
    
    setTimeout(() => {
      setOverlayCount(2);
    }, 800);
    
    setTimeout(() => {
      setOverlayCount(3);
    }, 1400);

    setTimeout(() => {
      setCurrentStep(step);
      setShowOverlay(false);
      setIsTransitioning(false);
    }, 2000);
  };

  const goBack = () => {
    if (currentStep > 1 && !isTransitioning) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    onComplete(formData);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-stone-900/60 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto select-none">
      
      {/* Centered Editorial Floating Folio */}
      <motion.div 
        initial={{ opacity: 0, y: 15, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 15, scale: 0.98 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="bg-[#FFFFFF] border border-stone-200 shadow-2xl max-w-xl w-full h-[620px] max-h-[95vh] overflow-hidden scholarly-border flex flex-col relative my-4 text-stone-900 font-sans"
      >
        
        {/* Overlay Transition inside the Card */}
        <AnimatePresence>
          {showOverlay && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="absolute inset-0 z-50 bg-adjung-maroon flex items-center justify-center flex-col text-center p-8 select-none"
            >
              <div className="space-y-4 max-w-md">
                <span className="block font-mono text-[9px] uppercase tracking-[0.35em] text-[#FDFBF7]/60 font-semibold">
                  SECTION {currentStep + 1} OF 09
                </span>
                <motion.h2 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                  className="font-serif text-3xl md:text-4xl text-[#FDFBF7] font-light flex items-start justify-center"
                >
                  {overlayTitle}
                </motion.h2>
                <div className="h-px w-16 bg-white/20 mx-auto my-3" />
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${overlayCount >= 1 ? 'bg-[#FDFBF7] scale-125' : 'bg-[#FDFBF7]/30'}`} />
                  <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${overlayCount >= 2 ? 'bg-[#FDFBF7] scale-125' : 'bg-[#FDFBF7]/30'}`} />
                  <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${overlayCount >= 3 ? 'bg-[#FDFBF7] scale-125' : 'bg-[#FDFBF7]/30'}`} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Elegant Close Button */}
        {currentStep < 9 && !showOverlay && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-5 right-5 text-stone-400 hover:text-adjung-maroon transition-all duration-300 z-40 p-1 cursor-pointer group"
            aria-label="Cancel registration"
          >
            <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Elegant Publication Header with Progress Bar */}
        {currentStep < 9 && (
          <div className="border-b border-stone-200/60 p-5 bg-[#FFFFFF] flex justify-between items-center select-none relative">
            <div className="flex items-center gap-3">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={goBack}
                  className="mr-1 text-stone-400 hover:text-adjung-maroon transition-colors duration-300 flex items-center justify-center p-1 cursor-pointer group"
                  aria-label="Go back"
                >
                  <ChevronLeft size={18} strokeWidth={2.5} className="group-hover:-translate-x-0.5 transition-transform" />
                </button>
              )}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-adjung-maroon font-bold">
                  {String(currentStep).padStart(2, '0')} / 09
                </span>
                <span className="text-stone-300 font-light font-sans text-xs">|</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-stone-500 font-medium">
                  {TITLES[currentStep] || 'Registration'}
                </span>
              </div>
            </div>
            {/* Smooth Progress line */}
            <div className="w-24 h-[1.5px] bg-stone-200/50 rounded-full overflow-hidden relative mr-8">
              <div 
                className="h-full bg-adjung-maroon transition-all duration-500 ease-out"
                style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full flex items-center justify-center p-6 md:p-10 overflow-y-auto relative">
          <AnimatePresence mode="wait">
            {currentStep === 1 && <Step1Welcome key="s1" onNext={() => goNext(2)} />}
            {currentStep === 2 && <Step2Philosophy key="s2" onNext={() => goNext(3)} />}
            {currentStep === 3 && <Step3Charter key="s3" onNext={() => goNext(4)} />}
            {currentStep === 4 && <Step4Identity key="s4" formData={formData} setFormData={setFormData} onNext={() => goNext(5)} />}
            {currentStep === 5 && <Step5Verification key="s5v" formData={formData} onNext={() => goNext(6)} goBack={goBack} />}
            {currentStep === 6 && <Step6Biography key="s6" formData={formData} setFormData={setFormData} onNext={() => goNext(7)} />}
            {currentStep === 7 && <Step7PersonalSite key="s7" formData={formData} setFormData={setFormData} onNext={() => goNext(8)} />}
            {currentStep === 8 && <Step8Signature key="s8" formData={formData} setFormData={setFormData} onNext={() => goNext(9)} />}
            {currentStep === 9 && <Step9Complete key="s9" onComplete={handleComplete} />}
          </AnimatePresence>
        </main>

        {/* Elegant Pagination Indicators (Dots Rail at the very bottom edge) */}
        {currentStep < 9 && (
          <div className="border-t border-stone-200/40 py-3.5 bg-[#FFFFFF] flex justify-center items-center gap-2 select-none">
            {Array.from({ length: 9 }).map((_, i) => (
              <div 
                key={i}
                className={`transition-all duration-300 rounded-full ${
                  currentStep === i + 1 
                    ? 'w-4 h-1 bg-adjung-maroon' 
                    : 'w-1 h-1 bg-stone-300'
                }`}
              />
            ))}
          </div>
        )}

      </motion.div>
    </div>
  );
}

// --- Step Components ---

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.3 } }
};

function Step1Welcome({ onNext }: { onNext: () => void, key?: string }) {
  return (
    <motion.section variants={pageVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center text-center w-full h-full justify-between select-none">
      <div className="flex flex-col items-center justify-center flex-1 py-4">
        <h1 className="font-serif text-3xl md:text-4xl font-normal text-[#111111] mb-4 tracking-tight leading-tight">Welcome to Adjung</h1>
        <p className="text-stone-500 text-base max-w-sm leading-relaxed font-serif italic">A place where knowledge is written to endure.</p>
      </div>
      
      <button 
        onClick={onNext} 
        className="px-10 py-3 bg-adjung-maroon hover:bg-stone-900 text-[#FDFDFD] font-mono text-xs tracking-widest uppercase transition-all duration-300 rounded-sm shadow-sm font-bold cursor-pointer"
      >
        Start Now
      </button>
    </motion.section>
  );
}

function Step2Philosophy({ onNext }: { onNext: () => void, key?: string }) {
  return (
    <motion.section variants={pageVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center w-full h-full justify-between py-1">
      <div className="text-center w-full">
        <h2 className="font-serif text-2xl md:text-3xl font-normal text-stone-900 mb-4 tracking-tight">The Philosophy</h2>
      </div>
      <div className="space-y-4 text-stone-600 leading-relaxed mb-6 font-serif text-[14.5px] max-w-md border-l-2 border-adjung-maroon/20 pl-6 flex-1 flex flex-col justify-center">
        <p>Adjung values knowledge over popularity. Every work published here is meant to endure beyond the moment of its creation.</p>
        <p>We honour human authorship. Every word carries the weight of its author's intellectual commitment.</p>
        <p>Editorial integrity is paramount. We do not optimise for engagement—we optimise for truth and clarity.</p>
        <p>Long-term preservation is our promise. What you write here becomes part of an enduring record.</p>
        <p>Respectful discourse is expected. Adjung is a place for serious intellectual exchange.</p>
      </div>
      <button 
        onClick={onNext} 
        className="px-10 py-3 bg-adjung-maroon hover:bg-stone-900 text-[#FDFDFD] font-mono text-xs tracking-widest uppercase transition-all duration-300 rounded-sm shadow-sm font-bold cursor-pointer"
      >
        Continue
      </button>
    </motion.section>
  );
}

function Step3Charter({ onNext }: { onNext: () => void, key?: string }) {
  const [agreed, setAgreed] = useState(false);
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    if (containerRef.current && !scrolledToBottom) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      if (scrollHeight - scrollTop - clientHeight < 25) {
        setScrolledToBottom(true);
      }
    }
  };

  useEffect(() => {
    // Fail-safe: if container has no scrollbar (e.g. large height or container small text), auto-enable
    if (containerRef.current) {
      const { scrollHeight, clientHeight } = containerRef.current;
      if (scrollHeight <= clientHeight) {
        setScrolledToBottom(true);
      }
    }
  }, []);

  return (
    <motion.section variants={pageVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center w-full px-2 h-full justify-between">
      <div className="text-center w-full">
        <h2 className="font-serif text-2xl md:text-3xl font-normal text-stone-900 mb-1 tracking-tight">Term of Use</h2>
        <p className="font-mono text-[9px] uppercase tracking-widest text-stone-400 mb-4">≈ 5–7 minutes reading time</p>
      </div>

      {/* Document container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="w-full max-w-md border border-stone-200/80 bg-stone-50/50 p-6 md:p-8 flex flex-col overflow-y-auto rounded-sm maroon-scrollbar" 
        style={{ maxHeight: '200px' }}
      >
        <div className="text-stone-600 font-serif leading-relaxed text-sm text-justify space-y-4">
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">1. Introduction</h3>
            <p className="mb-2 font-normal">Welcome to Adjung.</p>
            <p className="mb-2 font-normal">Adjung is an editorial publishing platform dedicated to the creation, preservation, and dissemination of knowledge. By creating an account or accessing any part of the platform, you agree to comply with these Terms of Use.</p>
            <p className="font-normal">These Terms govern your use of Adjung and all related services.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">2. Eligibility</h3>
            <p className="mb-2 font-normal">You must be legally capable of entering into a binding agreement under the laws applicable in your jurisdiction.</p>
            <p className="font-normal">If you register on behalf of an organization, you confirm that you are authorized to do so.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">3. Membership</h3>
            <p className="mb-2 font-normal">Creating an account establishes your membership in Adjung.</p>
            <p className="mb-2 font-normal">Membership grants access to features according to your account privileges and participation within the platform.</p>
            <p className="font-normal">Certain privileges, including eligibility for a Personal Site, may require additional participation requirements determined by Adjung.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">4. User Identity</h3>
            <p className="mb-2 font-normal">Members are responsible for maintaining accurate account information.</p>
            <p className="mb-2 font-normal">You may publish under a Pen Name.</p>
            <p className="font-normal">However, Adjung reserves the right to request identity verification where necessary to protect platform integrity.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">5. Intellectual Property</h3>
            <p className="mb-2 font-normal">You retain ownership of the works you publish.</p>
            <p className="mb-2 font-normal">By publishing content on Adjung, you grant Adjung a non-exclusive licence to display, archive, index, preserve, and distribute your published works within the platform.</p>
            <p className="font-normal">Adjung does not claim ownership of your intellectual property.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">6. Publication Standards</h3>
            <p className="mb-2 font-normal">Members agree that published content should:</p>
            <ul className="list-disc pl-5 mb-2 font-normal space-y-1">
              <li>be original or properly attributed;</li>
              <li>respect copyright;</li>
              <li>avoid plagiarism;</li>
              <li>avoid impersonation;</li>
              <li>avoid fraudulent or misleading information;</li>
              <li>comply with applicable laws.</li>
            </ul>
            <p className="font-normal">Adjung may remove or restrict content that violates these standards.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">7. Artificial Intelligence</h3>
            <p className="mb-2 font-normal">Members may use artificial intelligence tools during the creation of their works.</p>
            <p className="mb-2 font-normal">Where required by Adjung policies, AI-assisted content should be appropriately disclosed.</p>
            <p className="font-normal">Members remain fully responsible for everything published under their names.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">8. Personal Site</h3>
            <p className="mb-2 font-normal">Eligible members may establish a Personal Site under an Adjung subdomain.</p>
            <p className="mb-2 font-normal">Eligibility requirements are determined by Adjung and may change over time.</p>
            <p className="font-normal">A Personal Site remains subject to these Terms of Use.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">9. Privacy</h3>
            <p className="mb-2 font-normal">Adjung collects only the information necessary to operate the platform.</p>
            <p className="font-normal">Personal information will be handled in accordance with the Adjung Privacy Policy.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">10. Account Security</h3>
            <p className="mb-2 font-normal">Members are responsible for maintaining the confidentiality of their login credentials.</p>
            <p className="font-normal">Notify Adjung immediately if unauthorized access is suspected.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">11. Suspension and Termination</h3>
            <p className="mb-2 font-normal">Adjung may suspend or terminate accounts that:</p>
            <ul className="list-disc pl-5 mb-2 font-normal space-y-1">
              <li>violate these Terms;</li>
              <li>repeatedly breach publication standards;</li>
              <li>threaten platform integrity;</li>
              <li>engage in unlawful activities.</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">12. Amendments</h3>
            <p className="mb-2 font-normal">These Terms may be updated from time to time.</p>
            <p className="mb-2 font-normal">Material changes will be communicated through appropriate platform notices.</p>
            <p className="font-normal">Continued use of Adjung constitutes acceptance of the revised Terms.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">13. Governing Law</h3>
            <p className="font-normal">These Terms shall be governed by the laws applicable to the operator of Adjung unless otherwise required by mandatory local law.</p>
          </div>
          
          <div>
            <h3 className="font-serif text-base font-bold text-stone-900 mb-2">14. Contact</h3>
            <p className="font-normal">Questions regarding these Terms may be directed through the official contact channels published by Adjung.</p>
          </div>

          {scrolledToBottom && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center text-adjung-maroon font-serif text-xs font-normal mt-6 pt-4 border-t border-stone-200">
              You have reached the end of the Adjung Terms of Use.
            </motion.p>
          )}
        </div>
      </div>

      <div className="w-full max-w-xl mt-6 flex flex-col items-center select-none">
        <label className={`flex items-start gap-3 mb-6 ${scrolledToBottom ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'} max-w-md`}>
          <input 
            type="checkbox" 
            disabled={!scrolledToBottom}
            checked={agreed} 
            onChange={(e) => setAgreed(e.target.checked)} 
            className="w-4 h-4 accent-adjung-maroon mt-0.5 flex-shrink-0 cursor-pointer disabled:cursor-not-allowed"
          />
          <span className="text-stone-600 text-[13px] font-sans select-none leading-relaxed">
            I understand and accept the terms and responsibilities of Adjung membership.
            {!scrolledToBottom && (
              <span className="block text-[10px] text-stone-400 font-mono mt-1 uppercase tracking-wide">
                Please scroll to the bottom of the Terms of Use to enable
              </span>
            )}
          </span>
        </label>

        <button 
          disabled={!agreed || !scrolledToBottom}
          onClick={onNext} 
          className={`px-10 py-3 border font-mono text-xs tracking-widest uppercase transition-all duration-300 rounded-sm font-bold ${
            agreed && scrolledToBottom
              ? 'bg-adjung-maroon hover:bg-stone-900 text-[#FDFDFD] cursor-pointer shadow-sm' 
              : 'border-stone-200 text-stone-400 cursor-not-allowed bg-transparent'
          }`}
        >
          Accept & Continue
        </button>
      </div>
    </motion.section>
  );
}

function Step4Identity({ formData, setFormData, onNext }: any) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <motion.section variants={pageVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center w-full h-full justify-between">
      <div className="text-center w-full">
        <h2 className="font-serif text-2xl md:text-3xl font-normal text-stone-900 mb-2 tracking-tight">Your Identity</h2>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-md font-sans flex-1 flex flex-col justify-center">
        
        <div className="relative group">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 mb-1.5">Real & Full Name</label>
          <input 
            type="text" 
            required
            value={formData.displayName}
            onChange={e => setFormData({...formData, displayName: e.target.value})}
            className="w-full border-b-2 border-t-0 border-x-0 border-stone-200/60 bg-transparent px-0 py-2 text-sm text-stone-900 rounded-none focus:outline-none focus:border-adjung-maroon transition-all font-serif placeholder:italic placeholder:text-stone-400/60" 
            placeholder="e.g. Al-Ghazali"
          />
        </div>

        <div className="relative group">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 mb-1.5">Pen Name / Short Name</label>
          <input 
            type="text" 
            required
            value={formData.penName}
            onChange={e => setFormData({...formData, penName: e.target.value})}
            className="w-full border-b-2 border-t-0 border-x-0 border-stone-200/60 bg-transparent px-0 py-2 text-sm text-stone-900 rounded-none focus:outline-none focus:border-adjung-maroon transition-all font-serif placeholder:italic placeholder:text-stone-400/60" 
            placeholder="e.g. Ghazali"
          />
        </div>

        <div className="relative group">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 mb-1.5">Subdomain / Domain</label>
          <input 
            type="text" 
            required
            value={formData.username}
            onChange={e => setFormData({...formData, username: e.target.value})}
            className="w-full border-b-2 border-t-0 border-x-0 border-stone-200/60 bg-transparent px-0 py-2 text-sm text-stone-900 rounded-none focus:outline-none focus:border-adjung-maroon transition-all font-mono placeholder:text-stone-300" 
            placeholder="e.g. zayd.ghazali"
          />
        </div>

        <div className="relative group">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 mb-1.5">Username (Email)</label>
          <input 
            type="email" 
            required
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
            className="w-full border-b-2 border-t-0 border-x-0 border-stone-200/60 bg-transparent px-0 py-2 text-sm text-stone-900 rounded-none focus:outline-none focus:border-adjung-maroon transition-all placeholder:text-stone-300" 
            placeholder="e.g. contact@domain.edu"
          />
        </div>

        <div className="pt-4 flex justify-center">
          <button 
            type="submit" 
            className="px-10 py-3 bg-adjung-maroon hover:bg-stone-900 text-[#FDFDFD] font-mono text-xs tracking-widest uppercase transition-all duration-300 rounded-sm shadow-sm font-bold cursor-pointer"
          >
            Continue
          </button>
        </div>
      </form>
    </motion.section>
  );
}

function Step5Verification({ formData, onNext, goBack }: { formData: any; onNext: () => void; goBack: () => void; key?: string }) {
  const [code, setCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [error, setError] = useState('');
  const [resent, setResent] = useState(false);

  // Generate a code when step loads
  useEffect(() => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(randomCode);
  }, []);

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() === generatedCode || code.trim() === '123456') {
      onNext();
    } else {
      setError('The verification code you entered is invalid. Please try again.');
    }
  };

  const handleResend = () => {
    const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedCode(randomCode);
    setResent(true);
    setError('');
    setTimeout(() => setResent(false), 3000);
  };

  return (
    <motion.section 
      variants={pageVariants} 
      initial="initial" 
      animate="animate" 
      exit="exit" 
      className="flex flex-col items-center w-full py-1 h-full justify-between"
    >
      <div className="text-center w-full">
        <h2 className="font-serif text-2xl md:text-3xl font-normal text-stone-900 mb-2 tracking-tight">Email Verification</h2>
        <p className="text-stone-500 text-xs mb-6 max-w-sm mx-auto leading-relaxed font-sans select-none">
          To protect platform security and verify your academic identity, we have dispatched a simulated 6-digit code to your email.
        </p>
      </div>

      <form onSubmit={handleVerify} className="space-y-6 w-full max-w-md font-sans">
        {/* Simulation Alert Box */}
        <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-sm text-left relative overflow-hidden select-all text-amber-900">
          <div className="flex gap-2">
            <span className="font-mono text-xs font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded shrink-0">SMTP SIMULATOR</span>
            <span className="font-sans text-[11px] leading-relaxed">
              Dispatching simulated email to: <strong className="font-mono">{formData.email || 'scholar@adjung.com'}</strong>
            </span>
          </div>
          <div className="mt-2.5 pt-2.5 border-t border-amber-200/50 flex justify-between items-center text-[12px] font-serif">
            <span>Your 6-digit verification code:</span>
            <strong className="font-mono text-sm tracking-widest text-[#802334] font-bold select-all bg-white px-2 py-0.5 border border-amber-200/50 rounded shadow-sm animate-pulse">
              {generatedCode}
            </strong>
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-100 text-red-800 rounded font-sans text-xs">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-500 text-center mb-1.5">Enter 6-Digit Code</label>
          <input 
            type="text" 
            required
            maxLength={6}
            value={code}
            onChange={e => {
              setCode(e.target.value.replace(/\D/g, ''));
              setError('');
            }}
            className="w-full border-b-2 border-t-0 border-x-0 border-stone-200/60 bg-transparent px-0 py-3 text-center text-xl font-mono tracking-[0.4em] text-stone-900 rounded-none focus:outline-none focus:border-adjung-maroon transition-all" 
            placeholder="000000"
          />
        </div>

        <div className="flex justify-between items-center text-[11px]">
          <button 
            type="button"
            onClick={handleResend}
            className="text-stone-500 hover:text-adjung-maroon font-mono uppercase tracking-wider transition font-semibold"
          >
            {resent ? '✓ Dispatched New Code' : 'Resend Code'}
          </button>
          
          <button 
            type="button"
            onClick={() => setCode(generatedCode)}
            className="text-adjung-maroon/80 hover:text-adjung-maroon font-mono uppercase tracking-wider transition font-semibold"
          >
            Auto-fill
          </button>
        </div>

        <div className="pt-2 flex gap-3">
          <button 
            type="button"
            onClick={goBack}
            className="flex-1 py-3 border border-stone-200 text-stone-500 hover:bg-stone-50 font-mono text-xs tracking-wider uppercase transition-all duration-300 rounded-sm font-semibold cursor-pointer text-center"
          >
            Back
          </button>
          <button 
            type="submit" 
            className="flex-1 py-3 bg-adjung-maroon hover:bg-stone-900 text-[#FDFDFD] font-mono text-xs tracking-wider uppercase transition-all duration-300 rounded-sm shadow-sm font-bold cursor-pointer"
          >
            Verify Code
          </button>
        </div>
      </form>
    </motion.section>
  );
}

function Step6Biography({ formData, setFormData, onNext }: any) {
  const handleSkip = () => {
    setFormData({ ...formData, biography: '' });
    onNext();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <motion.section variants={pageVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center w-full py-1 h-full justify-between">
      <div className="text-center w-full">
        <h2 className="font-serif text-2xl md:text-3xl font-normal text-stone-900 mb-2 tracking-tight">About You</h2>
        <p className="text-stone-500 text-center text-xs mb-6 max-w-xs mx-auto leading-relaxed font-sans select-none">
          This is a short description of yourself, your intellectual background, or interests that will be displayed on your Personal Site.
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-md font-sans">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-widest text-stone-400 mb-1.5">Description (optional)</label>
          <textarea 
            rows={5} 
            value={formData.biography}
            onChange={e => setFormData({...formData, biography: e.target.value})}
            className="w-full border-b-2 border-t-0 border-x-0 border-stone-200/60 bg-transparent px-0 py-2.5 text-sm text-stone-900 rounded-none focus:outline-none focus:border-adjung-maroon transition-all font-serif leading-relaxed placeholder:italic placeholder:text-stone-400/60"
            placeholder="e.g. Researching ethics, epistemic integrity, and classical Islamic scholarship."
          ></textarea>
        </div>

        <div className="pt-2 flex gap-3">
          <button 
            type="button"
            onClick={handleSkip}
            className="flex-1 py-3 border border-stone-200 text-stone-500 hover:bg-stone-50 font-mono text-xs tracking-wider uppercase transition-all duration-300 rounded-sm font-semibold cursor-pointer text-center"
          >
            Skip
          </button>
          <button 
            type="submit" 
            className="flex-1 py-3 bg-adjung-maroon hover:bg-stone-900 text-[#FDFDFD] font-mono text-xs tracking-wider uppercase transition-all duration-300 rounded-sm shadow-sm font-bold cursor-pointer"
          >
            Continue
          </button>
        </div>
      </form>
    </motion.section>
  );
}

function Step7PersonalSite({ formData, setFormData, onNext }: any) {
  const [status, setStatus] = useState<'idle'|'loading'|'available'|'invalid'|'reserved'>('idle');
  const timeoutRef = useRef<any>(null);

  const checkDomain = (val: string) => {
    setFormData({...formData, domain: val});
    setStatus('idle');
    if (!val) return;
    
    if (!/^[a-z0-9\-]+$/i.test(val)) {
      setStatus('invalid');
      return;
    }
    
    setStatus('loading');
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      const reserved = ['admin','adjung','support','help', 'www', 'blog'];
      if (reserved.includes(val.toLowerCase())) {
        setStatus('reserved');
      } else {
        setStatus('available');
      }
    }, 1000);
  };

  return (
    <motion.section variants={pageVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center w-full py-1 h-full justify-between">
      <div className="text-center w-full">
        <h2 className="font-serif text-2xl md:text-3xl font-normal text-stone-900 mb-2 tracking-tight">Your Personal Site</h2>
        <p className="text-stone-500 text-center text-xs mb-6 max-w-md mx-auto leading-relaxed font-sans select-none">
          Every Personal Site represents a permanent intellectual address — the home of your Biography, Folio, Publications and intellectual legacy.
        </p>
      </div>
      
      {/* proposal Ledger panel */}
      <div className="bg-stone-50 border border-stone-200/80 p-5 rounded-sm w-full max-w-md text-center mb-4 shadow-sm select-none">
        <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-stone-400 mb-1.5 font-bold">PROPOSED INTELLECTUAL DOMAIN</p>
        <p className="font-serif text-xl md:text-2xl text-stone-800 tracking-tight">
          <span className={formData.domain ? 'text-adjung-maroon font-semibold italic' : 'text-stone-400/80'}>
            {formData.domain || 'yourname'}
          </span>
          <span className="text-stone-400 font-light">.adjung.com</span>
        </p>
      </div>
      
      <p className="text-stone-500 text-[11.5px] text-center mb-4 max-w-xs leading-relaxed font-serif italic select-none">
        Permanent addresses are granted upon credential verification to preserve valuable namespaces.
      </p>

      {/* Domain input */}
      <div className="w-full max-w-md mb-4 relative">
        <div className="flex items-baseline bg-transparent border-b-2 border-stone-200/60 pb-1.5 focus-within:border-adjung-maroon transition-all">
          <input 
            type="text" 
            placeholder="yourname" 
            value={formData.domain}
            onChange={(e) => checkDomain(e.target.value)}
            className="flex-1 bg-transparent font-serif text-lg text-stone-900 focus:outline-none placeholder:text-stone-300 min-w-0" 
          />
          <span className="font-serif text-base text-stone-400 ml-1 select-none">.adjung.com</span>
        </div>
        
        {/* Animated Loading Line */}
        <div className="h-[2px] bg-adjung-maroon absolute bottom-0 left-0 transition-all duration-700" style={{ width: status === 'loading' ? '100%' : '0%', opacity: status === 'loading' ? 1 : 0 }} />
        
        <p className="text-xs mt-2 text-center h-4 transition-opacity duration-300 font-sans" style={{ opacity: status !== 'idle' && status !== 'loading' ? 1 : 0, color: status === 'available' ? '#44403C' : '#9A3412' }}>
          {status === 'invalid' && 'Contains invalid characters'}
          {status === 'reserved' && 'Already reserved by administration'}
          {status === 'available' && '✓ This address is available for request'}
        </p>
      </div>

      <AnimatePresence>
        {status === 'available' && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="w-full max-w-md text-center mb-4 overflow-hidden">
            <div className="pt-1 border border-stone-200 bg-white p-4 rounded-sm shadow-sm">
              <p className="font-serif text-sm text-stone-900 mb-1.5 font-semibold">Preferred Address Recorded</p>
              <p className="text-[11px] text-stone-500 leading-relaxed font-sans text-left">
                This domain is logged in your registration record. It will remain locked for your application during review.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button 
        onClick={onNext} 
        className="px-10 py-3 bg-adjung-maroon hover:bg-stone-900 text-[#FDFDFD] font-mono text-xs tracking-widest uppercase transition-all duration-300 rounded-sm shadow-sm font-bold cursor-pointer"
      >
        Continue
      </button>
    </motion.section>
  );
}

// Embedded Simulated Mobile Signature Canvas
function SimulatedMobileCanvas({ onSave, onCancel }: { onSave: (strokes: any[]) => void, onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<any[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<any[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#802334';
    ctx.lineWidth = 3.5;
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    setIsDrawing(true);
    setCurrentStroke([{ x, y }]);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.beginPath();
    const lastPoint = currentStroke[currentStroke.length - 1];
    if (lastPoint) {
      ctx.moveTo(lastPoint.x, lastPoint.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    setCurrentStroke(prev => [...prev, { x, y }]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.length > 0) {
      setStrokes(prev => [...prev, currentStroke]);
    }
    setCurrentStroke([]);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setStrokes([]);
  };

  return (
    <div className="bg-[#1A1816] text-stone-100 p-5 rounded-2xl max-w-[280px] w-full border border-stone-800 shadow-2xl space-y-4 font-sans select-none relative">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black rounded-b-xl" /> {/* Speaker cutout */}
      
      <div className="flex justify-between items-center border-b border-stone-800/80 pt-2 pb-2">
        <span className="font-mono text-[9px] uppercase tracking-wider text-[#802334] font-bold flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
          ADJUNG MOBILE SIGN
        </span>
        <button onClick={onCancel} className="text-stone-500 hover:text-stone-300 text-[10px] font-mono uppercase">Close</button>
      </div>

      <div className="space-y-1">
        <p className="text-[11px] text-stone-300 font-serif italic text-center">Please sign inside the following box:</p>
      </div>

      <div className="bg-stone-950 border border-stone-800 rounded-lg h-44 relative overflow-hidden">
        <div className="absolute inset-x-4 bottom-8 border-b border-stone-800/40 border-dashed pointer-events-none" />
        <canvas
          ref={canvasRef}
          width={240}
          height={176}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="w-full h-full touch-none"
        />
        {strokes.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none opacity-20 text-center px-4">
            <span className="font-serif italic text-[12px] text-stone-300">Use your finger or stylus</span>
            <span className="text-[8px] font-mono uppercase tracking-widest text-stone-500 mt-1">Touch Screen Canvas</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          onClick={clear}
          className="flex-1 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-mono text-[10px] uppercase rounded-sm transition-colors cursor-pointer"
        >
          Clear
        </button>
        <button
          onClick={() => strokes.length > 0 && onSave(strokes)}
          disabled={strokes.length === 0}
          className="flex-1 py-2 bg-adjung-maroon hover:bg-stone-900 disabled:opacity-40 disabled:cursor-not-allowed text-stone-100 font-mono text-[10px] uppercase rounded-sm transition-all cursor-pointer font-bold"
        >
          Send to PC
        </button>
      </div>
    </div>
  );
}

// Helper to render drawn strokes as beautiful smooth vector SVG path
const renderStrokesToSvg = (strokes: any[], strokeColor = '#802334') => {
  if (!strokes || strokes.length === 0) return null;
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  strokes.forEach(stroke => {
    stroke.forEach((p: any) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });
  });
  
  const padding = 12;
  const width = Math.max(100, (maxX - minX) + padding * 2);
  const height = Math.max(60, (maxY - minY) + padding * 2);
  
  const paths = strokes.map((stroke, i) => {
    if (stroke.length === 0) return null;
    let d = `M ${stroke[0].x - minX + padding} ${stroke[0].y - minY + padding}`;
    for (let j = 1; j < stroke.length; j++) {
      d += ` L ${stroke[j].x - minX + padding} ${stroke[j].y - minY + padding}`;
    }
    return (
      <path
        key={i}
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  });
  
  return (
    <svg 
      viewBox={`0 0 ${width} ${height}`} 
      className="max-h-full max-w-full mx-auto"
      style={{ height: '80px' }}
    >
      {paths}
    </svg>
  );
};

function Step8Signature({ formData, setFormData, onNext }: any) {
  const [mode, setMode] = useState<'choose' | 'draw' | 'typo' | 'qr'>('choose');
  const [isDrawingPadOpen, setIsDrawingPadOpen] = useState(false);
  const [showSimulatedPhone, setShowSimulatedPhone] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [typedText, setTypedText] = useState(formData.displayName || '');

  const hasRecordedSignature = !!formData.signatureData;

  const handleSaveDrawn = (data: any) => {
    setFormData({
      ...formData,
      signatureType: 'draw',
      signatureData: data
    });
    setIsDrawingPadOpen(false);
  };

  const handleSaveTypo = () => {
    setFormData({
      ...formData,
      signatureType: 'typo',
      signatureData: typedText || formData.displayName
    });
    setMode('choose');
  };

  const handleSimulateMobileSign = (strokes: any[]) => {
    setIsSyncing(true);
    setSyncProgress(0);
    setShowSimulatedPhone(false);
    
    const interval = setInterval(() => {
      setSyncProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsSyncing(false);
            setFormData({
              ...formData,
              signatureType: 'draw',
              signatureData: { strokes, type: 'drawn' }
            });
            setMode('choose');
          }, 400);
          return 100;
        }
        return prev + 25;
      });
    }, 250);
  };

  return (
    <motion.section variants={pageVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center w-full py-1 h-full justify-between">
      
      {/* Title block */}
      <div className="text-center w-full">
        <h2 className="font-serif text-2xl md:text-3xl font-normal text-stone-900 mb-1 tracking-tight">Your Signature</h2>
        <p className="text-stone-500 text-xs mb-6 max-w-sm mx-auto leading-relaxed font-sans select-none">
          Your signature accompanies your published works as a mark of genuine human authorship.
        </p>
      </div>

      {/* Main active interactive block */}
      <div className="w-full flex-1 flex flex-col justify-center items-center px-2">
        
        {/* Syncing Progress Overlay */}
        {isSyncing && (
          <div className="bg-white border border-stone-200/80 p-8 rounded-sm text-center shadow-lg w-full max-w-md flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-8 h-8 text-adjung-maroon animate-spin" />
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-widest text-stone-400 font-bold">SIGNATURE SYNCHRONIZATION</p>
              <p className="font-serif italic text-sm text-stone-600">Copying signature data from mobile device...</p>
            </div>
            <div className="w-48 bg-stone-100 h-1 rounded-full overflow-hidden relative">
              <div className="bg-adjung-maroon h-full transition-all duration-300" style={{ width: `${syncProgress}%` }} />
            </div>
            <span className="font-mono text-xs text-stone-500 font-bold">{syncProgress}%</span>
          </div>
        )}

        {/* Dashboard Choice State */}
        {!isSyncing && mode === 'choose' && (
          <div className="w-full space-y-4 max-w-md">
            
            {/* If signature exists, display certificate card */}
            {hasRecordedSignature ? (
              <div className="border border-stone-200/80 bg-white p-5 rounded-sm shadow-sm relative overflow-hidden select-none">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-adjung-maroon" />
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className="font-mono text-[8px] uppercase tracking-widest bg-stone-100 px-1.5 py-0.5 rounded text-stone-500 font-bold">
                      {formData.signatureType === 'typo' ? 'Typographic Signature' : 'Handdrawn Signature'}
                    </span>
                    <h4 className="font-serif text-sm font-semibold text-stone-900 mt-1.5">Aesthetic Seal Registered</h4>
                  </div>
                  <Check className="w-4 h-4 text-green-600" />
                </div>

                {/* The visual preview of the signature */}
                <div className="bg-stone-50 border border-stone-150 h-28 rounded flex items-center justify-center relative overflow-hidden p-4">
                  <div className="absolute inset-0 bg-[radial-gradient(#802334/0.015_1px,transparent_1px)] [background-size:12px_12px]" />
                  {formData.signatureType === 'typo' ? (
                    <span className="font-signature text-4xl text-adjung-maroon select-none">
                      {formData.signatureData}
                    </span>
                  ) : (
                    renderStrokesToSvg(formData.signatureData?.strokes)
                  )}
                  <span className="absolute bottom-2 right-3 font-mono text-[7px] text-stone-300 tracking-wider">ADJUNG SECURE</span>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-stone-100">
                  <span className="font-mono text-[7px] text-stone-400">HASH: ADJ-SHA256-{(formData.displayName || 'x').substring(0, 3).toUpperCase()}-77AC</span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, signatureType: 'draw', signatureData: '' });
                      setMode('choose');
                    }}
                    className="text-[10px] font-mono uppercase text-adjung-maroon hover:underline font-bold"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : (
              // Empty selection state
              <div className="space-y-3">
                <button 
                  type="button" 
                  className="w-full border border-stone-200 bg-white p-4 text-left hover:border-adjung-maroon focus:border-adjung-maroon hover:shadow-md transition-all duration-300 flex items-center justify-between rounded-sm cursor-pointer group" 
                  onClick={() => setIsDrawingPadOpen(true)}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-stone-800 font-sans group-hover:text-adjung-maroon transition-colors flex items-center gap-1.5">
                      <PenTool className="w-4 h-4 text-adjung-maroon/80" /> Draw signature on PC / tablet
                    </span>
                    <span className="text-xs text-stone-400 mt-1 font-sans">Use touch trackpad or mouse cursor</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-stone-300 group-hover:text-adjung-maroon rotate-180 transition-transform" />
                </button>
                
                <button 
                  type="button" 
                  className="w-full border border-stone-200 bg-white p-4 text-left hover:border-adjung-maroon focus:border-adjung-maroon hover:shadow-md transition-all duration-300 flex items-center justify-between rounded-sm cursor-pointer group" 
                  onClick={() => setMode('typo')}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-stone-800 font-sans group-hover:text-adjung-maroon transition-colors flex items-center gap-1.5">
                      <Type className="w-4 h-4 text-adjung-maroon/80" /> Typographic signature
                    </span>
                    <span className="text-xs text-stone-400 mt-1 font-sans">Generate stylized signature from your pen name</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-stone-300 group-hover:text-adjung-maroon rotate-180 transition-transform" />
                </button>

                <button 
                  type="button" 
                  className="w-full border border-stone-200 bg-white p-4 text-left hover:border-adjung-maroon focus:border-adjung-maroon hover:shadow-md transition-all duration-300 flex items-center justify-between rounded-sm cursor-pointer group" 
                  onClick={() => setMode('qr')}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-stone-800 font-sans group-hover:text-adjung-maroon transition-colors flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-adjung-maroon/80" /> Draw on mobile (Scan QR)
                    </span>
                    <span className="text-xs text-stone-400 mt-1 font-sans">Scan to sign easily on your smartphone touch screen</span>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-stone-300 group-hover:text-adjung-maroon rotate-180 transition-transform" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Typographic Creator Step */}
        {!isSyncing && mode === 'typo' && (
          <div className="w-full mb-4 text-center max-w-md space-y-4">
            <p className="text-[10px] font-mono uppercase tracking-widest text-stone-400 mb-2 select-none">Stylized Typographic Mark</p>
            
            <div className="border border-stone-200 bg-white h-36 flex items-center justify-center rounded-sm shadow-inner relative overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(#802334/0.02_1px,transparent_1px)] [background-size:16px_16px]" />
              <span className="font-signature text-5xl text-adjung-maroon px-6 z-10 select-none">
                {typedText || 'Your Name'}
              </span>
            </div>

            <div className="text-left space-y-1.5">
              <label className="block text-[9px] font-mono uppercase tracking-wider text-stone-400">Pen & Short Name</label>
              <input 
                type="text" 
                value={typedText}
                onChange={e => setTypedText(e.target.value)}
                maxLength={20}
                className="w-full border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 rounded-sm focus:outline-none focus:border-adjung-maroon transition-all font-serif"
                placeholder="E.g. Al-Ghazali"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button 
                type="button" 
                className="flex-1 py-2 border border-stone-200 text-stone-500 font-mono text-[10px] uppercase rounded-sm hover:bg-stone-50 transition cursor-pointer" 
                onClick={() => setMode('choose')}
              >
                Back
              </button>
              <button 
                type="button" 
                className="flex-1 py-2 bg-adjung-maroon text-[#FDFDFD] font-mono text-[10px] uppercase rounded-sm hover:bg-stone-900 transition font-bold cursor-pointer"
                onClick={handleSaveTypo}
              >
                Use This Signature
              </button>
            </div>
          </div>
        )}

        {/* QR Mobile Synchronization View */}
        {!isSyncing && mode === 'qr' && (
          <div className="w-full max-w-lg space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
              
              {/* QR Panel representation */}
              <div className="border border-stone-200 bg-white p-4 rounded-sm flex flex-col items-center text-center shadow-sm relative">
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-adjung-maroon rounded-full animate-ping" />
                  <span className="font-mono text-[7px] text-stone-400 tracking-widest uppercase">Secured Room</span>
                </div>
                
                {/* Simulated QR Code via vector SVG */}
                <div className="w-32 h-32 bg-stone-50 border border-stone-150 rounded flex items-center justify-center p-2 mt-2 relative group">
                  <svg viewBox="0 0 100 100" className="w-full h-full text-stone-800">
                    {/* QR Finder patterns */}
                    <rect x="5" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                    <rect x="11" y="11" width="13" height="13" fill="currentColor" />
                    <rect x="70" y="5" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                    <rect x="76" y="11" width="13" height="13" fill="currentColor" />
                    <rect x="5" y="70" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="6" />
                    <rect x="11" y="76" width="13" height="13" fill="currentColor" />
                    {/* Random scholarly QR elements */}
                    <rect x="40" y="10" width="10" height="15" fill="currentColor" />
                    <rect x="45" y="30" width="15" height="10" fill="currentColor" />
                    <rect x="10" y="45" width="15" height="10" fill="currentColor" />
                    <rect x="75" y="45" width="15" height="15" fill="currentColor" />
                    <rect x="35" y="50" width="25" height="10" fill="currentColor" />
                    <rect x="40" y="70" width="15" height="20" fill="currentColor" />
                    <rect x="70" y="75" width="10" height="15" fill="currentColor" />
                    {/* Scanning red line animation */}
                    <line x1="0" y1="50" x2="100" y2="50" stroke="#802334" strokeWidth="2.5" className="animate-bounce" />
                  </svg>
                </div>
                
                <span className="font-mono text-[9px] text-stone-400 font-bold tracking-widest mt-3">SESSION: ADJ-{(formData.displayName || 'Z').substring(0,2).toUpperCase()}-99A</span>
              </div>

              {/* Instructions and connection simulation trigger */}
              <div className="space-y-3">
                <div className="flex gap-2.5 items-start">
                  <Smartphone className="w-5 h-5 text-adjung-maroon shrink-0 mt-0.5" />
                  <p className="text-[12px] text-stone-600 font-serif leading-relaxed">
                    Scan the QR code on the left with your smartphone's camera to open the mobile <span className="font-sans font-semibold text-stone-800">Calligraphy Pad</span>.
                  </p>
                </div>
                <div className="flex gap-2.5 items-start">
                  <Laptop className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                  <p className="text-[12px] text-stone-600 font-serif leading-relaxed">
                    The signature drawn on your phone screen will be synchronized directly to this computer.
                  </p>
                </div>

                {/* Simulated trigger button */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSimulatedPhone(true)}
                    className="w-full py-2 bg-stone-900 hover:bg-adjung-maroon text-white font-mono text-[10px] uppercase rounded-sm transition-all flex items-center justify-center gap-1.5 font-bold cursor-pointer shadow-sm border border-stone-800"
                  >
                    <Smartphone className="w-3.5 h-3.5" /> Simulate Smartphone
                  </button>
                </div>
              </div>

            </div>

            <div className="pt-2 flex justify-center">
              <button 
                type="button" 
                className="px-6 py-1.5 border border-stone-200 text-stone-500 font-mono text-[10px] uppercase rounded-sm hover:bg-stone-50 transition cursor-pointer" 
                onClick={() => setMode('choose')}
              >
                Back to Options
              </button>
            </div>

          </div>
        )}

      </div>

      {/* Floating Smartphone Mockup Overlay inside the wizard */}
      <AnimatePresence>
        {showSimulatedPhone && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="absolute inset-0 bg-[#0c0a09]/85 backdrop-blur-sm z-[80] flex items-center justify-center p-4"
          >
            <SimulatedMobileCanvas 
              onSave={handleSimulateMobileSign} 
              onCancel={() => setShowSimulatedPhone(false)} 
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Full screen drawing modal via native SignaturePad component (resolves issue 1!) */}
      {isDrawingPadOpen && (
        <SignaturePad 
          onSave={handleSaveDrawn} 
          onCancel={() => setIsDrawingPadOpen(false)} 
          defaultName={formData.displayName || formData.username}
        />
      )}

      {/* Footer Navigation controls */}
      <div className="w-full border-t border-stone-150 pt-4 mt-2 flex justify-between items-center bg-[#FFFFFF] select-none">
        <span className="text-[11px] text-stone-400 font-serif italic">
          {hasRecordedSignature ? '✓ Signature logged successfully' : 'Please authenticate with a signature'}
        </span>
        <button 
          disabled={!hasRecordedSignature}
          onClick={onNext} 
          className={`px-10 py-3 font-mono text-xs tracking-widest uppercase transition-all duration-300 rounded-sm font-bold ${
            hasRecordedSignature 
              ? 'bg-adjung-maroon hover:bg-stone-900 text-[#FDFDFD] cursor-pointer shadow-sm' 
              : 'bg-stone-100 border border-stone-200 text-stone-300 cursor-not-allowed'
          }`}
        >
          Continue
        </button>
      </div>

    </motion.section>
  );
}

function Step9Complete({ onComplete }: { onComplete: () => void, key?: string }) {
  const [showFinal, setShowFinal] = useState(false);
  const [visibleLines, setVisibleLines] = useState<number[]>([]);

  useEffect(() => {
    const sequence = async () => {
      // Show text lines sequentially
      for (let i = 0; i < 3; i++) {
        await new Promise(r => setTimeout(r, 1000));
        setVisibleLines(prev => [...prev, i]);
      }
      
      await new Promise(r => setTimeout(r, 1500));
      setShowFinal(true);
    };
    sequence();
  }, []);

  return (
    <motion.section variants={pageVariants} initial="initial" animate="animate" exit="exit" className="flex flex-col items-center text-center w-full justify-center h-full min-h-[350px]">
      
      <AnimatePresence>
        {!showFinal && (
          <motion.div exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.6 }} className="flex flex-col gap-6 w-full items-center justify-center min-h-[250px] select-none">
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: visibleLines.includes(0) ? 1 : 0, y: visibleLines.includes(0) ? 0 : 10 }} transition={{ duration: 0.8 }} className="font-serif text-xl text-stone-500 italic">Your membership has been established.</motion.p>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: visibleLines.includes(1) ? 1 : 0, y: visibleLines.includes(1) ? 0 : 10 }} transition={{ duration: 0.8 }} className="font-serif text-xl text-stone-500 italic">Your intellectual identity has been created.</motion.p>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: visibleLines.includes(2) ? 1 : 0, y: visibleLines.includes(2) ? 0 : 10 }} transition={{ duration: 0.8 }} className="font-serif text-xl text-stone-500 italic">Your Desk is now ready.</motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showFinal && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="flex flex-col items-center min-h-[250px] justify-center">
            <div className="mb-6">
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none" className="mx-auto text-adjung-maroon">
                <rect x="10" y="6" width="28" height="36" rx="1.5" stroke="currentColor" strokeWidth="1.5"></rect>
                <line x1="16" y1="14" x2="32" y2="14" stroke="currentColor" strokeWidth="1.25"></line>
                <line x1="16" y1="20" x2="32" y2="20" stroke="currentColor" strokeWidth="1.25"></line>
                <line x1="16" y1="26" x2="26" y2="26" stroke="currentColor" strokeWidth="1.25"></line>
              </svg>
            </div>
            <h1 className="font-serif text-3xl md:text-4xl font-normal text-stone-900 mb-3 tracking-tight">Welcome to Adjung.</h1>
            <p className="font-serif text-stone-500 italic text-sm mb-10 max-w-sm leading-relaxed">
              Your pen name is now registered in our scrolls.
            </p>
            <button 
              onClick={onComplete} 
              className="px-10 py-3 bg-adjung-maroon hover:bg-stone-900 text-[#FDFDFD] font-mono text-xs tracking-widest uppercase transition-all duration-300 rounded-sm shadow-sm font-bold cursor-pointer"
            >
              Enter Desk
            </button>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.section>
  );
}
