const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-base-200/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
        <div className="card bg-base-100 shadow-2xl w-80">
            <div className="card-body items-center text-center p-8 space-y-4">
                <div className="relative">
                    {/* Outer spinning circle */}
                    <div
                        className="absolute inset-0 rounded-full border-4 border-primary/20 border-t-primary animate-spin"/>

                    {/* Inner pulsing circle */}
                    <div
                        className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center animate-pulse">
                        <svg
                            className="w-8 h-8 text-primary"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                    </div>
                </div>

                <h3 className="text-lg font-semibold mt-4">Processing Booking...</h3>
                <p className="text-sm text-base-content/70">Please wait while we confirm your appointment</p>
            </div>

            {/* Progress bar animation */}
            <div className="h-1 bg-base-200 overflow-hidden">
                <div className="h-full bg-primary origin-left animate-progress"/>
            </div>
        </div>
    </div>
);

export default LoadingOverlay;