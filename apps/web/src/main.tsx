import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const root = document.getElementById('root');
if (root === null) throw new Error('#root 요소가 없음');

createRoot(root).render(
  <StrictMode>
    <h1>LokiBench</h1>
  </StrictMode>,
);
