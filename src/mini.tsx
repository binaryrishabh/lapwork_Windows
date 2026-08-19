import React from 'react';
import ReactDOM from 'react-dom/client';
import MiniStopwatch from './Components/MiniStopwatch';
import './mini.css';

const root = ReactDOM.createRoot(document.getElementById('mini-root'));
root.render(
  <React.StrictMode>
    <MiniStopwatch />
  </React.StrictMode>
);