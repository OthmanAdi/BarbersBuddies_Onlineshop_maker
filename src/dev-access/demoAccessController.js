import {isDemoAccessEnabled} from '../runtime/appRuntime';
import {getDemoPersona} from './personas';

const ERROR_MESSAGES = Object.freeze({
    DEMO_ACCESS_DISABLED: 'Local demo access is unavailable in this runtime.',
    DEMO_PERSONA_UNKNOWN: 'The requested local demo persona is unavailable.',
    DEMO_ACCESS_BUSY: 'Another local demo persona is being prepared.',
    DEMO_AUTH_FAILED: 'The local demo identity could not be prepared.',
    DEMO_PROFILE_FAILED: 'The local demo profile could not be prepared.',
    DEMO_PROFILE_CONFLICT: 'The current local identity belongs to another profile.'
});

export class DemoAccessError extends Error {
    constructor(code) {
        super(ERROR_MESSAGES[code] || ERROR_MESSAGES.DEMO_PROFILE_FAILED);
        this.name = 'DemoAccessError';
        this.code = code;
    }
}

const fail = (code) => {
    throw new DemoAccessError(code);
};

const requireFunction = (value) => {
    if (typeof value !== 'function') fail('DEMO_PROFILE_FAILED');
    return value;
};

const requireUser = (credential) => {
    try {
        const user = credential?.user;
        if (
            user === null ||
            typeof user !== 'object' ||
            user.isAnonymous !== true ||
            typeof user.uid !== 'string' ||
            user.uid.length < 1 ||
            user.uid.length > 128
        ) {
            fail('DEMO_AUTH_FAILED');
        }
        return user;
    } catch (error) {
        if (error instanceof DemoAccessError) throw error;
        fail('DEMO_AUTH_FAILED');
    }
};

const readExistingProfile = (snapshot) => {
    try {
        if (
            snapshot === null ||
            typeof snapshot !== 'object' ||
            typeof snapshot.exists !== 'function' ||
            typeof snapshot.data !== 'function'
        ) {
            fail('DEMO_PROFILE_FAILED');
        }
        if (!snapshot.exists()) return null;
        const profile = snapshot.data();
        if (profile === null || typeof profile !== 'object' || Array.isArray(profile)) {
            fail('DEMO_PROFILE_FAILED');
        }
        return profile;
    } catch (error) {
        if (error instanceof DemoAccessError) throw error;
        fail('DEMO_PROFILE_FAILED');
    }
};

const isMatchingProfile = (profile, persona) => {
    try {
        return (
            profile.demoPersonaId === persona.id &&
            profile.demoAccessVersion === persona.profile.demoAccessVersion &&
            profile.userType === persona.profile.userType
        );
    } catch {
        return false;
    }
};

const bestEffortSignOut = async (auth, signOut) => {
    try {
        await signOut(auth);
    } catch {
        // The original sanitized provisioning error remains authoritative.
    }
};

export const createDemoAccessController = ({
    runtime,
    auth,
    db,
    signInAnonymously,
    signOut,
    updateProfile,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    notify = () => undefined
}) => {
    const enterAnonymously = requireFunction(signInAnonymously);
    const leaveSession = requireFunction(signOut);
    const updateAuthProfile = requireFunction(updateProfile);
    const createDocumentReference = requireFunction(doc);
    const readDocument = requireFunction(getDoc);
    const writeDocument = requireFunction(setDoc);
    const createServerTimestamp = requireFunction(serverTimestamp);
    const notifyPersonaReady = requireFunction(notify);
    let activeEntry = null;

    const provision = async (persona) => {
        let user;
        try {
            user = requireUser(await enterAnonymously(auth));
            await updateAuthProfile(user, {displayName: persona.profile.displayName});
        } catch (error) {
            if (user) await bestEffortSignOut(auth, leaveSession);
            if (error instanceof DemoAccessError) throw error;
            fail('DEMO_AUTH_FAILED');
        }

        try {
            const userRef = createDocumentReference(db, 'users', user.uid);
            const existingProfile = readExistingProfile(await readDocument(userRef));
            const timestamp = createServerTimestamp();

            if (existingProfile && !isMatchingProfile(existingProfile, persona)) {
                fail('DEMO_PROFILE_CONFLICT');
            }

            if (existingProfile) {
                await writeDocument(userRef, {
                    lastLoginAt: timestamp,
                    lastUpdated: timestamp
                }, {merge: true});
            } else {
                await writeDocument(userRef, {
                    ...persona.profile,
                    createdAt: timestamp,
                    lastLoginAt: timestamp,
                    lastUpdated: timestamp
                });
            }

            try {
                notifyPersonaReady({
                    personaId: persona.id,
                    userType: persona.profile.userType
                });
            } catch {
                // UI synchronization is optional after Auth and Firestore commit.
            }

            return Object.freeze({
                personaId: persona.id,
                userId: user.uid,
                userType: persona.profile.userType,
                destination: persona.destination
            });
        } catch (error) {
            await bestEffortSignOut(auth, leaveSession);
            if (error instanceof DemoAccessError) throw error;
            fail('DEMO_PROFILE_FAILED');
        }
    };

    const enter = async (personaId) => {
        if (!isDemoAccessEnabled(runtime)) fail('DEMO_ACCESS_DISABLED');
        const persona = getDemoPersona(personaId);
        if (!persona) fail('DEMO_PERSONA_UNKNOWN');

        if (activeEntry) {
            if (activeEntry.personaId === personaId) return activeEntry.promise;
            fail('DEMO_ACCESS_BUSY');
        }

        const promise = provision(persona);
        activeEntry = {personaId, promise};
        try {
            return await promise;
        } finally {
            if (activeEntry?.promise === promise) activeEntry = null;
        }
    };

    return Object.freeze({
        isEnabled: () => isDemoAccessEnabled(runtime),
        enter
    });
};
