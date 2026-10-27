"use client";
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  Search, 
  X, 
  Copy, 
  Check, 
  Info, 
  GripVertical, 
  Sparkles,
  ExternalLink,
  BookMarked
} from 'lucide-react';
import { NameLibraryBlock, NameLibraryBlockValue } from '@/lib/blocks';
import { 
  searchThaiNames, 
  ThaiNameSearchResult, 
  ThaiMatchCategory, 
  getThaiNameDatasetMetadata 
} from '@/lib/thai-name-search';
import { useDraggableBlock } from '@/hooks/useDragBlock';

interface Props {
  block: NameLibraryBlock;
  onChange: (val: NameLibraryBlockValue) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

function normalizeValue(value: NameLibraryBlock['value']): NameLibraryBlockValue {
  if (!value) return { query: '', category: 'all' };
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object') return parsed as NameLibraryBlockValue;
    } catch {
      return { query: value, category: 'all' };
    }
    return { query: value, category: 'all' };
  }
  return value;
}

const CATEGORY_TABS: Array<{ id: NameLibraryBlockValue['category']; label: string }> = [
  { id: 'all', label: 'ทั้งหมด' },
  { id: 'male', label: 'ชื่อชาย' },
  { id: 'female', label: 'ชื่อหญิง' },
  { id: 'surname', label: 'นามสกุล' },
  { id: 'meaning', label: 'มีความหมาย' },
];

const EXAMPLE_QUERIES = ['นภัส', 'กนกภรณ์', 'กมลทิพย์', 'ชนิกานต์', 'ศิริพร', 'วัฒนา'];

