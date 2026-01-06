import React, { useState, useEffect, useContext } from 'react';
import { motion } from 'framer-motion';
import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts';
import {
    TrendingUp, TrendingDown, Users, CheckCircle, XCircle, Calendar, DollarSign
} from 'lucide-react';
import LanguageContext from './LanguageContext';
import ThemeContext from './ThemeContext';

// Define translations
const translations = {
    en: {
        'analytics.businessAnalytics': 'Business Analytics',
        'analytics.bookingTrends': 'Booking Trends',
        'analytics.revenue': 'Revenue',
        'analytics.totalAppointments': 'Total Appointments',
        'analytics.completedSessions': 'Completed Sessions',
        'analytics.cancelledAppointments': 'Cancelled Appointments',
        'analytics.totalRevenue': 'Total Revenue',
        'analytics.popularServices': 'Popular Services',
        'analytics.bookings': 'Bookings',
        'analytics.rank': 'Rank',
        'analytics.service': 'Service',
        'analytics.price': 'Avg. Price',
        'calendar.day': 'Day',
        'calendar.week': 'Week',
        'calendar.month': 'Month',
        'calendar.year': 'Year',
        'calendar.date': 'Date'
    },
    tr: {
        'analytics.businessAnalytics': 'İş Analitiği',
        'analytics.bookingTrends': 'Rezervasyon Trendleri',
        'analytics.revenue': 'Gelir',
        'analytics.totalAppointments': 'Toplam Randevular',
        'analytics.completedSessions': 'Tamamlanan Seanslar',
        'analytics.cancelledAppointments': 'İptal Edilen Randevular',
        'analytics.totalRevenue': 'Toplam Gelir',
        'analytics.popularServices': 'Popüler Hizmetler',
        'analytics.bookings': 'Rezervasyonlar',
        'analytics.rank': 'Sıra',
        'analytics.service': 'Hizmet',
        'analytics.price': 'Ort. Fiyat',
        'calendar.day': 'Gün',
        'calendar.week': 'Hafta',
        'calendar.month': 'Ay',
        'calendar.year': 'Yıl',
        'calendar.date': 'Tarih'
    },
    ar: {
        'analytics.businessAnalytics': 'تحليلات الأعمال',
        'analytics.bookingTrends': 'اتجاهات الحجز',
        'analytics.revenue': 'الإيرادات',
        'analytics.totalAppointments': 'إجمالي المواعيد',
        'analytics.completedSessions': 'الجلسات المكتملة',
        'analytics.cancelledAppointments': 'المواعيد الملغاة',
        'analytics.totalRevenue': 'إجمالي الإيرادات',
        'analytics.popularServices': 'الخدمات الشعبية',
        'analytics.bookings': 'الحجوزات',
        'analytics.rank': 'الترتيب',
        'analytics.service': 'الخدمة',
        'analytics.price': 'متوسط السعر',
        'calendar.day': 'يوم',
        'calendar.week': 'أسبوع',
        'calendar.month': 'شهر',
        'calendar.year': 'سنة',
        'calendar.date': 'التاريخ'
    },
    de: {
        'analytics.businessAnalytics': 'Geschäftsanalyse',
        'analytics.bookingTrends': 'Buchungstrends',
        'analytics.revenue': 'Umsatz',
        'analytics.totalAppointments': 'Gesamttermine',
        'analytics.completedSessions': 'Abgeschlossene Sitzungen',
        'analytics.cancelledAppointments': 'Stornierte Termine',
        'analytics.totalRevenue': 'Gesamtumsatz',
        'analytics.popularServices': 'Beliebte Dienstleistungen',
        'analytics.bookings': 'Buchungen',
        'analytics.rank': 'Rang',
        'analytics.service': 'Dienstleistung',
        'analytics.price': 'Durchschn. Preis',
        'calendar.day': 'Tag',
        'calendar.week': 'Woche',
        'calendar.month': 'Monat',
        'calendar.year': 'Jahr',
        'calendar.date': 'Datum'
    }
};

