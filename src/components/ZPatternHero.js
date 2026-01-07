import React, {useEffect, useRef, useState} from 'react';
import {motion, useAnimationControls, useInView} from 'framer-motion';
import {useDaisyTheme} from "../hooks/useDaisyTheme";
import {useNavigate} from "react-router-dom";
import VideoModal from "./VideoModal";

const NumberAnimation = ({value}) => {
    const controls = useAnimationControls();
    const ref = useRef(null);
    const isInView = useInView(ref, {once: true});
    const [displayValue, setDisplayValue] = React.useState(0);

    useEffect(() => {
        if (isInView) {
            let startValue = 0;
            const duration = 2000; // 2 seconds
            const startTime = Date.now();

            const updateValue = () => {
                const currentTime = Date.now();
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Easing function for smooth animation
                const easeOutBounce = (x) => {
                    const n1 = 7.5625;
                    const d1 = 2.75;

                    if (x < 1 / d1) {
                        return n1 * x * x;
                    } else if (x < 2 / d1) {
                        return n1 * (x -= 1.5 / d1) * x + 0.75;
                    } else if (x < 2.5 / d1) {
                        return n1 * (x -= 2.25 / d1) * x + 0.9375;
                    } else {
                        return n1 * (x -= 2.625 / d1) * x + 0.984375;
                    }
                };

                startValue = Math.floor(easeOutBounce(progress) * value);
                setDisplayValue(startValue);

                if (progress < 1) {
                    requestAnimationFrame(updateValue);
                } else {
                    // Trigger sparks animation when count is complete
                    controls.start("spark");
                }
            };

            controls.start("scale");
            updateValue();
        }
    }, [isInView, value, controls]);

    // Generate spark particles
    const sparks = Array.from({length: 20}).map((_, i) => {
        const angle = (i / 20) * Math.PI * 2;
        return {
            x: Math.cos(angle) * 100,
            y: Math.sin(angle) * 100,
            rotation: Math.random() * 360,
            scale: Math.random() * 0.5 + 0.5,
        };
    });

    return (<div ref={ref} className="relative flex justify-center items-center">
        <motion.div
            animate={controls}
            variants={{
                scale: {
                    scale: [1, 1.2, 1], transition: {duration: 2, ease: "easeOut"}
                }
            }}
            className="relative"
        >
            <div
                className="text-6xl md:text-7xl lg:text-8xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                {displayValue.toLocaleString()}+
            </div>
        </motion.div>

        {/* Spark particles */}
        {sparks.map((spark, index) => (<motion.div
            key={index}
            className="absolute w-1 h-1 bg-gradient-to-r from-purple-400 to-blue-400"
            initial={{opacity: 0, scale: 0, x: 0, y: 0}}
            variants={{
                spark: {
                    opacity: [0, 1, 0],
                    scale: [0, spark.scale, 0],
                    x: [0, spark.x],
                    y: [0, spark.y],
                    rotate: [0, spark.rotation],
                    transition: {
                        duration: 0.8, ease: "easeOut", delay: Math.random() * 0.2,
                    }
                }
            }}
            animate={controls}
        />))}
    </div>);
};

const ZPatternHero = () => {
    const isDark = useDaisyTheme();
    const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
    const navigate = useNavigate();

    const scrollToFeatures = () => {
        const featuresSection = document.querySelector('.features-section');
        if (featuresSection) {
            const headerOffset = 60;
            const elementPosition = featuresSection.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition, behavior: "smooth"
            });
        }
    };

    return (<div className={`relative min-h-[800px] md:min-h-[700px] lg:min-h-[800px] px-4 md:px-6 lg:px-8 pt-24 md:pt-32 lg:pt-40 overflow-hidden transition-colors duration-500 
      ${isDark ? 'bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900' : 'bg-gradient-to-br from-white via-purple-50 to-sky-50'}`}>

        {/* Gradient Orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={`absolute -top-1/4 right-0 w-1/2 h-1/2 
          bg-gradient-to-r rounded-full blur-3xl animate-blob
          ${isDark ? 'from-purple-500/20 to-blue-500/20' : 'from-purple-400/30 to-blue-400/30'}`}>
            </div>
            <div className={`absolute -bottom-1/4 left-0 w-1/2 h-1/2 
          bg-gradient-to-l rounded-full blur-xl animate-blob animation-delay-2000
          ${isDark ? 'from-rose-500/30 to-orange-500/30' : 'from-rose-400/40 to-orange-400/40'}`}>
            </div>
        </div>

        {/* Main Content Grid */}
        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {/* Top Left - Main Heading */}
            <motion.div
                initial={{opacity: 0, x: -20}}
                animate={{opacity: 1, x: 0}}
                transition={{duration: 0.8}}
                className="md:mt-8"
            >
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-left">
            <span
                className="bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400">
              Transform Your Barbershop
            </span>
                    <br/>
                    <span
                        className="text-3xl md:text-4xl lg:text-5xl bg-gradient-to-r from-rose-600 to-orange-600 dark:from-rose-400 dark:to-orange-400 bg-clip-text text-transparent">
              into a Smart Business
            </span>
                </h1>
            </motion.div>

            {/* Top Right - Value Prop */}
            <div className="flex flex-col items-center">
                <NumberAnimation value={5}/>
                <div className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mt-2">
                    Minute Setup
                </div>
            </div>

            {/* Bottom Left - CTAs */}
            <motion.div
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.8, delay: 0.4}}
                className="flex flex-col sm:flex-row gap-4 items-start mob-max:items-center"
            >
                <button onClick={() => window.location.href = '/auth'}
                        className="btn btn-primary btn-lg group relative overflow-hidden bg-gradient-to-r from-purple-600 to-blue-600 border-0 hover:from-purple-700 hover:to-blue-700 dark:from-purple-500 dark:to-blue-500 dark:hover:from-purple-600 dark:hover:to-blue-600 text-white">
                    Start Free Trial
                    <span className="absolute right-4 transition-transform duration-200 group-hover:translate-x-1">
              →
            </span>
                </button>

                <VideoModal
                    isOpen={isVideoModalOpen}
                    onClose={() => setIsVideoModalOpen(false)}
                />

            </motion.div>

            {/* Bottom Right - Description */}
            <motion.p
                initial={{opacity: 0, y: 20}}
                animate={{opacity: 1, y: 0}}
                transition={{duration: 0.8, delay: 0.3}}
                className={`text-lg md:text-xl lg:text-2xl leading-relaxed text-left self-center ${isDark ? 'text-gray-300' : 'text-gray-600'}`}
            >
                Launch your own barbershop booking platform in minutes. BarbersBuddies gives you
                everything you need: AI-powered scheduling, smart analytics, customer management,
                and seamless payments — completely free and open source.
            </motion.p>
        </div>
        {/* Scroll Arrow - Now outside the grid */}
        <motion.div
            className="absolute bottom-12 left-1/2 -translate-x-1/2"
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.8, delay: 0.5}}
        >
            <motion.button
                onClick={scrollToFeatures}
                animate={{
                    y: [0, 10, 0], transition: {
                        y: {
                            repeat: Infinity, duration: 2, ease: "easeInOut"
                        }
                    }
                }}
                className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
                <motion.svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-chevron-down"
                >
                    <polyline points="6 9 12 15 18 9"></polyline>
                </motion.svg>
            </motion.button>
        </motion.div>
    </div>);
};

export default ZPatternHero;