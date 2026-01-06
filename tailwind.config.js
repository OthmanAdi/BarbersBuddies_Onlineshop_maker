module.exports = {
    content: [
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            screens: {
                'mob-max': {'max': '639px'},
                'tab-max': {'max': '759px'},
                'video-bp': {'max': '1085px'},
                'xs': '475px',
                'sm': '640px',
                'md': '768px',
                'lg': '1024px',
                'xl': '1280px',
                '2xl': '1536px',
                '3xl': '1920px',
            },
            backgroundImage: {
                'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
            },
            keyframes: {
                blob1: {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '25%': { transform: 'translate(50px, -30px) scale(1.2)' },
                    '50%': { transform: 'translate(-20px, 40px) scale(0.9)' },
                    '75%': { transform: 'translate(-40px, -30px) scale(1.1)' }
                },
                blob2: {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '25%': { transform: 'translate(-40px, 20px) scale(1.1)' },
                    '50%': { transform: 'translate(30px, -30px) scale(0.9)' },
                    '75%': { transform: 'translate(40px, 30px) scale(1.2)' }
                },
                blob3: {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '25%': { transform: 'translate(30px, 30px) scale(1.2)' },
                    '50%': { transform: 'translate(-30px, -20px) scale(0.8)' },
                    '75%': { transform: 'translate(-20px, 40px) scale(1.1)' }
                },
                blob4: {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '25%': { transform: 'translate(-20px, -30px) scale(1.1)' },
                    '50%': { transform: 'translate(40px, 20px) scale(0.9)' },
                    '75%': { transform: 'translate(20px, -40px) scale(1.2)' }
                },
                blob5: {
                    '0%, 100%': { transform: 'translate(0, 0) scale(1)' },
                    '25%': { transform: 'translate(30px, -40px) scale(1.2)' },
                    '50%': { transform: 'translate(-40px, 30px) scale(0.9)' },
                    '75%': { transform: 'translate(20px, 30px) scale(1.1)' }
                },
                shimmer: {
                    '0%': {
                        backgroundPosition: '200% 50%'
                    },
                    '100%': {
                        backgroundPosition: '-200% 50%'
                    }
                },
                blob: {
                    '0%': {
                        transform: 'translate(0px, 0px) scale(1)'
                    },
                    '33%': {
                        transform: 'translate(30px, -50px) scale(1.1)'
                    },
                    '66%': {
                        transform: 'translate(-20px, 20px) scale(0.9)'
                    },
                    '100%': {
                        transform: 'translate(0px, 0px) scale(1)'
                    }
                },
                'gradient-x': {
                    '0%, 100%': {
                        'opacity': '0.3',
                        'transform': 'translateX(-25%)'
                    },
                    '50%': {
                        'opacity': '0.5',
                        'transform': 'translateX(25%)'
                    }
                }
            },
            animation: {
                shimmer: 'shimmer 6s linear infinite',
                blob: 'blob 7s infinite',
                'gradient-x': 'gradient-x 15s ease infinite',
                blob1: 'blob1 20s infinite',
                blob2: 'blob2 25s infinite',
                blob3: 'blob3 22s infinite',
                blob4: 'blob4 28s infinite',
                blob5: 'blob5 23s infinite'
            }
        },
    },
    plugins: [
        require("daisyui"),
        require('@tailwindcss/container-queries')
    ],
    daisyui: {
        themes: ["emerald", "luxury"],
    },
}