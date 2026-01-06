import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { onAuthStateChanged } from '../firebase';
import { Calendar, BarChart, Scissors, Users, Settings } from 'lucide-react';
import ShopTabContent from './ShopTabContent';
import { useNavigate } from 'react-router-dom';
import LanguageContext from './LanguageContext';
import { useContext } from 'react';
import FooterPages from './FooterPages';

const ShopDashboard = () => {
    const [shops, setShops] = useState([]);
    const [activeTab, setActiveTab] = useState('calendar');
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [userType, setUserType] = useState(null);
    const navigate = useNavigate();
    const { language } = useContext(LanguageContext);

    const translations = {
        en: {
            calendar: "Calendar",
            analytics: "Analytics",
            services: "Services",
            team: "Team",
            availability: "Availability",
            payments: "Payments",
            loading: "Loading your dashboard...",
            noAccess: "You don't have access to this dashboard.",
            signInPrompt: "Please sign in to access your shop dashboard."
        },
        tr: {
            calendar: "Takvim",
            analytics: "Analitik",
            services: "Hizmetler",
            team: "Ekip",
            availability: "Müsaitlik",
            payments: "Ödemeler",
            loading: "Kontrol paneliniz yükleniyor...",
            noAccess: "Bu kontrol paneline erişiminiz yok.",
            signInPrompt: "Dükkan kontrol panelinize erişmek için lütfen giriş yapın."
        },
        ar: {
            calendar: "التقويم",
            analytics: "التحليلات",
            services: "الخدمات",
            team: "الفريق",
            availability: "التوفر",
            payments: "المدفوعات",
            loading: "جارٍ تحميل لوحة التحكم الخاصة بك...",
            noAccess: "ليس لديك حق الوصول إلى لوحة التحكم هذه.",
            signInPrompt: "الرجاء تسجيل الدخول للوصول إلى لوحة تحكم المتجر الخاصة بك."
        },
        de: {
            calendar: "Kalender",
            analytics: "Analytik",
            services: "Dienstleistungen",
            team: "Team",
            availability: "Verfügbarkeit",
            payments: "Zahlungen",
            loading: "Ihr Dashboard wird geladen...",
            noAccess: "Sie haben keinen Zugriff auf dieses Dashboard.",
            signInPrompt: "Bitte melden Sie sich an, um auf Ihr Shop-Dashboard zuzugreifen."
        }
    };

    const t = translations[language] || translations.en;

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (currentUser) {
                setUser(currentUser);

                try {
                    // Fetch user type
                    const userDoc = await getDocs(query(
                        collection(db, 'users'),
                        where('uid', '==', currentUser.uid)
                    ));

                    if (!userDoc.empty) {
                        const userData = userDoc.docs[0].data();
                        setUserType(userData.userType);

                        // If not a shop owner, redirect
                        if (userData.userType !== 'shop-owner') {
                            navigate('/');
                            return;
                        }
                    }

                    // Fetch user's shops
                    const shopsQuery = query(
                        collection(db, 'barberShops'),
                        where('ownerId', '==', currentUser.uid)
                    );

                    const shopsSnapshot = await getDocs(shopsQuery);
                    const shopsData = shopsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    console.log('Fetched shops:', shopsData.length);
                    setShops(shopsData);

                } catch (error) {
                    console.error('Error fetching shop data:', error);
                } finally {
                    setLoading(false);
                }
            } else {
                // No user logged in
                setUser(null);
                setUserType(null);
                setLoading(false);
                navigate('/auth');
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    // Tab animations
    const tabVariants = {
        inactive: { opacity: 0.6, y: 0 },
        active: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 20 } },
        hover: { opacity: 0.8, y: -2, transition: { duration: 0.2 } }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base-200">
                <div className="text-center">
                    <div className="loading loading-spinner loading-lg text-primary"></div>
                    <p className="mt-4 text-lg font-medium">{t.loading}</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base-200">
                <div className="card bg-base-100 shadow-xl p-8 text-center">
                    <h2 className="text-2xl font-bold mb-4">{t.signInPrompt}</h2>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/auth')}
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    if (userType !== 'shop-owner') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-base-200">
                <div className="card bg-base-100 shadow-xl p-8 text-center">
                    <h2 className="text-2xl font-bold mb-4">{t.noAccess}</h2>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/')}
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-base-200">
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-8">Shop Dashboard</h1>

                {/* Tab Navigation */}
                <div className="mb-8 overflow-x-auto">
                    <div className="tabs tabs-boxed p-1 bg-base-100 inline-flex whitespace-nowrap">
                        {[
                            { id: 'calendar', icon: Calendar, label: t.calendar },
                            { id: 'analytics', icon: BarChart, label: t.analytics },
                            { id: 'services', icon: Scissors, label: t.services },
                            { id: 'team', icon: Users, label: t.team },
                            { id: 'availability', icon: Calendar, label: t.availability },
                            { id: 'payments', icon: Settings, label: t.payments }
                        ].map(tab => (
                            <motion.button
                                key={tab.id}
                                className={`tab tab-lg gap-2 ${activeTab === tab.id ? 'tab-active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                                variants={tabVariants}
                                initial="inactive"
                                animate={activeTab === tab.id ? "active" : "inactive"}
                                whileHover="hover"
                            >
                                <tab.icon className="w-5 h-5" />
                                {tab.label}
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="bg-base-100 shadow-xl rounded-box p-6 min-h-[70vh]">
                    <ShopTabContent
                        tab={activeTab}
                        shops={shops}
                        user={user}
                    />
                </div>
            </div>
            <FooterPages />
        </div>
    );
};

export default ShopDashboard;