import React, {createContext, useContext, useEffect, useState} from 'react';

const getDefaultLanguage = () => {
    try {
        const systemLanguages = navigator.languages || [navigator.language];
        const simplifiedLanguages = systemLanguages.map(lang => lang.split('-')[0]);
        const supportedLanguages = ['en', 'tr', 'ar', 'de'];
        const matchedLanguage = simplifiedLanguages.find(lang =>
            supportedLanguages.includes(lang)
        );
        return matchedLanguage || 'tr'; // Fallback to Turkish
    } catch (error) {
        console.warn('Language detection failed:', error);
        return 'tr';
    }
};

const LanguageContext = createContext();

export const LanguageProvider = ({children}) => {
    const [language, setLanguage] = useState(() => {
        const savedLanguage = localStorage.getItem('userLanguage');
        return savedLanguage || getDefaultLanguage();
    });

    const changeLanguage = (lang) => {
        setLanguage(lang);
        localStorage.setItem('userLanguage', lang);
    };

    useEffect(() => {
        // Ensure HTML lang attribute is updated
        document.documentElement.lang = language;
    }, [language]);

    return (
        <LanguageContext.Provider value={{language, changeLanguage}}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => useContext(LanguageContext);

export default LanguageContext;