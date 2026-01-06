import {useCallback, useEffect, useState} from 'react';
import {doc, getDoc, serverTimestamp, setDoc} from 'firebase/firestore';
import {db} from '../firebase';
import debounce from 'lodash/debounce';

const STORAGE_KEY = 'barbershop_draft';
const DEBOUNCE_DELAY = 1000;

export const useBarberShopPersistence = (userId, language) => {
    const [persistedData, setPersistedData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    useEffect(() => {
        console.log('Persisted data:', persistedData);
    }, [persistedData]);

    // Map your existing form data structure
    const initialFormState = {
        currentStep: 1,
        shopData: {
            name: '',
            address: '',
            // phoneNumber: '',
            email: '',
            description: '',
            biography: '',
            services: [],
            availability: {},
            images: [],
            specialDates: {},
            categories: [],
            pricingTier: '€',
            employees: [],
            slotDuration: 30,
        },
        shopNameStatus: {
            isChecking: false,
            isAvailable: null,
            suggestions: [],
            similar: []
        },
        isPublished: false
    };

    // Load persisted data
    useEffect(() => {
        const loadData = async () => {
            try {
                const localData = localStorage.getItem(STORAGE_KEY);
                if (localData) {
                    const parsed = JSON.parse(localData);
                    // Preserve phone number if it exists
                    // if (parsed.shopData?.phoneNumber) {
                    //     setPersistedData({
                    //         ...parsed,
                    //         shopData: {
                    //             ...parsed.shopData,
                    //             phoneNumber: parsed.shopData.phoneNumber
                    //         }
                    //     });
                    // } else {
                    //     setPersistedData(parsed);
                    // }
                    setIsLoading(false);
                    return;
                }

                if (userId) {
                    const draftRef = doc(db, 'shopDrafts', userId);
                    const draftDoc = await getDoc(draftRef);

                    if (draftDoc.exists()) {
                        const firebaseData = draftDoc.data();
                        setPersistedData(firebaseData);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(firebaseData));
                    } else {
                        setPersistedData(initialFormState);
                    }
                }
            } catch (error) {
                console.error('Error loading draft:', error);
                setPersistedData(initialFormState);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [userId]);

    // Debounced Firebase save
    const saveToFirebase = useCallback(
        debounce(async (data) => {
            if (!userId) return;

            try {
                const draftRef = doc(db, 'shopDrafts', userId);
                await setDoc(draftRef, {
                    ...data,
                    lastUpdated: serverTimestamp(),
                    userId,
                    language
                }, {merge: true});
            } catch (error) {
                console.error('Error saving draft to Firebase:', error);
            }
        }, DEBOUNCE_DELAY),
        [userId, language]
    );

    // Save data to both storages
    const saveData = useCallback((newData) => {
        setHasUnsavedChanges(true);

        // Save to localStorage immediately
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
        setPersistedData(newData);

        // Debounced save to Firebase
        saveToFirebase(newData);
    }, [saveToFirebase]);

    // Clear draft
    const clearDraft = useCallback(async () => {
        try {
            localStorage.removeItem(STORAGE_KEY);
            if (userId) {
                const draftRef = doc(db, 'shopDrafts', userId);
                await setDoc(draftRef, {
                    deleted: true,
                    deletedAt: serverTimestamp()
                }, {merge: true});
            }
            setPersistedData(initialFormState);
            setHasUnsavedChanges(false);
        } catch (error) {
            console.error('Error clearing draft:', error);
        }
    }, [userId]);

    // Handle browser close/refresh warning
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                const message = language === 'tr' ? 'Kaydedilmemiş değişiklikleriniz var. Çıkmak istediğinizden emin misiniz?' :
                    language === 'ar' ? 'لديك تغييرات غير محفوظة. هل أنت متأكد أنك تريد المغادرة؟' :
                        language === 'de' ? 'Sie haben ungespeicherte Änderungen. Sind Sie sicher, dass Sie die Seite verlassen möchten?' :
                            'You have unsaved changes. Are you sure you want to leave?';
                e.returnValue = message;
                return message;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            // Flush any pending saves
            if (hasUnsavedChanges) {
                saveToFirebase.flush();
            }
        };
    }, [hasUnsavedChanges, language, saveToFirebase]);

    return {
        persistedData,
        saveData,
        isLoading,
        hasUnsavedChanges,
        setHasUnsavedChanges,
        clearDraft,
        initialFormState
    };
};