"use client";
import React, { useState } from 'react';
import { 
  MapPin, Plus, Trash2, CheckCircle2, Circle, Clock, 
  ArrowDown, Navigation, Footprints, Train, Car, Bus, Plane, 
  Sparkles, Calendar, DollarSign, GripVertical, ChevronRight, Check
} from 'lucide-react';
import { 
  TripToGoData, TripLocationNode, TripTransit, TransportType, CheckInItem 
} from '@/lib/triptogo';

interface Props {
  data: TripToGoData;
  onChange: (newData: TripToGoData) => void;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  attraction: { bg: 'bg-emerald-50/80', text: 'text-emerald-800', border: 'border-emerald-200', icon: '🏰' },
  food: { bg: 'bg-amber-50/80', text: 'text-amber-800', border: 'border-amber-200', icon: '🍜' },
  hotel: { bg: 'bg-indigo-50/80', text: 'text-indigo-800', border: 'border-indigo-200', icon: '🏨' },
  airport: { bg: 'bg-sky-50/80', text: 'text-sky-800', border: 'border-sky-200', icon: '✈️' },
  shopping: { bg: 'bg-rose-50/80', text: 'text-rose-800', border: 'border-rose-200', icon: '🛍️' },
  other: { bg: 'bg-stone-50/80', text: 'text-stone-800', border: 'border-stone-200', icon: '📍' },
};

const TRANSPORT_ICONS: Record<TransportType, { label: string; icon: React.ReactNode }> = {
  walk: { label: 'Walk', icon: <Footprints size={13} className="text-emerald-600" /> },
  train: { label: 'Train / Metro', icon: <Train size={13} className="text-blue-600" /> },
  car: { label: 'Taxi / Car', icon: <Car size={13} className="text-amber-600" /> },
  bus: { label: 'Bus', icon: <Bus size={13} className="text-purple-600" /> },
  flight: { label: 'Flight', icon: <Plane size={13} className="text-sky-600" /> },
  ferry: { label: 'Boat / Ferry', icon: <Navigation size={13} className="text-cyan-600" /> },
  custom: { label: 'Transit', icon: <Navigation size={13} className="text-stone-500" /> },
};

