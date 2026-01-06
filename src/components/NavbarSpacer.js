import React, { useState, useEffect } from 'react';

export const NavbarSpacer = () => {
    const [height, setHeight] = useState(64);

    useEffect(() => {
        const updateHeight = () => {
            const navbar = document.getElementById('main-navbar');
            if (navbar) {
                setHeight(navbar.offsetHeight);
            }
        };

        updateHeight();
        window.addEventListener('resize', updateHeight);
        const timeout = setTimeout(updateHeight, 100);

        return () => {
            window.removeEventListener('resize', updateHeight);
            clearTimeout(timeout);
        };
    }, []);

    return <div style={{height: `${height}px`}} />;
};