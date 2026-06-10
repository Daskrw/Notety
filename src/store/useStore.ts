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
  // General UI
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isRightPanelOpen: boolean;
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

  // Template Modals
  isTemplateModalOpen: boolean;
  setIsTemplateModalOpen: (isOpen: boolean) => void;
  isCreateTemplateModalOpen: boolean;
  setIsCreateTemplateModalOpen: (isOpen: boolean) => void;
  isUseTemplateModalOpen: boolean;
  setIsUseTemplateModalOpen: (isOpen: boolean) => void;
  
  editingTemplateId: string | null;
  setEditingTemplateId: (id: string | null) => void;
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
  // General UI
  isSidebarOpen: true,
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  isRightPanelOpen: true,
  toggleRightPanel: () => set((state) => ({ isRightPanelOpen: !state.isRightPanelOpen })),
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

  // Template Modals
  isTemplateModalOpen: false,
  setIsTemplateModalOpen: (isOpen) => set({ isTemplateModalOpen: isOpen }),
  isCreateTemplateModalOpen: false,
  setIsCreateTemplateModalOpen: (isOpen) => set({ isCreateTemplateModalOpen: isOpen }),
  isUseTemplateModalOpen: false,
  setIsUseTemplateModalOpen: (isOpen) => set({ isUseTemplateModalOpen: isOpen }),
  
  editingTemplateId: null,
  setEditingTemplateId: (id) => set({ editingTemplateId: id }),
  activeTemplateId: null,
  setActiveTemplateId: (id) => set({ activeTemplateId: id }),

  // Category Modals
  isEditCategoryModalOpen: false,
  setIsEditCategoryModalOpen: (isOpen) => set({ isEditCategoryModalOpen: isOpen }),
  editingCategoryId: null,
  setEditingCategoryId: (id) => set({ editingCategoryId: id }),

  // Confirm Modal
  confirmConfig: { isOpen: false, title: '', message: '', onConfirm: () => {} },
  setConfirmConfig: (config) => set((state) => ({ confirmConfig: { ...state.confirmConfig, ...config } })),
}));
