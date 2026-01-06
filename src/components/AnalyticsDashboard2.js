import React from 'react';
import {Calendar, Coffee, Star, Tag} from 'lucide-react';

const StatCard = ({icon: Icon, title, value, color, delay}) => (
    <div
        className={`
      group stat bg-base-100 hover:bg-base-200 rounded-xl shadow-lg p-6
      transform transition-all duration-300 ease-out
      hover:scale-105 hover:shadow-xl
      data-[animate=true]:animate-slideIn
      cursor-pointer
      border border-transparent hover:border-${color}/20
    `}
        style={{
            animationDelay: `${delay}ms`,
        }}
        data-animate="true"
    >
        <div className={`
      stat-figure ${color}
      transform transition-transform duration-300
      group-hover:scale-110 group-hover:rotate-12
    `}>
            <Icon className="w-8 h-8"/>
        </div>

        <div className="stat-title text-sm font-medium opacity-70 group-hover:opacity-90">
            {title}
        </div>

        <div className={`
      stat-value text-2xl font-bold ${color}
      transition-all duration-300
      group-hover:scale-105
    `}>
            {value}
        </div>

        <div className={`
      mt-2 h-1 w-16 rounded-full bg-${color}/20
      transform origin-left transition-all duration-300
      group-hover:w-full
    `}/>
    </div>
);

const AnalyticsDashboard2 = ({analytics}) => {
    const stats = [
        {
            icon: Calendar,
            title: "Total Selections",
            value: analytics.total,
            color: "text-primary",
            delay: 0
        },
        {
            icon: Coffee,
            title: "Holidays",
            value: analytics.byType.holiday,
            color: "text-red-500",
            delay: 100
        },
        {
            icon: Star,
            title: "Special Days",
            value: analytics.byType.special,
            color: "text-yellow-500",
            delay: 200
        },
        {
            icon: Tag,
            title: "Promo Days",
            value: analytics.byType.promo,
            color: "text-green-500",
            delay: 300
        }
    ];

    return (
        <div className="space-y-6">
            {/* Mobile View - Horizontal Scroll */}
            <div className="md:hidden w-full overflow-x-auto pb-4 px-4 -mx-4">
                <div className="flex space-x-4 w-max">
                    {stats.map((stat, index) => (
                        <div key={index} className="w-60">
                            <StatCard {...stat} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Desktop Grid View */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat, index) => (
                    <StatCard key={index} {...stat} />
                ))}
            </div>

            <style jsx>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-slideIn {
          animation: slideIn 0.5s ease-out forwards;
        }

        /* Custom scrollbar for mobile scroll */
        .overflow-x-auto {
          scrollbar-width: none;
          -ms-overflow-style: none;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
        }

        .overflow-x-auto::-webkit-scrollbar {
          display: none;
        }

        /* Ensure smooth scrolling */
        .overflow-x-auto > div {
          scroll-snap-align: start;
        }
      `}</style>
        </div>
    );
};

export default AnalyticsDashboard2;