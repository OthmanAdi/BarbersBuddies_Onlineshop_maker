import React, {useEffect, useState} from 'react';
import {AreaChart} from "@tremor/react";
import {CheckCircle, DollarSign, TrendingDown, TrendingUp, Users, XCircle} from 'lucide-react';
import {Cell, Pie, PieChart, ResponsiveContainer, Tooltip} from 'recharts';
import MinimalTrendsChart from "./BookingTrendsChart";
import ResponsiveTrendsChart from "./ResponsiveTrendsChart";
import {AnimatePresence, motion} from 'framer-motion';

const valueFormatter = (number) =>
    new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "EUR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(number);

const percentageFormatter = (number) =>
    new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(number / 100);

// Custom tooltip component for charts
const CustomTooltip = ({active, payload, label}) => {
    if (!active || !payload) return null;

    return (
        <div className="bg-base-200 border border-base-300 rounded-lg shadow-xl p-3">
            <p className="text-base-content font-medium mb-2">{label}</p>
            {payload.map((entry, index) => (
                <div key={index} className="flex items-center gap-2 text-sm">
                    <div
                        className="w-3 h-3 rounded-full"
                        style={{backgroundColor: entry.color}}
                    />
                    <span className="text-base-content/80">{entry.name}:</span>
                    <span className="text-base-content font-medium">
                        {entry.name === 'revenue' ? '€' : ''}{entry.value}
                    </span>
                </div>
            ))}
        </div>
    );
};

const CustomAreaChart = ({data}) => (
    <AreaChart
        data={data}
        index="name"
        categories={["completed", "cancelled", "pending", "revenue"]} // Changed categories
        colors={["emerald", "rose", "amber", "cyan"]} // Changed colors
        valueFormatter={(value, category) =>
            category === "revenue" ? `€${value}` : value.toFixed(0)
        }
        showLegend={true}
        yAxisWidth={60}
        showAnimation={true}
        className="h-[300px] text-base-content"
        customTooltip={CustomTooltip}
        curveType="monotone"
        showXAxis={true}
        showYAxis={true}
        showGridLines={true}
        autoMinValue={true}
        startEndOnly={data.length > 10}
        style={{
            '--tremor-background-color': 'transparent',
            '--tremor-border-color': 'hsl(var(--bc) / 0.2)',
            '--tremor-brand-color': 'hsl(var(--p))',
            '--tremor-ring-color': 'hsl(var(--p))',
            '--tremor-track-color': 'transparent',
            '--tremor-text-color': 'hsl(var(--bc))',
        }}
    />
);

