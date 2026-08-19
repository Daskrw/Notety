import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import type { UserProfile } from '@/lib/db';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  setUser: (user) => set({ isAuthenticated: !!user, user }),
}));

export interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface AppState {
  // Sidebar (Left Panel)
  isSidebarPinned: boolean;
  isSidebarHovered: boolean;
  isSidebarOpen: boolean;
  toggleSidebarPin: () => void;
  setSidebarHovered: (hovered: boolean) => void;
  toggleSidebar: () => void;

  // Right Panel
  isRightPanelPinned: boolean;
  isRightPanelHovered: boolean;
  isRightPanelOpen: boolean;
  toggleRightPanelPin: () => void;
  setRightPanelHovered: (hovered: boolean) => void;
  toggleRightPanel: () => void;

  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Notes
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;

  // Highlights
  activeHighlightId: string | null;
  setActiveHighlightId: (id: string | null) => void;
  isHighlightModalOpen: boolean;
  setIsHighlightModalOpen: (isOpen: boolean) => void;

  // Settings
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (isOpen: boolean) => void;

  // Category Modals
  isEditCategoryModalOpen: boolean;
  setIsEditCategoryModalOpen: (isOpen: boolean) => void;
  editingCategoryId: string | null;
  setEditingCategoryId: (id: string | null) => void;

  // Confirm Modal
  confirmConfig: ConfirmConfig;
  setConfirmConfig: (config: Partial<ConfirmConfig>) => void;

  // Profile
  isProfilePanelOpen: boolean;
  setIsProfilePanelOpen: (isOpen: boolean) => void;
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
}

const isLargeScreen = typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;

export const useAppStore = create<AppState>((set) => ({
  // Sidebar (Left Panel)
  isSidebarPinned: isLargeScreen,
  isSidebarHovered: false,
  isSidebarOpen: isLargeScreen,
  toggleSidebarPin: () => set((state) => {
    const nextPinned = !state.isSidebarPinned;
    return { isSidebarPinned: nextPinned, isSidebarOpen: nextPinned || state.isSidebarHovered };
  }),
  setSidebarHovered: (hovered: boolean) => set((state) => ({
    isSidebarHovered: hovered,
    isSidebarOpen: state.isSidebarPinned || hovered
  })),
  toggleSidebar: () => set((state) => {
    const nextPinned = !state.isSidebarPinned;
    return { isSidebarPinned: nextPinned, isSidebarOpen: nextPinned || state.isSidebarHovered };
  }),

  // Right Panel
  isRightPanelPinned: isLargeScreen,
  isRightPanelHovered: false,
  isRightPanelOpen: isLargeScreen,
  toggleRightPanelPin: () => set((state) => {
    const nextPinned = !state.isRightPanelPinned;
    return { isRightPanelPinned: nextPinned, isRightPanelOpen: nextPinned || state.isRightPanelHovered };
  }),
  setRightPanelHovered: (hovered: boolean) => set((state) => ({
    isRightPanelHovered: hovered,
    isRightPanelOpen: state.isRightPanelPinned || hovered
  })),
  toggleRightPanel: () => set((state) => {
    const nextPinned = !state.isRightPanelPinned;
    return { isRightPanelPinned: nextPinned, isRightPanelOpen: nextPinned || state.isRightPanelHovered };
  }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Notes
  selectedNoteId: null,
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),

  // Highlights
  activeHighlightId: null,
  setActiveHighlightId: (id) => set({ activeHighlightId: id }),
  isHighlightModalOpen: false,
  setIsHighlightModalOpen: (isOpen) => set({ isHighlightModalOpen: isOpen }),

  // Settings
  isSettingsModalOpen: false,
  setIsSettingsModalOpen: (isOpen) => set({ isSettingsModalOpen: isOpen }),

  // Category Modals
  isEditCategoryModalOpen: false,
  setIsEditCategoryModalOpen: (isOpen) => set({ isEditCategoryModalOpen: isOpen }),
  editingCategoryId: null,
  setEditingCategoryId: (id) => set({ editingCategoryId: id }),

  // Confirm Modal
  confirmConfig: { isOpen: false, title: '', message: '', onConfirm: () => {} },
  setConfirmConfig: (config) => set((state) => ({ confirmConfig: { ...state.confirmConfig, ...config } })),

  // Profile
  isProfilePanelOpen: false,
  setIsProfilePanelOpen: (isOpen) => set({ isProfilePanelOpen: isOpen }),
  userProfile: null,
  setUserProfile: (profile) => set({ userProfile: profile }),
}));
