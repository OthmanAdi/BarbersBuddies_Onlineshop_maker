import {signInAnonymously, signOut, updateProfile} from 'firebase/auth';
import {doc, getDoc, runTransaction, serverTimestamp, setDoc} from 'firebase/firestore';
import {auth, db} from '../firebase';
import {appRuntime} from '../runtime/currentAppRuntime';
import {createDemoAccessController} from './demoAccessController';
import {createProfessionalShopFixtureProvisioner} from './professionalShopFixture';

const notify = ({personaId, userType}) => {
    if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
    window.dispatchEvent(new CustomEvent('userTypeUpdated', {
        detail: {personaId, userType}
    }));
};

export const firebaseDemoAccess = createDemoAccessController({
    runtime: appRuntime,
    auth,
    db,
    signInAnonymously,
    signOut,
    updateProfile,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    provisionPersonaFixture: createProfessionalShopFixtureProvisioner({
        runtime: appRuntime,
        db,
        doc,
        runTransaction,
        serverTimestamp
    }),
    notify
});
