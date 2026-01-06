import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
    TrendingUp,
    Ban,
    CheckCircle,
    Clock,
    DollarSign
} from 'lucide-react';

const MetricsSummary = ({ data }) => {
    const summary = useMemo(() => {
        if (!data?.length) return null;

        const latest = [...data].pop() || {};
        const previous = data[data.length - 2] || {};

        const calculateChange = (current, prev) => {
            if (!prev) return 0;
            return ((current - prev) / prev) * 100;
        };

        return {
            revenue: {
                value: latest.revenue || 0,
                change: calculateChange(latest.revenue, previous.revenue),
                label: 'Total Revenue',
                icon: DollarSign,
                prefix: '€',
                color: 'blue'
            },
            completed: {
                value: latest.completed || 0,
                change: calculateChange(latest.completed, previous.completed),
                label: 'Completed',
                icon: CheckCircle,
                color: 'purple'
            },
            upcoming: {
                value: latest.upcoming || 0,
                change: calculateChange(latest.upcoming, previous.upcoming),
                label: 'Upcoming',
                icon: Clock,
                color: 'green'
            },
            cancelled: {
                value: latest.cancelled || 0,
                change: calculateChange(latest.cancelled, previous.cancelled),
                label: 'Cancelled',
                icon: Ban,
                color: 'red'
            }
        };
    }, [data]);

    if (!summary) return null;

    const colorVariants = {
        blue: 'bg-blue-50 text-blue-600',
        purple: 'bg-purple-50 text-purple-600',
        green: 'bg-green-50 text-green-600',
        red: 'bg-red-50 text-red-600'
    };

    const MetricCard = ({ metric }) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
        >
            <div className="flex justify-between items-start mb-2">
                <div className={`p-2 rounded-lg ${colorVariants[metric.color]}`}>
                    <metric.icon className="w-4 h-4" />
                </div>
                <div className="flex items-center gap-1 text-xs font-medium [@media(min-width:1023px)_and_(max-width:1425px)]:hidden">
                    <TrendingUp
                        className={`w-3 h-3 ${
                            metric.change >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                    />
                    <span className={
                        metric.change >= 0 ? 'text-green-600' : 'text-red-600'
                    }>
                        {Math.abs(metric.change).toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="space-y-0.5">
                <h3 className="text-sm font-medium text-gray-500">
                    {metric.label}
                </h3>
                <p className="text-xl font-bold text-gray-900">
                    {metric.prefix}{metric.value.toLocaleString()}
                </p>
                <div className="hidden [@media(min-width:1023px)_and_(max-width:1425px)]:flex items-center gap-1 text-xs font-medium mt-1">
                    <TrendingUp
                        className={`w-3 h-3 ${
                            metric.change >= 0 ? 'text-green-500' : 'text-red-500'
                        }`}
                    />
                    <span className={
                        metric.change >= 0 ? 'text-green-600' : 'text-red-600'
                    }>
                        {Math.abs(metric.change).toFixed(1)}%
                    </span>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">vs previous</span>
                    <span className={`font-medium [@media(min-width:1023px)_and_(max-width:1425px)]:hidden ${
                        metric.change >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                    }`}>
                        {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}%
                    </span>
                </div>
                <div className="hidden [@media(min-width:1023px)_and_(max-width:1425px)]:block mt-1">
                    <span className={`font-medium text-sm ${
                        metric.change >= 0
                            ? 'text-green-600'
                            : 'text-red-600'
                    }`}>
                        {metric.change >= 0 ? '+' : ''}{metric.change.toFixed(1)}%
                    </span>
                </div>
            </div>
        </motion.div>
    );

    return (
        <>
            {Object.entries(summary).map(([key, metric]) => (
                <MetricCard key={key} metric={metric} />
            ))}
        </>
    );
};

export default MetricsSummary;