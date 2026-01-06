import React from 'react';
import {Calendar, ChevronRight} from 'lucide-react';

const CalendarInstructions = ({
                                  isMobile,
                                  mobileSelection,
                                  selectionFields,
                                  isExpanded,
                                  setIsExpanded,
                                  handleRemoveSelection,
                                  modeColors,
                                  modeIcons
                              }) => {
    if (!isMobile) return null;

    return (
        <div className="bg-base-100 p-4 rounded-lg shadow-lg space-y-2">
            {/* Mobile Instructions Text */}
            <p className="text-sm text-gray-600 text-center">
                {!mobileSelection.start
                    ? "Tap to select start date"
                    : !mobileSelection.end
                        ? "Tap to select end date"
                        : "Confirm your selection"}
            </p>

            {/* Mobile Selection List */}
            {selectionFields.length > 0 && (
                <div className="mt-4 border-t pt-2">
                    <div
                        className="p-3 cursor-pointer flex items-center justify-between hover:bg-base-200/50 transition-colors duration-200"
                        onClick={() => setIsExpanded(!isExpanded)}
                    >
                        <div className="flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-primary"/>
                            <h3 className="text-lg font-bold">
                                Selected Periods ({selectionFields.length})
                            </h3>
                        </div>
                        <ChevronRight
                            className={`w-5 h-5 transition-transform duration-300 ${
                                isExpanded ? 'rotate-90' : ''
                            }`}
                        />
                    </div>

                    <div className={`
            overflow-hidden transition-all duration-300 ease-in-out
            ${isExpanded ? 'max-h-96' : 'max-h-0'}
          `}>
                        <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                            {selectionFields.map((field, index) => (
                                <div
                                    key={index}
                                    className={`
                    flex items-center justify-between p-3
                    ${modeColors[field.type]}
                    rounded-lg transition-all duration-200
                    hover:shadow-md hover:scale-[1.02]
                    animate-fadeIn
                  `}
                                >
                                    <div className="flex items-center gap-3">
                                        {React.createElement(modeIcons[field.type], {
                                            className: 'w-5 h-5'
                                        })}
                                        <span className="font-medium">
                      {field.start.toLocaleDateString()} - {field.end.toLocaleDateString()}
                    </span>
                                    </div>
                                    <button
                                        className="btn btn-ghost btn-sm btn-circle hover:bg-red-100 hover:text-red-500
                      transition-all duration-200 hover:rotate-90"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveSelection(index, field);
                                        }}
                                        title="Remove selection"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="h-5 w-5"
                                            viewBox="0 0 20 20"
                                            fill="currentColor"
                                        >
                                            <path
                                                fillRule="evenodd"
                                                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                clipRule="evenodd"
                                            />
                                        </svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SelectionList = ({
                           selectionFields,
                           isMobile,
                           mobileSelection,
                           isExpanded,
                           setIsExpanded,
                           handleRemoveSelection,
                           modeColors,
                           modeIcons
                       }) => {
    return (
        <>
            {/* Desktop Floating Panel */}
            {selectionFields.length > 0 && !isMobile && (
                <div className="sticky left-0 right-0 bottom-0 z-50 p-4">
                    <div className="max-w-4xl mx-auto">
                        <div className="bg-base-100 rounded-t-xl shadow-2xl border border-base-200">
                            <div
                                className="p-3 cursor-pointer flex items-center justify-between hover:bg-base-200/50 transition-colors duration-200"
                                onClick={() => setIsExpanded(!isExpanded)}
                            >
                                <div className="flex items-center gap-2">
                                    <Calendar className="w-5 h-5 text-primary"/>
                                    <h3 className="text-lg font-bold">
                                        Selected Periods ({selectionFields.length})
                                    </h3>
                                </div>
                                <ChevronRight
                                    className={`w-5 h-5 transition-transform duration-300 ${
                                        isExpanded ? 'rotate-90' : ''
                                    }`}
                                />
                            </div>

                            <div className={`
                overflow-hidden transition-all duration-300 ease-in-out
                ${isExpanded ? 'max-h-96' : 'max-h-0'}
              `}>
                                <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                                    {selectionFields.map((field, index) => (
                                        <div
                                            key={index}
                                            className={`
                        flex items-center justify-between p-3
                        ${modeColors[field.type]}
                        rounded-lg transition-all duration-200
                        hover:shadow-md hover:scale-[1.02]
                        animate-fadeIn
                      `}
                                        >
                                            <div className="flex items-center gap-3">
                                                {React.createElement(modeIcons[field.type], {
                                                    className: 'w-5 h-5'
                                                })}
                                                <span className="font-medium">
                          {field.start.toLocaleDateString()} - {field.end.toLocaleDateString()}
                        </span>
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-sm btn-circle hover:bg-red-100 hover:text-red-500
                          transition-all duration-200 hover:rotate-90"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveSelection(index, field);
                                                }}
                                                title="Remove selection"
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    className="h-5 w-5"
                                                    viewBox="0 0 20 20"
                                                    fill="currentColor"
                                                >
                                                    <path
                                                        fillRule="evenodd"
                                                        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                                        clipRule="evenodd"
                                                    />
                                                </svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Instructions and Selection List */}
            <CalendarInstructions
                isMobile={isMobile}
                mobileSelection={mobileSelection}
                selectionFields={selectionFields}
                isExpanded={isExpanded}
                setIsExpanded={setIsExpanded}
                handleRemoveSelection={handleRemoveSelection}
                modeColors={modeColors}
                modeIcons={modeIcons}
            />

            <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
        
        /* Custom scrollbar */
        .overflow-y-auto {
          scrollbar-width: thin;
          scrollbar-color: rgba(0,0,0,0.2) transparent;
        }
        
        .overflow-y-auto::-webkit-scrollbar {
          width: 6px;
        }
        
        .overflow-y-auto::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .overflow-y-auto::-webkit-scrollbar-thumb {
          background-color: rgba(0,0,0,0.2);
          border-radius: 3px;
        }
        
        @media (max-width: 768px) {
          .max-h-72 {
            max-height: 40vh;
          }
        }
      `}</style>
        </>
    );
};

export default SelectionList;