import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, Clock, Mail, CheckCircle, X, AlertCircle, Info } from 'lucide-react';
import { collection, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const NotificationPreferences = ({ userId, userEmail }) => {
    const [preferences, setPreferences] = useState({
        oneHourBefore: false,
        threeDaysBefore: false,
        oneDayBefore: false,
        oneWeekBefore: false,
        onBooking: false
    });
    const [isEnabled, setIsEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState(null);
    const [showInfo, setShowInfo] = useState(false);
    const [initialPreferences, setInitialPreferences] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        const fetchPreferences = async () => {
            try {
                const userPrefsDoc = await getDoc(doc(db, 'notificationPreferences', userId));
                if (userPrefsDoc.exists()) {
                    const data = userPrefsDoc.data();
                    const enabled = data.enabled || false;
                    const prefs = data.preferences || {};
                    setIsEnabled(enabled);
                    setPreferences(prefs);
                    setInitialPreferences({ enabled, preferences: prefs });
                }
            } catch (error) {
                console.error('Error fetching preferences:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPreferences();

        // Add this return cleanup function
        return () => {
            setLoading(true);
            setPreferences({
                oneHourBefore: false,
                threeDaysBefore: false,
                oneDayBefore: false,
                oneWeekBefore: false,
                onBooking: false
            });
            setIsEnabled(false);
            setSaveStatus(null);
            setShowInfo(false);
            setInitialPreferences(null);
            setHasChanges(false);
        };
    }, [userId]);

    useEffect(() => {
        if (!initialPreferences) return;

        const prefsChanged = Object.keys(preferences).some(
            key => preferences[key] !== initialPreferences.preferences[key]
        );

        setHasChanges(
            isEnabled !== initialPreferences.enabled || prefsChanged
        );
    }, [isEnabled, preferences, initialPreferences]);

    const handleSave = async () => {
        try {
            setSaveStatus('saving');
            const prefsRef = doc(db, 'notificationPreferences', userId);
            await setDoc(prefsRef, {
                enabled: isEnabled,
                preferences,
                userEmail,
                updatedAt: new Date(),
            }, { merge: true });

            setSaveStatus('success');
            setTimeout(() => setSaveStatus(null), 2000);
            setInitialPreferences({ enabled: isEnabled, preferences: {...preferences} });
            setHasChanges(false);
        } catch (error) {
            console.error('Error saving preferences:', error);
            setSaveStatus('error');
            setTimeout(() => setSaveStatus(null), 3000);
        }
    };

    const handleToggle = (checked) => {
        setIsEnabled(checked);
        if (!checked) {
            setPreferences({
                oneHourBefore: false,
                threeDaysBefore: false,
                oneDayBefore: false,
                oneWeekBefore: false,
                onBooking: false
            });
        }
    };

    if (loading) return null;

    return (
        <motion.div
            className="w-full max-w-2xl mx-auto p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
        >
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <motion.div
                        className="flex items-center justify-between"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="flex items-center gap-3">
                            <BellRing className="w-6 h-6 text-primary" />
                            <h2 className="card-title">Notification Preferences</h2>
                            <button
                                className="btn btn-ghost btn-circle btn-sm"
                                onClick={() => setShowInfo(!showInfo)}
                            >
                                <Info className="w-4 h-4" />
                            </button>
                        </div>
                        <label className="swap swap-rotate">
                            <input
                                type="checkbox"
                                checked={isEnabled}
                                onChange={(e) => handleToggle(e.target.checked)}
                            />
                            <motion.div
                                className="swap-on"
                                whileTap={{ scale: 0.9 }}
                            >
                                <BellRing className="w-6 h-6 text-primary" />
                            </motion.div>
                            <motion.div
                                className="swap-off"
                                whileTap={{ scale: 0.9 }}
                            >
                                <BellRing className="w-6 h-6 text-base-content/30" />
                            </motion.div>
                        </label>
                    </motion.div>

                    <AnimatePresence>
                        {showInfo && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="alert alert-info mt-4"
                            >
                                <Info className="w-5 h-5" />
                                <div>
                                    <h3 className="font-bold">About Notifications</h3>
                                    <p className="text-sm">
                                        Choose when you'd like to receive email reminders about your upcoming appointments.
                                        All notifications are sent to {userEmail}.
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {isEnabled && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4"
                            >
                                {[
                                    { key: 'oneHourBefore', label: '1 hour before', icon: Clock },
                                    { key: 'oneDayBefore', label: '1 day before', icon: Clock },
                                    { key: 'threeDaysBefore', label: '3 days before', icon: Clock },
                                    { key: 'oneWeekBefore', label: '1 week before', icon: Clock },
                                    { key: 'onBooking', label: 'On booking confirmation', icon: Mail },
                                ].map(({ key, label, icon: Icon }) => (
                                    <motion.div
                                        key={key}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="form-control"
                                    >
                                        <label className="label cursor-pointer">
                      <span className="label-text flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                          {label}
                      </span>
                                            <input
                                                type="checkbox"
                                                className="toggle toggle-primary"
                                                checked={preferences[key]}
                                                onChange={(e) =>
                                                    setPreferences(prev => ({
                                                        ...prev,
                                                        [key]: e.target.checked
                                                    }))
                                                }
                                            />
                                        </label>
                                    </motion.div>
                                ))}

                                <AnimatePresence>
                                    {hasChanges && (
                                        <motion.div
                                            className="card-actions justify-end col-span-2 mt-2"
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                        >
                                            <button
                                                className={`btn btn-primary ${saveStatus === 'saving' ? 'loading' : ''}`}
                                                onClick={handleSave}
                                                disabled={saveStatus === 'saving'}
                                            >
                                                {saveStatus === 'saving' && <span className="loading loading-spinner" />}
                                                {saveStatus === 'success' && <CheckCircle className="w-5 h-5" />}
                                                {saveStatus === 'error' && <AlertCircle className="w-5 h-5" />}
                                                {saveStatus === null && 'Save Preferences'}
                                                {saveStatus === 'saving' && 'Saving...'}
                                                {saveStatus === 'success' && 'Saved!'}
                                                {saveStatus === 'error' && 'Error!'}
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <AnimatePresence>
                        {saveStatus === 'success' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="alert alert-success mt-4"
                            >
                                <CheckCircle className="w-5 h-5" />
                                <span>Your notification preferences have been saved!</span>
                            </motion.div>
                        )}
                        {saveStatus === 'error' && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="alert alert-error mt-4"
                            >
                                <AlertCircle className="w-5 h-5" />
                                <span>Failed to save preferences. Please try again.</span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </motion.div>
    );
};

export default NotificationPreferences;