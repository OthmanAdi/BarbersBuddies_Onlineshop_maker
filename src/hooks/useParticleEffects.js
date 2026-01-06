export const useParticleEffects = () => {
    const randomStart = () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        scale: Math.random() * 0.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1
    });

    return {randomStart};
};