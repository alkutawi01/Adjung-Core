import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {pasangPemintasSesi} from './utils/pemintasSesi';

// Dipasang SEKALI di sini, sebelum komponen App langsung dilekap — supaya SETIAP fetch (termasuk
// yang berlaku dalam useEffect pertama App/EditoriumView) sudah terlindung. Lihat pemintasSesi.ts.
pasangPemintasSesi();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
