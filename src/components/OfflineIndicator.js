import React, {useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {ChevronLeft, ChevronRight, Heart, Image, RefreshCw, Scissors, WifiOff, X} from 'lucide-react';

// Predefined hairstyles that will be available offline
const CACHED_STYLES = [
    {
        id: 1,
        name: 'Classic Fade',
        image: '/api/placeholder/400/300',
        description: 'Clean and professional look'
    },
    {
        id: 2,
        name: 'Modern Pompadour',
        image: '/api/placeholder/400/300',
        description: 'Stylish and bold'
    },
    {
        id: 3,
        name: 'Textured Crop',
        image: '/api/placeholder/400/300',
        description: 'Low maintenance, high style'
    },
    // Add more styles as needed
];

const StyleGallery = ({isOpen, onClose}) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [favorites, setFavorites] = useState(() => {
        const saved = localStorage.getItem('favoriteStyles');
        return saved ? JSON.parse(saved) : [];
    });

    const toggleFavorite = (styleId) => {
        setFavorites(prev => {
            const newFavorites = prev.includes(styleId)
                ? prev.filter(id => id !== styleId)
                : [...prev, styleId];
            localStorage.setItem('favoriteStyles', JSON.stringify(newFavorites));
            return newFavorites;
        });
    };

    const navigateGallery = (direction) => {
        setCurrentIndex(prev => {
            if (direction === 'next') {
                return prev === CACHED_STYLES.length - 1 ? 0 : prev + 1;
            }
            return prev === 0 ? CACHED_STYLES.length - 1 : prev - 1;
        });
    };

    const currentStyle = CACHED_STYLES[currentIndex];

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    exit={{opacity: 0}}
                    className="fixed inset-0 z-[100000] bg-black/50 backdrop-blur-sm flex items-center justify-center"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{y: 50, opacity: 0}}
                        animate={{y: 0, opacity: 1}}
                        exit={{y: 50, opacity: 0}}
                        // Remove absolute positioning and transform, use flex centering instead
                        className="w-full max-w-md mx-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="bg-base-100 rounded-xl shadow-xl overflow-hidden">
                            {/* Header */}
                            <div className="p-4 border-b border-base-200 flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Style Gallery</h3>
                                <button
                                    onClick={onClose}
                                    className="btn btn-ghost btn-sm btn-circle"
                                >
                                    <X className="w-5 h-5"/>
                                </button>
                            </div>

                            {/* Gallery */}
                            <div className="relative">
                                <motion.img
                                    key={currentStyle.id}
                                    src={currentStyle.image}
                                    alt={currentStyle.name}
                                    className="w-full h-64 object-cover"
                                    initial={{opacity: 0, x: 50}}
                                    animate={{opacity: 1, x: 0}}
                                    exit={{opacity: 0, x: -50}}
                                    transition={{type: "spring", stiffness: 300, damping: 30}}
                                />

                                {/* Navigation buttons */}
                                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4">
                                    <motion.button
                                        whileHover={{scale: 1.1}}
                                        whileTap={{scale: 0.9}}
                                        className="btn btn-circle btn-sm bg-black/30 text-white hover:bg-black/50"
                                        onClick={() => navigateGallery('prev')}
                                    >
                                        <ChevronLeft className="w-5 h-5"/>
                                    </motion.button>
                                    <motion.button
                                        whileHover={{scale: 1.1}}
                                        whileTap={{scale: 0.9}}
                                        className="btn btn-circle btn-sm bg-black/30 text-white hover:bg-black/50"
                                        onClick={() => navigateGallery('next')}
                                    >
                                        <ChevronRight className="w-5 h-5"/>
                                    </motion.button>
                                </div>

                                {/* Favorite button */}
                                <motion.button
                                    whileHover={{scale: 1.1}}
                                    whileTap={{scale: 0.9}}
                                    className="absolute top-4 right-4 btn btn-circle btn-sm"
                                    onClick={() => toggleFavorite(currentStyle.id)}
                                >
                                    <Heart
                                        className={`w-5 h-5 ${
                                            favorites.includes(currentStyle.id)
                                                ? 'fill-red-500 text-red-500'
                                                : 'text-white'
                                        }`}
                                    />
                                </motion.button>
                            </div>

                            {/* Style info */}
                            <div className="p-4">
                                <h4 className="font-semibold text-lg">{currentStyle.name}</h4>
                                <p className="text-base-content/70 mt-1">{currentStyle.description}</p>
                            </div>

                            {/* Progress indicators */}
                            <div className="flex justify-center gap-1 p-4">
                                {CACHED_STYLES.map((style, index) => (
                                    <div
                                        key={style.id}
                                        className={`w-2 h-2 rounded-full transition-all duration-300 ${
                                            index === currentIndex
                                                ? 'w-4 bg-primary'
                                                : 'bg-base-300'
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const OfflineIndicator = () => {
    const [isGalleryOpen, setIsGalleryOpen] = useState(false);

    const containerVariants = {
        hidden: {opacity: 0},
        visible: {
            opacity: 1,
            transition: {
                when: "beforeChildren",
                staggerChildren: 0.2
            }
        }
    };

    const itemVariants = {
        hidden: {y: 20, opacity: 0},
        visible: {
            y: 0,
            opacity: 1,
            transition: {type: "spring", stiffness: 300, damping: 24}
        }
    };

    // Gentle shifting animation for scissors
    const shiftTransition = {
        x: {
            duration: 4,
            repeat: Infinity,
            repeatType: "reverse",
            ease: "easeInOut",
            range: [-10, 10]
        }
    };

    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <>
            <motion.div
                className="fixed inset-0 z-[99999] bg-base-100 isolate flex items-center justify-center p-4"
                variants={containerVariants}
                initial="hidden"
                animate="visible"
            >
                {/* Scissors above container */}
                <motion.div
                    className="absolute top-0 left-1/2 -translate-x-1/2 text-base-content/5 pt-20"
                    animate={{x: [-10, 10]}}
                    transition={shiftTransition}
                >
                    <Scissors className="w-32 h-32"/>
                </motion.div>

                <div className="w-full max-w-md mt-24">
                    <motion.div
                        className="relative rounded-xl bg-base-100 shadow-lg border border-base-300 p-8 text-center"
                        variants={itemVariants}
                    >
                        {/* Main content */}
                        <motion.div
                            className="relative z-10 space-y-6"
                            variants={itemVariants}
                        >
                            <motion.div variants={itemVariants} className="space-y-2">
                                <div className="flex items-center justify-center gap-2 text-error">
                                    <WifiOff className="w-5 h-5"/>
                                    <span className="font-semibold">No Internet Connection</span>
                                </div>
                                <p className="text-base-content/70">
                                    Please check your internet connection and try again
                                </p>
                            </motion.div>

                            <div className="flex flex-col gap-3">
                                <motion.button
                                    variants={itemVariants}
                                    whileHover={{scale: 1.05}}
                                    whileTap={{scale: 0.95}}
                                    onClick={handleRefresh}
                                    className="btn btn-primary gap-2"
                                >
                                    <RefreshCw className="w-4 h-4"/>
                                    Retry Connection
                                </motion.button>

                                <motion.button
                                    variants={itemVariants}
                                    whileHover={{scale: 1.05}}
                                    whileTap={{scale: 0.95}}
                                    onClick={() => setIsGalleryOpen(true)}
                                    className="btn btn-secondary gap-2"
                                >
                                    <Image className="w-4 h-4"/>
                                    Browse Hairstyles
                                </motion.button>
                            </div>
                        </motion.div>

                        {/* Softer progress bars */}
                        <div className="absolute bottom-0 left-0 w-full h-1 overflow-hidden">
                            <motion.div
                                className="absolute right-1/2 h-full bg-primary/40"
                                initial={{width: "0%"}}
                                animate={{width: "50%"}}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    repeatType: "reverse",
                                    ease: "easeInOut"
                                }}
                            />
                            <motion.div
                                className="absolute left-1/2 h-full bg-primary/40"
                                initial={{width: "0%"}}
                                animate={{width: "50%"}}
                                transition={{
                                    duration: 3,
                                    repeat: Infinity,
                                    repeatType: "reverse",
                                    ease: "easeInOut"
                                }}
                            />
                        </div>
                    </motion.div>
                </div>
            </motion.div>

            <StyleGallery
                isOpen={isGalleryOpen}
                onClose={() => setIsGalleryOpen(false)}
            />
        </>
    );
};

export default OfflineIndicator;