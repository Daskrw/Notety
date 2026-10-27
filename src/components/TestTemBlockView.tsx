import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, FileCode, Copy, Check, Plus, X, Eraser } from 'lucide-react';
import { 
  TextTemBlock, 
  TextTemBlockValue, 
  TextTemSegment, 
  TestTemBlock, 
  TestTemBlockValue, 
  TestTemSegment,
  assembleTextTemText,
  assembleTestTemText
} from '@/lib/blocks';
import { useDraggableBlock } from '@/hooks/useDragBlock';

export { assembleTextTemText, assembleTestTemText };

interface Props {
  block: TextTemBlock;
  onChange: (val: TextTemBlockValue) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

// Normalize block value safely
function normalizeValue(value: TestTemBlock['value']): TestTemBlockValue {
  let val: TestTemBlockValue = { segments: [] };
  if (typeof value === 'string') {
    try {
      val = JSON.parse(value);
    } catch {
      val = { segments: [{ type: 'text', id: crypto.randomUUID(), text: value || '' }] };
    }
  } else if (value && typeof value === 'object' && Array.isArray(value.segments)) {
    val = value;
  }

  if (!val.segments || val.segments.length === 0) {
    val = {
      segments: [{ type: 'text', id: crypto.randomUUID(), text: '' }]
    };
  }
  return val;
}



export function TestTemBlockView({ block, onChange, onRemove, dragHandleProps }: Props) {
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastActiveCursor = useRef<{ segmentIndex: number; offset: number } | null>(null);
  const pendingFocusFieldId = useRef<string | null>(null);

  const { onMouseDown } = useDraggableBlock(
    { id: block.id, type: block.type, value: block.value },
    '📝 TextTem'
  );

  const blockValue = normalizeValue(block.value);
  const segments = blockValue.segments;

  // Auto focus newly created field if requested
  useEffect(() => {
    if (pendingFocusFieldId.current) {
      const fieldId = pendingFocusFieldId.current;
      pendingFocusFieldId.current = null;
      const el = containerRef.current?.querySelector(`input[data-field-id="${fieldId}"]`) as HTMLInputElement | null;
      if (el) {
        el.focus();
        el.select();
      }
    }
  }, [segments]);

  // Update text of a specific segment by index
  const handleUpdateSegmentText = (index: number, newText: string) => {
    const updated = segments.map((seg, i) => (i === index ? { ...seg, text: newText } : seg));
    onChange({ segments: updated });
  };

  // Remove a field and merge surrounding text segments
  const handleRemoveField = (fieldIndex: number) => {
    const newSegments: TestTemSegment[] = [];
    segments.forEach((seg, idx) => {
      if (idx === fieldIndex) return; // Drop this field
      if (seg.type === 'text' && newSegments.length > 0 && newSegments[newSegments.length - 1].type === 'text') {
        newSegments[newSegments.length - 1] = {
          ...newSegments[newSegments.length - 1],
          text: (newSegments[newSegments.length - 1].text || '') + (seg.text || '')
        };
      } else {
        newSegments.push(seg);
      }
    });

    if (newSegments.length === 0) {
      newSegments.push({ type: 'text', id: crypto.randomUUID(), text: '' });
    }

    onChange({ segments: newSegments });
  };

  // Insert an inline field at the last active cursor position
  const handleAddInlineField = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newFieldId = crypto.randomUUID();
    const newField: TestTemSegment = {
      type: 'field',
      id: newFieldId,
      text: '',
      placeholder: 'field'
    };
    pendingFocusFieldId.current = newFieldId;

    if (lastActiveCursor.current) {
      const { segmentIndex, offset } = lastActiveCursor.current;
      if (segmentIndex >= 0 && segmentIndex < segments.length) {
        const targetSeg = segments[segmentIndex];
        if (targetSeg.type === 'text') {
          const fullText = targetSeg.text || '';
          const cut = Math.min(Math.max(0, offset), fullText.length);
          const before = fullText.slice(0, cut);
          const after = fullText.slice(cut);

          const beforeSeg: TestTemSegment = { type: 'text', id: crypto.randomUUID(), text: before };
          const afterSeg: TestTemSegment = { type: 'text', id: crypto.randomUUID(), text: after };

          const newSegments = [
            ...segments.slice(0, segmentIndex),
            beforeSeg,
            newField,
            afterSeg,
            ...segments.slice(segmentIndex + 1)
          ];

          onChange({ segments: newSegments });
          return;
        }
      }
    }

    // Fallback: append at end
    const newSegments = [
      ...segments,
      newField,
      { type: 'text' as const, id: crypto.randomUUID(), text: '' }
    ];
    onChange({ segments: newSegments });
  };

  // Copy full assembled template text
  const handleCopyAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    const fullText = assembleTextTemText(segments);
    navigator.clipboard.writeText(fullText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Clear contents of all small rectangular text fields while keeping fields and text intact
  const handleClearTextFields = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const updatedSegments = segments.map((seg) => {
      if (seg.type === 'field') {
        return { ...seg, text: '' };
      }
      return seg;
    });

    onChange({ segments: updatedSegments });
  };

