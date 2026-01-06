import {initializeApp} from 'firebase/app';
import { getAnalytics, logEvent } from 'firebase/analytics';

import {
    deleteUser,
    EmailAuthProvider,
    getAuth,
    GoogleAuthProvider,
    onAuthStateChanged,
    reauthenticateWithCredential,
    reauthenticateWithPopup,
    signInWithPopup,
    updateEmail,
    updateProfile
} from 'firebase/auth';
import {deleteObject, getStorage, ref} from 'firebase/storage';
import {deleteDoc, doc, getDoc, getFirestore, serverTimestamp, setDoc, updateDoc} from 'firebase/firestore';
import {getFunctions} from 'firebase/functions';

const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
    prompt: 'consent select_account',  // Changed this line to include consent
    access_type: 'offline'
});

// Analytics event logging utility
export const logAnalyticsEvent = (eventName, eventParams = {}) => {
    try {
        logEvent(analytics, eventName, eventParams);
    } catch (error) {
        console.error('Analytics event logging failed:', error);
    }
};

const signInWithGoogle = async (userType = 'customer') => {
    console.log("Initiating Google Sign-In");
    logAnalyticsEvent('google_sign_in_initiated', {
        user_type: userType
    });

    // Clear any existing auth state first
    if (auth.currentUser) {
        await auth.signOut();
    }

    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/userinfo.profile');
    provider.addScope('https://www.googleapis.com/auth/userinfo.email');
    provider.setCustomParameters({
        prompt: 'select_account',
        access_type: 'offline',
        include_granted_scopes: 'true'
    });

    provider.setCustomParameters({
        prompt: 'select_account',
        access_type: 'offline',
        include_granted_scopes: 'true'
    });

    try {
        const result = await signInWithPopup(auth, provider);
        console.log("Popup sign-in successful!");
        logAnalyticsEvent('google_sign_in_successful', {
            user_id: result.user.uid,
            user_type: userType
        });

        const userRef = doc(db, 'users', result.user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists()) {
            const userData = {
                email: result.user.email,
                displayName: result.user.displayName,
                photoURL: result.user.photoURL,
                createdAt: serverTimestamp(),
                isSubscribed: false,
                trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                phoneNumber: result.user.phoneNumber || null,
                lastLoginAt: serverTimestamp(),
                userType: userType,
                emailVerified: true,
                providerId: 'google.com'
            };

            await setDoc(userRef, userData);
            logAnalyticsEvent('new_user_registration', {
                user_id: result.user.uid,
                user_type: userType,
                provider: 'google.com'
            });

            window.dispatchEvent(new CustomEvent('userTypeUpdated', {
                detail: {userType: userType}
            }));

            return {user: result.user, userData};
        } else {
            const updateData = {
                lastLoginAt: serverTimestamp(),
                photoURL: result.user.photoURL,
                displayName: result.user.displayName,
                phoneNumber: result.user.phoneNumber || userSnap.data().phoneNumber || null,
            };
            await setDoc(userRef, updateData, {merge: true});
            logAnalyticsEvent('returning_user_login', {
                user_id: result.user.uid,
                user_type: userSnap.data().userType,
                provider: 'google.com'
            });

            const updatedUserData = {...userSnap.data(), ...updateData};
            return {user: result.user, userData: updatedUserData};
        }
    } catch (error) {
        await auth.signOut();

        // Log the error event before handling specific cases
        logAnalyticsEvent('google_sign_in_error', {
            error_code: error.code,
            error_message: error.message || 'Unknown error'
        });

        // Rethrow specific errors
        if (error.code === 'auth/popup-closed-by-user' ||
            error.code === 'auth/cancelled-popup-request') {
            throw error;
        }

        if (error.code === 'auth/popup-blocked') {
            throw new Error('Popup was blocked. Please allow popups for this site.');
        }

        switch (error.code) {
            case 'auth/network-request-failed':
                throw new Error('Network error. Please check your internet connection.');
            case 'auth/user-disabled':
                throw new Error('This account has been disabled.');
            case 'auth/operation-not-allowed':
                throw new Error('Google sign-in is not enabled. Please contact support.');
            case 'auth/invalid-credential':
                throw new Error('Invalid Google credentials. Please try again.');
            default:
                throw new Error(error.message || 'An error occurred during Google sign-in. Please try again.');
        }
    }
};

export const getUserData = async (userId) => {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
        return userSnap.data();
    } else {
        throw new Error('User not found');
    }
};

export const updateUserSubscription = async (userId, subscriptionData) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, subscriptionData);
};

// Add new function for handling account deletion confirmation
export const sendAccountDeletionEmail = async (userData) => {
    try {
        const deletionRef = doc(db, 'deletedAccounts', userData.uid);
        await setDoc(deletionRef, {
            email: userData.email,
            displayName: userData.displayName || null,
            deletedAt: serverTimestamp(),
            language: userData.language || 'en',
            uid: userData.uid
        });
        console.log('Deletion record created for email confirmation');
    } catch (error) {
        console.error('Error creating deletion record:', error);
        throw error;
    }
};

// Updated cleanup function with shop deletion
export const cleanupUserData = async (userId, shops = []) => {
    try {
        // Delete shops if they exist
        if (shops && shops.length > 0) {
            for (const shop of shops) {
                try {
                    // Delete shop document
                    await deleteDoc(doc(db, 'barberShops', shop.id));

                    // Delete shop images
                    if (shop.imageUrls && shop.imageUrls.length > 0) {
                        for (const imageUrl of shop.imageUrls) {
                            if (imageUrl) {
                                const imageRef = ref(storage, imageUrl);
                                await deleteObject(imageRef).catch(console.error);
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error deleting shop ${shop.id}:`, error);
                }
            }
        }

        // Delete user document
        await deleteDoc(doc(db, 'users', userId));

        // Delete profile image if exists
        const user = auth.currentUser;
        if (user?.photoURL && user.photoURL.includes('profile_images')) {
            const imageRef = ref(storage, `profile_images/${userId}`);
            await deleteObject(imageRef).catch(console.error);
        }

        console.log('User data cleaned up successfully');
    } catch (error) {
        console.error('Error cleaning up user data:', error);
        throw error;
    }
};

// Complete account deletion process
export const deleteUserAccount = async (userData, shops = []) => {
    try {
        // Create deletion record first (triggers email cloud function)
        await sendAccountDeletionEmail(userData);

        // Clean up user data and shops
        await cleanupUserData(userData.uid, shops);

        // Delete auth account last
        if (auth.currentUser) {
            await deleteUser(auth.currentUser);
        }

        console.log('Account fully deleted');
        return true;
    } catch (error) {
        console.error('Error in account deletion process:', error);
        throw error;
    }
};

export const reauthenticateGoogleUser = async () => {
    const provider = new GoogleAuthProvider();
    const user = auth.currentUser;
    if (!user) throw new Error('No user found');
    return await reauthenticateWithPopup(user, provider);
};

const actionCodeSettings = {
    url: window.location.origin + '/auth',
    handleCodeInApp: true,
};

export {
    auth,
    db,
    storage,
    functions,
    analytics,
    signInWithGoogle,
    updateProfile,
    updateEmail,
    deleteUser,
    EmailAuthProvider,
    reauthenticateWithCredential,
    actionCodeSettings,
    onAuthStateChanged
};