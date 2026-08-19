import { useState } from 'react';
import { Activity, GripVertical, Radio, Copy, Check } from 'lucide-react';
import { PingBlock } from '@/lib/blocks';
import { useDraggableBlock } from '@/hooks/useDragBlock';

interface Props {
  block: PingBlock;
  onChange: (val: string) => void;
  onRemove: () => void;
}

export function PingBlockView({ block, onChange, onRemove }: Props) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const { onMouseDown } = useDraggableBlock(
    { id: block.id, type: 'ping', value: block.value },
    '📡 Ping Signal'
  );

  const getCleanDigits = (val: string) => {
    return (val || '').replace(/\D/g, '').substring(0, 5);
  };

  const getSignal = (val: string) => {
    const clean = getCleanDigits(val);
    if (clean.length < 5) return 'Awaiting 5 digits...';
    
    let a = clean[0];
    if (a === '0') a = '7';
    
    const b = clean[1];
    const c = clean[2];
    const d = clean[3];
    const e = clean[4];
    
    return `11${a}.1${b}${c}.1${d}${e}.xxx`;
  };

  const getNssSignal = (val: string) => {
    const clean = getCleanDigits(val);
    if (clean.length < 5) return 'Awaiting 5 digits...';
    
    let a = clean[0];
    if (a === '0') a = '7';
    
    const b = clean[1];
    const c = clean[2];
    const d = clean[3];
    const e = clean[4];
    
    return `11${a}.1${b}${c}.1${d}${e}.111 : 6100`;
  };

  const handleCopy = (text: string, key: string) => {
    if (!text || text.includes('Awaiting')) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  const signalText = getSignal(block.value);
  const nssSignalText = getNssSignal(block.value);

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
          value={block.value || ''}
          onChange={handleInputChange}
          placeholder="Enter ping code / text..."
          className="flex-1 px-2 py-1 bg-transparent outline-none text-green-900 text-xs font-mono placeholder:text-green-400 font-medium select-text"
        />
        <button 
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 p-1 text-green-500 hover:text-red-500 transition-all mr-1"
        >
          &times;
        </button>
      </div>

      {/* Below: Signal Outputs */}
      <div className="flex flex-col divide-y divide-green-100/80 bg-white/70">
        {/* Default Signal */}
        <div className="px-3 py-1.5 text-xs font-mono font-medium text-green-800 flex items-center justify-between gap-2">
          <span className="text-[10px] text-green-600 uppercase tracking-wider font-sans font-semibold shrink-0 flex items-center gap-1">
            <Radio size={11} className="text-green-600" />
            Signal:
          </span>
          <span className="truncate select-text cursor-text font-mono text-xs">{signalText}</span>
          <button
            onClick={() => handleCopy(signalText, 'signal')}
            title="Copy Signal"
            className="p-1 text-stone-400 hover:text-green-700 rounded transition-colors shrink-0"
          >
            {copiedKey === 'signal' ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
          </button>
        </div>

        {/* NSS Signal */}
        <div className="px-3 py-1.5 text-xs font-mono font-medium text-emerald-800 flex items-center justify-between gap-2 bg-emerald-50/40">
          <span className="text-[10px] text-emerald-600 uppercase tracking-wider font-sans font-semibold shrink-0 flex items-center gap-1">
            <Radio size={11} className="text-emerald-600" />
            NSS:
          </span>
          <span className="truncate select-text cursor-text font-mono text-xs">{nssSignalText}</span>
          <button
            onClick={() => handleCopy(nssSignalText, 'nss')}
            title="Copy NSS Signal"
            className="p-1 text-stone-400 hover:text-emerald-700 rounded transition-colors shrink-0"
          >
            {copiedKey === 'nss' ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
          </button>
        </div>
      </div>
    </div>
  );
}