  return (
    <div className="group relative flex flex-col bg-white border border-stone-200 rounded-lg overflow-hidden my-1.5 w-full shadow-sm transition-all hover:border-stone-300">
      {/* Header with Grip, Icon, Title, and Copy Button */}
      <div className="flex items-center justify-between bg-stone-50 border-b border-stone-200/70 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          {dragHandleProps && (
            <div 
              {...dragHandleProps}
              className="p-1 cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-700 transition-colors select-none shrink-0"
              onMouseDown={(e) => {
                if (!dragHandleProps) {
                  onMouseDown(e);
                }
              }}
            >
              <GripVertical size={14} />
            </div>
          )}
          <FileCode size={15} className="text-amber-600" />
          <span className="text-xs font-semibold text-stone-800">TextTem</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyAll}
            title="Copy entire assembled template"
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-stone-100 hover:bg-amber-500 hover:text-white text-stone-700 transition-colors shadow-2xs cursor-pointer active:scale-95"
          >
            {copied ? (
              <>
                <Check size={12} className="text-green-600" />
                <span className="text-green-700 font-semibold">Copied</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </button>

          <button 
            onClick={onRemove}
            title="Delete TextTem"
            className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all ml-1"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="p-3 bg-white flex flex-col gap-2.5">
        {/* Inline Segment Flow Container */}
        <div 
          ref={containerRef}
          className="min-h-[80px] w-full bg-stone-50/40 hover:bg-stone-50/60 focus-within:bg-white border border-stone-200/80 focus-within:border-amber-400 rounded-lg p-2.5 text-xs text-stone-800 leading-normal font-sans transition-all block break-words whitespace-pre-wrap select-text"
        >
          {segments.map((seg, idx) => {
            if (seg.type === 'text') {
              return (
                <InlineTextSegment
                  key={seg.id}
                  text={seg.text || ''}
                  placeholder={idx === 0 && segments.length === 1 ? "Write template here or click '+ Add Text' to insert inline field..." : ""}
                  onCursorChange={(offset) => {
                    lastActiveCursor.current = { segmentIndex: idx, offset };
                  }}
                  onChange={(newText) => handleUpdateSegmentText(idx, newText)}
                />
              );
            }

            return (
              <InlineFieldSegment
                key={seg.id}
                fieldId={seg.id}
                value={seg.text || ''}
                placeholder={seg.placeholder || 'field'}
                onChange={(newText) => handleUpdateSegmentText(idx, newText)}
                onRemove={() => handleRemoveField(idx)}
              />
            );
          })}
        </div>

        {/* Action button bar */}
        <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleAddInlineField}
              title="Insert inline editable text field at cursor"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-700 bg-amber-50/90 hover:bg-amber-100 hover:text-amber-900 border border-amber-200 rounded-md transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <Plus size={13} />
              <span>Add Text</span>
            </button>

            <button
              type="button"
              onClick={handleClearTextFields}
              title="Clear contents of all rectangular text fields"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 hover:text-stone-900 border border-stone-200 rounded-md transition-all shadow-2xs cursor-pointer active:scale-95"
            >
              <Eraser size={12} className="text-stone-500" />
              <span>Clear Text Fields</span>
            </button>
          </div>

          <span className="text-[10px] text-stone-400">
            {segments.filter(s => s.type === 'field').length} inline {segments.filter(s => s.type === 'field').length === 1 ? 'field' : 'fields'}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Subcomponents with isolated DOM & caret stability
// ─────────────────────────────────────────────

interface InlineFieldProps {
  fieldId: string;
  value: string;
  placeholder: string;
  onChange: (val: string) => void;
  onRemove: () => void;
}

const InlineFieldSegment = React.memo(function InlineFieldSegment({
  fieldId,
  value,
  placeholder,
  onChange,
  onRemove
}: InlineFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <span className="inline-flex items-center align-baseline mx-0.5 my-0 px-1 py-0 bg-amber-50 border border-amber-300 rounded shadow-2xs hover:border-amber-400 focus-within:ring-1 focus-within:ring-amber-500 focus-within:border-amber-500 select-none transition-all h-[20px]">
      <input
        ref={inputRef}
        data-field-id={fieldId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: `${Math.max(36, ((value || '').length + 1) * 7.5)}px`
        }}
        className="bg-transparent outline-none text-xs font-semibold text-amber-900 placeholder:text-amber-400/80 px-0.5 py-0 text-center font-sans h-full leading-none"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove field"
        className="p-0 text-amber-400 hover:text-red-500 hover:bg-amber-100 rounded transition-colors ml-0.5 cursor-pointer leading-none text-xs flex items-center justify-center w-3 h-3"
      >
        &times;
      </button>
    </span>
  );
});

interface InlineTextProps {
  text: string;
  placeholder?: string;
  onCursorChange: (offset: number) => void;
  onChange: (newText: string) => void;
}

const InlineTextSegment = React.memo(function InlineTextSegment({
  text,
  placeholder,
  onCursorChange,
  onChange
}: InlineTextProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const isSelfTyping = useRef(false);

  // Sync external text to DOM textContent only when not self-typing
  useEffect(() => {
    if (isSelfTyping.current) {
      isSelfTyping.current = false;
      return;
    }
    if (spanRef.current && spanRef.current.innerText !== text) {
      spanRef.current.innerText = text;
    }
  }, [text]);

  const updateCursor = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && spanRef.current?.contains(sel.getRangeAt(0).startContainer)) {
      onCursorChange(sel.getRangeAt(0).startOffset);
    }
  };

  const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
    isSelfTyping.current = true;
    const currentText = e.currentTarget.innerText || '';
    onChange(currentText);
    updateCursor();
  };

  return (
    <span
      ref={spanRef}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyUp={updateCursor}
      onMouseUp={updateCursor}
      onClick={updateCursor}
      onFocus={updateCursor}
      data-placeholder={placeholder}
      className="inline outline-none m-0 p-0 whitespace-pre-wrap break-words leading-normal align-baseline empty:before:content-[attr(data-placeholder)] empty:before:text-stone-300 empty:before:pointer-events-none"
    />
  );
});

export const TextTemBlockView = TestTemBlockView;

