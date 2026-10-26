import React, { useState, useEffect, useRef } from 'react';
import { 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Trash2, 
  Maximize2, 
  RefreshCw, 
  X, 
  ImageIcon, 
  Check, 
  MoveHorizontal 
} from 'lucide-react';
import { ParsedImageToken, resolveAssetDisplayUrl, validateImageFile } from '@/lib/assets';

interface Props {
  token: ParsedImageToken;
  userId?: string;
  onUpdate: (updated: Partial<ParsedImageToken>) => void;
  onDelete: () => void;
  onReplace: (file: File) => void;
}

export function DocumentImageView({ token, userId, onUpdate, onDelete, onReplace }: Props) {
  const [displayUrl, setDisplayUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSelected, setIsSelected] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Load and resolve image URL
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    resolveAssetDisplayUrl(token.assetId, userId)
      .then((url) => {
        if (isMounted) {
          setDisplayUrl(url);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token.assetId, userId]);

  // Click outside unselects
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSelected(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAlignmentChange = (newAlign: 'left' | 'center' | 'right', e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ align: newAlign });
  };

  const handleWidthPreset = (widthPx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdate({ width: widthPx });
  };

  // Interactive mouse drag resizing
  const handleDragResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = token.width || 540;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      // If dragged from right handle, width expands with deltaX
      const newWidth = Math.max(200, Math.min(1000, startWidth + deltaX * 1.5));
      onUpdate({ width: Math.round(newWidth) });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleReplaceClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    replaceInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validation = validateImageFile(file);
      if (!validation.valid) {
        alert(validation.error);
        return;
      }
      onReplace(file);
    }
  };

  // Alignment classes for outer container
  const alignClass = 
    token.align === 'left' ? 'justify-start' :
    token.align === 'right' ? 'justify-end' :
    'justify-center';

  return (
    <div 
      ref={containerRef}
      className={`my-4 w-full flex ${alignClass} select-none group transition-all`}
      onClick={() => setIsSelected(true)}
    >
      <div 
        className={`relative flex flex-col items-center rounded-xl transition-all ${
          isSelected 
            ? 'ring-2 ring-blue-500/80 shadow-md p-1 bg-stone-50/60' 
            : 'hover:ring-1 hover:ring-stone-300'
        }`}
        style={{ width: `${token.width || 540}px`, maxWidth: '100%' }}
      >
        {/* Floating Action Toolbar (visible on hover or when selected) */}
        <div 
          className={`absolute -top-11 z-20 flex items-center gap-1 bg-stone-900/90 text-white backdrop-blur-md px-2 py-1 rounded-lg shadow-lg border border-stone-700/60 transition-all ${
            isSelected || 'opacity-0 group-hover:opacity-100'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Alignment buttons */}
          <div className="flex items-center gap-0.5 pr-1.5 border-r border-stone-700">
            <button
              type="button"
              onClick={(e) => handleAlignmentChange('left', e)}
              title="Align Left (ชิดซ้าย)"
              className={`p-1 rounded hover:bg-stone-700 transition-colors ${token.align === 'left' ? 'text-blue-400 bg-stone-800' : 'text-stone-300'}`}
            >
              <AlignLeft size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => handleAlignmentChange('center', e)}
              title="Align Center (กึ่งกลาง)"
              className={`p-1 rounded hover:bg-stone-700 transition-colors ${token.align === 'center' ? 'text-blue-400 bg-stone-800' : 'text-stone-300'}`}
            >
              <AlignCenter size={13} />
            </button>
            <button
              type="button"
              onClick={(e) => handleAlignmentChange('right', e)}
              title="Align Right (ชิดขวา)"
              className={`p-1 rounded hover:bg-stone-700 transition-colors ${token.align === 'right' ? 'text-blue-400 bg-stone-800' : 'text-stone-300'}`}
            >
              <AlignRight size={13} />
            </button>
          </div>

          {/* Quick width presets */}
          <div className="flex items-center gap-1 px-1.5 border-r border-stone-700 text-[10px]">
            <button
              type="button"
              onClick={(e) => handleWidthPreset(320, e)}
              title="Small width (320px)"
              className={`px-1.5 py-0.5 rounded hover:bg-stone-700 transition-colors ${token.width === 320 ? 'bg-blue-600 text-white font-bold' : 'text-stone-300'}`}
            >
              S
            </button>
            <button
              type="button"
              onClick={(e) => handleWidthPreset(540, e)}
              title="Medium width (540px)"
              className={`px-1.5 py-0.5 rounded hover:bg-stone-700 transition-colors ${token.width === 540 ? 'bg-blue-600 text-white font-bold' : 'text-stone-300'}`}
            >
              M
            </button>
            <button
              type="button"
              onClick={(e) => handleWidthPreset(760, e)}
              title="Large width (760px)"
              className={`px-1.5 py-0.5 rounded hover:bg-stone-700 transition-colors ${token.width === 760 ? 'bg-blue-600 text-white font-bold' : 'text-stone-300'}`}
            >
              L
            </button>
            <button
              type="button"
              onClick={(e) => handleWidthPreset(980, e)}
              title="Full width (980px)"
              className={`px-1.5 py-0.5 rounded hover:bg-stone-700 transition-colors ${token.width === 980 ? 'bg-blue-600 text-white font-bold' : 'text-stone-300'}`}
            >
              Full
            </button>
          </div>

          {/* Replace Image Button */}
          <button
            type="button"
            onClick={handleReplaceClick}
            title="Replace image (เปลี่ยนรูปภาพ)"
            className="p-1 rounded text-stone-300 hover:text-white hover:bg-stone-700 transition-colors"
          >
            <RefreshCw size={13} />
          </button>
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileInputChange}
            className="hidden"
          />

          {/* Fullscreen Preview */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsPreviewOpen(true);
            }}
            title="Full view (ดูขนาดเต็ม)"
            className="p-1 rounded text-stone-300 hover:text-white hover:bg-stone-700 transition-colors"
          >
            <Maximize2 size={13} />
          </button>

          {/* Delete Image */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete image (ลบรูปภาพ)"
            className="p-1 rounded text-stone-300 hover:text-red-400 hover:bg-stone-700 transition-colors ml-0.5"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Image Display */}
        <div className="relative w-full overflow-hidden rounded-lg bg-stone-100 flex items-center justify-center min-h-[120px]">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-stone-400 gap-2">
              <ImageIcon className="animate-pulse w-8 h-8 text-stone-300" />
              <span className="text-xs">กำลังโหลดรูปภาพ...</span>
            </div>
          ) : displayUrl ? (
            <img
              src={displayUrl}
              alt={token.caption || 'Document photo'}
              className="w-full h-auto object-contain rounded-lg max-h-[700px] pointer-events-none cursor-pointer"
            />
          ) : (
            <div className="py-10 flex flex-col items-center justify-center text-stone-400 gap-1.5">
              <ImageIcon className="w-7 h-7 text-stone-300" />
              <span className="text-xs font-medium">ไม่พบไฟล์รูปภาพ</span>
            </div>
          )}

          {/* Right Corner Resize Handle (MS Word Style) */}
          {isSelected && (
            <div
              onMouseDown={handleDragResize}
              title="ลากเพื่อปรับขนาด (Drag to resize)"
              className="absolute bottom-1.5 right-1.5 w-4 h-4 bg-blue-600 hover:bg-blue-700 rounded-sm cursor-nwse-resize shadow-md flex items-center justify-center text-white z-10"
            >
              <div className="w-1.5 h-1.5 bg-white rounded-2xs" />
            </div>
          )}
        </div>

        {/* Document Caption Input (Inline under image) */}
        <input
          type="text"
          value={token.caption || ''}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onUpdate({ caption: e.target.value })}
          placeholder="ใส่คำอธิบายภาพ (Add a caption)..."
          className="mt-1.5 text-center text-xs font-sans text-stone-500 placeholder:text-stone-300 outline-none bg-transparent hover:text-stone-700 focus:text-stone-900 border-b border-transparent focus:border-stone-300 transition-all w-full max-w-md py-0.5"
        />
      </div>

      {/* Fullscreen Lightbox Modal */}
      {isPreviewOpen && displayUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsPreviewOpen(false)}
        >
          <button
            onClick={() => setIsPreviewOpen(false)}
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
          <img
            src={displayUrl}
            alt={token.caption || 'Document photo full view'}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {token.caption && (
            <div className="absolute bottom-6 px-4 py-1.5 bg-black/70 text-white text-xs rounded-full backdrop-blur-xs max-w-lg text-center truncate">
              {token.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
