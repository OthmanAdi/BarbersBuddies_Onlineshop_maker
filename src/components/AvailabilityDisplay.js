import React, {useState} from 'react';
import {Clock} from 'lucide-react';

const AvailabilityAccordion = ({shop, isOpen, onToggle}) => {
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const [openAccordion, setOpenAccordion] = useState(null);

    const renderAvailability = () => {
        if (!shop?.availability) {
            return (
                <div className="text-base-content/70 text-center py-4">
                    No availability set for this shop
                </div>
            );
        }

        return (
            <div className="space-y-2">
                {daysOrder.map((day) => {
                    const dayData = shop.availability[day];
                    const isOpen = dayData?.open && dayData?.close;

                    return (
                        <div
                            key={day}
                            className={`
                flex justify-between items-center p-3 rounded-lg border border-base-300
                ${isOpen ? 'bg-base-300/50 hover:bg-base-300 transition-colors' : 'bg-base-200/30'}
              `}
                        >
                            <div className="flex items-center gap-3">
                                <div
                                    className={`w-2 h-2 rounded-full ${isOpen ? 'bg-success animate-pulse' : 'bg-error/50'}`}/>
                                <span className="font-medium">{day}</span>
                            </div>

                            {isOpen ? (
                                <div className="flex items-center gap-2 text-primary">
                                    <Clock className="w-4 h-4"/>
                                    <span className="font-medium">
                    {dayData.open} - {dayData.close}
                  </span>
                                </div>
                            ) : (
                                <span className="text-sm text-base-content/50">Closed</span>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="collapse collapse-plus bg-base-300">
            <input
                type="checkbox"
                checked={isOpen}
                onChange={onToggle}
            />
            <div className="collapse-title font-medium flex items-center gap-2">
                <Clock className="w-4 h-4"/>
                Working Hours
            </div>
            <div className="collapse-content">
                {renderAvailability()}
            </div>
        </div>
    );
};

export default AvailabilityAccordion;