import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import FomoDashboard from './FomoDashboard';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container not found');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <FomoDashboard />
  </React.StrictMode>,
);