import React, { useState, useMemo } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  GripVertical, 
  Clock, 
  Sparkles, 
  X, 
  CheckSquare, 
  Layers, 
  Check, 
  Moon, 
  Sun, 
  Palette,
  Briefcase
} from 'lucide-react';
import { ScheduleBlock, ScheduleBlockValue, ScheduleDayDetail } from '@/lib/blocks';
import { useDraggableBlock } from '@/hooks/useDragBlock';
import { 
  getShiftColorTheme, 
  SHIFT_COLOR_PALETTE, 
  COMMON_SHIFT_PRESETS,
  calculateShiftDuration, 
  add9Hours30Mins, 
  format24HTime,
  parse24HTime
} from '@/lib/schedule';
import { TimeInput24H } from './TimeInput24H';

interface Props {
  block: ScheduleBlock;
  onChange: (val: ScheduleBlockValue) => void;
  onRemove: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ScheduleBlockView({ block, onChange, onRemove, dragHandleProps }: Props) {
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
  const [modalColor, setModalColor] = useState('blue');

  // Calculate monthly stats
  const monthlyStats = useMemo(() => {
    let workDays = 0;
    let totalWorkMinutes = 0;
    let holidays = 0;
    let offDays = 0;
    let overnightCount = 0;

    const formattedMonth = String(month + 1).padStart(2, '0');
    const prefix = `${year}-${formattedMonth}-`;

    Object.entries(dayDetails).forEach(([dateStr, detail]) => {
      if (!dateStr.startsWith(prefix)) return;

      if (detail.category === 'work') {
        workDays++;
        if (detail.shiftTimes) {
          const parts = detail.shiftTimes.split(' - ');
          const duration = calculateShiftDuration(parts[0] || '08:00', parts[1] || '17:30');
          totalWorkMinutes += duration.durationMinutes;
          if (duration.isOvernight) overnightCount++;
        }
      } else if (detail.category === 'holiday') {
        holidays++;
      } else if (detail.category === 'off') {
        offDays++;
      }
    });

    const totalHours = Math.floor(totalWorkMinutes / 60);
    const totalRemainingMins = totalWorkMinutes % 60;

    return {
      workDays,
      totalHours,
      totalRemainingMins,
      holidays,
      offDays,
      overnightCount,
    };
  }, [dayDetails, year, month]);

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
      setSelectedDates(prev => 
        prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
      );
    } else {
      setSelectedDates([dateStr]);
      const existing = dayDetails[dateStr];
      if (existing) {
        setModalCategory(existing.category || 'work');
        setModalTitle(existing.title || '');
        setModalColor(existing.color || getShiftColorTheme(existing).id);
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
        setModalColor('blue');
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
    const first = selectedDates[0];
    const existing = dayDetails[first];
    if (existing) {
      setModalCategory(existing.category || 'work');
      setModalTitle(existing.title || '');
      setModalColor(existing.color || getShiftColorTheme(existing).id);
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
      setModalColor('blue');
      setModalShiftStart('08:00');
      setModalShiftEnd('17:30');
    }
    setIsModalOpen(true);
  };

  const handleApplyPreset = (preset: typeof COMMON_SHIFT_PRESETS[0]) => {
    setModalCategory('work');
    setModalShiftStart(preset.start);
    setModalShiftEnd(preset.end);
    setModalColor(preset.color);
    if (!modalTitle) {
      setModalTitle(preset.shortLabel);
    }
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
        shiftTimes,
        color: modalColor,
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

  const modalDurationInfo = calculateShiftDuration(modalShiftStart, modalShiftEnd);

  return (
    <div className="group relative flex flex-col bg-amber-50/70 border border-amber-200 rounded-lg overflow-hidden my-1.5 w-full shadow-sm transition-all hover:border-amber-300">
      {/* Header with Grip, Icon, Navigation & Multi-select */}
      <div className="flex items-center justify-between bg-amber-100/50 border-b border-amber-200/60 px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          {dragHandleProps && (
            <div 
              {...dragHandleProps}
              className="p-1 cursor-grab active:cursor-grabbing text-amber-600 hover:text-amber-800 transition-colors select-none shrink-0"
              onMouseDown={(e) => {
                if (!dragHandleProps) {
                  onMouseDown(e);
                }
              }}
            >
              <GripVertical size={14} />
            </div>
          )}
          <Calendar size={15} className="text-amber-700" />
          <span className="text-xs font-semibold text-amber-900">
            {MONTH_NAMES[month]} {year}
          </span>
          <span className="text-[10px] px-1.5 py-0.2 bg-amber-200/70 text-amber-900 rounded font-mono font-medium">
            24h
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMultiSelectMode(!isMultiSelectMode)}
            title={isMultiSelectMode ? "ออกจากโหมดเลือกหลายวัน" : "เลือกหลายวันพร้อมกัน"}
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
            title="เดือนก่อนหน้า"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 text-amber-700 hover:bg-amber-200/60 rounded transition-colors"
            title="เดือนถัดไป"
          >
            <ChevronRight size={14} />
          </button>
          <button 
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 p-1 text-amber-500 hover:text-red-500 transition-all ml-1"
            title="ลบบล็อกตารางงาน"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Multi-select Action Bar */}
      {selectedDates.length > 0 && isMultiSelectMode && (
        <div className="bg-amber-200/80 px-3 py-1.5 flex items-center justify-between border-b border-amber-300 animate-in fade-in duration-150">
          <span className="text-xs font-medium text-amber-900">
            เลือกไว้ {selectedDates.length} วัน
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedDates([])}
              className="text-[11px] text-amber-800 hover:text-amber-950 font-medium"
            >
              ยกเลิกการเลือก
            </button>
            <button
              onClick={handleOpenModalForSelection}
              className="px-2.5 py-1 text-xs font-semibold bg-amber-900 text-white rounded-md hover:bg-amber-800 transition-colors shadow-xs"
            >
              ตั้งค่าตารางงาน
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

            const colorTheme = detail ? getShiftColorTheme(detail) : null;

            let cellStyle = "bg-stone-50 hover:bg-amber-100 text-stone-800 border-stone-200";
            if (detail && colorTheme) {
              cellStyle = `${colorTheme.bgClass} ${colorTheme.textClass} font-semibold ${colorTheme.borderClass} shadow-xs`;
            }

            if (isSelected) {
              cellStyle += " ring-2 ring-amber-600 ring-offset-1 scale-[0.96]";
            }

            const duration = (detail?.shiftTimes) ? calculateShiftDuration(
              detail.shiftTimes.split(' - ')[0] || '',
              detail.shiftTimes.split(' - ')[1] || ''
            ) : null;

            return (
              <button
                key={dateStr}
                onClick={(e) => handleDayClick(dayNum, e)}
                title={detail ? `${detail.category.toUpperCase()}: ${detail.title || ''} ${detail.shiftTimes ? 'เวลา ' + detail.shiftTimes : ''} ${duration ? '(' + duration.formattedDuration + ')' : ''}` : `วันที่ ${dayNum}`}
                className={`relative h-10 rounded-md border flex flex-col items-center justify-center transition-all ${cellStyle}`}
              >
                <div className="flex items-center gap-0.5 leading-tight">
                  <span className="text-sm font-semibold">{dayNum}</span>
                  {duration?.isOvernight && (
                    <span title="กะข้ามวัน (Overnight)" className="text-[9px] opacity-90">🌙</span>
                  )}
                </div>
                {detail?.category === 'work' && detail.shiftTimes && (
                  <span className="text-[8.5px] font-mono leading-none opacity-95 truncate max-w-full px-0.5 mt-0.5">
                    {detail.shiftTimes.split(' - ')[0]}
                  </span>
                )}
                {detail?.category !== 'work' && detail?.title && (
                  <span className="text-[8px] leading-none opacity-90 truncate max-w-full px-0.5 mt-0.5">
                    {detail.title}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Monthly Statistics Summary Bar */}
      <div className="px-3 py-1.5 bg-amber-100/40 border-t border-amber-200/50 flex items-center justify-between text-[11px] text-stone-700">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-medium">
            <Briefcase size={12} className="text-blue-600" />
            <span>กะทำงาน: <strong className="text-stone-900">{monthlyStats.workDays}</strong> วัน</span>
          </span>
          <span className="text-stone-400">|</span>
          <span className="flex items-center gap-1 font-medium">
            <Clock size={12} className="text-amber-700" />
            <span>รวม: <strong className="text-stone-900">{monthlyStats.totalHours}</strong> ชม. {monthlyStats.totalRemainingMins > 0 ? `${monthlyStats.totalRemainingMins} น.` : ''}</span>
          </span>
        </div>
        {monthlyStats.overnightCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] text-indigo-700 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
            <Moon size={10} /> {monthlyStats.overnightCount} กะดึก
          </span>
        )}
      </div>

      {/* Legend / Category Guide */}
      <div className="px-3 py-1.5 bg-amber-50/50 border-t border-amber-200/40 flex items-center justify-around text-xs text-stone-600">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span> กะเช้า/งาน</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span> กะดึก 🌙</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span> วันหยุด</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span> วันลา/หยุด</span>
      </div>

      {/* Day Detail Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-stone-200 p-5 w-full max-w-md flex flex-col gap-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                <h3 className="text-sm font-semibold text-stone-800">
                  {selectedDates.length === 1 ? `วันที่ ${selectedDates[0]}` : `เลือกไว้ ${selectedDates.length} วัน`}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-md"
              >
                <X size={16} />
              </button>
            </div>

            {/* Category Selector Buttons */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">หมวดหมู่ตารางงาน:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setModalCategory('work');
                    if (modalColor === 'rose' || modalColor === 'amber') {
                      setModalColor('blue');
                    }
                  }}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    modalCategory === 'work'
                      ? 'bg-blue-500 text-white border-blue-600 shadow-sm'
                      : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  🔵 กะทำงาน (Work Shift)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalCategory('holiday');
                    setModalColor('rose');
                  }}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    modalCategory === 'holiday'
                      ? 'bg-rose-500 text-white border-rose-600 shadow-sm'
                      : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                  }`}
                >
                  🔴 วันหยุดนักขัตฤกษ์
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalCategory('off');
                    setModalColor('amber');
                  }}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    modalCategory === 'off'
                      ? 'bg-amber-400 text-stone-900 border-amber-500 shadow-sm'
                      : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  🟡 วันหยุดประจำสัปดาห์ / ลา
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setModalCategory('custom');
                    setModalColor('violet');
                  }}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg border flex items-center justify-center gap-1.5 transition-all ${
                    modalCategory === 'custom'
                      ? 'bg-purple-500 text-white border-purple-600 shadow-sm'
                      : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  🟣 กำหนดเอง (Custom)
                </button>
              </div>
            </div>

            {/* Shift Times & Presets (if Work Shift selected) */}
            {modalCategory === 'work' && (
              <div className="flex flex-col gap-2.5 bg-blue-50/50 p-3 rounded-lg border border-blue-100">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-blue-900 flex items-center gap-1">
                    <Clock size={13} className="text-blue-700" /> 
                    <span>เวลากะทำงาน (ระบบ 24 ชม.):</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleShiftStartChange(modalShiftStart)}
                    className="text-[10px] text-blue-700 hover:text-blue-900 font-medium bg-blue-100/60 px-1.5 py-0.5 rounded"
                    title="คำนวณเวลาเลิกงานอัตโนมัติ (+9 ชม. 30 นาที)"
                  >
                    +9h 30m Auto
                  </button>
                </div>

                {/* Quick Presets Pills */}
                <div className="flex flex-wrap gap-1">
                  {COMMON_SHIFT_PRESETS.map((preset) => {
                    const isSelectedPreset = modalShiftStart === preset.start && modalShiftEnd === preset.end;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleApplyPreset(preset)}
                        className={`text-[10px] font-medium px-2 py-1 rounded-md border transition-all ${
                          isSelectedPreset
                            ? 'bg-blue-600 text-white border-blue-700 shadow-2xs font-semibold'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-blue-50 hover:border-blue-300'
                        }`}
                      >
                        {preset.shortLabel}
                      </button>
                    );
                  })}
                </div>

                {/* 24-Hour Time Inputs */}
                <div className="grid grid-cols-2 gap-2 mt-0.5">
                  <TimeInput24H
                    value={modalShiftStart}
                    onChange={(val) => handleShiftStartChange(val)}
                    label="เวลาเริ่มเข้างาน"
                  />
                  <TimeInput24H
                    value={modalShiftEnd}
                    onChange={(val) => setModalShiftEnd(val)}
                    label="เวลาเลิกงาน"
                  />
                </div>

                {/* Real-time Duration & Overnight status indicator */}
                <div className="flex items-center justify-between text-xs px-2 py-1.5 bg-white/90 rounded border border-blue-200">
                  <span className="text-stone-600 font-medium">ระยะเวลากะ:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-blue-900">
                      {modalDurationInfo.formattedDuration}
                    </span>
                    {modalDurationInfo.isOvernight && (
                      <span className="text-[10px] bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-semibold flex items-center gap-1 border border-indigo-200">
                        <Moon size={10} /> ข้ามวัน
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Color Palette Selector */}
            <div className="flex flex-col gap-1.5 bg-stone-50/80 p-3 rounded-lg border border-stone-200/70">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                  <Palette size={13} className="text-amber-700" />
                  <span>สีของกะ / รายการ:</span>
                </label>
                <span className="text-[11px] font-medium text-stone-500">
                  {SHIFT_COLOR_PALETTE.find(c => c.id === modalColor)?.name || modalColor}
                </span>
              </div>

              {/* Color chips */}
              <div className="grid grid-cols-5 gap-1.5 mt-1">
                {SHIFT_COLOR_PALETTE.map((colorTheme) => {
                  const isSelected = modalColor === colorTheme.id;
                  return (
                    <button
                      key={colorTheme.id}
                      type="button"
                      onClick={() => setModalColor(colorTheme.id)}
                      title={colorTheme.name}
                      className={`h-7 rounded-md border flex items-center justify-center transition-all ${colorTheme.bgClass} ${
                        isSelected 
                          ? 'ring-2 ring-stone-900 ring-offset-2 scale-105 shadow-sm border-white' 
                          : 'border-transparent hover:scale-102 hover:opacity-95'
                      }`}
                    >
                      {isSelected && (
                        <Check size={14} className={colorTheme.textClass} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Note / Details Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-600">บันทึกเพิ่มเติม / รายละเอียดกะ:</label>
              <input
                type="text"
                value={modalTitle}
                onChange={(e) => setModalTitle(e.target.value)}
                placeholder="เช่น กะเช้า, กะดึกสำรอง, หรือ วันหยุดบริษัท"
                className="w-full px-3 py-1.5 border border-stone-200 rounded-md text-xs outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-300"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-3 mt-1">
              <button
                type="button"
                onClick={handleClearDayDetail}
                className="px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                ล้างข้อมูลวันนี้
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-lg transition-colors"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={handleSaveDayDetail}
                  className="px-4 py-2 text-xs font-semibold bg-stone-900 text-white rounded-lg hover:bg-stone-800 transition-colors shadow-sm"
                >
                  บันทึกตารางงาน
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
