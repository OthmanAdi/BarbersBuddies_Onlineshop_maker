import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useAnimation } from 'framer-motion';
import { Scissors } from 'lucide-react';
import './BrandLogo.css';

const BarberPole = () => (
    <div className="relative h-14 w-3">
        {/* Background */}
        <div className="absolute inset-0 rounded-md bg-gray-100 dark:bg-gray-800" />

        {/* Base */}
        <div className="absolute top-0 left-0 right-0 h-2 rounded-t-md bg-gray-300 dark:bg-gray-700" />

        {/* Animated Pole */}
        <div className="absolute top-2 left-0 right-0 bottom-3 overflow-hidden">
            <div
                className="h-full w-full animate-barberpole"
                style={{
                    background: 'repeating-linear-gradient(45deg, #ef4444 0%, #ef4444 25%, #ffffff 25%, #ffffff 50%, #3b82f6 50%, #3b82f6 75%, #ef4444 75%, #ef4444 100%)',
                    backgroundSize: '200% 200%'
                }}
            />
        </div>

        {/* Cone */}
        <div className="absolute bottom-0 left-0 right-0 h-3">
            <div className="h-full w-full bg-gray-300 dark:bg-gray-700 clip-cone" />
        </div>
    </div>
);


const BrandLogo = () => {
    const [isAnimating, setIsAnimating] = useState(false);
    const scissorsControls = useAnimation();

    const handleLogoClick = async () => {
        if (!isAnimating) {
            setIsAnimating(true);
            await scissorsControls.start({
                rotate: [0, 360, 0],
                scale: [1, 1.1, 1.1, 1.1, 1.1, 1],
                transition: {
                    duration: 2.5,
                    ease: [0.4, 0, 0.2, 1], // Custom cubic-bezier for smooth motion
                    times: [0, 0.25, 0.5, 0.75, 0.9, 1], // Controlled timing for each rotation
                }
            });
            setIsAnimating(false);
        }
    };

    return (
        <Link
            to="/"
            className="flex items-center space-x-2 group relative px-4 md:px-8"
            onClick={handleLogoClick}
        >
            {/* Scissors Icon with click animation */}
            <motion.div
                animate={scissorsControls}
                initial={{ rotate: 0 }}
                className="absolute left-0 md:left-2 top-1/2 -translate-y-1/2 z-20"
            >
                <Scissors className="w-6 h-6 text-primary dark:text-primary/90" />
            </motion.div>

            {/* Logo Text Container */}
            <div className="flex items-center relative ml-8 md:ml-10">
                {/* Decorative Pole */}
                <div className="absolute -left-4 z-10">
                    <BarberPole/>
                </div>

                {/* Text Elements */}
                <div className="flex flex-col items-start relative overflow-hidden">
                    <motion.span
                        className="text-xl md:text-2xl font-black tracking-tight relative"
                        initial={{x: -20, opacity: 0}}
                        animate={{x: 0, opacity: 1}}
                        transition={{duration: 0.5, delay: 0.2}}
                    >
                        <span className="relative">
                            <span
                                className="bg-gradient-to-r from-primary via-secondary to-primary dark:from-primary/90 dark:via-secondary/90 dark:to-primary/90 bg-clip-text text-transparent animate-gradient bg-[length:200%_auto] relative z-10">
                                Barber
                            </span>
                            {/* Light ray animation overlay */}
                            <div
                                className="absolute inset-0 animate-lightray bg-gradient-to-r from-transparent via-white dark:via-white/40 to-transparent opacity-0 z-20"/>
                        </span>
                        <motion.span
                            initial={{opacity: 0, scale: 0.8}}
                            animate={{opacity: 1, scale: 1}}
                            transition={{duration: 0.3, delay: 0.4}}
                            className="inline-block ml-1 relative"
                        >
                            <span
                                className="bg-gradient-to-r from-secondary to-primary dark:from-secondary/90 dark:to-primary/90 bg-clip-text text-transparent relative z-10">
                                Buddy
                            </span>
                            {/* Light ray animation overlay */}
                            <div
                                className="absolute inset-0 animate-lightray bg-gradient-to-r from-transparent via-white dark:via-white/40 to-transparent opacity-0 z-20"/>
                        </motion.span>
                    </motion.span>

                    {/* Underline Effect */}
                    <motion.div
                        initial={{scaleX: 0}}
                        animate={{scaleX: 1}}
                        transition={{duration: 0.5, delay: 0.6}}
                        className="h-0.5 w-full bg-gradient-to-r from-primary to-secondary dark:from-primary/90 dark:to-secondary/90 rounded-full transform origin-left"
                    />
                </div>
            </div>

            {/* Hover Effects Container */}
            <div className="absolute inset-0 -z-10">
                <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    whileHover={{ scale: 1.1, opacity: 0.1 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0 bg-gradient-to-r from-primary to-secondary dark:from-primary/90 dark:to-secondary/90 rounded-xl blur-xl"
                />
            </div>
        </Link>
    );
};

const styles = `

@keyframes gradient {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
}


@keyframes lightray {
    0% {
        opacity: 0;
        transform: translateX(-100%);
    }
    50% {
        opacity: 1;
    }
    100% {
        opacity: 0;
        transform: translateX(100%);
    }
}

.animate-gradient {
    animation: gradient 3s linear infinite;
}

.animate-lightray {
    animation: lightray 4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
    animation-delay: 2s;
}

/* Ensure proper z-index stacking in dark mode */
.dark .from-primary {
    --tw-gradient-from: rgb(var(--primary) / 0.9);
    --tw-gradient-to: rgb(var(--primary) / 0);
}

.dark .to-primary {
    --tw-gradient-to: rgb(var(--primary) / 0.9);
}

.dark .via-secondary {
    --tw-gradient-via: rgb(var(--secondary) / 0.9);
}
`;

export { BrandLogo, styles };