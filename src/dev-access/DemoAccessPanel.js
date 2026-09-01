import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {isDemoAccessEnabled} from '../runtime/appRuntime';
import {PROFESSIONAL_DEMO_PERSONA_ID} from './personas';

const DemoAccessPanel = ({runtime, access}) => {
    const navigate = useNavigate();
    const [isEntering, setIsEntering] = useState(false);
    const [error, setError] = useState('');

    if (!isDemoAccessEnabled(runtime)) return null;

    const enterProfessionalDemo = async () => {
        if (isEntering) return;
        setIsEntering(true);
        setError('');

        try {
            if (typeof access?.enter !== 'function') throw new Error('demo-access-unavailable');
            const result = await access.enter(PROFESSIONAL_DEMO_PERSONA_ID);
            if (typeof result?.destination !== 'string' || !result.destination.startsWith('/')) {
                throw new Error('demo-destination-invalid');
            }
            navigate(result.destination, {replace: true});
        } catch {
            setError('Could not prepare the local professional demo. Confirm that Auth and Firestore emulators are running.');
            setIsEntering(false);
        }
    };

    return (
        <aside
            aria-label="Local demo access"
            className="fixed bottom-4 left-4 right-4 z-[100] mx-auto max-w-md rounded-2xl border border-emerald-400/40 bg-base-100/95 p-4 shadow-2xl backdrop-blur sm:left-auto sm:right-6 sm:mx-0"
        >
            <div className="flex items-start justify-between gap-4">
                <div>
                    <div className="mb-1 flex items-center gap-2">
                        <span className="badge badge-success badge-sm">Local emulators</span>
                        <span className="text-xs font-semibold uppercase tracking-wide text-base-content/60">
                            Disposable persona
                        </span>
                    </div>
                    <h2 className="text-base font-bold">Professional workspace</h2>
                    <p className="mt-1 text-sm text-base-content/70">
                        Enter as a shop owner without creating or verifying an account.
                    </p>
                </div>
            </div>

            <button
                type="button"
                className="btn btn-success mt-4 w-full"
                disabled={isEntering}
                onClick={enterProfessionalDemo}
            >
                {isEntering ? (
                    <>
                        <span className="loading loading-spinner loading-sm" aria-hidden="true" />
                        Preparing workspace…
                    </>
                ) : 'Enter professional demo'}
            </button>

            {error && (
                <p className="mt-3 text-sm text-error" role="alert">
                    {error}
                </p>
            )}
        </aside>
    );
};

export default DemoAccessPanel;
