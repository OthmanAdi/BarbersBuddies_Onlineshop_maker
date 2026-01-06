import React, {useEffect, useState} from 'react';
import {Navigate} from 'react-router-dom';
import {auth, db} from '../firebase';
import {doc, getDoc} from 'firebase/firestore';
import {onAuthStateChanged} from 'firebase/auth';

const ProtectedRoute = ({children, userType}) => {
    const [isAuthorized, setIsAuthorized] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                setIsAuthorized(false);
                setIsLoading(false);
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setIsAuthorized(userData.userType === userType);
                } else {
                    setIsAuthorized(false);
                }
            } catch (error) {
                console.error('Error checking user type:', error);
                setIsAuthorized(false);
            }

            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [userType]);

    if (isLoading) {
        return (<div className="min-h-screen flex items-center justify-center bg-base-200">
                <div className="text-center space-y-4">
                    <div className="loading loading-spinner loading-lg text-primary"></div>
                    <p className="mt-4 text-lg font-medium">Loading...</p>
                </div>
            </div>);
    }

    return isAuthorized ? children : <Navigate to="/auth" replace/>;
};

export default ProtectedRoute;