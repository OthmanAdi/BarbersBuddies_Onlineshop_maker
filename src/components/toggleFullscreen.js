import React, {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {Maximize2, Minimize2} from 'lucide-react';

const FullscreenEditorWrapper = ({children, editorRef}) => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [editorContent, setEditorContent] = useState('');

    useEffect(() => {
        if (isFullscreen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isFullscreen]);

    const toggleFullscreen = () => {
        if (!isFullscreen && editorRef.current) {
            setEditorContent(editorRef.current.getContent());
        }
        setIsFullscreen(!isFullscreen);
        setTimeout(() => {
            if (editorRef.current) {
                if (isFullscreen) {
                    editorRef.current.execCommand('mceAutoResize');
                } else {
                    editorRef.current.setContent(editorContent);
                    editorRef.current.execCommand('mceAutoResize');
                }
            }
        }, 300);
    };

    return (
        <div className="relative">
            <AnimatePresence mode="wait">
                <motion.div
                    key={isFullscreen ? 'fullscreen' : 'normal'}
                    initial={false}
                    animate={{
                        position: isFullscreen ? 'fixed' : 'relative',
                        top: isFullscreen ? 0 : 'auto',
                        left: isFullscreen ? 0 : 'auto',
                        right: isFullscreen ? 0 : 'auto',
                        bottom: isFullscreen ? 0 : 'auto',
                        width: '100%',
                        height: isFullscreen ? '100%' : 'auto',
                        zIndex: isFullscreen ? 50 : 1
                    }}
                    transition={{type: 'spring', damping: 20, stiffness: 300}}
                    className={`bg-base-100 ${isFullscreen ? 'pt-16 px-4 pb-4' : ''}`}
                >
                    <motion.button
                        onClick={toggleFullscreen}
                        className="absolute left-4 z-50 btn btn-circle btn-sm bg-base-100 shadow-lg hover:shadow-xl border-none"
                        whileHover={{scale: 1.05}}
                        whileTap={{scale: 0.95}}
                        initial={false}
                        animate={{
                            opacity: 1,
                            top: isFullscreen ? '1rem' : '0.5rem',
                            left: isFullscreen ? '1rem' : '0.5rem'
                        }}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="w-4 h-4"/>
                        ) : (
                            <Maximize2 className="w-4 h-4"/>
                        )}
                    </motion.button>

                    <motion.div
                        initial={false}
                        animate={{
                            marginTop: isFullscreen ? '3rem' : 0
                        }}
                        className={`relative ${isFullscreen ? 'h-[calc(100vh-7rem)] overflow-hidden' : ''}`}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default FullscreenEditorWrapper;