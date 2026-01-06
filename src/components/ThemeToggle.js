import React, { useContext } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';
import ThemeContext from './ThemeContext';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);

    return (
        <motion.button
            className="btn btn-circle btn-ghost"
            onClick={toggleTheme}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            <AnimatedThemeIcon theme={theme} />
        </motion.button>
    );
};

// Animated icon with smooth transition between sun and moon
const AnimatedThemeIcon = ({ theme }) => {
    return (
        <div className="relative w-5 h-5">
            <motion.div
                initial={false}
                animate={{
                    scale: theme === 'dark' ? 1 : 0,
                    opacity: theme === 'dark' ? 1 : 0,
                    rotate: theme === 'dark' ? 0 : 180,
                }}
                transition={{ duration: 0.5, type: 'spring' }}
                className="absolute inset-0 flex items-center justify-center"
            >
                <Moon className="w-5 h-5" />
            </motion.div>

            <motion.div
                initial={false}
                animate={{
                    scale: theme === 'light' ? 1 : 0,
                    opacity: theme === 'light' ? 1 : 0,
                    rotate: theme === 'light' ? 0 : -180,
                }}
                transition={{ duration: 0.5, type: 'spring' }}
                className="absolute inset-0 flex items-center justify-center"
            >
                <Sun className="w-5 h-5" />
            </motion.div>
        </div>
    );
};

export default ThemeToggle;