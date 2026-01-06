import React, {useEffect} from 'react';
import {BrowserRouter as Router, Route, Routes, useLocation, useNavigate} from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Shops from './components/BarberShops';
import Auth from './components/Auth';
import CreateBar from './components/CreateBarberShop';
import AccountPage from "./components/Account";
import ShopLandingPage from "./components/ShopLandingPage";
import useStore from './store';
import BookNow from "./components/BookNow";
import SubscriptionPage from "./components/SubscriptionForm";
import {loadStripe} from "@stripe/stripe-js";
import {Elements} from "@stripe/react-stripe-js";
import {LanguageProvider} from "./components/LanguageContext";
import {applyActionCode, getAuth, getRedirectResult} from "firebase/auth";
import {doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import {db} from './firebase';
import ClientManagementDashboard from './components/ClientManagementDashboard';
import MyAppointments from "./components/MyAppointments";
import ShopMessagesView from "./components/ShopMessageView";
import ProtectedRoute from "./components/ProtectedRoute";
import OfflineIndicator from './components/OfflineIndicator';
import {useNetworkStatus} from './hooks/useNetworkStatus';
import EmployeeRegisterPage from "./components/EmployeeRegisterPage";
import PageBuilderWrapper from "./components/PageBuilderWrapper";

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY);

// New component for handling email verification
const EmailVerificationHandler = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const auth = getAuth();

    useEffect(() => {
        if (location.pathname.includes('/__/auth/action')) {
            const queryParams = new URLSearchParams(location.search);
            const mode = queryParams.get('mode');
            const oobCode = queryParams.get('oobCode');

            if (mode === 'verifyEmail' && oobCode) {
                applyActionCode(auth, oobCode)
                    .then(() => {
                        navigate('/auth');
                    })
                    .catch((error) => {
                        console.error('Error verifying email:', error);
                        navigate('/auth');
                    });
            }
        }
    }, [location, navigate]);

    return null;
};

const GoogleRedirectResultHandler = () => {
    const navigate = useNavigate();
    const auth = getAuth();

    useEffect(() => {
        const handleRedirectResult = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result) {
                    // Handle successful sign in
                    console.log("Redirect result:", result.user);

                    // Create/update user document in Firestore
                    const userRef = doc(db, 'users', result.user.uid);
                    const userSnap = await getDoc(userRef);

                    if (!userSnap.exists()) {
                        await setDoc(userRef, {
                            email: result.user.email,
                            displayName: result.user.displayName,
                            photoURL: result.user.photoURL,
                            createdAt: serverTimestamp(),
                            isSubscribed: false,
                            trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                            phoneNumber: result.user.phoneNumber || null
                        });
                    } else {
                        await setDoc(userRef, {
                            phoneNumber: result.user.phoneNumber || userSnap.data().phoneNumber || null,
                            lastUpdated: serverTimestamp()
                        }, {merge: true});
                    }

                    // Navigate to home or dashboard
                    navigate('/create-shop');
                }
            } catch (error) {
                console.error("Redirect error:", error);
                // Handle any errors here
            }
        };

        handleRedirectResult();
    }, [auth, navigate]);

    return null;
};

function App() {
    const {theme} = useStore();
    const isOnline = useNetworkStatus();

    return (
        <>
            {!isOnline && <OfflineIndicator/>}

            <LanguageProvider>
                <Router>
                    <Elements stripe={stripePromise}>
                        <div data-theme="barber" className="min-h-screen bg-base-100">
                            <EmailVerificationHandler/>
                            <GoogleRedirectResultHandler/>
                            <Navbar/>
                            {/*<NavbarSpacer/>*/}
                            <Routes>
                                <Route path="/" element={<Home/>}/>
                                <Route path="/auth" element={<Auth/>}/>
                                <Route path="/shops" element={<Shops/>}/>
                                <Route path="/account" element={<AccountPage/>}/>
                                <Route path="/create-shop" element={<CreateBar/>}/>
                                <Route path="/shop/:uniqueUrl" element={<ShopLandingPage/>}/>
                                <Route path="/book/:shopId" element={<BookNow/>}/>
                                <Route path="/subscribe" element={<SubscriptionPage/>}/>
                                <Route path="/dashboard/clients" element={<ClientManagementDashboard/>}/>
                                <Route path="/dashboard/customers" element={<MyAppointments/>}/>
                                <Route path="/employee-register/:shopId/:token" element={<EmployeeRegisterPage />} />
                                <Route path="/customize-shop/:shopId" element={<PageBuilderWrapper />} />

                                <Route
                                    path="/shop-messages"
                                    element={
                                        <ProtectedRoute userType="shop-owner">
                                            <ShopMessagesView/>
                                        </ProtectedRoute>
                                    }
                                />
                            </Routes>
                        </div>
                    </Elements>
                </Router>
            </LanguageProvider>
        </>
    );
}

export default App;