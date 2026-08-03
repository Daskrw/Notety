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
    <div className="group relative flex flex-col bg-green-50/70 border border-green-200 rounded-lg overflow-hidden my-1.5 w-full shadow-sm transition-all hover:border-green-300">
      {/* Upper: Input & Controls */}
      <div className="flex items-center bg-green-100/50 border-b border-green-200/60 px-1 py-0.5">
        <div 
          className="px-1.5 py-1.5 cursor-grab active:cursor-grabbing text-green-600 hover:text-green-800 transition-colors select-none shrink-0"
          onMouseDown={onMouseDown}
        >
          <GripVertical size={14} />
        </div>
        <div className="flex items-center justify-center p-1 text-green-700 shrink-0">
          <Activity size={14} />
        </div>
        <input
          type="text"
          value={block.value}
          onChange={handleInputChange}
          placeholder="5-digit ping"
          className="flex-1 px-2 py-1 bg-transparent outline-none text-green-900 text-xs font-mono placeholder:text-green-400 font-medium"
        />
        <button 
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-1 text-green-500 hover:text-red-500 transition-all mr-1"
        >
          &times;
        </button>
      </div>

      {/* Below: Signal Output */}
      <div className="px-3 py-2 text-xs font-mono font-medium text-green-800 bg-white/70 flex items-center justify-between gap-2">
        <span className="text-[10px] text-green-600 uppercase tracking-wider font-sans font-medium shrink-0">Signal:</span>
        <span className="truncate">{getSignal(block.value)}</span>
      </div>
    </div>
  );
}
