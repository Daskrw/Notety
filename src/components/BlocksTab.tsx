"use client";
import { Lock, Activity, Briefcase } from 'lucide-react';
import { useDraggableBlock } from '@/hooks/useDragBlock';

function PasswordBlockDraggable() {
  const payload = { id: 'template-password', type: 'password' as const, value: '' };
  const { onMouseDown } = useDraggableBlock(payload, '🔒 Password Box');
  return (
    <div
      onMouseDown={onMouseDown}
      className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-stone-200 rounded-md cursor-grab active:cursor-grabbing hover:bg-stone-100 hover:border-stone-300 transition-all shadow-sm select-none"
    >
      <Lock size={14} className="text-stone-500" />
      <span className="text-sm font-medium text-stone-700">Password Box</span>
    </div>
  );
}

function PingBlockDraggable() {
  const payload = { id: 'template-ping', type: 'ping' as const, value: '' };
  const { onMouseDown } = useDraggableBlock(payload, '📡 Ping Signal');
  return (
    <div
      onMouseDown={onMouseDown}
      className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-stone-200 rounded-md cursor-grab active:cursor-grabbing hover:bg-stone-100 hover:border-stone-300 transition-all shadow-sm select-none"
    >
      <Activity size={14} className="text-green-600" />
      <span className="text-sm font-medium text-stone-700">Ping Signal</span>
    </div>
  );
}

function JobBlockDraggable() {
  const payload = { 
    id: 'template-job', 
    type: 'job' as const, 
    value: { totalTasks: 0, tasks: [] } 
  };
  const { onMouseDown } = useDraggableBlock(payload, '💼 Job Progress');
  return (
    <div
      onMouseDown={onMouseDown}
      className="flex items-center space-x-2 px-3 py-1.5 bg-white border border-stone-200 rounded-md cursor-grab active:cursor-grabbing hover:bg-stone-100 hover:border-stone-300 transition-all shadow-sm select-none"
    >
      <Briefcase size={14} className="text-blue-600" />
      <span className="text-sm font-medium text-stone-700">Job Progress</span>
    </div>
  );
}

export function BlocksTab() {
  return (
    <div className="h-14 border-t border-stone-200 bg-stone-50 flex items-center px-8 space-x-4 flex-shrink-0">
      <span className="text-xs font-semibold text-stone-400 uppercase tracking-wider mr-4">Blocks</span>
      <PasswordBlockDraggable />
      <PingBlockDraggable />
      <JobBlockDraggable />
    </div>
  );
}
