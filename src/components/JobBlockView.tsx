import { useState } from 'react';
import { Briefcase, GripVertical, CheckCircle2, Circle, RotateCcw } from 'lucide-react';
import { JobBlock, JobBlockValue, JobTaskItem } from '@/lib/blocks';
import { useDraggableBlock } from '@/hooks/useDragBlock';

interface Props {
  block: JobBlock;
  onChange: (val: JobBlockValue) => void;
  onRemove: () => void;
}

function ProgressCircle({ completed, total }: { completed: number; total: number }) {
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const radius = 14;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const isComplete = completed === total && total > 0;

  return (
    <div className="relative flex items-center justify-center w-9 h-9 shrink-0">
      <svg className="w-9 h-9 transform -rotate-90">
        <circle
          cx="18"
          cy="18"
          r={radius}
          stroke="#e7e5e4"
          strokeWidth="3"
          fill="transparent"
        />
        <circle
          cx="18"
          cy="18"
          r={radius}
          stroke={isComplete ? "#16a34a" : "#2563eb"}
          strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          fill="transparent"
          className="transition-all duration-300 ease-out"
        />
      </svg>
      <span className={`absolute text-[9px] font-bold ${isComplete ? 'text-green-700' : 'text-stone-700'}`}>
        {completed}/{total}
      </span>
    </div>
  );
}

export function JobBlockView({ block, onChange, onRemove }: Props) {
  const { onMouseDown } = useDraggableBlock(
    { id: block.id, type: 'job', value: block.value },
    '💼 Job Progress'
  );

  let jobValue: JobBlockValue = { totalTasks: 0, tasks: [] };
  if (typeof block.value === 'string') {
    try {
      jobValue = JSON.parse(block.value);
    } catch (e) {}
  } else if (block.value && typeof block.value === 'object') {
    jobValue = block.value;
  }

  const { totalTasks = 0, tasks = [] } = jobValue;
  const [taskInputCount, setTaskInputCount] = useState<string>('10');

  const handleCreateTasks = (count: number) => {
    if (count <= 0) return;
    const newTasks: JobTaskItem[] = Array.from({ length: count }, (_, i) => ({
      id: crypto.randomUUID(),
      text: ''
    }));
    onChange({ totalTasks: count, tasks: newTasks });
  };

  const handleTaskTextChange = (index: number, text: string) => {
    const newTasks = [...tasks];
    newTasks[index] = { ...newTasks[index], text };
    onChange({ totalTasks, tasks: newTasks });
  };

  const completedCount = tasks.filter(t => t.text.trim() !== '').length;
  const isComplete = completedCount === totalTasks && totalTasks > 0;

  // Setup prompt if no tasks set up yet
  if (totalTasks <= 0) {
    return (
      <div className="group relative flex flex-col bg-blue-50/70 border border-blue-200 rounded-lg overflow-hidden my-1.5 w-full shadow-sm">
        <div className="flex items-center justify-between bg-blue-100/50 border-b border-blue-200/60 px-2 py-1.5">
          <div className="flex items-center gap-1.5">
            <div 
              className="p-1 cursor-grab active:cursor-grabbing text-blue-600 hover:text-blue-800 transition-colors select-none shrink-0"
              onMouseDown={onMouseDown}
            >
              <GripVertical size={14} />
            </div>
            <Briefcase size={15} className="text-blue-700" />
            <span className="text-xs font-semibold text-blue-900">Job Setup</span>
          </div>
          <button 
            onClick={onRemove}
            className="p-1 text-blue-400 hover:text-red-500 transition-all"
          >
            &times;
          </button>
        </div>

        <div className="p-3 flex flex-col gap-2 bg-white/70">
          <label className="text-xs text-stone-600 font-medium">Enter total number of tasks:</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max="50"
              value={taskInputCount}
              onChange={(e) => setTaskInputCount(e.target.value)}
              placeholder="e.g. 10"
              className="w-24 px-2.5 py-1.5 bg-white border border-stone-200 rounded-md text-xs font-mono outline-none focus:border-blue-400"
            />
            <button
              onClick={() => handleCreateTasks(parseInt(taskInputCount, 10) || 10)}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors shadow-sm"
            >
              Set Tasks
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`group relative flex flex-col border rounded-lg overflow-hidden my-1.5 w-full shadow-sm transition-all ${
      isComplete ? 'bg-green-50/70 border-green-200 hover:border-green-300' : 'bg-blue-50/60 border-blue-200 hover:border-blue-300'
    }`}>
      {/* Header with Grip, Icon, Title, Progress Circle & Reset button */}
      <div className={`flex items-center justify-between border-b px-2 py-1.5 ${
        isComplete ? 'bg-green-100/50 border-green-200/60' : 'bg-blue-100/50 border-blue-200/60'
      }`}>
        <div className="flex items-center gap-1.5">
          <div 
            className="p-1 cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-700 transition-colors select-none shrink-0"
            onMouseDown={onMouseDown}
          >
            <GripVertical size={14} />
          </div>
          <Briefcase size={15} className={isComplete ? 'text-green-700' : 'text-blue-700'} />
          <span className={`text-xs font-semibold ${isComplete ? 'text-green-900' : 'text-blue-900'}`}>
            Job ({completedCount}/{totalTasks})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* SVG Progress Circle */}
          <ProgressCircle completed={completedCount} total={totalTasks} />
          
          <button
            onClick={() => onChange({ totalTasks: 0, tasks: [] })}
            title="Reset task count"
            className="p-1 text-stone-400 hover:text-blue-600 transition-colors"
          >
            <RotateCcw size={13} />
          </button>

          <button 
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 transition-all"
          >
            &times;
          </button>
        </div>
      </div>

      {/* Task input fields list */}
      <div className="p-2 flex flex-col gap-1.5 bg-white/70 max-h-72 overflow-y-auto custom-scrollbar">
        {tasks.map((task, idx) => {
          const isFilled = task.text.trim() !== '';
          return (
            <div key={task.id || idx} className="flex items-center gap-2 bg-white/80 px-2 py-1 border border-stone-100 rounded-md shadow-2xs">
              <span className="text-[10px] font-mono font-medium text-stone-400 w-5 shrink-0">#{idx + 1}</span>
              {isFilled ? (
                <CheckCircle2 size={13} className="text-green-600 shrink-0" />
              ) : (
                <Circle size={13} className="text-stone-300 shrink-0" />
              )}
              <input
                type="text"
                value={task.text}
                onChange={(e) => handleTaskTextChange(idx, e.target.value)}
                placeholder={`Task ${idx + 1}...`}
                className={`flex-1 bg-transparent outline-none text-xs font-sans transition-colors ${
                  isFilled ? 'text-stone-800 font-medium' : 'text-stone-500 placeholder:text-stone-300'
                }`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
