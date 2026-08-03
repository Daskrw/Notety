import { useState } from 'react';
import { Trash2, Maximize2, X, Image as ImageIcon } from 'lucide-react';
import { ImageBlock } from '@/lib/blocks';

interface Props {
  block: ImageBlock;
  onChange: (caption: string) => void;
  onRemove: () => void;
}

export function ImageBlockView({ block, onChange, onRemove }: Props) {
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  return (
    <div className="my-6 w-full flex flex-col items-center justify-center select-none">
      {/* Centered Image Container (MS Word Style) */}
      <div className="relative group max-w-2xl w-full flex flex-col items-center justify-center bg-stone-50 border border-stone-200/80 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
        <img
          src={block.url}
          alt={block.caption || 'Note attached photo'}
          className="max-h-[480px] w-auto max-w-full object-contain mx-auto rounded-lg"
        />

        {/* Hover Action Overlay */}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 flex items-center gap-1 bg-black/60 backdrop-blur-xs p-1 rounded-lg transition-opacity">
          <button
            onClick={() => setIsPreviewOpen(true)}
            title="Full view"
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-md transition-colors"
          >
            <Maximize2 size={14} />
          </button>
          <button
            onClick={onRemove}
            title="Remove photo"
            className="p-1.5 text-white/80 hover:text-red-400 hover:bg-white/20 rounded-md transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Centered Caption Input */}
      <input
        type="text"
        value={block.caption || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Add a caption (optional)..."
        className="mt-2.5 text-center text-xs font-sans text-stone-500 placeholder:text-stone-300 outline-none bg-transparent hover:text-stone-700 focus:text-stone-900 border-b border-transparent focus:border-stone-300 transition-all max-w-md w-full py-0.5"
      />

      {/* Fullscreen Image Preview Modal */}
      {isPreviewOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setIsPreviewOpen(false)}
        >
          <button
            onClick={() => setIsPreviewOpen(false)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
          <div className="max-w-4xl max-h-[90vh] flex flex-col items-center gap-3">
            <img
              src={block.url}
              alt={block.caption || 'Preview'}
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-lg shadow-2xl"
            />
            {block.caption && (
              <p className="text-sm text-stone-200 font-sans text-center">{block.caption}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
