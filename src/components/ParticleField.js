import React, {useEffect, useState} from 'react';
import {motion} from 'framer-motion';
import {useDaisyTheme} from '../hooks/useDaisyTheme';
import {useParticleEffects} from '../hooks/useParticleEffects';

const Particle = () => {
    const isDark = useDaisyTheme();
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
            className={`absolute w-2 h-2 rounded-full pointer-events-none ${
                isDark
                    ? 'bg-white'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600'
            }`}
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
        <div className="fixed inset-0 pointer-events-none z-10">
            {Array.from({length: 50}).map((_, i) => (
                <Particle key={i}/>
            ))}
        </div>
    );
};

export default ParticleField;