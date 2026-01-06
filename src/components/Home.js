import React, {useEffect, useRef, useState} from 'react';
import {AnimatePresence, motion, useAnimation, useMotionValue, useTransform} from 'framer-motion';
import {
    BarChart,
    Bell,
    Calendar,
    ChevronDown,
    ChevronUp,
    CreditCard,
    Languages,
    Star,
    Store,
    Users
} from 'lucide-react';
import '../App.css';
import {useParticleEffects} from "../hooks/useParticleEffects";
import Footer from "./Footer";
import ZPatternHero from "./ZPatternHero";

const useDaisyTheme = () => {
    const [isDark, setIsDark] = useState(false);

    useEffect(() => {
        // Initial check
        const htmlElement = document.documentElement;
        setIsDark(htmlElement.getAttribute('data-theme') === 'luxury');

        // Create observer
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'data-theme') {
                    setIsDark(htmlElement.getAttribute('data-theme') === 'luxury');
                }
            });
        });

        // Start observing
        observer.observe(htmlElement, {
            attributes: true,
            attributeFilter: ['data-theme']
        });

        return () => observer.disconnect();
    }, []);

    return isDark;
};

const MobileNavigation = ({activeIndex, total, setActiveIndex}) => {
    return (
        <div
            className="">
            {/* Main Navigation */}
            <div className="flex items-center justify-between">
                <motion.div
                    initial={{x: -20, opacity: 0}}
                    animate={{x: 0, opacity: 1}}
                    className="flex items-center gap-2"
                >
                    <div className="text-white/90 font-medium">
                        <span className="text-xl">{activeIndex + 1}</span>
                        <span className="text-sm text-white/60">/{total}</span>
                    </div>
                </motion.div>

                <div className="flex gap-2">
                    <button
                        onClick={() => activeIndex > 0 && setActiveIndex(activeIndex - 1)}
                        className={`p-2 rounded-full ${activeIndex === 0 ? 'opacity-30' : 'bg-white/10 hover:bg-white/20'}`}
                        disabled={activeIndex === 0}
                    >
                        <motion.div
                            whileHover={{x: -2}}
                            whileTap={{scale: 0.95}}
                        >
                            <ChevronUp className="w-6 h-6 text-white"/>
                        </motion.div>
                    </button>
                    <button
                        onClick={() => activeIndex < total - 1 && setActiveIndex(activeIndex + 1)}
                        className={`p-2 rounded-full ${activeIndex === total - 1 ? 'opacity-30' : 'bg-white/10 hover:bg-white/20'}`}
                        disabled={activeIndex === total - 1}
                    >
                        <motion.div
                            whileHover={{x: 2}}
                            whileTap={{scale: 0.95}}
                        >
                            <ChevronDown className="w-6 h-6 text-white"/>
                        </motion.div>
                    </button>
                </div>
            </div>
        </div>
    );
};

