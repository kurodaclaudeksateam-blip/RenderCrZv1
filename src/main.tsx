import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import SharedView from './components/SharedView';
import './styles.css';

// las ligas públicas son /v/<clave>: abren directo la vista compartida, sin contraseña
const share = location.pathname.match(/^\/v\/([\w-]{6,40})\/?$/)?.[1];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {share ? <SharedView share={share} /> : <App />}
  </StrictMode>,
);
