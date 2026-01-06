import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {X} from 'lucide-react';

const VideoModal = ({isOpen, onClose}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        initial={{opacity: 0}}
                        animate={{opacity: 1}}
                        exit={{opacity: 0}}
                        className="fixed inset-0 z-50"
                    >
                        {/* Gradient background blur */}
                        <div
                            className="absolute inset-0 bg-gradient-to-br from-purple-500/30 via-blue-500/30 to-pink-500/30 backdrop-blur-xl">
                            <div className="absolute inset-0 animate-gradient-xy">
                                <div
                                    className="absolute inset-0 bg-gradient-to-br from-purple-600/20 via-blue-600/20 to-pink-600/20 animate-pulse"/>
                                <div
                                    className="absolute inset-0 bg-gradient-to-tl from-blue-500/20 via-purple-500/20 to-pink-500/20 animate-pulse delay-75"/>
                            </div>
                        </div>

                        {/* Modal Container */}
                        <div className="fixed inset-0 flex items-start justify-center pt-16">
                            <motion.div
                                initial={{scale: 0.9, opacity: 0, y: 20}}
                                animate={{scale: 1, opacity: 1, y: 0}}
                                exit={{scale: 0.9, opacity: 0, y: 20}}
                                transition={{type: "spring", duration: 0.5}}
                                className="relative w-[90%] max-w-[1400px]"
                            >
                                {/* 3D Frame Container */}
                                <div className="relative rounded-2xl overflow-hidden transform-gpu transition-transform hover:scale-[1.02]
                                    shadow-[0_0_0_2px_rgba(255,255,255,0.3),0_0_0_4px_rgba(255,255,255,0.2),
                                    0_8px_16px_rgba(0,0,0,0.3),0_16px_32px_rgba(0,0,0,0.15)]
                                    before:absolute before:inset-0 before:rounded-2xl before:p-[2px]
                                    before:bg-gradient-to-r before:from-white/30 before:to-white/10
                                    before:content-[''] after:absolute after:inset-[2px] after:rounded-xl
                                    after:bg-gradient-to-br after:from-black/90 after:to-black/70
                                    after:content-['']"
                                >
                                    {/* Video Container */}
                                    <div className="relative z-10 aspect-video rounded-xl overflow-hidden
                                        ring-1 ring-white/20 bg-black/90">
                                        <iframe
                                            className="absolute top-0 left-0 w-full h-full"
                                            src="https://www.youtube.com/embed/dQw4w9WgXcQ"
                                            title="YouTube video player"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        />
                                    </div>

                                    {/* Close Button */}
                                    <motion.button
                                        onClick={onClose}
                                        whileHover={{scale: 1.1}}
                                        whileTap={{scale: 0.95}}
                                        className="absolute top-4 right-4 z-20 p-2 rounded-full
                                            bg-white/10 backdrop-blur-md
                                            border border-white/20 shadow-lg
                                            hover:bg-white/20 transition-colors
                                            group"
                                    >
                                        <X className="w-6 h-6 text-white/90 group-hover:text-white"/>
                                    </motion.button>
                                </div>
                            </motion.div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// Usage Example
const DemoSection = () => {
    const [isModalOpen, setIsModalOpen] = React.useState(false);

    return (
        <>
            <button
                onClick={() => setIsModalOpen(true)}
                className="btn btn-lg group relative overflow-hidden bg-gradient-to-r from-rose-500 to-orange-500 border-0 hover:from-rose-600 hover:to-orange-600 dark:from-rose-400 dark:to-orange-400 dark:hover:from-rose-500 dark:hover:to-orange-500 text-white"
            >
                Watch Demo
                <span className="absolute right-4 transition-transform duration-200 group-hover:translate-x-1">
          →
        </span>
            </button>

            <VideoModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
            />
        </>
    );
};

export default DemoSection;