import React, {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {auth, getUserData, updateUserSubscription} from '../firebase';
import {CardElement, Elements, useElements, useStripe} from '@stripe/react-stripe-js';
import Swal from 'sweetalert2';
import {useStripeLoader} from '../Services/stripe';

const SubscriptionForm = () => {
    const [loading, setLoading] = useState(false);
    const stripe = useStripe();
    const elements = useElements();
    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);

        if (!stripe || !elements) {
            return;
        }

        const cardElement = elements.getElement(CardElement);

        const {error, paymentMethod} = await stripe.createPaymentMethod({
            type: 'card', card: cardElement,
        });

        if (error) {
            console.error('[error]', error);
            Swal.fire('Error', error.message, 'error');
            setLoading(false);
            return;
        }

        const user = auth.currentUser;
        if (!user) {
            Swal.fire('Error', 'You must be logged in to subscribe', 'error');
            setLoading(false);
            return;
        }

        try {
            // Call your backend API to create a subscription
            const response = await fetch('https://your-backend-api.com/create-subscription', {
                method: 'POST', headers: {
                    'Content-Type': 'application/json',
                }, body: JSON.stringify({
                    paymentMethodId: paymentMethod.id, userId: user.uid,
                }),
            });

            const subscription = await response.json();

            if (subscription.status === 'active') {
                await updateUserSubscription(user.uid, {
                    isSubscribed: true, subscriptionStatus: 'active', stripeCustomerId: subscription.customer,
                });

                Swal.fire('Success', 'Your subscription is now active!', 'success');
                navigate('/account');
            } else {
                throw new Error('Subscription failed');
            }
        } catch (error) {
            console.error('Error:', error);
            Swal.fire('Error', 'Failed to process subscription', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (<form onSubmit={handleSubmit}>
            <CardElement/>
            <button type="submit" disabled={!stripe || loading} className="btn btn-primary mt-4">
                {loading ? 'Processing...' : 'Subscribe Now'}
            </button>
        </form>);
};

const SubscriptionPage = () => {
    const [userData, setUserData] = useState(null);
    const {stripePromise, isLoading, error} = useStripeLoader();

    useEffect(() => {
        const fetchUserData = async () => {
            const user = auth.currentUser;
            if (user) {
                const data = await getUserData(user.uid);
                setUserData(data);
            }
        };

        fetchUserData();
    }, []);

    if (error === 'offline') {
        return (<div className="container mx-auto px-4 py-8">
                <div className="alert alert-warning">
                    <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none"
                             viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                        </svg>
                        <span>Payment system is currently offline. Please check your internet connection and try again.</span>
                    </div>
                </div>
            </div>);
    }

    if (isLoading) {
        return (<div className="container mx-auto px-4 py-8">
                <div className="flex justify-center items-center">
                    <div className="loading loading-spinner loading-lg"></div>
                </div>
            </div>);
    }

    return (<div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Subscribe to Our Service</h1>
            {userData && (<div className="mb-6">
                    <p>Current Status: {userData.subscriptionStatus}</p>
                    {userData.trialEndDate && (
                        <p>Trial Ends: {userData.trialEndDate.toDate().toLocaleDateString()}</p>)}
                </div>)}
            <Elements stripe={stripePromise}>
                <SubscriptionForm/>
            </Elements>
        </div>);
};

export default SubscriptionPage;