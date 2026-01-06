import React, { createContext, useState, useEffect } from 'react';

const ThemeContext = createContext({
    theme: 'light',
    setTheme: () => {},
    toggleTheme: () => {}
});

export const ThemeProvider = ({ children }) => {
    // Get initial theme from localStorage or system preference
    const getInitialTheme = () => {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) return savedTheme;

        // Check system preference
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }

        return 'light';
    };

    const [theme, setTheme] = useState(getInitialTheme);

    const toggleTheme = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };

    // Apply theme when it changes
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);

        // Log theme change
        console.log('Theme changed to:', theme);
    }, [theme]);

    // Listen for system preference changes
    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

        const handleChange = () => {
            if (!localStorage.getItem('theme')) {
                setTheme(mediaQuery.matches ? 'dark' : 'light');
            }
        };

        mediaQuery.addEventListener('change', handleChange);
        return () => mediaQuery.removeEventListener('change', handleChange);
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;