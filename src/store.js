// src/store.js
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useStore = create(
    persist(
        (set) => ({
            theme: 'emerald',
            toggleTheme: (newTheme) => set((state) => ({
                theme: newTheme || (state.theme === 'emerald' ? 'luxury' : 'emerald')
            })),
            userShops: [],
            setUserShops: (shops) => set({ userShops: shops }),
            addUserShop: (shop) => set((state) => ({ userShops: [...state.userShops, shop] })),
            removeUserShop: (shopId) => set((state) => ({
                userShops: state.userShops.filter(shop => shop.id !== shopId)
            })),
        }),
        {
            name: 'theme-storage',
        }
    )
)

export default useStore;