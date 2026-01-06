import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {AnimatePresence, motion} from 'framer-motion';
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    CartesianGrid,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis
} from 'recharts';
import {
    ArrowUpRight,
    BarChart2,
    Calendar,
    LineChart as LineChartIcon,
    Minus,
    Plus,
    TrendingDown,
    TrendingUp
} from 'lucide-react';
import MetricsSummary from "./MetricsSummary";
import {useAnalyticsData} from "./fetchAnalyticsData";

// Common Constants
const CHART_TYPES = {
    LINE: {
        id: 'line', label: 'Line Chart', icon: LineChartIcon
    }, AREA: {
        id: 'area', label: 'Area View', icon: ArrowUpRight
    }, BAR: {
        id: 'bar', label: 'Bar Graph', icon: BarChart2
    }
};

const CHART_THEME = {
    revenue: {
        stroke: '#2563EB', fill: '#3B82F6', gradient: ['#3B82F620', '#3B82F600']
    }, upcoming: {
        stroke: '#16A34A', fill: '#22C55E', gradient: ['#22C55E20', '#22C55E00']
    }, cancelled: {
        stroke: '#DC2626', fill: '#EF4444', gradient: ['#EF444420', '#EF444400']
    }, completed: {
        stroke: '#9333EA', fill: '#A855F7', gradient: ['#A855F720', '#A855F700']
    }
};

