import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {AlertCircle} from 'lucide-react';

const AuthAlert = ({message, isVisible, onClose}) => {
    const [progress, setProgress] = useState(100);

    useEffect(() => {
        if (isVisible) {
            setProgress(100);
            const timer = setInterval(() => {
                setProgress(prev => Math.max(0, prev - 1));
            }, 30);

            const hideTimer = setTimeout(() => {
                onClose();
            }, 3000);

            return () => {
                clearInterval(timer);
                clearTimeout(hideTimer);
            };
        }
    }, [isVisible, onClose]);

    return (
        <AnimatePresence>
            {isVisible && (
                <div className="fixed inset-0 pointer-events-none" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 99999,
                    WebkitTransform: 'translate3d(0,0,0)'
                }}>
                    <motion.div
                        initial={{y: -100, opacity: 0}}
                        animate={{y: 0, opacity: 1}}
                        exit={{y: -100, opacity: 0}}
                        className="absolute top-4 left-0 right-0 mx-auto w-[calc(100%-2rem)] max-w-sm px-4 sm:px-0 pointer-events-auto"
                        onClick={onClose}
                        style={{
                            WebkitTransform: 'translate3d(0,0,0)',
                            transform: 'translate3d(0,0,0)'
                        }}
                    >
                        <div
                            className="bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-800 rounded-lg shadow-lg overflow-hidden">
                            <div className="p-4 flex items-center gap-3">
                                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0"/>
                                <p className="text-sm font-medium text-red-700 dark:text-red-300">
                                    {message}
                                </p>
                            </div>
                            <div className="h-1 w-full bg-gray-100 dark:bg-gray-800">
                                <motion.div
                                    className="h-full bg-blue-500 dark:bg-blue-400"
                                    initial={{width: "100%"}}
                                    animate={{width: `${progress}%`}}
                                    transition={{duration: 0.1}}
                                />
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default AuthAlert;