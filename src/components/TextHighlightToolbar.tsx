"use client";
import { useState } from 'react';
import { Highlighter, Ban, Palette } from 'lucide-react';

export const PRESET_COLORS = [
  { name: 'Yellow', value: '#fef08a' },
  { name: 'Green', value: '#bbf7d0' },
  { name: 'Blue', value: '#bfdbfe' },
  { name: 'Pink', value: '#fbcfe8' },
  { name: 'Orange', value: '#fed7aa' },
  { name: 'Purple', value: '#e9d5ff' },
];

interface Props {
  onSelectColor: (color: string) => void;
  onClearHighlight: () => void;
}

export function TextHighlightToolbar({ onSelectColor, onClearHighlight }: Props) {
  const [customColor, setCustomColor] = useState('#fef08a');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        title="Highlight Text Color"
        className={`p-2 rounded-full transition-colors flex items-center gap-1 ${
          isOpen ? 'bg-amber-100 text-amber-700' : 'hover:bg-stone-100 text-stone-400 hover:text-stone-700'
        }`}
      >
        <Highlighter className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-stone-200 rounded-xl shadow-xl p-3 z-50 flex flex-col gap-2">
          <div className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider px-1">
            Highlight Color
          </div>

          {/* Preset Swatches */}
          <div className="grid grid-cols-6 gap-1.5 p-1 bg-stone-50 rounded-lg border border-stone-100">
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => {
                  onSelectColor(c.value);
                  setIsOpen(false);
                }}
                title={c.name}
                style={{ backgroundColor: c.value }}
                className="w-6 h-6 rounded-full border border-stone-300/50 hover:scale-110 transition-transform shadow-xs cursor-pointer"
              />
            ))}
          </div>

          {/* Custom Color Input & Clear Option */}
          <div className="flex items-center justify-between pt-1 border-t border-stone-100">
            <label className="flex items-center gap-1.5 text-xs text-stone-600 cursor-pointer hover:text-stone-900">
              <Palette className="w-3.5 h-3.5 text-purple-600" />
              <span>Custom:</span>
              <input
                type="color"
                value={customColor}
                onChange={(e) => {
                  setCustomColor(e.target.value);
                  onSelectColor(e.target.value);
                  setIsOpen(false);
                }}
                className="w-5 h-5 rounded cursor-pointer border-none bg-transparent"
              />
            </label>

            <button
              onClick={() => {
                onClearHighlight();
                setIsOpen(false);
              }}
              title="Remove Highlight"
              className="flex items-center gap-1 text-xs text-stone-400 hover:text-red-500 transition-colors p-1"
            >
              <Ban className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