// Shared Components
const DateDisplay = ({date, value, icon: Icon, color}) => (<div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-full bg-opacity-10 ${color}`}>
            <Icon className={`w-4 h-4 ${color}`}/>
        </div>
        <span className="font-medium text-sm">{date}</span>
        {value && <span className="font-semibold ml-2">{value}</span>}
    </div>);

const MetricItem = ({label, value, color, trend}) => (<div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{backgroundColor: color}}/>
            <span className="text-sm text-gray-600">{label}</span>
        </div>
        <div className="flex items-center gap-1">
            {trend !== undefined && (trend ? <TrendingUp className="w-3 h-3 text-green-500"/> :
                    <TrendingDown className="w-3 h-3 text-red-500"/>)}
            <span className="font-medium text-gray-900">{value}</span>
        </div>
    </div>);

const HoverCard = ({data}) => (<div className="bg-white rounded-lg shadow-lg border border-gray-100 p-4">
        <div className="space-y-3">
            <DateDisplay
                date={data.date}
                icon={Calendar}
                color="text-blue-500"
            />
            <div className="h-px bg-gray-100"/>
            <div className="grid gap-2">
                <MetricItem
                    label="Revenue"
                    value={`€${data.revenue}`}
                    color={CHART_THEME.revenue.stroke}
                    trend={data.revenue > 0}
                />
                <MetricItem
                    label="Completed"
                    value={data.completed}
                    color={CHART_THEME.completed.stroke}
                />
                <MetricItem
                    label="Upcoming"
                    value={data.upcoming}
                    color={CHART_THEME.upcoming.stroke}
                />
                <MetricItem
                    label="Cancelled"
                    value={data.cancelled}
                    color={CHART_THEME.cancelled.stroke}
                />
            </div>
        </div>
    </div>);

// Chart Renderer Component
const ChartRenderer = ({type, data, theme, onHover, isMobile = false}) => {
    if (!data || data.length === 0) return null;

    const commonProps = {
        data,
        margin: {top: 20, right: 30, left: 10, bottom: 5},
        onMouseMove: (e) => e.activePayload && onHover(e.activePayload[0].payload),
        onMouseLeave: () => onHover(null), ...(isMobile && {
            onTouchMove: (e) => e.activePayload && onHover(e.activePayload[0].payload), onTouchEnd: () => onHover(null)
        })
    };

    const renderChart = () => {
        switch (type) {
            case CHART_TYPES.LINE.id:
                return (<LineChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis
                            dataKey="date"
                            stroke="#6B7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            padding={{left: 10, right: 10}}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#6B7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke={theme.revenue.stroke}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={value => `€${value}`}
                        />
                        <Tooltip content={(props) => {
                            if (!props.payload || !props.payload[0]) return null;
                            return <HoverCard data={props.payload[0].payload}/>;
                        }}/>
                        <Legend/>
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="revenue"
                            stroke={theme.revenue.stroke}
                            strokeWidth={2}
                            dot={false}
                            name="Revenue"
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="completed"
                            stroke={theme.completed.stroke}
                            strokeWidth={2}
                            dot={false}
                            name="Completed"
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="cancelled"
                            stroke={theme.cancelled.stroke}
                            strokeWidth={2}
                            dot={false}
                            name="Cancelled"
                        />
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="upcoming"
                            stroke={theme.upcoming.stroke}
                            strokeWidth={2}
                            dot={false}
                            name="Upcoming"
                        />
                    </LineChart>);
            case CHART_TYPES.AREA.id:
                return (<AreaChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis
                            dataKey="date"
                            stroke="#6B7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#6B7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke={theme.revenue.stroke}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={value => `€${value}`}
                        />
                        <Tooltip content={(props) => {
                            if (!props.payload || !props.payload[0]) return null;
                            return <HoverCard data={props.payload[0].payload}/>;
                        }}/>
                        <Legend/>
                        <Area
                            yAxisId="right"
                            type="monotone"
                            dataKey="revenue"
                            stroke={theme.revenue.stroke}
                            fill={theme.revenue.fill}
                            name="Revenue"
                        />
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="completed"
                            stroke={theme.completed.stroke}
                            fill={theme.completed.fill}
                            name="Completed"
                        />
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="cancelled"
                            stroke={theme.cancelled.stroke}
                            fill={theme.cancelled.fill}
                            name="Cancelled"
                        />
                        <Area
                            yAxisId="left"
                            type="monotone"
                            dataKey="upcoming"
                            stroke={theme.upcoming.stroke}
                            fill={theme.upcoming.fill}
                            name="Upcoming"
                        />
                    </AreaChart>);
            case CHART_TYPES.BAR.id:
                return (<BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis
                            dataKey="date"
                            stroke="#6B7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="left"
                            stroke="#6B7280"
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            stroke={theme.revenue.stroke}
                            fontSize={12}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={value => `€${value}`}
                        />
                        <Tooltip content={(props) => {
                            if (!props.payload || !props.payload[0]) return null;
                            return <HoverCard data={props.payload[0].payload}/>;
                        }}/>
                        <Legend/>
                        <Bar
                            yAxisId="right"
                            dataKey="revenue"
                            fill={theme.revenue.fill}
                            name="Revenue"
                        />
                        <Bar
                            yAxisId="left"
                            dataKey="completed"
                            fill={theme.completed.fill}
                            name="Completed"
                        />
                        <Bar
                            yAxisId="left"
                            dataKey="cancelled"
                            fill={theme.cancelled.fill}
                            name="Cancelled"
                        />
                        <Bar
                            yAxisId="left"
                            dataKey="upcoming"
                            fill={theme.upcoming.fill}
                            name="Upcoming"
                        />
                    </BarChart>);
            default:
                return null;
        }
    };

    return (<ResponsiveContainer width="100%" height={isMobile ? 350 : 400}>
            {renderChart()}
        </ResponsiveContainer>);
};

// Main Components
const MobileTabletChart = ({selectedDateRange}) => {
    const [visualType, setVisualType] = useState(CHART_TYPES.LINE.id);
    const [hoveredData, setHoveredData] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [scrollPosition, setScrollPosition] = useState(0);
    const {data: rawData, isLoading} = useAnalyticsData(selectedDateRange);

    const handleZoom = useCallback((direction) => {
        setZoomLevel(prev => {
            const newZoom = direction === 'in' ? Math.min(prev + 0.5, 4) : Math.max(prev - 0.5, 1);
            return newZoom;
        });
    }, []);

    const handleScroll = useCallback((e) => {
        if (zoomLevel > 1) {
            const touch = e.touches[0];
            const diff = scrollPosition - touch.clientX;
            setScrollPosition(touch.clientX);
            e.currentTarget.scrollLeft += diff;
        }
    }, [zoomLevel, scrollPosition]);

    const chartData = useMemo(() => {
        if (!rawData || rawData.length === 0) {
            const today = new Date();
            return Array.from({length: 7}, (_, i) => {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                return {
                    date: date.toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric'
                    }), revenue: 0, completed: 0, cancelled: 0, upcoming: 0
                };
            }).reverse();
        }
        return rawData;
    }, [rawData]);

    return (<motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.3}}
            className="bg-white rounded-lg shadow-md overflow-hidden"
        >
            <div className="p-4 space-y-4">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <h2 className="text-lg font-bold text-gray-900">
                        Analytics Dashboard
                    </h2>
                    <p className="text-xs text-gray-500">
                        Real-time booking performance metrics
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <MetricsSummary data={chartData}/>
                </div>

                {/* Chart Type Selector */}
                <div className="flex justify-center gap-1 p-1 bg-gray-50 rounded-lg">
                    {Object.values(CHART_TYPES).map(({id, label, icon: Icon}) => (<button
                            key={id}
                            onClick={() => setVisualType(id)}
                            className={`flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${visualType === id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
                        >
                            <Icon className="w-3 h-3"/>
                            <span>{label}</span>
                        </button>))}
                </div>

                {/* Chart Section */}
                <div className="relative">
                    <div
                        className="overflow-x-auto touch-pan-x"
                        style={{
                            width: `${100 * zoomLevel}%`, minWidth: '100%'
                        }}
                        onTouchStart={e => setScrollPosition(e.touches[0].clientX)}
                        onTouchMove={handleScroll}
                    >
                        <div className="relative min-h-[350px]">
                            {isLoading ? (<div
                                    className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                                    <div
                                        className="w-6 h-6 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                                </div>) : (<ChartRenderer
                                    type={visualType}
                                    data={chartData}
                                    theme={CHART_THEME}
                                    onHover={setHoveredData}
                                    isMobile={true}
                                />)}
                        </div>
                    </div>

                    {/* Zoom Controls */}
                    <div
                        className="absolute bottom-2 right-2 flex items-center gap-1 p-1 bg-white rounded-lg shadow-md">
                        <button
                            onClick={() => handleZoom('out')}
                            disabled={zoomLevel <= 1}
                            className="p-1.5 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label="Zoom out"
                        >
                            <Minus className="w-3 h-3"/>
                        </button>
                        <span className="text-xs font-medium text-gray-600">
                            {Math.round(zoomLevel * 100)}%
                        </span>
                        <button
                            onClick={() => handleZoom('in')}
                            disabled={zoomLevel >= 4}
                            className="p-1.5 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            aria-label="Zoom in"
                        >
                            <Plus className="w-3 h-3"/>
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>);
};

