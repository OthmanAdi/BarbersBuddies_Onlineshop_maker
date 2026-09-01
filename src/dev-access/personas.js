import {isDemoAccessEnabled} from '../runtime/appRuntime';

export const PROFESSIONAL_DEMO_PERSONA_ID = 'professional';
export const PROFESSIONAL_DEMO_FIXTURE_KIND = 'professional-shop';
export const PROFESSIONAL_DEMO_FIXTURE_VERSION = 1;

const PERSONAS = Object.freeze({
    [PROFESSIONAL_DEMO_PERSONA_ID]: Object.freeze({
        id: PROFESSIONAL_DEMO_PERSONA_ID,
        label: 'Professional',
        destination: '/account',
        fixture: Object.freeze({
            kind: PROFESSIONAL_DEMO_FIXTURE_KIND,
            version: PROFESSIONAL_DEMO_FIXTURE_VERSION
        }),
        profile: Object.freeze({
            demoPersonaId: PROFESSIONAL_DEMO_PERSONA_ID,
            demoAccessVersion: 1,
            displayName: 'BarbersBuddies Demo Professional',
            email: 'professional@barbersbuddies.invalid',
            phoneNumber: '+15555550100',
            photoURL: '',
            userType: 'shop-owner',
            isSubscribed: true,
            subscriptionStatus: 'demo',
            emailVerified: false,
            providerId: 'anonymous'
        })
    })
});

const DEMO_EMAILS = new Set(
    Object.values(PERSONAS).map((persona) => persona.profile.email)
);

export const getDemoPersona = (personaId) => PERSONAS[personaId] || null;

export const listDemoPersonas = () => Object.freeze(Object.values(PERSONAS));

export const isDemoPersonaIdentity = (identity, runtime) => {
    if (!isDemoAccessEnabled(runtime)) return false;

    try {
        if (typeof identity === 'string') {
            return DEMO_EMAILS.has(identity.toLowerCase());
        }
        if (identity === null || typeof identity !== 'object') return false;
        if (identity.isAnonymous === true) return true;
        return typeof identity.email === 'string' && DEMO_EMAILS.has(identity.email.toLowerCase());
    } catch {
        return false;
    }
};
