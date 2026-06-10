import { create } from 'zustand';

interface AuthState {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  username: null,
  login: (username) => set({ isAuthenticated: true, username }),
  logout: () => set({ isAuthenticated: false, username: null }),
}));

export interface ConfirmConfig {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
}

interface AppState {
  selectedNoteId: string | null;
  setSelectedNoteId: (id: string | null) => void;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isRightPanelOpen: boolean;
  toggleRightPanel: () => void;
  activeHighlightId: string | null;
  setActiveHighlightId: (id: string | null) => void;
  isHighlightModalOpen: boolean;
  setIsHighlightModalOpen: (isOpen: boolean) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  // Template Modals
  isTemplateModalOpen: boolean;
  setIsTemplateModalOpen: (isOpen: boolean) => void;
  editingTemplateId: string | null;
  setEditingTemplateId: (id: string | null) => void;
  isUseTemplateModalOpen: boolean;
  setIsUseTemplateModalOpen: (isOpen: boolean) => void;
  activeTemplateId: string | null;
  setActiveTemplateId: (id: string | null) => void;
  // Category Modals
  isEditCategoryModalOpen: boolean;
  setIsEditCategoryModalOpen: (isOpen: boolean) => void;
  editingCategoryId: string | null;
  setEditingCategoryId: (id: string | null) => void;
  // Confirm Modal
  confirmConfig: ConfirmConfig;
  setConfirmConfig: (config: Partial<ConfirmConfig>) => void;
}

export const useAppStore = create<AppState>((set) => ({
  selectedNoteId: null,
  setSelectedNoteId: (id) => set({ selectedNoteId: id }),
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  isRightPanelOpen: true,
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
  activeHighlightId: null,
  setActiveHighlightId: (id) => set({ activeHighlightId: id }),
  isHighlightModalOpen: false,
  setIsHighlightModalOpen: (isOpen) => set({ isHighlightModalOpen: isOpen }),
  searchQuery: '',
  setSearchQuery: (query) => set({ searchQuery: query }),
  isTemplateModalOpen: false,
  setIsTemplateModalOpen: (isOpen) => set({ isTemplateModalOpen: isOpen }),
  editingTemplateId: null,
  setEditingTemplateId: (id) => set({ editingTemplateId: id }),
  isUseTemplateModalOpen: false,
  setIsUseTemplateModalOpen: (isOpen) => set({ isUseTemplateModalOpen: isOpen }),
  activeTemplateId: null,
  setActiveTemplateId: (id) => set({ activeTemplateId: id }),
  isEditCategoryModalOpen: false,
  setIsEditCategoryModalOpen: (isOpen) => set({ isEditCategoryModalOpen: isOpen }),
  editingCategoryId: null,
  setEditingCategoryId: (id) => set({ editingCategoryId: id }),
  confirmConfig: { isOpen: false, title: '', message: '', onConfirm: () => {} },
  setConfirmConfig: (config) => set((state) => ({ confirmConfig: { ...state.confirmConfig, ...config } })),
}));
