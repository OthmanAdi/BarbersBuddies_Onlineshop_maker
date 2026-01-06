// hooks/useDaisyTheme.js
import {useEffect, useState} from 'react';

export const useDaisyTheme = () => {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        const htmlElement = document.documentElement;
        setIsDark(htmlElement.getAttribute('data-theme') === 'luxury');

        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    setIsDark(htmlElement.getAttribute('data-theme') === 'luxury');
                }
            });
        });

        observer.observe(htmlElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        return () => observer.disconnect();
    }, []);

    return isDark;
};