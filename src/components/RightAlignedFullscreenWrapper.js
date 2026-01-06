import React, {useEffect} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {Maximize2, Minimize2} from 'lucide-react';

const RightAlignedFullscreenWrapper = ({children, editorRef, isFullscreen, setIsFullscreen}) => {
    useEffect(() => {
        if (isFullscreen) {
            document.body.style.overflow = 'hidden';
            if (editorRef.current) {
                const editor = editorRef.current;
                // Increased height to 95vh for more space
                setTimeout(() => {
                    editor.editorManager.activeEditor.theme.resizeTo('100%', '95vh');
                }, 100);
            }
        } else {
            document.body.style.overflow = 'unset';
            if (editorRef.current) {
                const editor = editorRef.current;
                editor.editorManager.activeEditor.theme.resizeTo('100%', '500px');
            }
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isFullscreen]);

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);

        setTimeout(() => {
            if (editorRef.current) {
                const editor = editorRef.current.editorManager.activeEditor;
                if (!isFullscreen) {
                    editor.theme.resizeTo('100%', '95vh');  // Increased to 95vh
                } else {
                    editor.theme.resizeTo('100%', '500px');
                }
            }
        }, 100);
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
                        zIndex: isFullscreen ? 9999 : 1
                    }}
                    transition={{type: 'spring', damping: 20, stiffness: 300}}
                    className={`bg-base-100 ${isFullscreen ? 'pt-12 px-4 pb-2' : ''}`} // Reduced padding
                >
                    <div
                        className="absolute w-full h-10 top-0 left-0 bg-base-100 shadow-sm" // Reduced header height
                        style={{
                            zIndex: 100000,
                            display: isFullscreen ? 'block' : 'none'
                        }}
                    />

                    <motion.button
                        onClick={toggleFullscreen}
                        className={`absolute right-4 btn btn-circle btn-sm shadow-lg hover:shadow-xl border-none ${
                            isFullscreen
                                ? 'bg-primary hover:bg-primary-focus text-primary-content'
                                : 'bg-base-100'
                        }`}
                        whileHover={{scale: 1.05}}
                        whileTap={{scale: 0.95}}
                        initial={false}
                        style={{
                            zIndex: 100001,
                            top: isFullscreen ? '0.5rem' : '0.5rem', // Adjusted top position
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
                            marginTop: isFullscreen ? '2rem' : 0 // Reduced margin
                        }}
                        className={`relative ${isFullscreen ? 'h-[calc(100vh-3rem)]' : ''}`} // Increased height
                        style={{
                            zIndex: isFullscreen ? 99999 : 1
                        }}
                    >
                        {children}
                    </motion.div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
};

export default RightAlignedFullscreenWrapper;