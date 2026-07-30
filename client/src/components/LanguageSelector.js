import React, { useState } from 'react';
import './LanguageSelector.css';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'zh', name: 'Chinese', flag: '🇨🇳' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' }
];

function LanguageSelector({ selectedLanguage, onLanguageChange, showLabel = true }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (langCode) => {
    onLanguageChange(langCode);
    setIsOpen(false);
  };

  const selectedLang = SUPPORTED_LANGUAGES.find(l => l.code === selectedLanguage) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="language-selector">
      {showLabel && <label className="language-label">🌐 Translation Language:</label>}
      <div className="language-dropdown">
        <button 
          className="language-button"
          onClick={() => setIsOpen(!isOpen)}
          type="button"
        >
          <span className="language-flag">{selectedLang.flag}</span>
          <span className="language-name">{selectedLang.name}</span>
          <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
        </button>
        
        {isOpen && (
          <div className="language-menu">
            {SUPPORTED_LANGUAGES.map(lang => (
              <button
                key={lang.code}
                className={`language-option ${lang.code === selectedLanguage ? 'selected' : ''}`}
                onClick={() => handleSelect(lang.code)}
                type="button"
              >
                <span className="language-flag">{lang.flag}</span>
                <span className="language-name">{lang.name}</span>
                {lang.code === selectedLanguage && <span className="check-mark">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default LanguageSelector;
export { SUPPORTED_LANGUAGES };
