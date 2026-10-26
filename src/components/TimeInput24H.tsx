import React, { useState, useEffect } from 'react';
import { parse24HTime, format24HTime } from '@/lib/schedule';

interface TimeInput24HProps {
  value: string; // "HH:mm"
  onChange: (val: string) => void;
  label?: string;
  className?: string;
}

export function TimeInput24H({ value, onChange, label, className = '' }: TimeInput24HProps) {
  const [h, m] = parse24HTime(value);

  const [hourStr, setHourStr] = useState(String(h).padStart(2, '0'));
  const [minuteStr, setMinuteStr] = useState(String(m).padStart(2, '0'));

  useEffect(() => {
    const [currH, currM] = parse24HTime(value);
    setHourStr(String(currH).padStart(2, '0'));
    setMinuteStr(String(currM).padStart(2, '0'));
  }, [value]);

  const commitTime = (newHStr: string, newMStr: string) => {
    let parsedH = parseInt(newHStr, 10);
    let parsedM = parseInt(newMStr, 10);
    if (isNaN(parsedH)) parsedH = 0;
    if (isNaN(parsedM)) parsedM = 0;
    parsedH = Math.max(0, Math.min(23, parsedH));
    parsedM = Math.max(0, Math.min(59, parsedM));

    const formatted = format24HTime(parsedH, parsedM);
    setHourStr(String(parsedH).padStart(2, '0'));
    setMinuteStr(String(parsedM).padStart(2, '0'));
    onChange(formatted);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setHourStr(raw);
    if (raw.length === 2) {
      commitTime(raw, minuteStr);
    }
  };

  const handleHourBlur = () => {
    commitTime(hourStr, minuteStr);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 2);
    setMinuteStr(raw);
    if (raw.length === 2) {
      commitTime(hourStr, raw);
    }
  };

  const handleMinuteBlur = () => {
    commitTime(hourStr, minuteStr);
  };

  const handleMinutePreset = (mins: number) => {
    commitTime(hourStr, String(mins).padStart(2, '0'));
  };

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <span className="text-[11px] font-medium text-stone-600 flex items-center justify-between">
          <span>{label}</span>
          <span className="text-[10px] text-amber-700 bg-amber-50 px-1 rounded font-mono font-semibold">
            24 ชม.
          </span>
        </span>
      )}
      <div className="flex items-center gap-1 bg-white border border-stone-200 rounded-lg p-1 shadow-2xs hover:border-amber-400 focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-400 transition-all">
        {/* Hours input */}
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={hourStr}
          onChange={handleHourChange}
          onBlur={handleHourBlur}
          placeholder="00"
          title="ชั่วโมง (00 - 23)"
          className="w-9 py-1 text-center font-mono text-sm font-semibold text-stone-800 bg-stone-50 rounded outline-none hover:bg-stone-100 focus:bg-white focus:text-amber-900 transition-colors"
        />
        <span className="font-mono font-bold text-stone-400 select-none">:</span>
        {/* Minutes input */}
        <input
          type="text"
          inputMode="numeric"
          maxLength={2}
          value={minuteStr}
          onChange={handleMinuteChange}
          onBlur={handleMinuteBlur}
          placeholder="00"
          title="นาที (00 - 59)"
          className="w-9 py-1 text-center font-mono text-sm font-semibold text-stone-800 bg-stone-50 rounded outline-none hover:bg-stone-100 focus:bg-white focus:text-amber-900 transition-colors"
        />

        {/* Quick minute pills */}
        <div className="flex items-center gap-0.5 ml-auto pl-1 border-l border-stone-100">
          {[0, 15, 30, 45].map((presetM) => {
            const isActive = parseInt(minuteStr, 10) === presetM;
            return (
              <button
                key={presetM}
                type="button"
                onClick={() => handleMinutePreset(presetM)}
                className={`px-1 py-0.5 text-[9px] font-mono rounded transition-colors ${
                  isActive
                    ? 'bg-amber-600 text-white font-bold'
                    : 'text-stone-400 hover:text-stone-700 hover:bg-stone-100'
                }`}
              >
                :{String(presetM).padStart(2, '0')}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
