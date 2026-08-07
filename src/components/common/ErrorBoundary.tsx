import React from 'react';
import { BRAND, LOGO_SIZE } from '../../config/brand';

// Sempadan ralat React (2026-08-07, Tier 1 audit inventori) — sebelum ini TIADA langsung dalam
// seluruh aplikasi, jadi satu ralat render (cth satu item kandungan rosak, satu medan `undefined`
// tak dijangka) memutihkan SELURUH halaman awam tanpa sebarang mesej. Untuk portal yang menghadap
// pembaca, itu kegagalan paling teruk yang boleh berlaku secara senyap.
//
// Sengaja komponen kelas: React hanya menyokong penangkapan ralat render melalui kaedah kitaran
// hayat kelas (componentDidCatch/getDerivedStateFromError) — tiada padanan cangkuk setakat ini.
//
// Ralat SEBENAR dihantar ke console.error sahaja (untuk pemantauan/penyahpepijatan), BUKAN
// dipaparkan kepada pembaca — mesej dalaman bukan urusan mereka, dan ia boleh membocorkan
// struktur sistem.
interface Props {
  children: React.ReactNode;
  /** Label konteks untuk log — cth "Editorium" vs "Frontpage", memudahkan mengesan punca. */
  konteks?: string;
}
interface State {
  adaRalat: boolean;
}

// Diberi jenis eksplisit pada `props`/`state` sendiri (bukan bergantung sepenuhnya pada generik
// React.Component<Props,State>) — repo ni tiada @types/react dipasang (React 19 tanpa .d.ts
// berasingan), jadi pewarisan generik biasa gagal disahkan pemeriksa jenis dalam persediaan ni.
export class ErrorBoundary extends React.Component {
  props!: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.state = { adaRalat: false };
  }

  static getDerivedStateFromError(): State {
    return { adaRalat: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`Ralat render${this.props.konteks ? ` (${this.props.konteks})` : ''}:`, error, info.componentStack);
  }

  render() {
    if (!this.state.adaRalat) return this.props.children;
    return (
      <div className="min-h-screen bg-[#FDFDFD] flex items-center justify-center px-6 font-sans">
        <div className="max-w-md w-full text-center">
          <div className={`font-serif ${LOGO_SIZE.gate} text-Adjung-maroon mb-3 select-none`}>{BRAND.logoText}</div>
          <h1 className="font-serif text-lg font-bold text-stone-900 mb-2">
            Maaf, halaman ini tidak dapat dipaparkan
          </h1>
          <p className="font-sans text-xs text-stone-600 leading-relaxed mb-6">
            Berlaku ralat teknikal semasa memaparkan halaman ini. Muat semula halaman untuk mencuba
            sekali lagi. Jika ia berulang, sila hubungi pentadbir sistem.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="bg-Adjung-maroon text-white text-xs font-semibold px-5 py-2 rounded hover:bg-Adjung-maroon-dark transition-colors cursor-pointer"
          >
            Muat Semula Halaman
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
