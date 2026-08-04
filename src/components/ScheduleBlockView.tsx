import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, GripVertical, Clock, Sparkles, X } from 'lucide-react';
import { ScheduleBlock, ScheduleBlockValue, ScheduleDayDetail } from '@/lib/blocks';
import { useDraggableBlock } from '@/hooks/useDragBlock';

interface Props {
  block: ScheduleBlock;
  onChange: (val: ScheduleBlockValue) => void;
  onRemove: () => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduleBlockView({ block, onChange, onRemove }: Props) {
  const { onMouseDown } = useDraggableBlock(
    { id: block.id, type: 'schedule', value: block.value },
    '📅 Work Schedule'
  );

  let scheduleValue: ScheduleBlockValue = {
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
    dayDetails: {}
  };

  if (typeof block.value === 'string') {
    try {
      scheduleValue = JSON.parse(block.value);
    } catch (e) {}
  } else if (block.value && typeof block.value === 'object') {
    scheduleValue = block.value;
  }

  const { year, month, dayDetails = {} } = scheduleValue;

  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [modalCategory, setModalCategory] = useState<'holiday' | 'work' | 'off' | 'custom'>('holiday');
  const [modalTitle, setModalTitle] = useState('');
  const [modalShiftStart, setModalShiftStart] = useState('08:00');
  const [modalShiftEnd, setModalShiftEnd] = useState('17:00');

  // Month navigation
  const handlePrevMonth = () => {
    let newM = month - 1;
    let newY = year;
    if (newM < 0) {
      newM = 11;
      newY -= 1;
    }
    onChange({ year: newY, month: newM, dayDetails });
  };

  const handleNextMonth = () => {
    let newM = month + 1;
    let newY = year;
    if (newM > 11) {
      newM = 0;
      newY += 1;
    }
    onChange({ year: newY, month: newM, dayDetails });
  };

  // Calendar calculations
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  const openDayEditor = (dayNum: number) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(dayNum).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

    setSelectedDateStr(dateStr);
    const existing = dayDetails[dateStr];
    if (existing) {
      setModalCategory(existing.category || 'holiday');
      setModalTitle(existing.title || '');
      if (existing.shiftTimes) {
        const parts = existing.shiftTimes.split(' - ');
        setModalShiftStart(parts[0] || '08:00');
        setModalShiftEnd(parts[1] || '17:00');
      } else {
        setModalShiftStart('08:00');
        setModalShiftEnd('17:00');
      }
    } else {
      setModalCategory('holiday');
      setModalTitle('');
      setModalShiftStart('08:00');
      setModalShiftEnd('17:00');
    }
  };

  const handleSaveDayDetail = () => {
    if (!selectedDateStr) return;

    const newDetails = { ...dayDetails };
    const shiftTimes = modalCategory === 'work' ? `${modalShiftStart} - ${modalShiftEnd}` : undefined;

    newDetails[selectedDateStr] = {
      dateStr: selectedDateStr,
      category: modalCategory,
      title: modalTitle.trim(),
      shiftTimes
    };

    onChange({ year, month, dayDetails: newDetails });
    setSelectedDateStr(null);
  };

  const handleClearDayDetail = () => {
    if (!selectedDateStr) return;
    const newDetails = { ...dayDetails };
    delete newDetails[selectedDateStr];
    onChange({ year, month, dayDetails: newDetails });
    setSelectedDateStr(null);
  };

