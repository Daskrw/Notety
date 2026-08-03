import { useState } from 'react';
import { Activity, GripVertical } from 'lucide-react';
import { PingBlock } from '@/lib/blocks';
import { useDraggableBlock } from '@/hooks/useDragBlock';

interface Props {
  block: PingBlock;
  onChange: (val: string) => void;
  onRemove: () => void;
}

export function PingBlockView({ block, onChange, onRemove }: Props) {
  const { onMouseDown } = useDraggableBlock(
    { id: block.id, type: 'ping', value: block.value },
    '📡 Ping Signal'
  );

  const getSignal = (val: string) => {
    const clean = val.replace(/\D/g, '').substring(0, 5);
    if (clean.length < 5) return 'Awaiting 5 digits...';
    
    let a = clean[0];
    if (a === '0') a = '7';
    
    const b = clean[1];
    const c = clean[2];
    const d = clean[3];
    const e = clean[4];
    
    return `11${a}.1${b}${c}.1${d}${e}.xxx`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').substring(0, 5);
    onChange(val);
  };

  return (
    <div className="group relative flex items-center bg-green-50 border border-green-200 rounded-lg overflow-hidden my-1 w-full shadow-sm transition-all hover:border-green-300">
      <div 
        className="px-2 py-3 bg-green-100/50 cursor-grab active:cursor-grabbing text-green-500 hover:text-green-700 transition-colors select-none shrink-0"
        onMouseDown={onMouseDown}
      >
        <GripVertical size={16} />
      </div>
      <div className="flex items-center justify-center p-2.5 bg-green-200 shrink-0">
        <Activity size={16} className="text-green-700" />
      </div>
      <input
        type="text"
        value={block.value}
        onChange={handleInputChange}
        placeholder="5-digit ping"
        className="w-28 px-3 py-2 bg-transparent outline-none text-green-900 text-xs font-mono placeholder:text-green-400 shrink-0"
      />
      <div className="flex-1 px-3 py-2 border-l border-green-200 text-xs font-mono text-green-700 bg-white/50 truncate whitespace-nowrap">
        {getSignal(block.value)}
      </div>
      <button 
        onClick={onRemove}
        className="z-10 opacity-0 group-hover:opacity-100 p-2 text-green-500 hover:text-red-500 transition-all absolute right-1"
      >
        &times;
      </button>
    </div>
  );
}
