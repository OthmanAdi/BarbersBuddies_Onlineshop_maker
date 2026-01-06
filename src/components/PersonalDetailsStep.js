import React from 'react';
import {motion} from 'framer-motion';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';

const PersonalDetailsStep = ({
                                 userName,
                                 setUserName,
                                 userEmail,
                                 setUserEmail,
                                 userPhone,
                                 setUserPhone,
                                 selectedServices,
                                 selectedDate,
                                 selectedTime,
                                 totalPrice,
                                 isLoading,
                                 setStep,
                                 t,
                                 handleSubmit,
                                 isAuthenticated,
                                 onSubmit
                             }) => {

    const handleFormSubmit = (e) => {
        e.preventDefault();
        handleSubmit?.(e);
        onSubmit?.(e);
    };

    // Animation variants for the live preview
    const fadeIn = {
        initial: {opacity: 0, y: 10}, animate: {opacity: 1, y: 0}, transition: {duration: 0.2}
    };

    return (<motion.div
            initial={{opacity: 0, x: -20}}
            animate={{opacity: 1, x: 0}}
            className="space-y-6"
        >
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <h3 className="card-title mb-6">{t.personalDetails}</h3>

                    {/* Input Fields Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">{t.name}</span>
                            </label>
                            <input
                                type="text"
                                value={userName}
                                onChange={(e) => setUserName(e.target.value)}
                                className="input input-bordered w-full"
                                required
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">{t.phoneOptional}</span>
                            </label>
                            <PhoneInput
                                country={'tr'}
                                value={userPhone}
                                onChange={phone => setUserPhone(phone)}
                                inputProps={{
                                    required: true, className: 'input input-bordered w-full pl-[4.5rem]'
                                }}
                                containerClass="phone-input-container relative"
                                buttonClass="!absolute !left-0 !top-0 !h-full !border-0 !bg-base-200 !rounded-l-lg px-3"
                            />
                        </div>

                        <div className="form-control md:col-span-2">
                            <label className="label">
                                <span className="label-text">{t.emailRequired}</span>
                            </label>
                            <input
                                type="email"
                                value={userEmail}
                                onChange={(e) => setUserEmail(e.target.value)}
                                className="input input-bordered w-full"
                                required
                                placeholder="your.email@example.com"
                            />
                        </div>
                    </div>

                    <form onSubmit={handleFormSubmit}>
                        {/* Enhanced Booking Summary Card */}
                        <div className="card bg-base-200 mt-8">
                            <div className="card-body">
                                <div className="flex items-center justify-between">
                                    <h3 className="card-title text-lg">{t.bookingSummary}</h3>
                                    <div className="badge badge-primary">INVOICE PREVIEW</div>
                                </div>

                                {/* Customer Information Section */}
                                <div className="bg-base-100 rounded-lg p-4 mt-4">
                                    <motion.div
                                        className="space-y-2"
                                        initial="initial"
                                        animate="animate"
                                        variants={fadeIn}
                                    >
                                        <div className="flex items-center space-x-2 text-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary"
                                                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                                            </svg>
                                            <span className="opacity-70">Customer:</span>
                                            <span className="font-medium">
                                            {userName || '...'}
                                        </span>
                                        </div>

                                        <div className="flex items-center space-x-2 text-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary"
                                                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
                                            </svg>
                                            <span className="opacity-70">Email:</span>
                                            <span className="font-medium">
                                            {userEmail || '...'}
                                        </span>
                                        </div>

                                        <div className="flex items-center space-x-2 text-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-primary"
                                                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                            </svg>
                                            <span className="opacity-70">Phone:</span>
                                            <span className="font-medium">
                                            {userPhone || '...'}
                                        </span>
                                        </div>
                                    </motion.div>
                                </div>

                                <div className="divider my-2"></div>

                                {/* Appointment Details */}
                                <div className="space-y-4">
                                    <div
                                        className="flex items-center justify-between text-base bg-base-100 p-3 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary"
                                                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                                            </svg>
                                            <span className="opacity-70">{t.date}</span>
                                        </div>
                                        <span
                                            className="font-medium">{new Date(selectedDate).toLocaleDateString()}</span>
                                    </div>

                                    <div
                                        className="flex items-center justify-between text-base bg-base-100 p-3 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary"
                                                 fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                                            </svg>
                                            <span className="opacity-70">{t.time}</span>
                                        </div>
                                        <span className="font-medium">{selectedTime}</span>
                                    </div>

                                    <div className="divider my-2"></div>

                                    {/* Services List */}
                                    <div className="space-y-2">
                                        {selectedServices.map((service) => (<div key={service.name}
                                                                                 className="flex items-center justify-between text-sm bg-base-200/50 p-3 rounded-lg hover:bg-base-200 transition-colors duration-200">
                                                <span className="font-medium">{service.name}</span>
                                                <span className="font-semibold text-primary">€{service.price}</span>
                                            </div>))}
                                    </div>

                                    <div className="divider my-2"></div>

                                    {/* Total Price */}
                                    <div
                                        className="flex items-center justify-between text-lg font-bold bg-primary/10 p-3 rounded-lg">
                                        <span>{t.total}</span>
                                        <span className="text-primary">€{totalPrice}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="card-actions justify-between mt-6">
                            <button
                                type="button" // Keep as button type for back action
                                className="btn btn-outline btn-lg gap-2"
                                onClick={() => setStep(2)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20"
                                     fill="currentColor">
                                    <path fillRule="evenodd"
                                          d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                                          clipRule="evenodd"/>
                                </svg>
                                {t.back}
                            </button>

                            <button
                                type="submit" // This should be submit type
                                className="btn btn-primary btn-lg gap-2"
                                disabled={isLoading || !userName || !userEmail || !selectedDate || !selectedTime || selectedServices.length === 0}
                            >
                                {isLoading ? (<>
                                        <span className="loading loading-spinner"></span>
                                        {t.processing}
                                    </>) : (<>
                                        {t.confirmBooking}
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20"
                                             fill="currentColor">
                                            <path fillRule="evenodd"
                                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                  clipRule="evenodd"/>
                                        </svg>
                                    </>)}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </motion.div>);
};

export default PersonalDetailsStep;