import React, {useEffect, useRef, useState} from 'react';

const TimePicker = ({value, onChange}) => {
    const [isOpen, setIsOpen] = useState(false);
    const pickerRef = useRef(null);

    const hours = Array.from({length: 24}, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({length: 60}, (_, i) => i.toString().padStart(2, '0'));

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (pickerRef.current && !pickerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleTimeChange = (type, newValue) => {
        const [currentHour, currentMinute] = value.split(':');
        const newTime = type === 'hour' ? `${newValue}:${currentMinute}` : `${currentHour}:${newValue}`;
        onChange(newTime);
    };

    return (<div className="relative" ref={pickerRef}>
            <input
                type="text"
                className="input input-bordered w-full"
                value={value}
                onClick={() => setIsOpen(!isOpen)}
                readOnly
            />
            {isOpen && (
                <div className="absolute z-10 mt-1 w-full bg-base-100 shadow-xl rounded-lg overflow-hidden flex">
                    <div className="w-1/2 h-40 overflow-y-scroll scrollbar-hide">
                        {hours.map((hour) => (<div
                                key={hour}
                                className={`p-2 text-center cursor-pointer hover:bg-base-200 ${hour === value.split(':')[0] ? 'bg-primary text-primary-content' : ''}`}
                                onClick={() => handleTimeChange('hour', hour)}
                            >
                                {hour}
                            </div>))}
                    </div>
                    <div className="w-1/2 h-40 overflow-y-scroll scrollbar-hide">
                        {minutes.map((minute) => (<div
                                key={minute}
                                className={`p-2 text-center cursor-pointer hover:bg-base-200 ${minute === value.split(':')[1] ? 'bg-primary text-primary-content' : ''}`}
                                onClick={() => handleTimeChange('minute', minute)}
                            >
                                {minute}
                            </div>))}
                    </div>
                </div>)}
        </div>);
};

export default TimePicker;