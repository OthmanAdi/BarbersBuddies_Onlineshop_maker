// src/services/stripe.js
import {loadStripe} from '@stripe/stripe-js';
import {useEffect, useState} from 'react';

const STRIPE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY;
const useStripeLoader = () => {
    const [stripePromise, setStripePromise] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const initializeStripe = async () => {
            try {
                if (!navigator.onLine) {
                    throw new Error('offline');
                }
                const stripe = await loadStripe(STRIPE_KEY);
                if (!stripe) throw new Error('Failed to initialize Stripe');
                setStripePromise(stripe);
                setError(null);
            } catch (err) {
                console.warn('Stripe initialization issue:', err);
                setError(err.message === 'offline' ? 'offline' : 'initialization');
                setStripePromise(null);
            } finally {
                setIsLoading(false);
            }
        };

        const handleOnline = () => initializeStripe();
        const handleOffline = () => {
            setError('offline');
            setStripePromise(null);
        };

        initializeStripe();
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return {stripePromise, isLoading, error};
};

export {useStripeLoader};
export default loadStripe(STRIPE_KEY);