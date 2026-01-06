import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

const CountdownTimer = ({ appointmentDate, appointmentTime }) => {
    const [timeLeft, setTimeLeft] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    const calculateTimeLeft = useMemo(() => () => {
        const appointmentDateTime = new Date(`${appointmentDate}T${appointmentTime}`).getTime();
        const now = new Date().getTime();
        const total = appointmentDateTime - now;

        // Hide timer if we're past appointment time
        if (total <= -5 * 60 * 1000) { // 5 minutes after appointment
            return null;
        }

        // Show "Time's up" only in the 5-minute window before appointment
        if (total <= 0 && total > -5 * 60 * 1000) {
            return {
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0,
                total: 0,
                showTimeUp: true
            };
        }

        if (total <= 0) {
            return null;
        }

        return {
            days: Math.floor(total / (1000 * 60 * 60 * 24)),
            hours: Math.floor((total % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
            minutes: Math.floor((total % (1000 * 60 * 60)) / (1000 * 60)),
            seconds: Math.floor((total % (1000 * 60)) / 1000),
            total,
            showTimeUp: false
        };
    }, [appointmentDate, appointmentTime]);

    useEffect(() => {
        const initialTimer = setTimeout(() => {
            setTimeLeft(calculateTimeLeft());
            setIsLoading(false);
        }, 100);

        const timer = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => {
            clearInterval(timer);
            clearTimeout(initialTimer);
        };
    }, [calculateTimeLeft]);

    const getTimerColor = () => {
        if (!timeLeft || timeLeft.showTimeUp) return 'text-error';
        if (timeLeft.days === 0) {
            if (timeLeft.hours < 2) return 'text-error';
            if (timeLeft.hours < 12) return 'text-warning';
        }
        return 'text-success';
    };

    const getTimerSize = () => {
        if (!timeLeft || timeLeft.days > 0) return 'text-sm md:text-base';
        return 'text-base md:text-lg font-semibold';
    };

    if (isLoading) {
        return (
            <div className="min-w-[100px] flex justify-end">
                <motion.div
                    className="h-4 w-16 md:w-20 bg-base-300 rounded"
                    animate={{
                        opacity: [0.5, 0.7, 0.5],
                    }}
                    transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                />
            </div>
        );
    }

    // Don't render anything if timeLeft is null (past 5 minutes after appointment)
    if (!timeLeft) return null;

    return (
        <div className="min-w-[100px] flex justify-end">
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`flex items-center gap-2 ${getTimerColor()} ${getTimerSize()} transition-colors duration-300`}
            >
                {timeLeft.showTimeUp ? (
                    <span className="font-bold animate-pulse">Time's up!</span>
                ) : timeLeft.days > 0 ? (
                    <span>{timeLeft.days}d {timeLeft.hours}h left</span>
                ) : (
                    <span className="font-mono">
            {String(timeLeft.hours).padStart(2, '0')}:
                        {String(timeLeft.minutes).padStart(2, '0')}:
                        {String(timeLeft.seconds).padStart(2, '0')}
          </span>
                )}
            </motion.div>
        </div>
    );
};

export default CountdownTimer;