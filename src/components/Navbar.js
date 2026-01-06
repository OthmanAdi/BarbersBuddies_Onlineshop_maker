import React, { useState, useEffect } from 'react';
import DesktopNavbar from './DesktopNavbar';
import MobileNavbar from './MobileNavbar';
import { NavbarSpacer } from './NavbarSpacer';
import {useLocation} from "react-router-dom";

const Navbar = () => {
    const [isMobile, setIsMobile] = useState(false);
    const [isAgendaOpen, setIsAgendaOpen] = useState(false);
    const location = useLocation(); // Add this

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 1024);
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    if (location.pathname === '/auth') {
        return null;
    }

    return (
        <>
            <NavbarSpacer />
            {isMobile ?
                <MobileNavbar isAgendaOpen={isAgendaOpen} /> :
                <DesktopNavbar onAgendaOpen={setIsAgendaOpen} />
            }
        </>
    );
};

export default Navbar;