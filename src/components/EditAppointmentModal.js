import React, {useEffect, useState} from 'react';
import {motion} from 'framer-motion';
import {Calendar, Clock, DollarSign, X} from 'lucide-react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

const EditAppointmentModal = ({
                                  isOpen,
                                  onClose,
                                  appointment,
                                  onSave,
                                  availableTimeSlots
                              }) => {
    const [formData, setFormData] = useState({
        date: new Date(),
        time: '',
        selectedServices: [],
        notes: '',
        totalPrice: 0
    });

    // Update form data when appointment changes
    useEffect(() => {
        if (appointment) {
            setFormData({
                date: appointment.selectedDate ? new Date(appointment.selectedDate) : new Date(),
                time: appointment.selectedTime || '',
                selectedServices: appointment.selectedServices || [],
                notes: appointment.notes || '',
                totalPrice: appointment.totalPrice || 0
            });
        }
    }, [appointment]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!appointment) return;

        await onSave({
            ...appointment,
            selectedDate: formData.date,
            selectedTime: formData.time,
            selectedServices: formData.selectedServices,
            notes: formData.notes,
            totalPrice: formData.totalPrice,
            lastModified: new Date(),
        });
        onClose();
    };

    const removeService = (index) => {
        setFormData(prev => ({
            ...prev,
            selectedServices: prev.selectedServices.filter((_, i) => i !== index)
        }));
    };

    if (!isOpen || !appointment) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="flex min-h-screen items-center justify-center p-4">
                <motion.div
                    initial={{opacity: 0}}
                    animate={{opacity: 1}}
                    exit={{opacity: 0}}
                    className="fixed inset-0 bg-black/50"
                    onClick={onClose}
                />

                <motion.div
                    initial={{opacity: 0, scale: 0.95}}
                    animate={{opacity: 1, scale: 1}}
                    exit={{opacity: 0, scale: 0.95}}
                    className="relative w-full max-w-2xl rounded-lg bg-base-100 shadow-lg"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-base-300 p-4">
                        <h3 className="text-lg font-bold">Edit Appointment</h3>
                        <button
                            onClick={onClose}
                            className="btn btn-ghost btn-sm btn-circle"
                        >
                            <X className="w-5 h-5"/>
                        </button>
                    </div>

                    {/* Content */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Date Picker */}
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Date</span>
                                </label>
                                <div className="relative">
                                    <Calendar
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/50"/>
                                    <DatePicker
                                        selected={formData.date}
                                        onChange={(date) => setFormData(prev => ({...prev, date}))}
                                        dateFormat="MMMM d, yyyy"
                                        minDate={new Date()}
                                        className="input input-bordered w-full pl-10"
                                    />
                                </div>
                            </div>

                            {/* Time Picker */}
                            <div className="form-control">
                                <label className="label">
                                    <span className="label-text">Time</span>
                                </label>
                                <div className="relative">
                                    <Clock
                                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/50"/>
                                    <select
                                        value={formData.time}
                                        onChange={(e) => setFormData(prev => ({...prev, time: e.target.value}))}
                                        className="select select-bordered w-full pl-10"
                                    >
                                        <option value="">Select time</option>
                                        {availableTimeSlots.map((slot) => (
                                            <option key={slot} value={slot}>{slot}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Services */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Services</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {formData.selectedServices && formData.selectedServices.map((service, index) => (
                                    <div key={index} className="badge badge-primary gap-2">
                                        {service.name}
                                        <button
                                            type="button"
                                            onClick={() => removeService(index)}
                                            className="btn btn-ghost btn-xs btn-circle"
                                        >
                                            <X className="w-3 h-3"/>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Notes</span>
                            </label>
                            <textarea
                                value={formData.notes}
                                onChange={(e) => setFormData(prev => ({...prev, notes: e.target.value}))}
                                className="textarea textarea-bordered h-24"
                                placeholder="Add any special notes or requests..."
                            />
                        </div>

                        {/* Total Price */}
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Total Price</span>
                            </label>
                            <div className="relative">
                                <DollarSign
                                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-base-content/50"/>
                                <input
                                    type="number"
                                    value={formData.totalPrice}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        totalPrice: parseFloat(e.target.value)
                                    }))}
                                    className="input input-bordered w-full pl-10"
                                    step="0.01"
                                />
                            </div>
                        </div>
                    </form>

                    {/* Footer */}
                    <div className="border-t border-base-300 p-4 flex justify-end space-x-2">
                        <button
                            onClick={onClose}
                            className="btn btn-ghost"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            className="btn btn-primary"
                        >
                            Save Changes
                        </button>
                    </div>
                </motion.div>
            </div>
        </div>
    );
};

export default EditAppointmentModal;