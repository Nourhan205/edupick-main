import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/theme.css';
import './index.css';
import App from './App.jsx';

// Apply saved theme before first paint (default: dark)
document.documentElement.dataset.theme = localStorage.getItem('ep-theme') || 'dark';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

