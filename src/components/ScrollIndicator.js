import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

const ScrollIndicator = ({ hasTeamMembers }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        if (!hasTeamMembers) return;

        const handleScroll = () => {
            // Get the team section
            const teamSection = document.getElementById('team-section');
            if (!teamSection) return;

            // Calculate when to hide the arrow
            const teamSectionTop = teamSection.getBoundingClientRect().top;
            setIsVisible(teamSectionTop > window.innerHeight);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [hasTeamMembers]);

    if (!hasTeamMembers) return null;

    return (
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{
                        opacity: 1,
                        y: 0,
                        transition: { duration: 0.3 }
                    }}
                    exit={{
                        opacity: 0,
                        y: 20,
                        transition: { duration: 0.2 }
                    }}
                    className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50"
                >
                    <motion.div
                        animate={{
                            y: [0, 10, 0],
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="flex flex-col items-center gap-2"
                    >
                        <div className="text-sm font-medium text-base-content/70">
                            Meet Our Team
                        </div>
                        <div className="bg-base-100 shadow-lg rounded-full p-2">
                            <ChevronDown className="w-6 h-6 text-primary" />
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ScrollIndicator;