const ShopAnalyticsTab = ({ shop, user }) => {
    const [timeRange, setTimeRange] = useState('week'); // 'day', 'week', 'month', 'year'
    const [statsData, setStatsData] = useState(null);
    const [bookingData, setBookingData] = useState([]);
    const [serviceData, setServiceData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const { language } = useContext(LanguageContext);
    const { theme } = useContext(ThemeContext);

    // Get translations based on language
    const getTranslation = (key) => {
        const currentTranslations = translations[language] || translations.en;
        return currentTranslations[key] || key;
    };

    // Define chart colors based on theme
    const getChartColors = () => {
        return theme === 'dark'
            ? ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#a3e635'] // Lighter colors for dark theme
            : ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#84cc16']; // Darker colors for light theme
    };

    useEffect(() => {
        if (!shop?.id) return;

        const fetchAnalyticsData = async () => {
            setIsLoading(true);
            console.log('Fetching analytics data for shop:', shop.id, 'time range:', timeRange);

            try {
                // Calculate date range based on selected time range
                const endDate = new Date();
                let startDate = new Date();

                switch(timeRange) {
                    case 'day':
                        startDate.setDate(startDate.getDate() - 1);
                        break;
                    case 'week':
                        startDate.setDate(startDate.getDate() - 7);
                        break;
                    case 'month':
                        startDate.setMonth(startDate.getMonth() - 1);
                        break;
                    case 'year':
                        startDate.setFullYear(startDate.getFullYear() - 1);
                        break;
                    default:
                        startDate.setDate(startDate.getDate() - 7); // Default to week
                }

                // Format dates for query
                const startDateStr = startDate.toISOString().split('T')[0];
                const endDateStr = endDate.toISOString().split('T')[0];

                console.log('Date range:', startDateStr, 'to', endDateStr);

                // Query bookings
                const bookingsRef = collection(db, 'bookings');
                const q = query(
                    bookingsRef,
                    where('shopId', '==', shop.id),
                    where('selectedDate', '>=', startDateStr),
                    where('selectedDate', '<=', endDateStr)
                );

                const querySnapshot = await getDocs(q);
                const bookings = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log(`Fetched ${bookings.length} bookings for analysis`);

                // Calculate statistics
                const totalBookings = bookings.length;
                const completedBookings = bookings.filter(b => b.status === 'completed').length;
                const cancelledBookings = bookings.filter(b => b.status === 'cancelled').length;
                const pendingBookings = bookings.filter(b => b.status === 'pending').length;
                const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;

                // Calculate total revenue
                let totalRevenue = 0;
                bookings.forEach(booking => {
                    if (booking.status !== 'cancelled') {
                        const bookingRevenue = booking.selectedServices?.reduce(
                            (sum, service) => sum + parseFloat(service.price), 0
                        ) || 0;
                        totalRevenue += bookingRevenue;
                    }
                });

                // Format for proper date display based on language
                const dateFormatter = new Intl.DateTimeFormat(
                    language === 'en' ? 'en-US' :
                        language === 'tr' ? 'tr-TR' :
                            language === 'ar' ? 'ar-EG' : 'de-DE',
                    {
                        day: 'numeric',
                        month: 'short',
                        year: timeRange === 'year' ? 'numeric' : undefined
                    }
                );

                // Group bookings by date
                const bookingsByDate = {};
                const now = new Date();

                // Initialize all dates in range
                let current = new Date(startDate);
                while (current <= now) {
                    const dateKey = current.toISOString().split('T')[0];
                    bookingsByDate[dateKey] = {
                        date: dateKey,
                        name: dateFormatter.format(current),
                        total: 0,
                        completed: 0,
                        cancelled: 0,
                        pending: 0,
                        confirmed: 0,
                        revenue: 0
                    };

                    // Increment based on timeRange
                    if (timeRange === 'day') {
                        current.setHours(current.getHours() + 1);
                    } else if (timeRange === 'week' || timeRange === 'month') {
                        current.setDate(current.getDate() + 1);
                    } else {
                        current.setMonth(current.getMonth() + 1);
                    }
                }

                // Fill in actual booking data
                bookings.forEach(booking => {
                    const dateKey = booking.selectedDate;
                    if (bookingsByDate[dateKey]) {
                        bookingsByDate[dateKey].total++;

                        if (booking.status === 'completed') {
                            bookingsByDate[dateKey].completed++;
                        } else if (booking.status === 'cancelled') {
                            bookingsByDate[dateKey].cancelled++;
                        } else if (booking.status === 'pending') {
                            bookingsByDate[dateKey].pending++;
                        } else if (booking.status === 'confirmed') {
                            bookingsByDate[dateKey].confirmed++;
                        }

                        if (booking.status !== 'cancelled') {
                            const bookingRevenue = booking.selectedServices?.reduce(
                                (sum, service) => sum + parseFloat(service.price), 0
                            ) || 0;
                            bookingsByDate[dateKey].revenue += bookingRevenue;
                        }
                    }
                });

                // Convert to array for charts
                const bookingChartData = Object.values(bookingsByDate);
                console.log('Prepared booking chart data with', bookingChartData.length, 'data points');

                // Calculate popular services
                const serviceStats = {};
                bookings.forEach(booking => {
                    if (booking.status !== 'cancelled' && booking.selectedServices) {
                        booking.selectedServices.forEach(service => {
                            if (!serviceStats[service.name]) {
                                serviceStats[service.name] = {
                                    name: service.name,
                                    count: 0,
                                    revenue: 0
                                };
                            }
                            serviceStats[service.name].count++;
                            serviceStats[service.name].revenue += parseFloat(service.price);
                        });
                    }
                });

                const serviceChartData = Object.values(serviceStats).sort((a, b) => b.count - a.count);
                console.log('Prepared service popularity data for', serviceChartData.length, 'services');

                // Calculate growth compared to previous period
                // For demonstration, we're using example growth rates
                // In a real app, this would compare to actual historical data
                const previousPeriodStats = {
                    totalBookings: Math.round(totalBookings * 0.9),
                    completedBookings: Math.round(completedBookings * 0.85),
                    totalRevenue: totalRevenue * 0.92
                };

                const bookingsGrowth = previousPeriodStats.totalBookings > 0
                    ? ((totalBookings - previousPeriodStats.totalBookings) / previousPeriodStats.totalBookings * 100).toFixed(1)
                    : 100;

                const completedGrowth = previousPeriodStats.completedBookings > 0
                    ? ((completedBookings - previousPeriodStats.completedBookings) / previousPeriodStats.completedBookings * 100).toFixed(1)
                    : 100;

                const revenueGrowth = previousPeriodStats.totalRevenue > 0
                    ? ((totalRevenue - previousPeriodStats.totalRevenue) / previousPeriodStats.totalRevenue * 100).toFixed(1)
                    : 100;

                // Set state with calculated data
                setStatsData({
                    totalBookings,
                    completedBookings,
                    cancelledBookings,
                    pendingBookings,
                    confirmedBookings,
                    totalRevenue,
                    bookingsGrowth,
                    completedGrowth,
                    revenueGrowth
                });

                setBookingData(bookingChartData);
                setServiceData(serviceChartData);

            } catch (error) {
                console.error('Error fetching analytics data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchAnalyticsData();
    }, [shop.id, timeRange, language]);

    const COLORS = getChartColors();

    if (isLoading) {
        return (
            <div className="h-full flex items-center justify-center">
                <motion.div
                    className="loading loading-spinner text-primary"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Time Range Selector */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                <h3 className="text-lg font-bold">{getTranslation('analytics.businessAnalytics')}</h3>

                <div className="join">
                    <button
                        className={`join-item btn btn-sm ${timeRange === 'day' ? 'btn-active' : 'btn-outline'}`}
                        onClick={() => setTimeRange('day')}
                    >
                        {getTranslation('calendar.day')}
                    </button>
                    <button
                        className={`join-item btn btn-sm ${timeRange === 'week' ? 'btn-active' : 'btn-outline'}`}
                        onClick={() => setTimeRange('week')}
                    >
                        {getTranslation('calendar.week')}
                    </button>
                    <button
                        className={`join-item btn btn-sm ${timeRange === 'month' ? 'btn-active' : 'btn-outline'}`}
                        onClick={() => setTimeRange('month')}
                    >
                        {getTranslation('calendar.month')}
                    </button>
                    <button
                        className={`join-item btn btn-sm ${timeRange === 'year' ? 'btn-active' : 'btn-outline'}`}
                        onClick={() => setTimeRange('year')}
                    >
                        {getTranslation('calendar.year')}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {/* Total Appointments Card */}
                <motion.div
                    className="card bg-base-100 shadow-sm"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="card-body p-4">
                        <div className="flex justify-between items-start">
                            <div className="rounded-full p-2 bg-primary/20">
                                <Calendar className="w-5 h-5 text-primary" />
                            </div>
                            <div className={`text-sm flex items-center ${parseFloat(statsData.bookingsGrowth) >= 0 ? 'text-success' : 'text-error'}`}>
                                {parseFloat(statsData.bookingsGrowth) >= 0 ? (
                                    <TrendingUp className="w-4 h-4 mr-1" />
                                ) : (
                                    <TrendingDown className="w-4 h-4 mr-1" />
                                )}
                                {Math.abs(parseFloat(statsData.bookingsGrowth))}%
                            </div>
                        </div>
                        <div className="mt-2">
                            <h2 className="card-title text-2xl">{statsData.totalBookings}</h2>
                            <p className="text-sm text-base-content/60">{getTranslation('analytics.totalAppointments')}</p>
                        </div>
                    </div>
                </motion.div>

                {/* Completed Sessions Card */}
                <motion.div
                    className="card bg-base-100 shadow-sm"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    <div className="card-body p-4">
                        <div className="flex justify-between items-start">
                            <div className="rounded-full p-2 bg-success/20">
                                <CheckCircle className="w-5 h-5 text-success" />
                            </div>
                            <div className={`text-sm flex items-center ${parseFloat(statsData.completedGrowth) >= 0 ? 'text-success' : 'text-error'}`}>
                                {parseFloat(statsData.completedGrowth) >= 0 ? (
                                    <TrendingUp className="w-4 h-4 mr-1" />
                                ) : (
                                    <TrendingDown className="w-4 h-4 mr-1" />
                                )}
                                {Math.abs(parseFloat(statsData.completedGrowth))}%
                            </div>
                        </div>
                        <div className="mt-2">
                            <h2 className="card-title text-2xl">{statsData.completedBookings}</h2>
                            <p className="text-sm text-base-content/60">{getTranslation('analytics.completedSessions')}</p>
                        </div>
                    </div>
                </motion.div>

                {/* Cancelled Appointments Card */}
                <motion.div
                    className="card bg-base-100 shadow-sm"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.2 }}
                >
                    <div className="card-body p-4">
                        <div className="flex justify-between items-start">
                            <div className="rounded-full p-2 bg-error/20">
                                <XCircle className="w-5 h-5 text-error" />
                            </div>
                            <div className="text-sm">{statsData.cancelledBookings} / {statsData.totalBookings}</div>
                        </div>
                        <div className="mt-2">
                            <h2 className="card-title text-2xl">{statsData.cancelledBookings}</h2>
                            <p className="text-sm text-base-content/60">{getTranslation('analytics.cancelledAppointments')}</p>
                        </div>
                    </div>
                </motion.div>

                {/* Total Revenue Card */}
                <motion.div
                    className="card bg-base-100 shadow-sm"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.3 }}
                >
                    <div className="card-body p-4">
                        <div className="flex justify-between items-start">
                            <div className="rounded-full p-2 bg-secondary/20">
                                <DollarSign className="w-5 h-5 text-secondary" />
                            </div>
                            <div className={`text-sm flex items-center ${parseFloat(statsData.revenueGrowth) >= 0 ? 'text-success' : 'text-error'}`}>
                                {parseFloat(statsData.revenueGrowth) >= 0 ? (
                                    <TrendingUp className="w-4 h-4 mr-1" />
                                ) : (
                                    <TrendingDown className="w-4 h-4 mr-1" />
                                )}
                                {Math.abs(parseFloat(statsData.revenueGrowth))}%
                            </div>
                        </div>
                        <div className="mt-2">
                            <h2 className="card-title text-2xl">€{statsData.totalRevenue.toFixed(2)}</h2>
                            <p className="text-sm text-base-content/60">{getTranslation('analytics.totalRevenue')}</p>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-4 overflow-hidden">
                {/* Bookings Chart */}
                <motion.div
                    className="card bg-base-100 shadow-sm"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="card-body p-4">
                        <h3 className="card-title text-lg">{getTranslation('analytics.bookingTrends')}</h3>
                        <div className="w-full h-64 mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart
                                    data={bookingData}
                                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                    <XAxis
                                        dataKey="name"
                                        stroke={theme === 'dark' ? '#aaa' : '#888'}
                                        style={{
                                            fontSize: '0.75rem',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                    <YAxis
                                        stroke={theme === 'dark' ? '#aaa' : '#888'}
                                        style={{
                                            fontSize: '0.75rem',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                    <Tooltip
                                        formatter={(value) => [value, '']}
                                        labelFormatter={(label) => `${getTranslation('calendar.date')}: ${label}`}
                                        contentStyle={{
                                            backgroundColor: theme === 'dark' ? '#2a2a2a' : '#fff',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            color: theme === 'dark' ? '#eee' : '#333'
                                        }}
                                    />
                                    <Legend />
                                    <Line type="monotone" dataKey="completed" stroke={COLORS[1]} strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="confirmed" stroke={COLORS[0]} strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="pending" stroke={COLORS[2]} strokeWidth={2} dot={{ r: 3 }} />
                                    <Line type="monotone" dataKey="cancelled" stroke={COLORS[3]} strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </motion.div>

                {/* Revenue Chart */}
                <motion.div
                    className="card bg-base-100 shadow-sm"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="card-body p-4">
                        <h3 className="card-title text-lg">{getTranslation('analytics.revenue')}</h3>
                        <div className="w-full h-64 mt-4">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={bookingData}
                                    margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                    <XAxis
                                        dataKey="name"
                                        stroke={theme === 'dark' ? '#aaa' : '#888'}
                                        style={{
                                            fontSize: '0.75rem',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                    <YAxis
                                        stroke={theme === 'dark' ? '#aaa' : '#888'}
                                        style={{
                                            fontSize: '0.75rem',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                    <Tooltip
                                        formatter={(value) => [`€${value.toFixed(2)}`, getTranslation('analytics.revenue')]}
                                        labelFormatter={(label) => `${getTranslation('calendar.date')}: ${label}`}
                                        contentStyle={{
                                            backgroundColor: theme === 'dark' ? '#2a2a2a' : '#fff',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            color: theme === 'dark' ? '#eee' : '#333'
                                        }}
                                    />
                                    <Bar dataKey="revenue" fill={COLORS[4]} name={getTranslation('analytics.revenue')} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </motion.div>
            </div>

            {/* Service Popularity */}
            <motion.div
                className="card bg-base-100 shadow-sm mb-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 }}
            >
                <div className="card-body p-4">
                    <h3 className="card-title text-lg">{getTranslation('analytics.popularServices')}</h3>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="w-full h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={serviceData.slice(0, 6)}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="count"
                                        nameKey="name"
                                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {serviceData.slice(0, 6).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value) => [value, getTranslation('analytics.bookings')]}
                                        contentStyle={{
                                            backgroundColor: theme === 'dark' ? '#2a2a2a' : '#fff',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            color: theme === 'dark' ? '#eee' : '#333'
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="w-full h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={serviceData.slice(0, 6)}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 70, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.1)" />
                                    <XAxis
                                        type="number"
                                        stroke={theme === 'dark' ? '#aaa' : '#888'}
                                        style={{
                                            fontSize: '0.75rem',
                                            fontFamily: 'inherit'
                                        }}
                                    />
                                    <YAxis
                                        type="category"
                                        dataKey="name"
                                        stroke={theme === 'dark' ? '#aaa' : '#888'}
                                        width={70}
                                        style={{
                                            fontSize: '0.75rem',
                                            fontFamily: 'inherit'
                                        }}
                                        tickFormatter={(value) =>
                                            value.length > 10 ? `${value.substring(0, 10)}...` : value
                                        }
                                    />
                                    <Tooltip
                                        formatter={(value) => [`€${value.toFixed(2)}`, getTranslation('analytics.revenue')]}
                                        contentStyle={{
                                            backgroundColor: theme === 'dark' ? '#2a2a2a' : '#fff',
                                            border: 'none',
                                            borderRadius: '0.375rem',
                                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            color: theme === 'dark' ? '#eee' : '#333'
                                        }}
                                    />
                                    <Bar dataKey="revenue" fill={COLORS[5]} name={getTranslation('analytics.revenue')} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Service Ranking Table */}
                    <div className="overflow-x-auto mt-4">
                        <table className="table table-xs">
                            <thead>
                            <tr>
                                <th>{getTranslation('analytics.rank')}</th>
                                <th>{getTranslation('analytics.service')}</th>
                                <th>{getTranslation('analytics.bookings')}</th>
                                <th>{getTranslation('analytics.revenue')}</th>
                                <th>{getTranslation('analytics.price')}</th>
                            </tr>
                            </thead>
                            <tbody>
                            {serviceData.slice(0, 6).map((service, index) => (
                                <motion.tr
                                    key={service.name}
                                    className={index < 3 ? 'font-medium' : ''}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.1 * index, duration: 0.2 }}
                                >
                                    <td>{index + 1}</td>
                                    <td>{service.name}</td>
                                    <td>{service.count}</td>
                                    <td>€{service.revenue.toFixed(2)}</td>
                                    <td>€{(service.revenue / service.count).toFixed(2)}</td>
                                </motion.tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default ShopAnalyticsTab;