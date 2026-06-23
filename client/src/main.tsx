import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import resources from './i18n';
import { ThemeProvider } from './context/ThemeContext';
import App from './App';
import './index.css';

i18n.use(initReactI18next).init({
  resources,
  lng: localStorage.getItem('synoza_lang') || 'ar',
  fallbackLng: 'ar',
  interpolation: { escapeValue: false },
});

function applyDocumentLanguage(lng: string) {
  document.documentElement.lang = lng;
  document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.classList.toggle('font-arabic', lng === 'ar');
}

applyDocumentLanguage(i18n.language);

i18n.on('languageChanged', (lng) => {
  localStorage.setItem('synoza_lang', lng);
  applyDocumentLanguage(lng);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>
);
