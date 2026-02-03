import React, { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './components/ToastProvider';
import ImportPage from './pages/ImportPage';
import './App.css';

// PUBLIC_INTERFACE
function App() {
  /** App entry: provides theme toggle + routing (currently /import). */
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // PUBLIC_INTERFACE
  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  return (
    <div className="App">
      <ToastProvider>
        <button className="theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>

        <BrowserRouter>
          <Routes>
            <Route path="/import" element={<ImportPage />} />
            <Route path="/" element={<Navigate to="/import" replace />} />
            <Route path="*" element={<Navigate to="/import" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </div>
  );
}

export default App;
