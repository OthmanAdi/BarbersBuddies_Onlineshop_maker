/**
 * @fileoverview ServiceSelectionStep Component
 * 
 * A sophisticated component for selecting services in a barbershop booking flow.
 * 
 * Key Features:
 * - Interactive service selection with animations using Framer Motion
 * - Real-time price calculation and service management
 * - Responsive grid layout for service cards
 * - Visual feedback for selected services
 * - Running total calculation
 * 
 * Props:
 * @param {Array} services - Available services to choose from
 * @param {Array} selectedServices - Currently selected services
 * @param {Function} handleServiceChange - Handler for service selection
 * @param {Function} removeService - Handler for removing a service
 * @param {number} totalPrice - Running total of selected services
 * @param {Function} setStep - Navigation function between steps
 * @param {Object} t - Translation object for internationalization
 * @param {Array} serviceCategories - Categories for service organization
 * @param {string} selectedServiceCategory - Currently selected category
 * @param {Function} setSelectedServiceCategory - Category selection handler
 *
 * @example
 * <ServiceSelectionStep
 *   services={availableServices}
 *   selectedServices={currentlySelected}
 *   handleServiceChange={onServiceSelect}
 *   removeService={onServiceRemove}
 *   totalPrice={calculateTotal()}
 *   setStep={navigationHandler}
 *   t={translations}
 * />
 */

import React from 'react';
import {motion} from 'framer-motion';

const ServiceSelectionStep = ({
                                  services,
                                  selectedServices,
                                  handleServiceChange,
                                  removeService,
                                  totalPrice,
                                  setStep,
                                  t,
                                  serviceCategories,
                                  selectedServiceCategory,
                                  setSelectedServiceCategory
                              }) => {
    return (<motion.div
            initial={{opacity: 0, x: -20}}
            animate={{opacity: 1, x: 0}}
            className="space-y-6"
        >
            <div className="card bg-base-100 shadow-xl">
                <div className="card-body">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {services.map((service, index) => (<motion.div
                                key={service.name}
                                initial={{opacity: 0, y: 20}}
                                animate={{opacity: 1, y: 0}}
                                transition={{delay: index * 0.1}}
                                className={`card bg-base-200 hover:bg-base-300 transition-all cursor-pointer
                ${selectedServices.some(s => s.name === service.name) ? 'ring-2 ring-primary' : ''}
              `}
                                onClick={() => handleServiceChange(service)}
                            >
                                <div className="card-body p-4">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-semibold">{service.name}</h3>
                                            <p className="text-sm opacity-70">{service.duration || '30 min'}</p>
                                        </div>
                                        <span className="text-xl font-bold text-primary">€{service.price}</span>
                                    </div>
                                </div>
                            </motion.div>))}
                    </div>

                    {selectedServices.length > 0 && (<div className="mt-6">
                            <div className="card bg-primary text-primary-content">
                                <div className="card-body p-4">
                                    <h3 className="card-title text-lg">{t.selectedServices}</h3>
                                    <div className="space-y-2">
                                        {selectedServices.map((service) => (
                                            <div key={service.name} className="flex justify-between items-center">
                                                <span>{service.name}</span>
                                                <div className="flex items-center gap-4">
                                                    <span>€{service.price}</span>
                                                    <button
                                                        onClick={(e) => removeService(service.name, e)}
                                                        className="btn btn-ghost btn-circle btn-sm"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            </div>))}
                                        <div className="divider my-2"></div>
                                        <div className="flex justify-between items-center text-xl font-bold">
                                            <span>{t.total}</span>
                                            <span>€{totalPrice}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>)}

                    <div className="card-actions justify-end mt-6">
                        <button
                            type="button"
                            className="btn btn-primary btn-lg gap-2"
                            onClick={() => setStep(2)}
                            disabled={selectedServices.length === 0}
                        >
                            {t.next}
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20"
                                 fill="currentColor">
                                <path fillRule="evenodd"
                                      d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                                      clipRule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>);
}

export default ServiceSelectionStep;