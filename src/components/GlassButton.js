import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Edit2, Palette, Trash2 } from 'lucide-react';

const GlassButton = ({ onClick, icon: Icon, text, variant }) => {
    const variants = {
        initial: { opacity: 0, scale: 0.95 },
        animate: { opacity: 1, scale: 1 },
        hover: {
            scale: 1.02,
            transition: { type: "spring", stiffness: 400, damping: 10 }
        },
        tap: { scale: 0.98 }
    };

    const getGradient = () => {
        switch (variant) {
            case 'manage':
                return 'dark:from-blue-500/20 dark:to-blue-600/20 from-blue-400/30 to-blue-500/30';
            case 'edit':
                return 'dark:from-green-500/20 dark:to-green-600/20 from-green-400/30 to-green-500/30';
            case 'customize':
                return 'dark:from-purple-500/20 dark:to-purple-600/20 from-purple-400/30 to-purple-500/30';
            case 'delete':
                return 'dark:from-red-500/20 dark:to-red-600/20 from-red-400/30 to-red-500/30';
            default:
                return 'from-primary/20 to-secondary/20';
        }
    };

    return (
        <motion.button
            onClick={onClick}
            variants={variants}
            initial="initial"
            animate="animate"
            whileHover="hover"
            whileTap="tap"
            className={`relative w-full h-full min-h-16 overflow-hidden rounded-xl
        backdrop-blur-md border border-base-content/10
        dark:bg-base-100/10 bg-base-200/40
        group transition-all duration-300`}
        >
            {/* Gradient background */}
            <div className={`absolute inset-0 bg-gradient-to-br ${getGradient()} opacity-50 
        group-hover:opacity-70 transition-opacity duration-300`} />

            {/* Shine effect */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100
        transition-opacity duration-300 bg-gradient-to-r from-transparent
        via-base-content/5 to-transparent -skew-x-12 translate-x-full
        group-hover:translate-x-0 transform" />

            {/* Content */}
            <div className="relative h-full flex items-center justify-center p-3">
                <div className="flex flex-col sm:flex-row items-center gap-2 text-base-content">
                    <Icon className="w-6 h-6 sm:w-5 sm:h-5" />
                    <span className="text-sm font-medium hidden sm:inline">{text}</span>
                </div>
            </div>
        </motion.button>
    );
};

const ActionButtonsGrid = ({
                               onManageHours,
                               onEditShop,
                               onCustomize,
                               onDelete,
                               deleteText = "Delete Shop"
                           }) => {
    return (
        <div className="card-actions justify-end mt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                <GlassButton
                    onClick={onManageHours}
                    icon={Clock}
                    text="Manage Hours"
                    variant="manage"
                />
                <GlassButton
                    onClick={onEditShop}
                    icon={Edit2}
                    text="Edit Shop"
                    variant="edit"
                />
                <GlassButton
                    onClick={onCustomize}
                    icon={Palette}
                    text="Customize Page"
                    variant="customize"
                />
                <GlassButton
                    onClick={onDelete}
                    icon={Trash2}
                    text={deleteText}
                    variant="delete"
                />
            </div>
        </div>
    );
};

export default ActionButtonsGrid;