const CustomPieChart = ({data}) => {
    const [dimensions, setDimensions] = useState({
        outer: 200,
        inner: 160
    });

    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width <= 496) {
                // Calculate proportional sizes
                const scale = Math.max(0.5, width / 496); // Min scale of 0.5
                setDimensions({
                    outer: Math.floor(200 * scale),
                    inner: Math.floor(160 * scale)
                });
            } else {
                // Reset to default sizes
                setDimensions({
                    outer: 200,
                    inner: 160
                });
            }
        };

        // Initial call
        handleResize();

        // Add event listener
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const COLORS = {
        Completed: {
            primary: 'hsl(142, 76%, 36%)',
            gradient: ['hsl(142, 76%, 36%)', 'hsl(142, 76%, 46%)']
        },
        Cancelled: {
            primary: 'hsl(0, 84%, 60%)',
            gradient: ['hsl(0, 84%, 60%)', 'hsl(0, 84%, 70%)']
        },
        Pending: {
            primary: 'hsl(45, 93%, 47%)',
            gradient: ['hsl(45, 93%, 47%)', 'hsl(45, 93%, 57%)']
        }
    };

    const total = data.reduce((sum, entry) => sum + entry.value, 0);
    const enrichedData = data.map(entry => ({
        ...entry,
        percent: entry.value / total,
        fill: COLORS[entry.name].primary,
        gradient: COLORS[entry.name].gradient
    }));

    const CustomTooltip = ({active, payload}) => {
        if (!active || !payload || !payload.length) return null;
        const entry = payload[0].payload;

        return (
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-base-100/80 backdrop-blur-lg border border-base-200 shadow-2xl rounded-xl p-6"
            >
                <div className="space-y-4">
                    <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded-full" style={{
                            background: `linear-gradient(135deg, ${entry.gradient[0]}, ${entry.gradient[1]})`
                        }}/>
                        <h4 className="text-base-content font-bold text-xl">
                            {entry.name}
                        </h4>
                    </div>

                    <div className="grid gap-3">
                        <div>
                            <p className="text-xs text-base-content/60 font-medium">Total Count</p>
                            <p className="text-base-content font-bold text-2xl font-mono">
                                {entry.value.toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-base-content/60 font-medium">Share</p>
                            <p className="text-base-content font-bold text-2xl font-mono">
                                {(entry.percent * 100).toFixed(1)}%
                            </p>
                        </div>
                    </div>
                </div>
            </motion.div>
        );
    };

    return (
        <div className="w-full h-[600px] relative">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <defs>
                        {enrichedData.map((entry, index) => (
                            <linearGradient
                                key={`gradient-${index}`}
                                id={`gradient-${entry.name}`}
                                x1="0" y1="0" x2="1" y2="1"
                            >
                                <stop offset="0%" stopColor={entry.gradient[0]} stopOpacity={0.95}/>
                                <stop offset="100%" stopColor={entry.gradient[1]} stopOpacity={0.95}/>
                            </linearGradient>
                        ))}
                    </defs>
                    <Pie
                        data={enrichedData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={dimensions.outer}
                        innerRadius={dimensions.inner}
                        dataKey="value"
                        nameKey="name"
                        className="filter drop-shadow-xl"
                        strokeWidth={1}
                        stroke="white"
                    >
                        {enrichedData.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={`url(#gradient-${entry.name})`}
                                className="transition-all duration-300 hover:opacity-90 hover:scale-105 origin-center"
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        content={<CustomTooltip/>}
                        wrapperStyle={{outline: 'none', zIndex: 20}}
                    />
                </PieChart>
            </ResponsiveContainer>

            {/* Center Stats with Animation */}
            <motion.div
                initial={false}
                animate={{scale: [0.95, 1, 0.95]}}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
            >
                <div
                    className="text-center bg-base-100/30 backdrop-blur-md rounded-full p-12 transform scale-90 md:scale-100">
                    <p className="text-base-content/70 text-sm font-medium uppercase tracking-wider">Total</p>
                    <h3 className="text-4xl md:text-5xl font-bold text-base-content mt-2 font-mono">
                        {total.toLocaleString()}
                    </h3>
                    <p className="text-base-content/70 text-xs md:text-sm mt-2">Bookings</p>
                </div>
            </motion.div>

            {/* Legend */}
            <div className="absolute top-0 right-0 p-4 space-y-2">
                {enrichedData.map((entry, index) => (
                    <motion.div
                        key={index}
                        initial={{x: 20, opacity: 0}}
                        animate={{x: 0, opacity: 1}}
                        transition={{delay: index * 0.1}}
                        className="flex items-center gap-2"
                    >
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{
                                background: `linear-gradient(135deg, ${entry.gradient[0]}, ${entry.gradient[1]})`
                            }}
                        />
                        <span className="text-sm font-medium text-base-content/80">
                            {entry.name}
                        </span>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};


const AnalyticsDashboard = ({stats, chartData, selectedDateRange, onRangeChange}) => {  // Add onRangeChange here
    // console.log('ANALYTICS DASHBOARD RECEIVED:', {
    //     stats,
    //     chartData,
    //     selectedDateRange,
    //     onRangeChange
    // });
    const bookingDistribution = [
        {
            name: 'Completed',
            value: stats?.completedBookings || 0,
        },
        {
            name: 'Cancelled',
            value: stats?.cancelledBookings || 0,
        },
        {
            name: 'Pending',
            value: (stats?.totalBookings || 0) - ((stats?.completedBookings || 0) + (stats?.cancelledBookings || 0)),
        }
    ];


    return (
        <div className="w-full space-y-8">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Total Bookings Card */}
                <div className="card bg-base-100 hover:bg-base-200 transition-colors shadow-md">
                    <div className="card-body">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center">
                                <Users className="w-6 h-6 text-primary"/>
                            </div>
                            <div className="bg-base-300 px-2 py-1 rounded-lg flex items-center gap-1">
                                {stats?.bookingsGrowth >= 0 ? (
                                    <TrendingUp className="w-4 h-4 text-success"/>
                                ) : (
                                    <TrendingDown className="w-4 h-4 text-error"/>
                                )}
                                <span className={`text-sm font-semibold ${
                                    stats?.bookingsGrowth >= 0 ? 'text-success' : 'text-error'
                                }`}>
                                    {Math.abs(stats?.bookingsGrowth || 0)}%
                                </span>
                            </div>
                        </div>
                        <div className="mt-4">
                            <h2 className="text-3xl font-bold text-base-content">{stats?.totalBookings || 0}</h2>
                            <p className="text-base-content/60 text-sm mt-1">Total Appointments</p>
                        </div>
                    </div>
                </div>

                {/* Completed Bookings */}
                <div className="card bg-base-100 hover:bg-base-200 transition-colors shadow-md">
                    <div className="card-body">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-success/20 flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-success"/>
                            </div>
                            <div className="bg-base-300 px-2 py-1 rounded-lg flex items-center gap-1">
                                {stats?.completedGrowth >= 0 ? (
                                    <TrendingUp className="w-4 h-4 text-success"/>
                                ) : (
                                    <TrendingDown className="w-4 h-4 text-error"/>
                                )}
                                <span className={`text-sm font-semibold ${
                                    stats?.completedGrowth >= 0 ? 'text-success' : 'text-error'
                                }`}>
                    {Math.abs(stats?.completedGrowth || 0)}%
                </span>
                            </div>
                        </div>
                        <div className="mt-4">
                            <h2 className="text-3xl font-bold text-base-content">{stats?.completedBookings || 0}</h2>
                            <p className="text-base-content/60 text-sm mt-1">Completed Sessions</p>
                        </div>
                    </div>
                </div>

                {/* Cancelled Bookings */}
                <div className="card bg-base-100 hover:bg-base-200 transition-colors shadow-md">
                    <div className="card-body">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-error/20 flex items-center justify-center">
                                <XCircle className="w-6 h-6 text-error"/>
                            </div>
                            <div className="bg-base-300 px-2 py-1 rounded-lg flex items-center gap-1">
                                {stats?.cancelledGrowth >= 0 ? (
                                    <TrendingUp className="w-4 h-4 text-success"/>
                                ) : (
                                    <TrendingDown className="w-4 h-4 text-error"/>
                                )}
                                <span className={`text-sm font-semibold ${
                                    stats?.cancelledGrowth >= 0 ? 'text-success' : 'text-error'
                                }`}>
                    {Math.abs(stats?.cancelledGrowth || 0)}%
                </span>
                            </div>
                        </div>
                        <div className="mt-4">
                            <h2 className="text-3xl font-bold text-base-content">{stats?.cancelledBookings || 0}</h2>
                            <p className="text-base-content/60 text-sm mt-1">Cancelled Sessions</p>
                        </div>
                    </div>
                </div>

                {/* Revenue Card */}
                <div className="card bg-base-100 hover:bg-base-200 transition-colors shadow-md">
                    <div className="card-body">
                        <div className="flex items-center justify-between">
                            <div className="w-12 h-12 rounded-2xl bg-secondary/20 flex items-center justify-center">
                                <DollarSign className="w-6 h-6 text-secondary"/>
                            </div>
                            <div className="bg-base-300 px-2 py-1 rounded-lg flex items-center gap-1">
                                {stats?.revenueGrowth >= 0 ? (
                                    <TrendingUp className="w-4 h-4 text-success"/>
                                ) : (
                                    <TrendingDown className="w-4 h-4 text-error"/>
                                )}
                                <span className={`text-sm font-semibold ${
                                    stats?.revenueGrowth >= 0 ? 'text-success' : 'text-error'
                                }`}>
                    {Math.abs(stats?.revenueGrowth || 0)}%
                </span>
                            </div>
                        </div>
                        <div className="mt-4">
                            <h2 className="text-3xl font-bold text-base-content">
                                €{stats?.revenue?.toFixed(2) || '0.00'}
                            </h2>
                            <p className="text-base-content/60 text-sm mt-1">Total Revenue</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Trend Analysis */}
                <ResponsiveTrendsChart
                    data={chartData}
                    selectedDateRange={selectedDateRange}
                    onRangeChange={onRangeChange}
                />

                {/* Distribution Analysis */}
                <div className="card bg-base-100 hover:bg-base-200 transition-colors shadow-md">
                    <div className="card-body">
                        <div className="space-y-3">
                            <h3 className="text-lg font-semibold text-base-content">Booking Distribution</h3>
                            <CustomPieChart data={bookingDistribution}/>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;