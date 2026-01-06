import React, {useEffect, useState} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import CustomAgenda from './CustomAgenda';
import MobileAgenda from './MobileAgenda';

const BackdropPortal = ({ isOpen, onClose }) => {
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            return () => document.body.style.overflow = 'unset';
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return createPortal(
        <>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
                className="fixed inset-0 bg-black/30 backdrop-blur-md z-[9998]"
            />
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9997] overflow-hidden"
            >
                <div className="absolute inset-0 bg-gray-900/80" />

                <div className="absolute top-1/4 left-1/4 w-96 h-96 animate-blob1">
                    <div className="absolute inset-0 bg-gradient-radial from-purple-500/40 via-fuchsia-500/30 to-transparent rounded-full mix-blend-screen blur-xl" />
                </div>

                <div className="absolute bottom-1/3 right-1/4 w-80 h-80 animate-blob2">
                    <div className="absolute inset-0 bg-gradient-radial from-blue-500/50 via-cyan-500/40 to-transparent rounded-full mix-blend-screen blur-xl" />
                </div>

                <div className="absolute top-1/2 left-1/3 w-72 h-72 animate-blob3">
                    <div className="absolute inset-0 bg-gradient-radial from-emerald-500/40 via-green-500/30 to-transparent rounded-full mix-blend-screen blur-xl" />
                </div>

                <div className="absolute bottom-1/4 right-1/3 w-64 h-64 animate-blob4">
                    <div className="absolute inset-0 bg-gradient-radial from-orange-500/40 via-amber-500/30 to-transparent rounded-full mix-blend-screen blur-xl" />
                </div>

                <div className="absolute top-1/3 right-1/4 w-80 h-80 animate-blob5">
                    <div className="absolute inset-0 bg-gradient-radial from-rose-500/40 via-pink-500/30 to-transparent rounded-full mix-blend-screen blur-xl" />
                </div>
            </motion.div>
        </>,
        document.body
    );
};

const AgendaTrigger = ({ isMobile, onClick }) => (
    <motion.button
        whileHover={{scale: 1.05}}
        whileTap={{scale: 0.95}}
        onClick={onClick}
        className={`
            ${isMobile
            ? 'flex flex-col items-center justify-center p-4 rounded-2xl bg-base-200 hover:bg-base-300 transition-colors'
            : 'btn btn-ghost btn-sm rounded-full hover:bg-primary/10 hover:text-primary flex items-center space-x-2'
        }
        `}
    >
        <svg
            className={`${isMobile ? 'w-6 h-6 mb-2' : 'w-4 h-4'}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
        >
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
        </svg>
        <span className={isMobile ? "mt-2 text-sm font-medium" : ""}>Agenda</span>
    </motion.button>
);

const AgendaModal = ({isOpen, onClose, isMobile, user}) => (
    <AnimatePresence mode="wait">
        {isOpen && (
            <>
                {isMobile ? (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
                            onClick={onClose}
                        />
                        <motion.div
                            className="fixed inset-0 z-30 overflow-hidden pointer-events-none"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                        >
                            <div className="absolute inset-0 bg-gray-900/50" />
                            <div className="absolute -top-20 left-10 w-64 h-64 animate-blob1">
                                <div className="absolute inset-0 bg-gradient-radial from-purple-500/30 via-fuchsia-500/20 to-transparent rounded-full mix-blend-screen blur-xl" />
                            </div>
                            <div className="absolute bottom-40 right-10 w-56 h-56 animate-blob2">
                                <div className="absolute inset-0 bg-gradient-radial from-blue-500/40 via-cyan-500/30 to-transparent rounded-full mix-blend-screen blur-xl" />
                            </div>
                            <div className="absolute top-60 left-20 w-48 h-48 animate-blob3">
                                <div className="absolute inset-0 bg-gradient-radial from-emerald-500/30 via-green-500/20 to-transparent rounded-full mix-blend-screen blur-xl" />
                            </div>
                        </motion.div>
                    </>
                ) : (
                    <BackdropPortal isOpen={isOpen} onClose={onClose} />
                )}
                <motion.div
                    initial={isMobile ? {y: '100%'} : {x: '100%'}}
                    animate={isMobile ? {y: 0} : {x: 0}}
                    exit={isMobile ? {y: '100%'} : {x: '100%'}}
                    transition={{type: 'spring', damping: 30, stiffness: 300}}
                    className={`
                        fixed
                        ${isMobile
                        ? 'inset-x-0 bottom-0 h-[90vh] rounded-t-3xl z-50 bg-base-100'
                        : 'top-0 right-0 h-screen w-[90vw] max-w-4xl z-[9999]'
                    }
                    `}
                >
                    <div className="relative h-full rounded-t-3xl">
                        <motion.button
                            whileHover={{scale: 1.1}}
                            whileTap={{scale: 0.9}}
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-gray-800 z-50"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"/>
                            </svg>
                        </motion.button>

                        {isMobile ? <MobileAgenda user={user}/> : <CustomAgenda user={user}/>}
                    </div>
                </motion.div>
            </>
        )}
    </AnimatePresence>
);

const AgendaButton = ({user, userType, isMobile}) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!user || !userType || userType === 'customer') return null;

    return (
        <>
            <AgendaTrigger
                isMobile={isMobile}
                onClick={() => setIsOpen(true)}
            />
            <AgendaModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                isMobile={isMobile}  // Add this line
                user={user}
            />
        </>
    );
};

export default AgendaButton;