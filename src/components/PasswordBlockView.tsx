import { useState, useEffect } from 'react';
import { Eye, EyeOff, GripVertical } from 'lucide-react';
import { PasswordBlock } from '@/lib/blocks';
import { useDraggableBlock } from '@/hooks/useDragBlock';

interface Props {
  block: PasswordBlock;
  onChange: (val: string) => void;
  onRemove: () => void;
}

export function PasswordBlockView({ block, onChange, onRemove }: Props) {
  const [isVisible, setIsVisible] = useState(false);

  const { onMouseDown } = useDraggableBlock(
    { id: block.id, type: 'password', value: block.value },
    '🔒 Password Box'
  );

  useEffect(() => {
    // Hide when window loses focus
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') setIsVisible(false);
    };
    const handleBlur = () => setIsVisible(false);

    window.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  return (
    <div className="group relative flex items-center bg-stone-100 border border-stone-200 rounded-lg overflow-hidden my-1 w-full transition-all hover:border-stone-300">
      <div 
        className="px-2 py-3 bg-stone-200/50 cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-600 transition-colors select-none"
        onMouseDown={onMouseDown}
      >
        <GripVertical size={16} />
      </div>
      <div 
        className="flex items-center justify-center p-3 bg-stone-200 cursor-pointer hover:bg-stone-300 transition-colors"
        onClick={() => setIsVisible(!isVisible)}
      >
        {isVisible ? <EyeOff size={18} className="text-stone-600" /> : <Eye size={18} className="text-stone-600" />}
      </div>
      <input
        type={isVisible ? "text" : "password"}
        value={block.value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Secret password..."
        className="flex-1 px-4 py-2 bg-transparent outline-none text-stone-800 text-sm font-mono placeholder:text-stone-400 placeholder:font-sans"
      />
      <button 
        onClick={onRemove}
        className="z-10 opacity-0 group-hover:opacity-100 p-2 text-stone-400 hover:text-red-500 transition-all absolute right-1"
      >
        &times;
      </button>
    </div>
  );
}
