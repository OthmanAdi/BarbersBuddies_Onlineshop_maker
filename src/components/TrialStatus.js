import React, {useEffect, useState} from 'react';
import {auth, db} from '../firebase';
import {doc, getDoc} from 'firebase/firestore';
import {Link} from 'react-router-dom';

const TrialStatus = () => {
    const [trialStatus, setTrialStatus] = useState(null);
    const [daysLeft, setDaysLeft] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchTrialStatus = async () => {
            const user = auth.currentUser;
            if (user) {
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        const now = new Date();
                        const trialEndDate = userData.trialEndDate.toDate();
                        const isSubscribed = userData.isSubscribed;

                        if (isSubscribed) {
                            setTrialStatus('subscribed');
                        } else if (now < trialEndDate) {
                            setTrialStatus('active');
                            const timeDiff = trialEndDate.getTime() - now.getTime();
                            setDaysLeft(Math.ceil(timeDiff / (1000 * 3600 * 24)));
                        } else {
                            setTrialStatus('expired');
                        }
                    } else {
                        setError('User document not found');
                    }
                } catch (err) {
                    console.error('Error fetching trial status:', err);
                    setError('Error fetching trial status');
                }
            }
        };

        fetchTrialStatus();
    }, []);

    if (error) {
        return <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4" role="alert">
            <p>{error}</p>
        </div>;
    }

    if (!trialStatus) return null;

    return (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4" role="alert">
            {trialStatus === 'active' && (
                <>
                    <p className="font-bold">Trial Active</p>
                    <p>You have {daysLeft} days left in your trial. <Link to="/subscribe" className="underline">Subscribe
                        now</Link> to continue using our services.</p>
                </>
            )}
            {trialStatus === 'expired' && (
                <>
                    <p className="font-bold">Trial Expired</p>
                    <p>Your trial has expired. <Link to="/subscribe" className="underline">Subscribe now</Link> to
                        continue using our services.</p>
                </>
            )}
            {trialStatus === 'subscribed' && (
                <>
                    <p className="font-bold">Subscribed</p>
                    <p>Thank you for subscribing to our services!</p>
                </>
            )}
        </div>
    );
};

export default TrialStatus;