export function NameLibraryBlockView({ block, onChange, onRemove, dragHandleProps }: Props) {
  const blockValue = normalizeValue(block.value);
  const [query, setQuery] = useState(blockValue.query ?? '');
  const [activeCategory, setActiveCategory] = useState<NameLibraryBlockValue['category']>(blockValue.category ?? 'all');
  const [copiedName, setCopiedName] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { onMouseDown } = useDraggableBlock(
    { id: block.id, type: block.type, value: block.value },
    '📚 NameLibrary'
  );

  // Sync external changes to query if any
  useEffect(() => {
    const val = normalizeValue(block.value);
    if (val.query !== undefined && val.query !== query) {
      setQuery(val.query);
    }
    if (val.category && val.category !== activeCategory) {
      setActiveCategory(val.category);
    }
  }, [block.value]);

  // Update block state in note storage
  const handleQueryChange = (newQuery: string) => {
    setQuery(newQuery);
    onChange({
      query: newQuery,
      category: activeCategory,
    });
  };

  const handleCategoryChange = (cat: NameLibraryBlockValue['category']) => {
    setActiveCategory(cat);
    onChange({
      query,
      category: cat,
    });
  };

  const handleClear = () => {
    setQuery('');
    onChange({ query: '', category: activeCategory });
    inputRef.current?.focus();
  };

  // Perform deterministic Thai-aware search
  const results = useMemo(() => {
    return searchThaiNames(query, {
      category: activeCategory,
      limit: 50,
    });
  }, [query, activeCategory]);

  // Copy individual name to clipboard
  const handleCopy = async (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(name);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = name;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedName(name);
      setTimeout(() => {
        setCopiedName((curr) => (curr === name ? null : curr));
      }, 1500);
    } catch (err) {
      console.error('Failed to copy name:', err);
    }
  };

  const getMatchBadge = (matchType: ThaiMatchCategory) => {
    switch (matchType) {
      case 'exact':
        return {
          label: 'ตรงทุกตัว',
          bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        };
      case 'prefix':
        return {
          label: 'ขึ้นต้นด้วย',
          bg: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'contains':
        return {
          label: 'มีคำนี้',
          bg: 'bg-stone-100 text-stone-600 border-stone-200',
        };
      case 'closely_related':
        return {
          label: 'การสะกดใกล้เคียง',
          bg: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'similar':
        return {
          label: 'ชื่อใกล้เคียง',
          bg: 'bg-purple-50 text-purple-700 border-purple-200',
        };
      default:
        return {
          label: 'ผลลัพธ์',
          bg: 'bg-stone-50 text-stone-600 border-stone-200',
        };
    }
  };

  const metadata = getThaiNameDatasetMetadata();

  return (
    <div className="group relative flex flex-col bg-white border border-stone-200 rounded-lg overflow-hidden my-1.5 w-full shadow-xs transition-all hover:border-stone-300">
      {/* Block Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-stone-50/90 border-b border-stone-200/70 select-none">
        <div className="flex items-center gap-2">
          {dragHandleProps ? (
            <div {...dragHandleProps} className="cursor-grab text-stone-400 hover:text-stone-600">
              <GripVertical size={14} />
            </div>
          ) : (
            <div onMouseDown={onMouseDown} className="cursor-grab text-stone-400 hover:text-stone-600">
              <GripVertical size={14} />
            </div>
          )}
          <BookOpen size={15} className="text-teal-600" />
          <span className="text-xs font-semibold text-stone-800">NameLibrary</span>
          <span className="text-[10px] font-medium text-teal-700 bg-teal-50 border border-teal-200/80 px-1.5 py-0.2 rounded-full">
            21.3k
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowInfo((prev) => !prev)}
            title="แหล่งข้อมูลและลิขสิทธิ์ (Dataset sources & licenses)"
            className={`p-1 rounded text-stone-400 hover:text-teal-600 hover:bg-stone-200/60 transition-colors ${
              showInfo ? 'text-teal-700 bg-teal-50' : ''
            }`}
          >
            <Info size={13} />
          </button>

          <button
            type="button"
            onClick={onRemove}
            title="Delete NameLibrary"
            aria-label="Delete NameLibrary"
            className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all ml-1"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Dataset Attribution / License Drawer */}
      {showInfo && (
        <div className="p-3 bg-teal-50/70 border-b border-teal-100 text-xs text-stone-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-teal-900 flex items-center gap-1">
              <Sparkles size={12} className="text-teal-600" />
              แหล่งอ้างอิงคลังชื่อไทย (Offline Name Reference)
            </span>
            <button
              onClick={() => setShowInfo(false)}
              className="text-stone-400 hover:text-stone-600 text-xs"
            >
              &times;
            </button>
          </div>
          <p className="text-[11px] text-stone-600 leading-relaxed">
            คลังข้อมูลนี้รวบรวมและตรวจสอบความถูกต้องจากชุดข้อมูลสาธารณะ โดยไม่ใช้ API ภายนอกและทำงานแบบออฟไลน์ 100%:
          </p>
          <div className="space-y-1.5 pt-1">
            <div className="bg-white/80 p-2 rounded border border-teal-100">
              <div className="font-medium text-stone-800 text-[11px]">
                1. Thai Male, Female, and Family Name Corpus
              </div>
              <div className="text-[10px] text-stone-500 flex items-center justify-between mt-0.5">
                <span>ผู้รวบรวม: Korkeat Wannapat, Arthit Suriyawongkul</span>
                <span className="text-teal-700 font-mono">CC BY-SA 4.0</span>
              </div>
            </div>
            <div className="bg-white/80 p-2 rounded border border-teal-100">
              <div className="font-medium text-stone-800 text-[11px]">
                2. ชื่อบุคคลพร้อมความหมาย (Person Names & Meanings)
              </div>
              <div className="text-[10px] text-stone-500 flex items-center justify-between mt-0.5">
                <span>สำนักงานราชบัณฑิตยสภา (กองศิลปกรรม)</span>
                <span className="text-teal-700 font-mono">Open Data Common</span>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-stone-400 italic">
            * คลังนี้เป็นข้อมูลอ้างอิงตัวสะกดและอาจไม่ได้ครอบคลุมชื่อไทยทั้งหมด
          </p>
        </div>
      )}

      {/* Main Content Area */}
      <div className="p-3 space-y-2.5">
        {/* Search Input Box */}
        <div className="relative flex items-center">
          <Search size={14} className="absolute left-2.5 text-stone-400 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="ค้นหาชื่อไทย (เช่น นภัส, กนก, กมล)..."
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-stone-50/80 hover:bg-stone-50 focus:bg-white border border-stone-200 rounded-md outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-200 transition-all font-sans text-stone-800 placeholder:text-stone-400"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              title="ล้างข้อความค้นหา (Clear search)"
              className="absolute right-2 text-stone-400 hover:text-stone-600 p-0.5"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Category Pills Bar */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 custom-scrollbar text-[11px]">
          {CATEGORY_TABS.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleCategoryChange(tab.id)}
                className={`px-2 py-0.5 rounded-full border transition-all shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-teal-600 text-white border-teal-600 font-medium shadow-2xs'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100 hover:text-stone-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Results Header / Summary */}
        <div className="flex items-center justify-between text-[11px] text-stone-400 px-0.5">
          <span>
            {query.trim()
              ? `พบ ${results.length} รายการ`
              : 'คลังชื่อไทย 21,344 รายการ'}
          </span>
          {query.trim() && results.length > 0 && (
            <span className="text-[10px] text-teal-600">เรียงตามความใกล้เคียง</span>
          )}
        </div>

        {/* Search Results List */}
        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-0.5 custom-scrollbar">
          {results.map((item) => {
            const badge = getMatchBadge(item.matchType);
            const isCopied = copiedName === item.name;

            return (
              <div
                key={item.name}
                className="flex flex-col bg-stone-50/60 hover:bg-teal-50/40 border border-stone-100 hover:border-teal-200/80 p-2 rounded-md transition-all gap-1 group/item"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                    <span className="font-semibold text-stone-900 text-sm tracking-wide font-sans">
                      {item.name}
                    </span>

                    {/* Match Type Badge */}
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded border font-medium ${badge.bg}`}
                    >
                      {badge.label}
                    </span>

                    {/* Categories Badges */}
                    {item.categories.includes('male') && (
                      <span className="text-[9px] text-blue-600 bg-blue-50/80 border border-blue-100 px-1 py-0.2 rounded">
                        ชาย
                      </span>
                    )}
                    {item.categories.includes('female') && (
                      <span className="text-[9px] text-pink-600 bg-pink-50/80 border border-pink-100 px-1 py-0.2 rounded">
                        หญิง
                      </span>
                    )}
                    {item.categories.includes('surname') && (
                      <span className="text-[9px] text-amber-700 bg-amber-50/80 border border-amber-100 px-1 py-0.2 rounded">
                        นามสกุล
                      </span>
                    )}
                  </div>

                  {/* Individual Copy Button */}
                  <button
                    type="button"
                    onClick={(e) => handleCopy(item.name, e)}
                    title={`คัดลอก "${item.name}" (Copy name)`}
                    aria-label={`Copy ${item.name}`}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border transition-all cursor-pointer shrink-0 ${
                      isCopied
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-stone-600 border-stone-200 hover:bg-teal-600 hover:text-white hover:border-teal-600'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check size={11} className="stroke-[2.5]" />
                        <span className="text-[10px]">คัดลอกแล้ว</span>
                      </>
                    ) : (
                      <>
                        <Copy size={11} />
                        <span className="text-[10px]">Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Meaning Section if available from Royal Society */}
                {item.meaning && (
                  <div className="flex items-start gap-1 text-[11px] text-stone-600 bg-white/70 p-1.5 rounded border border-stone-100 mt-0.5">
                    <BookMarked size={12} className="text-teal-600 shrink-0 mt-0.5" />
                    <span className="leading-snug">{item.meaning}</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Empty State: No Matches Found */}
          {query.trim() && results.length === 0 && (
            <div className="py-6 px-3 text-center space-y-1.5 bg-stone-50/50 rounded-lg border border-dashed border-stone-200">
              <p className="text-xs font-medium text-stone-700">
                ไม่พบชื่อที่ตรงหรือใกล้เคียงกับ "{query}"
              </p>
              <p className="text-[10px] text-stone-400 max-w-xs mx-auto leading-relaxed">
                คลังข้อมูลอ้างอิงจากแหล่งที่บันทึกไว้ และอาจไม่ได้รวบรวมชื่อไทยทั้งหมดในปัจจุบัน
              </p>
            </div>
          )}

          {/* Initial State Helper when query is empty */}
          {!query.trim() && (
            <div className="pt-1 pb-2 space-y-2 text-stone-500">
              <p className="text-[11px] leading-relaxed">
                พิมพ์ชื่อภาษาไทยในช่องค้นหาเพื่อดูตัวสะกดที่ตรง ความหมาย และชื่อที่ใกล้เคียง หรือคลิกตัวอย่าง:
              </p>
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                {EXAMPLE_QUERIES.map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => handleQueryChange(ex)}
                    className="text-[10px] px-2 py-0.5 bg-stone-100 hover:bg-teal-50 hover:text-teal-800 hover:border-teal-200 border border-stone-200 rounded-md transition-colors"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