export function TripToGoView({ data, onChange }: Props) {
  const { nodes = [], transits = [] } = data;
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Statistics
  const totalSpots = nodes.length;
  const visitedSpots = nodes.filter(n => n.isVisited).length;
  const progressPercent = totalSpots > 0 ? Math.round((visitedSpots / totalSpots) * 100) : 0;

  const handleAddNode = (indexAfter?: number) => {
    const newNode: TripLocationNode = {
      id: crypto.randomUUID(),
      name: 'New Destination',
      timeStart: '10:00',
      timeEnd: '11:30',
      isVisited: false,
      category: 'attraction',
      day: 1
    };

    const newNodes = [...nodes];
    if (indexAfter !== undefined && indexAfter >= 0) {
      newNodes.splice(indexAfter + 1, 0, newNode);
    } else {
      newNodes.push(newNode);
    }

    onChange({ ...data, nodes: newNodes });
  };

  const handleUpdateNode = (id: string, updates: Partial<TripLocationNode>) => {
    const newNodes = nodes.map(n => n.id === id ? { ...n, ...updates } : n);
    onChange({ ...data, nodes: newNodes });
  };

  const handleDeleteNode = (id: string) => {
    const newNodes = nodes.filter(n => n.id !== id);
    const newTransits = transits.filter(t => t.fromNodeId !== id && t.toNodeId !== id);
    onChange({ ...data, nodes: newNodes, transits: newTransits });
  };

  const handleToggleVisited = (id: string) => {
    const newNodes = nodes.map(n => n.id === id ? { ...n, isVisited: !n.isVisited } : n);
    onChange({ ...data, nodes: newNodes });
  };

  const getTransit = (fromId: string, toId: string): TripTransit => {
    const existing = transits.find(t => t.fromNodeId === fromId && t.toNodeId === toId);
    return existing || {
      id: `${fromId}-${toId}`,
      fromNodeId: fromId,
      toNodeId: toId,
      transportType: 'walk',
      duration: '15m'
    };
  };

  const handleUpdateTransit = (fromId: string, toId: string, updates: Partial<TripTransit>) => {
    const existingIndex = transits.findIndex(t => t.fromNodeId === fromId && t.toNodeId === toId);
    let newTransits = [...transits];

    if (existingIndex >= 0) {
      newTransits[existingIndex] = { ...newTransits[existingIndex], ...updates };
    } else {
      newTransits.push({
        id: `${fromId}-${toId}`,
        fromNodeId: fromId,
        toNodeId: toId,
        transportType: 'walk',
        duration: '15m',
        ...updates
      });
    }

    onChange({ ...data, transits: newTransits });
  };

  // Node Drag Reordering
  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      return;
    }

    const updated = [...nodes];
    const [moved] = updated.splice(draggedIndex, 1);
    updated.splice(targetIndex, 0, moved);
    setDraggedIndex(null);

    onChange({ ...data, nodes: updated });
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-3 sm:px-8 py-4 sm:py-8 flex flex-col gap-4 sm:gap-6 select-none">
      {/* Header Summary Banner */}
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-500/10 border border-amber-200/80 rounded-2xl p-3.5 sm:p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm font-semibold text-base sm:text-lg shrink-0">
            🗺️
          </div>
          <div>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <h2 className="text-sm sm:text-lg font-heading font-bold text-stone-800 tracking-tight">TripToGo Flowchart</h2>
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                Itinerary Mode
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5">
              Plan and connect your travel route chronologically with interactive checkpoints.
            </p>
          </div>
        </div>

        {/* Progress Pill */}
        <div className="flex items-center gap-3 bg-white/90 border border-amber-200/80 px-3.5 py-1.5 sm:py-2 rounded-xl shadow-2xs shrink-0 self-stretch sm:self-auto justify-between sm:justify-start">
          <div className="flex flex-col">
            <span className="text-[9px] sm:text-[10px] uppercase font-bold tracking-wider text-stone-400">Visited Progress</span>
            <span className="text-xs font-semibold text-stone-800">
              {visitedSpots} of {totalSpots} checkpoints ({progressPercent}%)
            </span>
          </div>
          <div className="w-12 h-2 bg-stone-100 rounded-full overflow-hidden border border-stone-200/60">
            <div 
              className="h-full bg-emerald-500 transition-all duration-300 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Nodes Flowchart Container */}
      <div className="flex flex-col items-center gap-0 w-full relative">
        {nodes.map((node, index) => {
          const nextNode = nodes[index + 1];
          const transit = nextNode ? getTransit(node.id, nextNode.id) : null;
          const catStyle = CATEGORY_COLORS[node.category || 'attraction'] || CATEGORY_COLORS.other;
          const isBeingDragged = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <React.Fragment key={node.id}>
              {/* Place Checkpoint Card */}
              <div 
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={(e) => handleDrop(e, index)}
                className={`group relative w-full rounded-2xl border transition-all duration-200 p-3.5 sm:p-5 shadow-xs ${
                  node.isVisited 
                    ? 'bg-emerald-50/40 border-emerald-300 ring-1 ring-emerald-400/30' 
                    : `${catStyle.bg} ${catStyle.border} hover:border-stone-300 hover:shadow-sm`
                } ${
                  isBeingDragged ? 'opacity-40 scale-95 border-dashed border-stone-400' : ''
                } ${
                  isDragOver ? 'border-amber-500 ring-2 ring-amber-300 ring-offset-2' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2 sm:gap-3">
                  {/* Left: Grip Handle + Visited Checkbox + Place Info */}
                  <div className="flex items-start gap-2 sm:gap-3 flex-1 min-w-0">
                    <div 
                      title="Drag to reorder checkpoint"
                      className="p-1 cursor-grab active:cursor-grabbing text-stone-400 hover:text-stone-700 transition-colors mt-0.5 shrink-0"
                    >
                      <GripVertical size={15} />
                    </div>

                    {/* Visited Toggle Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleVisited(node.id)}
                      title={node.isVisited ? "Mark as unvisited" : "Mark as visited"}
                      className="mt-0.5 shrink-0 transition-transform active:scale-90 cursor-pointer p-0.5"
                    >
                      {node.isVisited ? (
                        <CheckCircle2 size={20} className="text-emerald-600 fill-emerald-100 sm:w-[22px] sm:h-[22px]" />
                      ) : (
                        <Circle size={20} className="text-stone-300 hover:text-amber-500 sm:w-[22px] sm:h-[22px]" />
                      )}
                    </button>

                    {/* Place Name and Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap mb-1">
                        <span className="text-sm font-semibold">{catStyle.icon}</span>
                        <input
                          type="text"
                          value={node.name}
                          onChange={(e) => handleUpdateNode(node.id, { name: e.target.value })}
                          placeholder="Place or activity name..."
                          className={`flex-1 min-w-[120px] text-sm sm:text-base font-semibold bg-transparent outline-none border-b border-transparent hover:border-stone-300 focus:border-amber-500 transition-colors ${
                            node.isVisited ? 'text-emerald-950 line-through opacity-80' : 'text-stone-900'
                          }`}
                        />
                        
                        {/* Category Selector */}
                        <select
                          value={node.category || 'attraction'}
                          onChange={(e) => handleUpdateNode(node.id, { category: e.target.value as any })}
                          className="text-[11px] font-medium text-stone-600 bg-white/90 border border-stone-200 rounded-md px-2 py-0.5 outline-none cursor-pointer hover:border-stone-400"
                        >
                          <option value="attraction">🏰 Attraction</option>
                          <option value="food">🍜 Food / Cafe</option>
                          <option value="hotel">🏨 Hotel</option>
                          <option value="airport">✈️ Airport / Transit</option>
                          <option value="shopping">🛍️ Shopping</option>
                          <option value="other">📍 Other</option>
                        </select>
                      </div>

                      {/* Multiple Check-In Sub-Heading & Checkbox List */}
                      {(() => {
                        // Normalize checkIns (support backwards compatibility with legacy single field)
                        const items: CheckInItem[] = node.checkIns && node.checkIns.length > 0
                          ? node.checkIns
                          : node.checkInSubHeading || node.isCheckedIn
                          ? [{ id: 'legacy-1', label: node.checkInSubHeading || '', isChecked: !!node.isCheckedIn }]
                          : [];

                        const handleAddCheckIn = () => {
                          const updated = [...items, { id: crypto.randomUUID(), label: '', isChecked: false }];
                          handleUpdateNode(node.id, { checkIns: updated });
                        };

                        const handleUpdateCheckIn = (itemId: string, updates: Partial<CheckInItem>) => {
                          const updated = items.map(it => it.id === itemId ? { ...it, ...updates } : it);
                          handleUpdateNode(node.id, { checkIns: updated });
                        };

                        const handleDeleteCheckIn = (itemId: string) => {
                          const updated = items.filter(it => it.id !== itemId);
                          handleUpdateNode(node.id, { checkIns: updated });
                        };

                        return (
                          <div className="flex flex-col gap-1.5 my-2">
                            {items.map((item, cIndex) => (
                              <div 
                                key={item.id || cIndex}
                                className="group/checkin flex items-center gap-2 bg-white/70 border border-stone-200/70 hover:border-amber-300 rounded-lg px-2.5 py-1 transition-all"
                              >
                                <label className="flex items-center gap-1.5 cursor-pointer shrink-0">
                                  <input
                                    type="checkbox"
                                    checked={!!item.isChecked}
                                    onChange={(e) => handleUpdateCheckIn(item.id, { isChecked: e.target.checked })}
                                    className="w-3.5 h-3.5 rounded text-amber-600 focus:ring-amber-500 border-stone-300 accent-amber-600 cursor-pointer"
                                  />
                                  <span className={`text-[11px] font-medium transition-colors ${item.isChecked ? 'text-amber-700 font-semibold' : 'text-stone-500'}`}>
                                    📍 Check-in {items.length > 1 ? `#${cIndex + 1}:` : ':'}
                                  </span>
                                </label>
                                <input
                                  type="text"
                                  value={item.label}
                                  onChange={(e) => handleUpdateCheckIn(item.id, { label: e.target.value })}
                                  placeholder="Check-in point (e.g. Gate 4, Counter 2, Lobby, Spot #A)..."
                                  className={`flex-1 text-xs bg-transparent outline-none placeholder:text-stone-400 font-medium ${
                                    item.isChecked ? 'text-amber-900 line-through opacity-80' : 'text-stone-600'
                                  }`}
                                />
                                {item.isChecked && (
                                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded border border-amber-300 shrink-0">
                                    Checked In
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCheckIn(item.id)}
                                  title="Delete this check-in point"
                                  className="opacity-0 group-hover/checkin:opacity-100 p-0.5 text-stone-300 hover:text-red-500 transition-opacity"
                                >
                                  &times;
                                </button>
                              </div>
                            ))}

                            {/* Button to add more sub-check-in points */}
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={handleAddCheckIn}
                                className="text-[11px] font-medium text-amber-700 hover:text-amber-900 bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 rounded-md px-2 py-0.5 flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Plus size={12} />
                                <span>{items.length === 0 ? 'Add Check-in Point' : '+ Add Another Check-in Point'}</span>
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Time Range and Note Inputs */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 mt-2">
                        {/* Time Range */}
                        <div className="flex items-center gap-1.5 bg-white/90 border border-stone-200/80 px-2.5 py-1 rounded-lg text-xs text-stone-700 shadow-2xs">
                          <Clock size={13} className="text-amber-600 shrink-0" />
                          <input
                            type="time"
                            value={node.timeStart || '09:00'}
                            onChange={(e) => handleUpdateNode(node.id, { timeStart: e.target.value })}
                            className="bg-transparent font-mono text-xs outline-none cursor-pointer"
                          />
                          <span className="text-stone-400 text-[10px]">to</span>
                          <input
                            type="time"
                            value={node.timeEnd || '10:30'}
                            onChange={(e) => handleUpdateNode(node.id, { timeEnd: e.target.value })}
                            className="bg-transparent font-mono text-xs outline-none cursor-pointer"
                          />
                        </div>

                        {/* Quick Note */}
                        <input
                          type="text"
                          value={node.note || ''}
                          onChange={(e) => handleUpdateNode(node.id, { note: e.target.value })}
                          placeholder="Add details, tickets, reservation note..."
                          className="flex-1 w-full sm:w-auto text-xs bg-white/70 border border-stone-200/60 rounded-lg px-2.5 py-1 text-stone-600 placeholder:text-stone-400 outline-none focus:border-stone-400 focus:bg-white"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleAddNode(index)}
                      title="Insert checkpoint after this"
                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-amber-600 hover:bg-amber-100/60 rounded transition-all"
                    >
                      <Plus size={15} />
                    </button>
                    <button
                      onClick={() => handleDeleteNode(node.id)}
                      title="Delete checkpoint"
                      className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Transit Connector Arrow (Between Checkpoints) */}
              {nextNode && transit && (
                <div className="flex flex-col items-center my-1.5 group/transit w-full">
                  {/* Vertical dotted line top */}
                  <div className="w-0.5 h-3 bg-stone-300"></div>

                  {/* Transit Badge / Pill */}
                  <div className="flex items-center gap-2 bg-white border border-stone-200/80 hover:border-amber-400 px-3 py-1 rounded-full shadow-2xs transition-all text-xs text-stone-600">
                    <div className="flex items-center gap-1">
                      {TRANSPORT_ICONS[transit.transportType]?.icon || TRANSPORT_ICONS.walk.icon}
                      <select
                        value={transit.transportType}
                        onChange={(e) => handleUpdateTransit(node.id, nextNode.id, { transportType: e.target.value as any })}
                        className="text-[11px] font-medium bg-transparent outline-none cursor-pointer pr-1"
                      >
                        <option value="walk">🚶 Walk</option>
                        <option value="train">🚇 Train / Metro</option>
                        <option value="car">🚗 Taxi / Car</option>
                        <option value="bus">🚌 Bus</option>
                        <option value="flight">✈️ Flight</option>
                        <option value="ferry">⛴️ Ferry</option>
                      </select>
                    </div>

                    <span className="text-stone-300">•</span>

                    {/* Duration input */}
                    <input
                      type="text"
                      value={transit.duration || '15m'}
                      onChange={(e) => handleUpdateTransit(node.id, nextNode.id, { duration: e.target.value })}
                      placeholder="Duration (e.g. 20m)"
                      className="w-12 text-[11px] font-mono text-stone-700 bg-transparent outline-none text-center hover:bg-stone-50 rounded"
                    />

                    {/* In Transit Arrow */}
                    <ArrowDown size={13} className="text-amber-500 group-hover/transit:translate-y-0.5 transition-transform" />
                  </div>

                  {/* Vertical dotted line bottom */}
                  <div className="w-0.5 h-3 bg-stone-300"></div>
                </div>
              )}
            </React.Fragment>
          );
        })}

        {/* Empty State */}
        {nodes.length === 0 && (
          <div className="text-center py-12 px-4 bg-amber-50/40 border-2 border-dashed border-amber-200 rounded-2xl w-full">
            <p className="text-sm text-stone-500 mb-3">No trip stops added yet.</p>
            <button
              onClick={() => handleAddNode()}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm inline-flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Add First Checkpoint</span>
            </button>
          </div>
        )}
      </div>

      {/* Bottom Add Next Destination Button */}
      {nodes.length > 0 && (
        <div className="flex justify-center pt-2 pb-12">
          <button
            onClick={() => handleAddNode()}
            className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2 hover:scale-[1.02] active:scale-95"
          >
            <Plus size={15} />
            <span>Add Next Destination</span>
          </button>
        </div>
      )}
    </div>
  );
}