const MobileCard = ({feature, isActive}) => {
    return (
        <motion.div
            className="min-h-fit px-4 pt-20 pb-8 flex flex-col"
            initial={false}
            animate={{
                opacity: isActive ? 1 : 0,
                y: isActive ? 0 : 100,
            }}
            transition={{
                type: "spring",
                stiffness: 300,
                damping: 30
            }}
        >
            {/* Enhanced Header Section */}
            <motion.div
                className="mb-6"
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
            >
                <div className="flex flex-col items-start gap-4 mb-4">
                    <div className="flex items-center gap-3 w-full">
                        <div
                            className={`p-3.5 rounded-2xl ${feature.gradient} shadow-lg transform hover:scale-105 transition-transform duration-300`}>
                            <feature.icon
                                className="w-7 h-7 text-white transform hover:rotate-12 transition-transform duration-300"/>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-white mb-0.5 tracking-tight">
                                {feature.title}
                            </h2>
                            <p className="text-white/70 text-base font-medium">
                                {feature.subtitle}
                            </p>
                        </div>
                    </div>

                    {/* New: Feature highlight tag */}
                    <div
                        className="inline-flex items-center px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                        <span className="text-white/90 text-sm font-medium">✨ Most Popular Feature</span>
                    </div>
                </div>

                {/* Enhanced description with better typography */}
                <p className="text-white/80 text-lg leading-relaxed font-medium">
                    {feature.description}
                </p>
            </motion.div>

            {/* Enhanced Features Grid */}
            <div className="grid grid-cols-1 gap-3">
                {feature.features.map((item, idx) => (
                    <motion.div
                        key={idx}
                        initial={{opacity: 0, x: -20}}
                        animate={{opacity: 1, x: 0}}
                        transition={{delay: idx * 0.1}}
                        className={`
                            group p-4 rounded-xl bg-gradient-to-br from-white/10 to-white/5
                            border border-white/10 backdrop-blur-md hover:from-white/15 hover:to-white/10
                            transition-all duration-300 ease-in-out transform hover:scale-[1.02]
                            hover:border-white/20 cursor-pointer
                        `}
                    >
                        <div className="flex items-start gap-3">
                            {/* Feature icon indicator */}
                            <div
                                className="mt-1 w-1.5 h-1.5 rounded-full bg-white/40 group-hover:bg-white/80 transition-colors"/>

                            <div className="flex-1">
                                <p className="text-white text-base font-medium leading-snug">
                                    {item}
                                </p>
                                {/* New: Feature detail text */}
                                <p className="mt-1 text-white/60 text-sm">
                                    {getFeatureDetail(item)}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Enhanced CTA Section */}
            <motion.div
                className="mt-8 flex flex-col gap-3"
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
            >
                <button className={`
                    w-full py-4 px-6 rounded-xl text-lg font-semibold text-white
                    ${feature.gradient} transform transition-all duration-300
                    hover:scale-[1.02] active:scale-98 hover:shadow-lg
                    flex items-center justify-center gap-2
                `}>
                    Try {feature.title.split(' ')[0]}
                    <span className="text-white/80">→</span>
                </button>
                <p className="text-center text-white/60 text-sm">
                    {getCtaSubtext(feature.title)}
                </p>
            </motion.div>
        </motion.div>
    );
};

// Helper function to generate feature details
const getFeatureDetail = (feature) => {
    const details = {};
    return details[feature] || "Enhanced feature for your business";
};

// Helper function for CTA subtext
const getCtaSubtext = (title) => {
    if (title.includes("Booking")) return "30-day free trial • No credit card required";
    if (title.includes("Management")) return "Streamline your operations today";
    return "Start optimizing your business now";
};

// Mobile View Container
const MobileFeatureView = ({features, activeIndex, setActiveIndex}) => {
    const [touchStart, setTouchStart] = useState({x: 0});  // Changed from y to x
    const [swipeDirection, setSwipeDirection] = useState(null);

    const handleTouchStart = (e) => {
        setTouchStart({x: e.touches[0].clientX});  // Changed from clientY to clientX
    };

    const handleTouchMove = (e) => {
        if (!touchStart.x) return;

        const currentX = e.touches[0].clientX;  // Changed from clientY to clientX
        const diff = touchStart.x - currentX;  // Changed direction calculation

        if (Math.abs(diff) > 50) { // Threshold
            setSwipeDirection(diff > 0 ? 'left' : 'right');  // Changed from up/down to left/right
        }
    };

    const handleTouchEnd = () => {
        if (swipeDirection === 'left' && activeIndex < features.length - 1) {  // Changed from up to left
            setActiveIndex(activeIndex + 1);
        } else if (swipeDirection === 'right' && activeIndex > 0) {  // Changed from down to right
            setActiveIndex(activeIndex - 1);
        }

        setTouchStart({x: 0});  // Reset x instead of y
        setSwipeDirection(null);
    };

    return (
        <div className="relative min-h-fit overflow-hidden"
             onTouchStart={handleTouchStart}
             onTouchMove={handleTouchMove}
             onTouchEnd={handleTouchEnd}
        >
            {/* Navigation */}
            {/*<MobileNavigation*/}
            {/*    activeIndex={activeIndex}*/}
            {/*    total={features.length}*/}
            {/*    setActiveIndex={setActiveIndex}*/}
            {/*/>*/}

            {/* Cards Container */}
            <AnimatePresence mode="wait">
                <MobileCard
                    key={features[activeIndex].id}
                    feature={features[activeIndex]}
                    isActive={true}
                />
            </AnimatePresence>

            {/* Swipe Indicator */}
            <motion.div
                className="fixed bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-sm flex items-center gap-2"
                animate={{opacity: [0.4, 0.8, 0.4]}}
                transition={{duration: 2, repeat: Infinity}}
            >
                {/*<ChevronUp className="w-4 h-4" />*/}
                {/*Swipe to explore*/}
                {/*<ChevronDown className="w-4 h-4" />*/}
            </motion.div>
        </div>
    );
};

const NavigationBar = ({features, activeIndex, setActiveIndex}) => {
    return (
        <div className="w-full flex justify-center z-50">
            <motion.div
                initial={{opacity: 0, y: -20}}
                animate={{opacity: 1, y: 0}}
                className="inline-flex bg-black/20 backdrop-blur-md rounded-2xl
                         border border-white/10 shadow-2xl mx-auto"
            >
                <div className="flex items-center px-4 md:px-16 py-2 relative">
                    {/* Left Arrow */}
                    <motion.button
                        onClick={() => activeIndex > 0 && setActiveIndex(activeIndex - 1)}
                        className={`absolute left-2 p-2 rounded-full bg-black/20 backdrop-blur-md 
                                  border border-white/10
                                  ${activeIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/30'}`}
                        whileHover={activeIndex > 0 ? {scale: 1.1} : {}}
                        whileTap={activeIndex > 0 ? {scale: 0.9} : {}}
                        disabled={activeIndex === 0}
                    >
                        <motion.svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            className="text-white"
                        >
                            <path
                                d="M12 4l-6 6 6 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </motion.svg>
                    </motion.button>

                    {/* Navigation - Desktop */}
                    <div className="hidden md:flex items-center gap-1">
                        {features.map((feature, index) => (
                            <motion.button
                                key={feature.id}
                                onClick={() => setActiveIndex(index)}
                                className={`relative px-4 py-2 rounded-xl transition-all
                                         ${activeIndex === index
                                    ? 'text-white'
                                    : 'text-white/50 hover:text-white/80'}`}
                                whileHover={{scale: 1.05}}
                                whileTap={{scale: 0.95}}
                            >
                                <span className="relative z-10 text-sm font-medium whitespace-nowrap">
                                    {feature.title.split(' ')[0]}
                                </span>

                                {activeIndex === index && (
                                    <motion.div
                                        className={`absolute inset-0 rounded-xl ${feature.gradient}`}
                                        layoutId="activeTab"
                                        initial={{opacity: 0}}
                                        animate={{opacity: 1}}
                                        exit={{opacity: 0}}
                                        transition={{type: "spring", bounce: 0.2, duration: 0.6}}
                                    />
                                )}
                            </motion.button>
                        ))}
                    </div>

                    {/* Navigation - Mobile & Tablet */}
                    <div className="md:hidden flex items-center justify-center min-w-[180px]">
                        <motion.div
                            className="relative px-4 py-2 rounded-xl"
                            layout
                        >
                            <span className="relative z-10 text-sm font-medium text-white whitespace-nowrap">
                                {features[activeIndex].title.split(' ')[0]}
                            </span>
                            <motion.div
                                className={`absolute inset-0 rounded-xl ${features[activeIndex].gradient}`}
                                layoutId="activeTabMobile"
                                initial={{opacity: 0}}
                                animate={{opacity: 1}}
                                exit={{opacity: 0}}
                                transition={{type: "spring", bounce: 0.2, duration: 0.6}}
                            />
                        </motion.div>
                    </div>

                    {/* Right Arrow */}
                    <motion.button
                        onClick={() => activeIndex < features.length - 1 && setActiveIndex(activeIndex + 1)}
                        className={`absolute right-2 p-2 rounded-full bg-black/20 backdrop-blur-md 
                                  border border-white/10
                                  ${activeIndex === features.length - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-black/30'}`}
                        whileHover={activeIndex < features.length - 1 ? {scale: 1.1} : {}}
                        whileTap={activeIndex < features.length - 1 ? {scale: 0.9} : {}}
                        disabled={activeIndex === features.length - 1}
                    >
                        <motion.svg
                            width="20"
                            height="20"
                            viewBox="0 0 20 20"
                            fill="none"
                            className="text-white"
                        >
                            <path
                                d="M8 4l6 6-6 6"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </motion.svg>
                    </motion.button>
                </div>
            </motion.div>
        </div>
    );
};

// Particle Component
const Particle = () => {
    const {randomStart} = useParticleEffects();
    const [position, setPosition] = useState(randomStart());

    useEffect(() => {
        const duration = 15000 + Math.random() * 10000;
        const animate = () => {
            const newPosition = randomStart();
            setPosition(newPosition);
            setTimeout(animate, duration);
        };

        setTimeout(animate, duration);
    }, []);

    return (
        <motion.div
            className="absolute w-2 h-2 bg-white rounded-full pointer-events-none"
            animate={{
                x: [position.x, position.x + (Math.random() - 0.5) * 100],
                y: [position.y, position.y + (Math.random() - 0.5) * 100],
                scale: [position.scale, position.scale * 1.2],
                opacity: [position.opacity, 0]
            }}
            transition={{
                duration: 10,
                ease: "linear",
                repeat: Infinity,
                repeatType: "reverse"
            }}
        />
    );
};

// ParticleField Component
const ParticleField = () => {
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    if (isMobile) return null;

    return (
        <div className="fixed inset-0 pointer-events-none">
            {Array.from({length: 50}).map((_, i) => (
                <Particle key={i}/>
            ))}
        </div>
    );
};

const FeatureDeck = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const deckRef = useRef(null);
    const controls = useAnimation();
    const isDark = useDaisyTheme();
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const features = [
        {
            id: 1,
            title: "Smart Booking System",
            subtitle: "AI-Powered Scheduling",
            description: "Intelligent appointment management with automated scheduling and conflict resolution.",
            icon: Calendar,
            gradient: "from-rose-500 to-orange-500",
            features: [
                "Smart conflict prevention",
                "Real-time availability",
                "Multi-staff support",
                "Automated reminders"
            ]
        },
        {
            id: 2,
            title: "Shop Management",
            subtitle: "Complete Business Control",
            description: "Comprehensive dashboard for managing your entire barbershop operation.",
            icon: Store,
            gradient: "from-blue-500 to-purple-600",
            features: [
                "Inventory tracking",
                "Staff management",
                "Service catalog",
                "Financial reports"
            ]
        },
        {
            id: 3,
            title: "Client Dashboard",
            subtitle: "Customer Experience",
            description: "Personalized client profiles with history, preferences, and recommendations.",
            icon: Users,
            gradient: "from-green-400 to-cyan-500",
            features: [
                "Booking history",
                "Preference tracking",
                "Loyalty rewards",
                "Digital receipts"
            ]
        },
        {
            id: 4,
            title: "Reviews & Ratings",
            subtitle: "Reputation Management",
            description: "Collect and manage customer feedback and ratings automatically.",
            icon: Star,
            gradient: "from-yellow-400 to-orange-500",
            features: [
                "Automated collection",
                "Response management",
                "Rating analytics",
                "Social integration"
            ]
        },
        {
            id: 5,
            title: "Payment Processing",
            subtitle: "Seamless Transactions",
            description: "Secure and flexible payment options for your customers.",
            icon: CreditCard,
            gradient: "from-purple-500 to-pink-500",
            features: [
                "Multiple methods",
                "Secure processing",
                "Automatic receipts",
                "Subscription support"
            ]
        },
        {
            id: 6,
            title: "Analytics Dashboard",
            subtitle: "Business Intelligence",
            description: "Comprehensive insights into your business performance.",
            icon: BarChart,
            gradient: "from-indigo-500 to-blue-600",
            features: [
                "Revenue tracking",
                "Customer analytics",
                "Staff performance",
                "Trend analysis"
            ]
        },
        {
            id: 7,
            title: "Multi-language",
            subtitle: "Global Support",
            description: "Full multilingual support for international customers.",
            icon: Languages,
            gradient: "from-teal-400 to-emerald-500",
            features: [
                "Auto-translation",
                "Regional settings",
                "Currency conversion",
                "Local formatting"
            ]
        },
        {
            id: 8,
            title: "Notification System",
            subtitle: "Smart Communications",
            description: "Automated client and staff notifications across multiple channels.",
            icon: Bell,
            gradient: "from-red-500 to-rose-600",
            features: [
                "SMS alerts",
                "Email notifications",
                "Push messages",
                "Custom templates"
            ]
        }
    ];

    const Card = ({feature, index, isActive, ...props}) => {
        const getCardPosition = () => {
            const positionOffset = index - activeIndex;
            const baseOffset = 40;
            const rotationFactor = 3;
            const scaleFactor = 0.04;
            const maxOffset = 200;
            const boundedOffset = Math.min(Math.abs(positionOffset), 3) * Math.sign(positionOffset);

            return {
                x: boundedOffset * baseOffset,
                y: Math.min(Math.abs(positionOffset) * baseOffset * 0.6, maxOffset),
                rotate: boundedOffset * rotationFactor,
                scale: 1 - Math.min(Math.abs(positionOffset), 3) * scaleFactor
            };
        };

        const position = getCardPosition();
        const springConfig = {
            type: "spring",
            stiffness: isActive ? 400 : 350,
            damping: 32,
            mass: 1.2,
            restDelta: 0.001,
            velocity: 2
        };
        const zIndex = features.length - Math.abs(activeIndex - index);
        const cardControls = useAnimation();
        const mouseX = useMotionValue(0);
        const mouseY = useMotionValue(0);
        const rotateX = useTransform(mouseY, [-100, 100], [5, -5]);
        const rotateY = useTransform(mouseX, [-100, 100], [-5, 5]);
        const cardRef = useRef(null);
        const dragStartX = useRef(0);
        const dragEndX = useRef(0);

        const hoverAnimation = !isActive ? {
            scale: 1.02,
            y: Math.max(position.y - 15, -200),
            x: position.x + (index < activeIndex ? -5 : 5),
            transition: {
                duration: 0.2,
                type: "spring",
                stiffness: 300,
                restDelta: 0.001
            }
        } : {};

        // Touch event handlers
        const handleTouchStart = (e) => {
            dragStartX.current = e.touches[0].clientX;
        };

        const handleTouchEnd = (e) => {
            dragEndX.current = e.changedTouches[0].clientX;
            handleSwipe();
        };

        // Mouse event handlers
        const handleMouseDown = (e) => {
            dragStartX.current = e.clientX;
            document.addEventListener('mouseup', handleMouseUp);
        };

        const handleMouseUp = (e) => {
            dragEndX.current = e.clientX;
            handleSwipe();
            document.removeEventListener('mouseup', handleMouseUp);
        };

        // Swipe logic
        const handleSwipe = () => {
            const swipeDistance = dragEndX.current - dragStartX.current;
            const minSwipeDistance = 50; // Minimum distance for a swipe

            if (Math.abs(swipeDistance) >= minSwipeDistance) {
                if (swipeDistance > 0 && activeIndex > 0) {
                    // Swipe right - go to previous card
                    setActiveIndex(activeIndex - 1);
                } else if (swipeDistance < 0 && activeIndex < features.length - 1) {
                    // Swipe left - go to next card
                    setActiveIndex(activeIndex + 1);
                }
            }
        };

        const selectCard = async () => {
            if (!isActive && !isDragging) {
                // await cardControls.start({
                //     scale: [1, 1.08, 0.98, 1.02, 1],
                //     rotate: [position.rotate, position.rotate - 4, position.rotate + 2, position.rotate],
                //     transition: {
                //         duration: 0.5,
                //         times: [0, 0.2, 0.5, 0.8, 1],
                //         type: "spring"
                //     }
                // });
                setActiveIndex(index);
            }
        };

        const handleMouseMove = (e) => {
            if (!cardRef.current || isActive) return;
            const rect = cardRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left - rect.width / 2;
            const y = e.clientY - rect.top - rect.height / 2;
            mouseX.set(x);
            mouseY.set(y);
        };

        const handleMouseLeave = () => {
            mouseX.set(0);
            mouseY.set(0);
        };

        return (
            <motion.div
                {...props}
                className="absolute w-[320px] md:w-[380px] lg:w-[420px] h-[500px] md:h-[540px] lg:h-[580px] rounded-3xl"
                style={{
                    zIndex: zIndex,
                    filter: `brightness(${1 - Math.abs(index - activeIndex) * 0.08})`,
                    transformOrigin: "center center",
                    perspective: 1000,
                }}
                whileHover={hoverAnimation}
            >
                <motion.div
                    className={`
                    w-full h-full rounded-3xl relative overflow-hidden
                    shadow-[0_8px_16px_rgba(0,0,0,0.2)] backdrop-blur-sm
                    border border-white/20
                    ${isActive ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'}
                `}
                    style={{
                        rotateX: !isActive ? rotateX : 0,
                        rotateY: !isActive ? rotateY : 0
                    }}
                    animate={{
                        x: position.x,
                        y: position.y,
                        rotate: position.rotate,
                        scale: position.scale,
                    }}
                    transition={springConfig}
                    onClick={selectCard}
                >
                    {/* Enhanced Gradient Background with Animation */}
                    <motion.div
                        className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-90`}
                        initial={false}
                        animate={{
                            backgroundPosition: isActive ? ['0% 0%', '100% 100%'] : '0% 0%',
                        }}
                        transition={{
                            duration: 20,
                            repeat: Infinity,
                            repeatType: 'reverse',
                            ease: "linear"
                        }}
                    />

                    {/* Decorative Elements */}
                    <div className="absolute inset-0 overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-full opacity-30">
                            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                                    <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                                </pattern>
                                <rect width="100" height="100" fill="url(#grid)"/>
                            </svg>
                        </div>
                    </div>

                    {/* Content Wrapper with Enhanced Layout */}
                    <motion.div
                        className="relative z-10 h-full p-6 md:p-8 flex flex-col"
                        initial={false}
                        animate={{opacity: 1}}
                    >
                        {/* Enhanced Header Section */}
                        <div className="space-y-6">
                            {/* Icon and Title Group */}
                            <div className="flex items-start gap-4">
                                <motion.div
                                    className={`p-4 rounded-2xl bg-white/10 backdrop-blur-md
                                          shadow-lg transform-gpu`}
                                    whileHover={{scale: 1.05, rotate: 5}}
                                    transition={{type: "spring", stiffness: 400}}
                                >
                                    <feature.icon className="w-8 h-8 text-white"/>
                                </motion.div>
                                <div className="flex-1">
                                    <h3 className="text-2xl font-bold text-white mb-1 tracking-tight">
                                        {feature.title}
                                    </h3>
                                    <p className="text-white/80 text-lg">
                                        {feature.subtitle}
                                    </p>
                                </div>
                            </div>

                            {/* Status Badge - Only for Active Card */}
                            {isActive && (
                                <motion.div
                                    initial={{opacity: 0, y: 10}}
                                    animate={{opacity: 1, y: 0}}
                                    className="inline-flex items-center gap-2 px-4 py-1.5
                                         rounded-full bg-white/10 backdrop-blur-sm border border-white/20"
                                >
                                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
                                    <span className="text-white/90 text-sm font-bold">Most Popular</span>
                                </motion.div>
                            )}

                            {/* Enhanced Description */}
                            <p className="text-white/90 text-lg leading-relaxed">
                                {feature.description}
                            </p>
                        </div>

                        {/* Enhanced Features Grid */}
                        <div className="mt-8 grid grid-cols-2 gap-3">
                            {feature.features.map((item, idx) => (
                                <motion.div
                                    key={idx}
                                    initial={{opacity: 0, y: 20}}
                                    animate={{
                                        opacity: isActive ? 1 : 0.7,
                                        y: 0,
                                        scale: isActive ? 1 : 0.95
                                    }}
                                    transition={{delay: isActive ? idx * 0.1 : 0}}
                                    className="group relative p-4 rounded-xl
                 bg-[#1a1a1a]
                 ring-1 ring-inset ring-white/10
                 shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)]
                 transition-all duration-300
                 hover:shadow-[inset_0_3px_6px_rgba(0,0,0,0.5)]
                 border border-[#2a2a2a]"
                                >
                                    {/* Feature Content */}
                                    <div className="relative z-10">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-white/40
                            group-hover:bg-white/80 transition-colors"/>
                                            <h4 className="text-white/90 font-semibold">{item}</h4>
                                        </div>
                                        <p className="text-white/80 text-sm">
                                            {getFeatureDetail(item)}
                                        </p>
                                    </div>

                                    {/* Hover Effect Background */}
                                    <motion.div
                                        className="absolute inset-0 rounded-xl opacity-0
                                             group-hover:opacity-100 transition-opacity"
                                        style={{
                                            background: `linear-gradient(45deg, ${feature.gradient})`
                                        }}
                                    />
                                </motion.div>
                            ))}
                        </div>

                        {/* Enhanced Action Section */}
                        <div className="mt-auto pt-8 space-y-4">
                            {isActive && (
                                <motion.div
                                    initial={{opacity: 0, y: 20}}
                                    animate={{opacity: 1, y: 0}}
                                    transition={{delay: 0.3}}
                                    className="space-y-3"
                                >
                                    <button className={`
                                    w-full py-4 px-6 rounded-xl text-lg font-semibold
                                    text-white bg-white/20 backdrop-blur-md
                                    hover:bg-white/30 transform transition-all duration-300
                                    hover:scale-[1.02] active:scale-[0.98]
                                    flex items-center justify-center gap-2
                                `}>
                                        Get Started
                                        <span className="text-white/80">→</span>
                                    </button>
                                    <p className="text-center text-white/60 text-sm">
                                        {getCtaSubtext(feature.title)}
                                    </p>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>

                    {/* Active Card Decorative Border */}
                    {isActive && (
                        <motion.div
                            className="absolute inset-0 rounded-3xl border-2 border-white/20"
                            animate={{
                                scale: [1, 1.02, 1],
                                opacity: [0.3, 0.1, 0.3]
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut"
                            }}
                        />
                    )}
                </motion.div>
            </motion.div>
        );
    };

    const getFeatureDetail = (feature) => {
        const details = {
            "Smart conflict prevention": "AI-powered scheduling to avoid double bookings",
            "Real-time availability": "Live updates across all your devices",
            "Multi-staff support": "Manage entire team's schedule effortlessly",
            "Automated reminders": "Reduce no-shows by up to 85%",
            "Inventory tracking": "Never run out of essential supplies",
            "Staff management": "Optimize your team's productivity",
            "Service catalog": "Showcase your services beautifully",
            "Financial reports": "Make data-driven decisions",
        };
        return details[feature] || "Enhanced feature for your business";
    };

    const scrollToFeatures = () => {
        const featuresSection = document.querySelector('.features-section');
        if (featuresSection) {
            if (isMobile) {
                const headerOffset = 60;
                const elementPosition = featuresSection.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            } else {
                featuresSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    };

    return (
        <>
            <ZPatternHero/>

            <div
                className="features-section min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black overflow-hidden">
                <ParticleField/>
                <div className="">
                    <NavigationBar
                        features={features}
                        activeIndex={activeIndex}
                        setActiveIndex={setActiveIndex}
                    />
                </div>

                {/* Content */}
                <div className="">
                    {isMobile ? (
                        <MobileFeatureView
                            features={features}
                            activeIndex={activeIndex}
                            setActiveIndex={setActiveIndex}
                        />
                    ) : (
                        <div id="feature-cards" ref={deckRef}
                             className="relative w-full h-[800px] flex items-center justify-center">
                            <AnimatePresence>
                                {features.map((feature, index) => (
                                    <Card
                                        key={feature.id}
                                        feature={feature}
                                        index={index}
                                        activeIndex={activeIndex}
                                        setActiveIndex={setActiveIndex}
                                    />
                                ))}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* Footer - now shows on both mobile and desktop */}
                <Footer/>
            </div>
        </>
    );
};

export default FeatureDeck;