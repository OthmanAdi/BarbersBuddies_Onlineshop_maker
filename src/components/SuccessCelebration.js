import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Check, DollarSign, Star } from 'lucide-react';

const SuccessCelebration = () => {
    useEffect(() => {
        const colors = ['#0ea5e9', '#64748b', '#0f172a'];
        const duration = 1500;
        const end = Date.now() + duration;

        const shootConfetti = () => {
            confetti({
                particleCount: 15,
                angle: 60,
                spread: 40,
                origin: { x: 0, y: 0.7 },
                colors: colors,
                shapes: ['circle'],
                ticks: 150,
                scalar: 1.2,
                gravity: 1.2
            });

            confetti({
                particleCount: 15,
                angle: 120,
                spread: 40,
                origin: { x: 1, y: 0.7 },
                colors: colors,
                shapes: ['circle'],
                ticks: 150,
                scalar: 1.2,
                gravity: 1.2
            });
        };

        const animate = () => {
            const now = Date.now();
            if (now < end) {
                shootConfetti();
                requestAnimationFrame(animate);
            }
        };

        animate();
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-50">
            <div className="absolute inset-0 flex items-center justify-center gap-4">
                <div className="animate-pulse">
                    <Check className="text-sky-600 w-5 h-5" />
                </div>
                <div className="animate-pulse">
                    <DollarSign className="text-slate-700 w-5 h-5" />
                </div>
            </div>
        </div>
    );
};

export default SuccessCelebration;