import { useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, GripVertical, Clock, Sparkles, X, CheckSquare, Layers } from 'lucide-react';
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

// Helper to calculate +9 hours 30 mins
function add9Hours30Mins(timeStr: string): string {
  if (!timeStr || !timeStr.includes(':')) return '17:30';
  const [hStr, mStr] = timeStr.split(':');
  let hours = parseInt(hStr, 10);
  let mins = parseInt(mStr, 10);
  if (isNaN(hours)) hours = 8;
  if (isNaN(mins)) mins = 0;

  // Add 9 hours and 30 minutes
  let totalMins = hours * 60 + mins + 9 * 60 + 30;
  totalMins = totalMins % (24 * 60);

  const endH = Math.floor(totalMins / 60);
  const endM = totalMins % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

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

  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [modalCategory, setModalCategory] = useState<'holiday' | 'work' | 'off' | 'custom'>('work');
  const [modalTitle, setModalTitle] = useState('');
  const [modalShiftStart, setModalShiftStart] = useState('08:00');
  const [modalShiftEnd, setModalShiftEnd] = useState('17:30');

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

  const handleDayClick = (dayNum: number, e: React.MouseEvent) => {
    const formattedMonth = String(month + 1).padStart(2, '0');
    const formattedDay = String(dayNum).padStart(2, '0');
    const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

    if (isMultiSelectMode || e.ctrlKey || e.metaKey || e.shiftKey) {
      // Multi-select toggle
      setSelectedDates(prev => 
        prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
      );
    } else {
      // Single click opens modal directly
      setSelectedDates([dateStr]);
      const existing = dayDetails[dateStr];
      if (existing) {
        setModalCategory(existing.category || 'work');
        setModalTitle(existing.title || '');
        if (existing.shiftTimes) {
          const parts = existing.shiftTimes.split(' - ');
          const start = parts[0] || '08:00';
          setModalShiftStart(start);
          setModalShiftEnd(parts[1] || add9Hours30Mins(start));
        } else {
          setModalShiftStart('08:00');
          setModalShiftEnd('17:30');
        }
      } else {
        setModalCategory('work');
        setModalTitle('');
        setModalShiftStart('08:00');
        setModalShiftEnd('17:30');
      }
      setIsModalOpen(true);
    }
  };

  const handleShiftStartChange = (val: string) => {
    setModalShiftStart(val);
    setModalShiftEnd(add9Hours30Mins(val));
  };

  const handleOpenModalForSelection = () => {
    if (selectedDates.length === 0) return;
    // Set initial defaults from first selected date or work
    const first = selectedDates[0];
    const existing = dayDetails[first];
    if (existing) {
      setModalCategory(existing.category || 'work');
      setModalTitle(existing.title || '');
      if (existing.shiftTimes) {
        const parts = existing.shiftTimes.split(' - ');
        const start = parts[0] || '08:00';
        setModalShiftStart(start);
        setModalShiftEnd(parts[1] || add9Hours30Mins(start));
      } else {
        setModalShiftStart('08:00');
        setModalShiftEnd('17:30');
      }
    } else {
      setModalCategory('work');
      setModalTitle('');
      setModalShiftStart('08:00');
      setModalShiftEnd('17:30');
    }
    setIsModalOpen(true);
  };

  const handleSaveDayDetail = () => {
    if (selectedDates.length === 0) return;

    const newDetails = { ...dayDetails };
    const shiftTimes = modalCategory === 'work' ? `${modalShiftStart} - ${modalShiftEnd}` : undefined;

    selectedDates.forEach(dateStr => {
      newDetails[dateStr] = {
        dateStr,
        category: modalCategory,
        title: modalTitle.trim(),
        shiftTimes
      };
    });

    onChange({ year, month, dayDetails: newDetails });
    setIsModalOpen(false);
    setSelectedDates([]);
    setIsMultiSelectMode(false);
  };

  const handleClearDayDetail = () => {
    if (selectedDates.length === 0) return;
    const newDetails = { ...dayDetails };
    selectedDates.forEach(dateStr => {
      delete newDetails[dateStr];
    });
    onChange({ year, month, dayDetails: newDetails });
    setIsModalOpen(false);
    setSelectedDates([]);
    setIsMultiSelectMode(false);
  };

  return (
    <div className="group relative flex flex-col bg-amber-50/70 border border-amber-200 rounded-lg overflow-hidden my-1.5 w-full shadow-sm transition-all hover:border-amber-300">
      {/* Header with Grip, Icon, Navigation & Multi-select */}
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
            onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
            title={isMultiSelectMode ? "Exit multi-select mode" : "Select multiple days"}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded border transition-colors flex items-center gap-1 ${
              isMultiSelectMode 
                ? 'bg-amber-500 text-white border-amber-600 shadow-xs' 
                : 'bg-white/80 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <CheckSquare size={11} />
            <span>Multi-select</span>
          </button>
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

      {/* Multi-select Action Bar */}
      {selectedDates.length > 0 && isMultiSelectMode && (
        <div className="bg-amber-200/80 px-3 py-1.5 flex items-center justify-between border-b border-amber-300 animate-in fade-in duration-150">
          <span className="text-xs font-medium text-amber-900">
            {selectedDates.length} {selectedDates.length === 1 ? 'day' : 'days'} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDates([])}
              className="text-[11px] text-amber-800 hover:text-amber-950 font-medium"
            >
              Deselect
            </button>
            <button
              onClick={handleOpenModalForSelection}
              className="px-2.5 py-1 text-xs font-semibold bg-amber-900 text-white rounded-md hover:bg-amber-800 transition-colors shadow-xs"
            >
              Set Schedule
            </button>
          </div>
        </div>
      )}

      {/* Calendar Grid Container */}
      <div className="p-2 bg-white/80 select-none">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
          {WEEKDAYS.map((wd, i) => (
            <span key={wd} className={`text-xs font-bold ${i === 0 ? 'text-red-500' : 'text-stone-500'}`}>
              {wd}
            </span>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {/* Empty padding before 1st day */}
          {Array.from({ length: firstDayOfWeek }).map((_, i) => (
            <div key={`empty-${i}`} className="h-10" />
          ))}

          {/* Days 1 to totalDaysInMonth */}
          {Array.from({ length: totalDaysInMonth }).map((_, i) => {
            const dayNum = i + 1;
            const formattedMonth = String(month + 1).padStart(2, '0');
            const formattedDay = String(dayNum).padStart(2, '0');
            const dateStr = `${year}-${formattedMonth}-${formattedDay}`;
            const detail = dayDetails[dateStr];
            const isSelected = selectedDates.includes(dateStr);

            let cellStyle = "bg-stone-50 hover:bg-amber-100 text-stone-800 border-stone-200";
            if (detail?.category === 'holiday') {
              cellStyle = "bg-red-500 text-white font-bold border-red-600 shadow-xs";
            } else if (detail?.category === 'work') {
              cellStyle = "bg-blue-500 text-white font-semibold border-blue-600 shadow-xs";
            } else if (detail?.category === 'off') {
              cellStyle = "bg-amber-400 text-stone-900 font-semibold border-amber-500 shadow-xs";
            } else if (detail?.category === 'custom') {
              cellStyle = "bg-purple-500 text-white font-semibold border-purple-600 shadow-xs";
            }

            if (isSelected) {
              cellStyle += " ring-2 ring-amber-600 ring-offset-1 scale-[0.96]";
            }

            return (
              <button
                key={dateStr}
                onClick={(e) => handleDayClick(dayNum, e)}
                title={detail ? `${detail.category.toUpperCase()}: ${detail.title || ''} ${detail.shiftTimes || ''}` : `Day ${dayNum}`}
                className={`relative h-10 rounded-md border flex flex-col items-center justify-center transition-all ${cellStyle}`}
              >
                <span className="text-sm font-semibold leading-tight">{dayNum}</span>
                {detail?.category === 'work' && detail.shiftTimes && (
                  <span className="text-[8px] font-medium leading-none opacity-90 truncate max-w-full px-0.5 mt-0.5">
                    {detail.shiftTimes.split(' - ')[0]}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Legend / Category Guide */}
      <div className="px-3 py-1.5 bg-amber-50/50 border-t border-amber-200/40 flex items-center justify-around text-xs text-stone-600">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500"></span> Holiday</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> Shift</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> Off</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Custom</span>
      </div>

      {/* Day Detail Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-5 w-full max-w-sm flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-stone-800">
                  {selectedDates.length === 1 ? selectedDates[0] : `${selectedDates.length} Selected Days`}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
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
              <div className="flex flex-col gap-1.5 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                <label className="text-xs font-semibold text-blue-900 flex items-center justify-between">
                  <span className="flex items-center gap-1"><Clock size={12} /> Shift Times:</span>
                  <span className="text-[10px] text-blue-600 font-normal">(Auto +9h 30m)</span>
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 flex flex-col">
                    <span className="text-[10px] text-stone-400 mb-0.5">Start</span>
                    <input
                      type="time"
                      value={modalShiftStart}
                      onChange={(e) => handleShiftStartChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-md text-xs font-mono outline-none focus:border-blue-400"
                    />
                  </div>
                  <span className="text-xs text-stone-400 mt-3.5">to</span>
                  <div className="flex-1 flex flex-col">
                    <span className="text-[10px] text-stone-400 mb-0.5">End</span>
                    <input
                      type="time"
                      value={modalShiftEnd}
                      onChange={(e) => setModalShiftEnd(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-stone-200 rounded-md text-xs font-mono outline-none focus:border-blue-400"
                    />
                  </div>
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
                placeholder="e.g. Morning Shift or Company Holiday"
                className="w-full px-3 py-1.5 border border-stone-200 rounded-md text-xs outline-none focus:border-stone-400"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-3 mt-1">
              <button
                onClick={handleClearDayDetail}
                className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear Day(s)
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setIsModalOpen(false)}
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
