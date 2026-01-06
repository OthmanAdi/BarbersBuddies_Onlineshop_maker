import React, {useState} from 'react';
import {CardElement, useElements, useStripe} from '@stripe/react-stripe-js';
import {doc, updateDoc} from 'firebase/firestore';
import {auth, db} from '../firebase';

const SubscriptionPage = () => {
    const stripe = useStripe();
    const elements = useElements();
    const [error, setError] = useState(null);
    const [processing, setProcessing] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setProcessing(true);

        if (!stripe || !elements) {
            return;
        }

        try {
            // 1. Create a payment method
            const {error: paymentMethodError, paymentMethod} = await stripe.createPaymentMethod({
                type: 'card', card: elements.getElement(CardElement),
            });

            if (paymentMethodError) {
                setError(paymentMethodError.message);
                setProcessing(false);
                return;
            }

            // 2. Call your backend to create a subscription
            const user = auth.currentUser;
            if (!user) {
                setError('You must be logged in to subscribe');
                setProcessing(false);
                return;
            }

            const response = await fetch('/create-subscription', {
                method: 'POST', headers: {
                    'Content-Type': 'application/json',
                }, body: JSON.stringify({
                    paymentMethodId: paymentMethod.id, userId: user.uid,
                }),
            });

            const subscription = await response.json();

            if (subscription.error) {
                setError(subscription.error);
                setProcessing(false);
                return;
            }

            // 3. Handle the subscription status
            if (subscription.status === 'active' || subscription.status === 'trialing') {
                // Update user document in Firestore
                await updateDoc(doc(db, 'users', user.uid), {
                    isSubscribed: true,
                    subscriptionId: subscription.id,
                    subscriptionStatus: subscription.status,
                    subscriptionDate: new Date()
                });

                setError(null);
                alert('Subscription successful!');
            } else {
                setError('Subscription failed. Please try again.');
            }
        } catch (err) {
            console.error('Error:', err);
            setError('An error occurred while processing your subscription.');
        } finally {
            setProcessing(false);
        }
    };

    return (<div className="container mx-auto mt-10">
            <h1 className="text-2xl font-bold mb-4">Subscribe to BarberBuddy</h1>
            <form onSubmit={handleSubmit} className="max-w-md mx-auto">
                <CardElement className="p-2 border rounded mb-4"/>
                {error && <div className="text-red-500 mb-4">{error}</div>}
                <button
                    type="submit"
                    disabled={!stripe || processing}
                    className="w-full bg-blue-500 text-white p-2 rounded disabled:bg-gray-300"
                >
                    {processing ? 'Processing...' : 'Subscribe Now - 50€ / 3 Months'}
                </button>
            </form>
        </div>);
};

export default SubscriptionPage;