const DesktopChart = ({selectedDateRange}) => {
    const [visualType, setVisualType] = useState(CHART_TYPES.LINE.id);
    const [hoveredData, setHoveredData] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [scrollPosition, setScrollPosition] = useState(0);
    const {data: rawData, isLoading} = useAnalyticsData(selectedDateRange);

    const handleZoom = useCallback((direction) => {
        setZoomLevel(prev => {
            const newZoom = direction === 'in' ? Math.min(prev + 0.5, 4) : Math.max(prev - 0.5, 1);
            return newZoom;
        });
    }, []);

    const handleScroll = useCallback((e) => {
        if (zoomLevel > 1) {
            const container = e.currentTarget;
            const touch = e.touches[0];
            const diff = scrollPosition - touch.clientX;
            setScrollPosition(touch.clientX);
            container.scrollLeft += diff;
        }
    }, [zoomLevel, scrollPosition]);

    const chartData = useMemo(() => {
        if (!rawData || rawData.length === 0) {
            const today = new Date();
            return Array.from({length: 7}, (_, i) => {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                return {
                    date: date.toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric'
                    }), revenue: 0, completed: 0, cancelled: 0, upcoming: 0
                };
            }).reverse();
        }
        return rawData;
    }, [rawData]);

    useEffect(() => {
        const handleDismiss = (e) => {
            const chartArea = document.querySelector('.recharts-wrapper');
            const isClickOutside = !chartArea?.contains(e.target);
            if (isClickOutside || e.type === 'scroll') {
                setHoveredData(null);
            }
        };

        document.addEventListener('mousedown', handleDismiss);
        document.addEventListener('scroll', handleDismiss, true);

        return () => {
            document.removeEventListener('mousedown', handleDismiss);
            document.removeEventListener('scroll', handleDismiss, true);
        };
    }, []);

    return (<motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0}}
            transition={{duration: 0.3}}
            className="bg-white rounded-xl shadow-lg overflow-hidden"
        >
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-1">
                        <h2 className="text-xl font-bold text-gray-900">
                            Analytics Dashboard
                        </h2>
                        <p className="text-sm text-gray-500">
                            Real-time booking performance metrics
                        </p>
                    </div>

                    <div className="flex gap-2">
                        {Object.values(CHART_TYPES).map(({id, label, icon: Icon}) => (<button
                                key={id}
                                onClick={() => setVisualType(id)}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${visualType === id ? 'bg-blue-50 text-blue-600' : 'text-gray-600 hover:bg-gray-50'}`}
                            >
                                <Icon className="w-4 h-4"/>
                                <span className="hidden sm:inline">{label}</span>
                            </button>))}
                    </div>
                </div>

                {/* Metrics Summary - Always visible */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricsSummary data={chartData}/>
                </div>

                {/* Chart Section */}
                <div className="relative">
                    <div
                        className="overflow-x-auto"
                        style={{
                            width: `${100 * zoomLevel}%`, minWidth: '100%'
                        }}
                        onTouchStart={e => setScrollPosition(e.touches[0].clientX)}
                        onTouchMove={handleScroll}
                    >
                        <div className="relative min-h-[400px]">
                            {isLoading ? (<div
                                    className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75">
                                    <div
                                        className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                                </div>) : (<ChartRenderer
                                    type={visualType}
                                    data={chartData}
                                    theme={CHART_THEME}
                                    onHover={setHoveredData}
                                    isMobile={false}
                                />)}
                        </div>

                        {/* Hover Card */}
                        <AnimatePresence>
                            {hoveredData && (<motion.div
                                    initial={{opacity: 0}}
                                    animate={{opacity: 1}}
                                    exit={{opacity: 0}}
                                    className="fixed top-24 right-60 w-72 z-50"
                                >
                                    <HoverCard data={hoveredData}/>
                                </motion.div>)}
                        </AnimatePresence>

                        {/* Zoom Controls */}
                        <div
                            className="absolute bottom-4 right-4 flex items-center gap-2 p-1 bg-white rounded-lg shadow-md">
                            <button
                                onClick={() => handleZoom('out')}
                                disabled={zoomLevel <= 1}
                                className="p-2 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                aria-label="Zoom out"
                            >
                                <Minus className="w-4 h-4"/>
                            </button>
                            <span className="text-sm font-medium text-gray-600">
                                {Math.round(zoomLevel * 100)}%
                            </span>
                            <button
                                onClick={() => handleZoom('in')}
                                disabled={zoomLevel >= 4}
                                className="p-2 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                aria-label="Zoom in"
                            >
                                <Plus className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>);
};

const MobileTabletView = ({data, selectedDateRange, onRangeChange}) => {
    return <MobileTabletChart selectedDateRange={selectedDateRange}/>;
};

const DesktopView = ({data, selectedDateRange, onRangeChange}) => {
    return <DesktopChart selectedDateRange={selectedDateRange}/>;
};

const ResponsiveTrendsChart = ({data, selectedDateRange, onRangeChange}) => {
    const [isMobileTablet, setIsMobileTablet] = useState(true);

    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobileTablet(window.innerWidth < 1024);
        };

        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    return isMobileTablet ? (<MobileTabletView
            data={data}
            selectedDateRange={selectedDateRange}
            onRangeChange={onRangeChange}
        />) : (<DesktopView
            data={data}
            selectedDateRange={selectedDateRange}
            onRangeChange={onRangeChange}
        />);
};

export default ResponsiveTrendsChart;