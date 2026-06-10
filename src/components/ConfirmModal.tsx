"use client";
import { useAppStore } from '@/store/useStore';
import { X, AlertTriangle } from 'lucide-react';

export function ConfirmModal() {
  const { confirmConfig, setConfirmConfig } = useAppStore();

  const close = () => setConfirmConfig({ isOpen: false });

  const handleConfirm = () => {
    confirmConfig.onConfirm();
    close();
  };

  if (!confirmConfig.isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-stone-900/30 backdrop-blur-sm transition-opacity" onClick={close} />
      
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3 text-stone-800">
            <div className="p-2 bg-red-50 text-red-500 rounded-full">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-semibold">{confirmConfig.title}</h3>
          </div>
          <p className="text-sm text-stone-500 leading-relaxed pl-11">
            {confirmConfig.message}
          </p>
        </div>

        <div className="p-4 bg-stone-50/50 flex justify-end gap-3 border-t border-stone-100">
          <button onClick={close} className="px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleConfirm} className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-sm">Confirm</button>
        </div>
      </div>
    </div>
  );
}
