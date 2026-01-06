import {useEffect, useState} from 'react';

export const useNetworkStatus = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // For iOS Safari, check connection type if available
        if ('connection' in navigator) {
            // @ts-ignore
            navigator.connection.addEventListener('change', () => {
                // @ts-ignore
                setIsOnline(navigator.connection.type !== 'none');
            });
        }

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if ('connection' in navigator) {
                // @ts-ignore
                navigator.connection.removeEventListener('change', () => {
                    // @ts-ignore
                    setIsOnline(navigator.connection.type !== 'none');
                });
            }
        };
    }, []);

    return isOnline;
};