  return (
    <div className="group relative flex flex-col bg-amber-50/70 border border-amber-200 rounded-lg overflow-hidden my-1.5 w-full shadow-sm transition-all hover:border-amber-300">
      {/* Header with Grip, Icon, Navigation & Remove */}
      <div className="flex items-center justify-between bg-amber-100/50 border-b border-amber-200/60 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <div 
            className="p-1 cursor-grab active:cursor-grabbing text-amber-600 hover:text-amber-800 transition-colors select-none shrink-0"
            onMouseDown={onMouseDown}
          >
            <GripVertical size={14} />
          </div>
          <Calendar size={15} className="text-amber-700" />
          <span className="text-xs font-semibold text-amber-900">
            {MONTH_NAMES[month]} {year}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 text-amber-700 hover:bg-amber-200/60 rounded transition-colors"
            title="Previous Month"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 text-amber-700 hover:bg-amber-200/60 rounded transition-colors"
            title="Next Month"
          >
            <ChevronRight size={14} />
          </button>
          <button 
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 p-1 text-amber-500 hover:text-red-500 transition-all ml-1"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="p-2 bg-white/80 select-none">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {WEEKDAYS.map((wd, i) => (
            <span key={wd} className={`text-[10px] font-bold ${i === 0 ? 'text-red-500' : 'text-stone-400'}`}>
              {wd}
            </span>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {/* Empty padding before 1st day */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-8" />
          ))}

          {/* Days 1 to totalDaysInMonth */}
          {Array.from({ length: totalDaysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const formattedMonth = String(month + 1).padStart(2, '0');
            const formattedDay = String(dayNum).padStart(2, '0');
            const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
            const detail = dayDetails[dateStr];

            let cellStyle = "bg-stone-50 hover:bg-amber-100 text-stone-700 border-stone-100";
            if (detail?.category === 'holiday') {
              cellStyle = "bg-red-500 text-white font-bold border-red-600 shadow-xs";
            } else if (detail?.category === 'work') {
              cellStyle = "bg-blue-500 text-white font-semibold border-blue-600 shadow-xs";
            } else if (detail?.category === 'off') {
              cellStyle = "bg-amber-400 text-stone-900 font-semibold border-amber-500 shadow-xs";
            } else if (detail?.category === 'custom') {
              cellStyle = "bg-purple-500 text-white font-semibold border-purple-600 shadow-xs";
            }

            return (
              <button
                key={dateStr}
                onClick={() => openDayEditor(dayNum)}
                title={detail ? `${detail.category.toUpperCase()}: ${detail.title || ''} ${detail.shiftTimes || ''}` : `Day ${dayNum}`}
                className={`relative h-8 rounded-md border flex flex-col items-center justify-center transition-all ${cellStyle}`}
              >
                <span className="text-xs leading-none">{dayNum}</span>
                {detail?.category === 'work' && detail.shiftTimes && (
                  <span className="text-[7px] leading-tight opacity-90 truncate max-w-full px-0.5">
                    {detail.shiftTimes.split(' - ')[0]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend / Category Guide */}
      <div className="px-3 py-1.5 bg-amber-50/50 border-t border-amber-200/40 flex items-center justify-around text-[10px] text-stone-600">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span> Holiday</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span> Shift</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> Off</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500"></span> Custom</span>
      </div>

      {/* Day Detail Editor Modal */}
      {selectedDateStr && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-5 w-full max-w-sm flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-stone-800">
                  {selectedDateStr}
                </h3>
              </div>
              <button 
                onClick={() => setSelectedDateStr(null)}
                className="text-stone-400 hover:text-stone-700"
              >
                <X size={16} />
              </button>
            </div>

            {/* Category Selector Buttons */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">Select Category:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setModalCategory('holiday')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    modalCategory === 'holiday'
                      ? 'bg-red-500 text-white border-red-600 shadow-sm'
                      : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                  }`}
                >
                  🔴 Holiday
                </button>
                <button
                  onClick={() => setModalCategory('work')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    modalCategory === 'work'
                      ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  🔵 Work Shift
                </button>
                <button
                  onClick={() => setModalCategory('off')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    modalCategory === 'off'
                      ? 'bg-amber-400 text-stone-900 border-amber-500 shadow-sm'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  🟡 Off / Leave
                </button>
                <button
                  onClick={() => setModalCategory('custom')}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    modalCategory === 'custom'
                      ? 'bg-purple-500 text-white border-purple-600 shadow-sm'
                      : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  🟣 Custom
                </button>
              </div>
            </div>

            {/* Shift Times (if Work Shift selected) */}
            {modalCategory === 'work' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-stone-600 flex items-center gap-1">
                  <Clock size={12} /> Shift Times:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={modalShiftStart}
                    onChange={(e) => setModalShiftStart(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-stone-200 rounded-md text-xs font-mono outline-none focus:border-blue-400"
                  />
                  <span className="text-xs text-stone-400">to</span>
                  <input
                    type="time"
                    value={modalShiftEnd}
                    onChange={(e) => setModalShiftEnd(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 border border-stone-200 rounded-md text-xs font-mono outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            )}

            {/* Note / Details Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">Event / Shift Note:</label>
              <input
                type="text"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="e.g. Company Holiday or Morning Shift"
                className="w-full px-3 py-1.5 border border-stone-200 rounded-md text-xs outline-none focus:border-stone-400"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-3 mt-1">
              <button
                onClick={handleClearDayDetail}
                className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear Day
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedDateStr(null)}
                  className="px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveDayDetail}
                  className="px-4 py-2 text-xs font-semibold bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors shadow-sm"
                >
                  Save Schedule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
