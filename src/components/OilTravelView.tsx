"use client";
import React, { useState, useMemo } from 'react';
import { 
  Fuel, Plus, Trash2, Edit3, Search, ArrowUpDown, Filter, 
  Calendar, DollarSign, Droplets, TrendingUp, TrendingDown,
  Building2, Sparkles, ChevronRight, X, Check, Clock, Info,
  Flame, Award, ArrowUpRight, ArrowDownRight, Tag, HelpCircle
} from 'lucide-react';
import { 
  OilTravelData, OilTravelRecord, OilTravelStation, OilTravelFuelType,
  recalculateRecords
} from '@/lib/oiltravel';
import { format, parseISO } from 'date-fns';

interface Props {
  data: OilTravelData;
  onChange: (newData: OilTravelData) => void;
}

export function OilTravelView({ data, onChange }: Props) {
  const { records = [], customStations = [], customFuelTypes = [], unit = 'L', currency = '฿' } = data;

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStationFilter, setSelectedStationFilter] = useState<string>('all');
  const [selectedFuelTypeFilter, setSelectedFuelTypeFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'cost_asc' | 'cost_desc'>('newest');

  // Modal states for Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<OilTravelRecord | null>(null);

  // Form states
  const [formDate, setFormDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [formStationName, setFormStationName] = useState<string>('');
  const [formFuelTypeName, setFormFuelTypeName] = useState<string>('');
  const [formAmountPaid, setFormAmountPaid] = useState<string>('');
  const [formFuelQuantity, setFormFuelQuantity] = useState<string>('');
  const [formNote, setFormNote] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Add custom station / fuel type inline input states
  const [isAddingNewStation, setIsAddingNewStation] = useState(false);
  const [newStationInput, setNewStationInput] = useState('');
  const [isAddingNewFuelType, setIsAddingNewFuelType] = useState(false);
  const [newFuelTypeInput, setNewFuelTypeInput] = useState('');

  // Delete confirmation
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  // ─────────────────────────────────────────────
  // DASHBOARD CALCULATIONS & ANALYTICS
  // ─────────────────────────────────────────────
  const analytics = useMemo(() => {
    const totalRefills = records.length;
    if (totalRefills === 0) {
      return {
        totalRefills: 0,
        totalSpent: 0,
        totalFuel: 0,
        avgCostPerUnit: 0,
        avgDiffPercent: 0,
        topStation: '-',
        topFuelType: '-',
        lastRefill: null as OilTravelRecord | null,
        bestCostRefill: null as OilTravelRecord | null,
        highestCostRefill: null as OilTravelRecord | null,
      };
    }

    const totalSpent = records.reduce((acc, r) => acc + (r.amountPaid || 0), 0);
    const totalFuel = records.reduce((acc, r) => acc + (r.fuelQuantity || 0), 0);
    const avgCostPerUnit = totalFuel > 0 ? totalSpent / totalFuel : 0;
    const avgDiffPercent = totalRefills > 0 
      ? records.reduce((acc, r) => acc + (r.percentageDifference || 0), 0) / totalRefills 
      : 0;

    // Station frequency
    const stationCounts: Record<string, number> = {};
    records.forEach(r => {
      const s = r.stationName || 'Unknown';
      stationCounts[s] = (stationCounts[s] || 0) + 1;
    });
    let topStation = '-';
    let maxStationCount = 0;
    Object.entries(stationCounts).forEach(([name, count]) => {
      if (count > maxStationCount) {
        maxStationCount = count;
        topStation = name;
      }
    });

    // Fuel Type frequency
    const fuelCounts: Record<string, number> = {};
    records.forEach(r => {
      const f = r.fuelTypeName || 'Unknown';
      fuelCounts[f] = (fuelCounts[f] || 0) + 1;
    });
    let topFuelType = '-';
    let maxFuelCount = 0;
    Object.entries(fuelCounts).forEach(([name, count]) => {
      if (count > maxFuelCount) {
        maxFuelCount = count;
        topFuelType = name;
      }
    });

    // Last Refill (sorted by date newest)
    const sortedByDate = [...records].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
    const lastRefill = sortedByDate[0] || null;

    // Best (lowest cost/L) & Highest cost/L
    const validWithCost = records.filter(r => r.costPerUnit > 0);
    const sortedByCost = [...validWithCost].sort((a, b) => a.costPerUnit - b.costPerUnit);
    const bestCostRefill = sortedByCost[0] || null;
    const highestCostRefill = sortedByCost[sortedByCost.length - 1] || null;

    return {
      totalRefills,
      totalSpent,
      totalFuel,
      avgCostPerUnit,
      avgDiffPercent,
      topStation,
      topFuelType,
      lastRefill,
      bestCostRefill,
      highestCostRefill
    };
  }, [records]);

  // ─────────────────────────────────────────────
  // FILTERING & SORTING
  // ─────────────────────────────────────────────
  const filteredRecords = useMemo(() => {
    let list = [...records];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => 
        r.stationName.toLowerCase().includes(q) ||
        r.fuelTypeName.toLowerCase().includes(q) ||
        r.date.includes(q) ||
        (r.note && r.note.toLowerCase().includes(q))
      );
    }

    if (selectedStationFilter !== 'all') {
      list = list.filter(r => r.stationName === selectedStationFilter);
    }

    if (selectedFuelTypeFilter !== 'all') {
      list = list.filter(r => r.fuelTypeName === selectedFuelTypeFilter);
    }

    list.sort((a, b) => {
      if (sortOrder === 'newest') return b.date.localeCompare(a.date) || b.createdAt - a.createdAt;
      if (sortOrder === 'oldest') return a.date.localeCompare(b.date) || a.createdAt - b.createdAt;
      if (sortOrder === 'cost_asc') return a.costPerUnit - b.costPerUnit;
      if (sortOrder === 'cost_desc') return b.costPerUnit - a.costPerUnit;
      return 0;
    });

    return list;
  }, [records, searchQuery, selectedStationFilter, selectedFuelTypeFilter, sortOrder]);

  // All available stations and fuel types
  const availableStations = useMemo(() => {
    const set = new Set<string>();
    customStations.forEach(s => set.add(s.name));
    records.forEach(r => { if (r.stationName) set.add(r.stationName); });
    return Array.from(set);
  }, [customStations, records]);

  const availableFuelTypes = useMemo(() => {
    const set = new Set<string>();
    customFuelTypes.forEach(f => set.add(f.name));
    records.forEach(r => { if (r.fuelTypeName) set.add(r.fuelTypeName); });
    return Array.from(set);
  }, [customFuelTypes, records]);

  // ─────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────
  const handleOpenCreateModal = () => {
    setEditingRecord(null);
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormStationName(availableStations[0] || 'PTT Station');
    setFormFuelTypeName(availableFuelTypes[0] || 'Gasohol 95');
    setFormAmountPaid('');
    setFormFuelQuantity('');
    setFormNote('');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rec: OilTravelRecord) => {
    setEditingRecord(rec);
    setFormDate(rec.date);
    setFormStationName(rec.stationName);
    setFormFuelTypeName(rec.fuelTypeName);
    setFormAmountPaid(String(rec.amountPaid));
    setFormFuelQuantity(String(rec.fuelQuantity));
    setFormNote(rec.note || '');
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const paid = parseFloat(formAmountPaid);
    const quantity = parseFloat(formFuelQuantity);

    if (!formStationName.trim()) {
      setFormError('Please select or add a fuel station name.');
      return;
    }
    if (!formFuelTypeName.trim()) {
      setFormError('Please select or add a fuel type.');
      return;
    }
    if (isNaN(paid) || paid <= 0) {
      setFormError('Please enter a valid amount paid (greater than 0).');
      return;
    }
    if (isNaN(quantity) || quantity <= 0) {
      setFormError('Please enter a valid fuel quantity in Liters (greater than 0).');
      return;
    }

    const now = Date.now();
    let updatedRecords: OilTravelRecord[];

    if (editingRecord) {
      updatedRecords = records.map(r => {
        if (r.id === editingRecord.id) {
          return {
            ...r,
            date: formDate,
            stationName: formStationName.trim(),
            fuelTypeName: formFuelTypeName.trim(),
            amountPaid: Number(paid.toFixed(2)),
            fuelQuantity: Number(quantity.toFixed(2)),
            note: formNote.trim() || undefined,
            updatedAt: now
          };
        }
        return r;
      });
    } else {
      const newRec: OilTravelRecord = {
        id: crypto.randomUUID(),
        date: formDate,
        stationId: crypto.randomUUID(),
        stationName: formStationName.trim(),
        fuelTypeId: crypto.randomUUID(),
        fuelTypeName: formFuelTypeName.trim(),
        amountPaid: Number(paid.toFixed(2)),
        fuelQuantity: Number(quantity.toFixed(2)),
        costPerUnit: 0, // will be recalculated
        percentageDifference: 0, // will be recalculated
        note: formNote.trim() || undefined,
        createdAt: now,
        updatedAt: now
      };
      updatedRecords = [newRec, ...records];
    }

    // Persist any new custom station if not exists
    let updatedStations = [...customStations];
    if (!updatedStations.some(s => s.name.toLowerCase() === formStationName.trim().toLowerCase())) {
      updatedStations.push({
        id: crypto.randomUUID(),
        name: formStationName.trim(),
        createdAt: now
      });
    }

    // Persist any new custom fuel type if not exists
    let updatedFuelTypes = [...customFuelTypes];
    if (!updatedFuelTypes.some(f => f.name.toLowerCase() === formFuelTypeName.trim().toLowerCase())) {
      updatedFuelTypes.push({
        id: crypto.randomUUID(),
        name: formFuelTypeName.trim(),
        createdAt: now
      });
    }

    const recalculated = recalculateRecords(updatedRecords);
    onChange({
      ...data,
      records: recalculated,
      customStations: updatedStations,
      customFuelTypes: updatedFuelTypes
    });

    setIsModalOpen(false);
  };

  const handleAddNewStation = () => {
    const trimmed = newStationInput.trim();
    if (!trimmed) return;
    if (!customStations.some(s => s.name.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...customStations, { id: crypto.randomUUID(), name: trimmed, createdAt: Date.now() }];
      onChange({ ...data, customStations: updated });
    }
    setFormStationName(trimmed);
    setNewStationInput('');
    setIsAddingNewStation(false);
  };

  const handleAddNewFuelType = () => {
    const trimmed = newFuelTypeInput.trim();
    if (!trimmed) return;
    if (!customFuelTypes.some(f => f.name.toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...customFuelTypes, { id: crypto.randomUUID(), name: trimmed, createdAt: Date.now() }];
      onChange({ ...data, customFuelTypes: updated });
    }
    setFormFuelTypeName(trimmed);
    setNewFuelTypeInput('');
    setIsAddingNewFuelType(false);
  };

  const handleDeleteConfirm = () => {
    if (!recordToDelete) return;
    const remaining = records.filter(r => r.id !== recordToDelete);
    const recalculated = recalculateRecords(remaining);
    onChange({ ...data, records: recalculated });
    setRecordToDelete(null);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 animate-in fade-in duration-200">
      
      {/* ─────────────────────────────────────────────
          1. DASHBOARD SUMMARY CARDS
      ───────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-amber-50/90 via-orange-50/40 to-stone-50 border border-amber-200/80 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/60 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
              <Fuel size={22} className="stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-heading font-bold text-stone-900">Oil Travel</h2>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-300 rounded-md uppercase tracking-wider">
                  Fuel Analytics
                </span>
              </div>
              <p className="text-xs text-stone-500">Refill memory timeline, fuel consumption & cost comparison archive</p>
            </div>
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer shrink-0"
          >
            <Plus size={15} />
            <span>Add Refill Record</span>
          </button>
        </div>

        {/* Primary Metrics Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 mb-3.5">
          <div className="bg-white/80 backdrop-blur-xs p-3 sm:p-3.5 rounded-xl border border-amber-100 shadow-2xs">
            <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wide flex items-center gap-1">
              <Droplets size={12} className="text-amber-500" />
              <span>Total Refills</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-heading text-stone-900 mt-1">
              {analytics.totalRefills} <span className="text-xs font-normal text-stone-500">times</span>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xs p-3 sm:p-3.5 rounded-xl border border-amber-100 shadow-2xs">
            <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wide flex items-center gap-1">
              <DollarSign size={12} className="text-emerald-600" />
              <span>Total Spent</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-heading text-emerald-800 mt-1">
              {currency}{analytics.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xs p-3 sm:p-3.5 rounded-xl border border-amber-100 shadow-2xs">
            <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wide flex items-center gap-1">
              <Flame size={12} className="text-orange-500" />
              <span>Total Fuel</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-heading text-stone-900 mt-1">
              {analytics.totalFuel.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-stone-500">{unit}</span>
            </div>
          </div>

          <div className="bg-white/80 backdrop-blur-xs p-3 sm:p-3.5 rounded-xl border border-amber-100 shadow-2xs">
            <div className="text-[11px] font-medium text-stone-500 uppercase tracking-wide flex items-center gap-1">
              <Sparkles size={12} className="text-amber-600" />
              <span>Avg. Cost / {unit}</span>
            </div>
            <div className="text-lg sm:text-2xl font-bold font-heading text-stone-900 mt-1">
              {currency}{analytics.avgCostPerUnit.toFixed(2)}<span className="text-xs font-normal text-stone-500">/{unit}</span>
            </div>
          </div>
        </div>

        {/* Secondary Insights Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 text-xs">
          <div className="bg-white/60 p-2.5 rounded-lg border border-amber-100/70">
            <span className="text-stone-400 block text-[10px] uppercase font-semibold">Avg. Difference</span>
            <div className="flex items-center gap-1 mt-0.5 font-semibold text-stone-800">
              {analytics.avgDiffPercent > 0 ? (
                <span className="text-rose-600 flex items-center gap-0.5 font-bold">
                  <ArrowUpRight size={13} /> +{analytics.avgDiffPercent.toFixed(2)}%
                </span>
              ) : analytics.avgDiffPercent < 0 ? (
                <span className="text-emerald-600 flex items-center gap-0.5 font-bold">
                  <ArrowDownRight size={13} /> {analytics.avgDiffPercent.toFixed(2)}%
                </span>
              ) : (
                <span className="text-stone-600">0.00% (Baseline)</span>
              )}
            </div>
          </div>

          <div className="bg-white/60 p-2.5 rounded-lg border border-amber-100/70 truncate">
            <span className="text-stone-400 block text-[10px] uppercase font-semibold">Top Station</span>
            <span className="font-semibold text-stone-800 truncate block mt-0.5" title={analytics.topStation}>
              {analytics.topStation}
            </span>
          </div>

          <div className="bg-white/60 p-2.5 rounded-lg border border-amber-100/70 truncate">
            <span className="text-stone-400 block text-[10px] uppercase font-semibold">Top Fuel Type</span>
            <span className="font-semibold text-stone-800 truncate block mt-0.5" title={analytics.topFuelType}>
              {analytics.topFuelType}
            </span>
          </div>

          <div className="bg-white/60 p-2.5 rounded-lg border border-amber-100/70 truncate">
            <span className="text-stone-400 block text-[10px] uppercase font-semibold">Last Refill</span>
            <span className="font-semibold text-stone-800 truncate block mt-0.5">
              {analytics.lastRefill ? `${analytics.lastRefill.date}` : '-'}
            </span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          2. SEARCH & CONTROLS TOOLBAR
      ───────────────────────────────────────────── */}
      <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white p-3 rounded-xl border border-stone-200/80 shadow-2xs">
        {/* Search Bar */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fuel station, fuel type, date, notes..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg outline-none focus:border-amber-400 focus:bg-white transition-all text-stone-800"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')} 
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filters Group */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Station Filter */}
          <select
            value={selectedStationFilter}
            onChange={(e) => setSelectedStationFilter(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 outline-none text-stone-700 hover:border-stone-300 transition-colors"
          >
            <option value="all">All Stations ({availableStations.length})</option>
            {availableStations.map(st => (
              <option key={st} value={st}>{st}</option>
            ))}
          </select>

          {/* Fuel Type Filter */}
          <select
            value={selectedFuelTypeFilter}
            onChange={(e) => setSelectedFuelTypeFilter(e.target.value)}
            className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 outline-none text-stone-700 hover:border-stone-300 transition-colors"
          >
            <option value="all">All Fuel Types</option>
            {availableFuelTypes.map(ft => (
              <option key={ft} value={ft}>{ft}</option>
            ))}
          </select>

          {/* Sort Order */}
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="text-xs bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 outline-none text-stone-700 hover:border-stone-300 transition-colors font-medium"
          >
            <option value="newest">📅 Newest First</option>
            <option value="oldest">📅 Oldest First</option>
            <option value="cost_asc">💰 Lowest Cost/L</option>
            <option value="cost_desc">💰 Highest Cost/L</option>
          </select>
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          3. CONNECTED TIMELINE / MEMORY HISTORY
      ───────────────────────────────────────────── */}
      <section className="flex flex-col gap-0 relative">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-heading font-semibold tracking-wider text-stone-500 uppercase">
              Fuel Memory Timeline ({filteredRecords.length})
            </h3>
          </div>
          <span className="text-[11px] text-stone-400 font-medium">
            Baseline: {currency}{analytics.avgCostPerUnit.toFixed(2)}/{unit}
          </span>
        </div>

        {/* Empty State */}
        {records.length === 0 && (
          <div className="flex flex-col items-center justify-center p-10 sm:p-14 bg-stone-50/60 border border-dashed border-stone-200 rounded-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center mb-3.5 shadow-2xs">
              <Fuel size={28} />
            </div>
            <h4 className="text-base font-heading font-bold text-stone-800">No fuel records yet</h4>
            <p className="text-xs text-stone-500 max-w-sm mt-1 mb-5 leading-relaxed">
              Start tracking your fuel refills to compare prices, station choices, and understand percentage cost differences over time.
            </p>
            <button
              onClick={handleOpenCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <Plus size={15} />
              <span>Add Your First Refill</span>
            </button>
          </div>
        )}

        {/* No Search Results */}
        {records.length > 0 && filteredRecords.length === 0 && (
          <div className="p-8 text-center bg-stone-50 border border-stone-200 rounded-xl">
            <p className="text-xs text-stone-500">No fuel records matching your filter or search criteria.</p>
            <button
              onClick={() => { setSearchQuery(''); setSelectedStationFilter('all'); setSelectedFuelTypeFilter('all'); }}
              className="mt-2 text-xs font-semibold text-amber-600 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Timeline Flow */}
        <div className="relative pl-6 sm:pl-10 space-y-6">
          {/* Vertical Connection Line */}
          {filteredRecords.length > 0 && (
            <div className="absolute left-2.5 sm:left-4 top-4 bottom-4 w-0.5 bg-gradient-to-b from-amber-400 via-amber-300 to-stone-200" />
          )}

          {filteredRecords.map((rec, index) => {
            const isDiffPositive = rec.percentageDifference > 0;
            const isDiffNegative = rec.percentageDifference < 0;

            return (
              <div key={rec.id} className="relative group">
                {/* Node Connector Dot on Vertical Line */}
                <div className={`absolute -left-6 sm:-left-10 top-5 w-4 h-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center transition-transform group-hover:scale-125 z-10 ${
                  isDiffNegative ? 'bg-emerald-500' : isDiffPositive ? 'bg-rose-500' : 'bg-amber-500'
                }`}>
                  <div className="w-1.5 h-1.5 bg-white rounded-full" />
                </div>

                {/* Card Container */}
                <div className="bg-white hover:bg-stone-50/50 border border-stone-200/90 hover:border-amber-300 rounded-2xl p-4 sm:p-5 shadow-2xs hover:shadow-sm transition-all flex flex-col gap-3.5">
                  
                  {/* Card Header: Station, Type, Date & Action Menu */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 rounded-lg flex items-center gap-1">
                          <Building2 size={12} className="text-amber-600" />
                          {rec.stationName}
                        </span>

                        <span className="px-2 py-0.5 text-[11px] font-medium bg-stone-100 text-stone-700 border border-stone-200 rounded-lg flex items-center gap-1">
                          <Tag size={11} className="text-stone-500" />
                          {rec.fuelTypeName}
                        </span>

                        {analytics.bestCostRefill?.id === rec.id && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-md flex items-center gap-1">
                            <Award size={11} /> Best Value
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs text-stone-400 mt-1.5 font-medium">
                        <Calendar size={12} />
                        <span>{rec.date}</span>
                      </div>
                    </div>

                    {/* Edit / Delete Buttons */}
                    <div className="flex items-center gap-1 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleOpenEditModal(rec)}
                        title="Edit record"
                        className="p-1.5 text-stone-400 hover:text-stone-800 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={() => setRecordToDelete(rec.id)}
                        title="Delete record"
                        className="p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Card Key Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 bg-stone-50/70 p-3 rounded-xl border border-stone-100">
                    <div>
                      <span className="text-[10px] font-medium text-stone-400 uppercase block">Amount Paid</span>
                      <span className="text-sm sm:text-base font-bold font-heading text-stone-900">
                        {currency}{rec.amountPaid.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-medium text-stone-400 uppercase block">Quantity Received</span>
                      <span className="text-sm sm:text-base font-bold font-heading text-stone-900">
                        {rec.fuelQuantity.toFixed(2)} {unit}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-medium text-stone-400 uppercase block">Cost Per {unit}</span>
                      <span className="text-sm sm:text-base font-bold font-heading text-stone-900">
                        {currency}{rec.costPerUnit.toFixed(2)}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-medium text-stone-400 uppercase block">Cost Difference</span>
                      <div className="flex items-center gap-1 text-sm font-bold">
                        {isDiffPositive ? (
                          <span className="text-rose-600 flex items-center gap-0.5" title="Higher than overall average cost">
                            <ArrowUpRight size={14} /> +{rec.percentageDifference.toFixed(2)}%
                          </span>
                        ) : isDiffNegative ? (
                          <span className="text-emerald-600 flex items-center gap-0.5" title="Lower than overall average cost">
                            <ArrowDownRight size={14} /> {rec.percentageDifference.toFixed(2)}%
                          </span>
                        ) : (
                          <span className="text-stone-500">0.00%</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Optional Note */}
                  {rec.note && (
                    <div className="text-xs text-stone-600 bg-amber-50/40 px-3 py-1.5 rounded-lg border border-amber-100/60 italic">
                      "{rec.note}"
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────
          4. ADD / EDIT RECORD MODAL
      ───────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-stone-200 flex flex-col max-h-[90vh] overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                  <Fuel size={17} />
                </div>
                <h3 className="text-sm sm:text-base font-heading font-bold text-stone-900">
                  {editingRecord ? 'Edit Refill Record' : 'Add Refill Record'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <X size={17} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveRecord} className="p-5 overflow-y-auto flex flex-col gap-4 custom-scrollbar">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
                  <Info size={15} className="shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Date */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                  <Calendar size={13} className="text-stone-400" />
                  <span>Refill Date *</span>
                </label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white text-stone-800"
                  required
                />
              </div>

              {/* Fuel Station Selector + Add New */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                    <Building2 size={13} className="text-stone-400" />
                    <span>Fuel Station *</span>
                  </label>
                  {!isAddingNewStation && (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewStation(true)}
                      className="text-[11px] text-amber-600 hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <Plus size={11} /> New Station
                    </button>
                  )}
                </div>

                {isAddingNewStation ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newStationInput}
                      onChange={(e) => setNewStationInput(e.target.value)}
                      placeholder="e.g. PTT Rama 9"
                      className="flex-1 px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl outline-none text-stone-800"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewStation}
                      className="px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAddingNewStation(false); setNewStationInput(''); }}
                      className="px-2.5 py-2 text-stone-500 text-xs hover:bg-stone-100 rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <select
                    value={formStationName}
                    onChange={(e) => setFormStationName(e.target.value)}
                    className="px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white text-stone-800"
                  >
                    {availableStations.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Fuel Type Selector + Add New */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                    <Tag size={13} className="text-stone-400" />
                    <span>Fuel Type *</span>
                  </label>
                  {!isAddingNewFuelType && (
                    <button
                      type="button"
                      onClick={() => setIsAddingNewFuelType(true)}
                      className="text-[11px] text-amber-600 hover:underline font-semibold flex items-center gap-0.5"
                    >
                      <Plus size={11} /> New Fuel Type
                    </button>
                  )}
                </div>

                {isAddingNewFuelType ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={newFuelTypeInput}
                      onChange={(e) => setNewFuelTypeInput(e.target.value)}
                      placeholder="e.g. Premium Gasohol 95"
                      className="flex-1 px-3 py-2 text-xs bg-white border border-amber-300 rounded-xl outline-none text-stone-800"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewFuelType}
                      className="px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-xl hover:bg-amber-700"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsAddingNewFuelType(false); setNewFuelTypeInput(''); }}
                      className="px-2.5 py-2 text-stone-500 text-xs hover:bg-stone-100 rounded-xl"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <select
                    value={formFuelTypeName}
                    onChange={(e) => setFormFuelTypeName(e.target.value)}
                    className="px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white text-stone-800"
                  >
                    {availableFuelTypes.map(ft => (
                      <option key={ft} value={ft}>{ft}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Amount Paid & Fuel Quantity Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                    <DollarSign size={13} className="text-stone-400" />
                    <span>Amount Paid ({currency}) *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formAmountPaid}
                    onChange={(e) => setFormAmountPaid(e.target.value)}
                    placeholder="500.00"
                    className="px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white text-stone-800 font-mono"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-stone-700 flex items-center gap-1">
                    <Droplets size={13} className="text-stone-400" />
                    <span>Fuel Quantity ({unit}) *</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formFuelQuantity}
                    onChange={(e) => setFormFuelQuantity(e.target.value)}
                    placeholder="18.42"
                    className="px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white text-stone-800 font-mono"
                    required
                  />
                </div>
              </div>

              {/* Live Cost/L & Difference Preview */}
              {parseFloat(formAmountPaid) > 0 && parseFloat(formFuelQuantity) > 0 && (
                <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-stone-500 block text-[10px]">Calculated Cost Per {unit}:</span>
                    <span className="font-bold font-heading text-stone-900 text-sm">
                      {currency}{(parseFloat(formAmountPaid) / parseFloat(formFuelQuantity)).toFixed(2)}/{unit}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-stone-500 block text-[10px]">Baseline Comparison:</span>
                    {analytics.avgCostPerUnit > 0 ? (
                      <span className="font-bold text-xs">
                        {((((parseFloat(formAmountPaid) / parseFloat(formFuelQuantity)) - analytics.avgCostPerUnit) / analytics.avgCostPerUnit) * 100).toFixed(2)}% vs avg
                      </span>
                    ) : (
                      <span className="text-stone-500 font-medium">Will establish baseline</span>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-stone-700">Refill Note (Optional)</label>
                <textarea
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder="e.g. Highway trip refill, tire pressure check done"
                  rows={2}
                  className="px-3 py-2 text-xs bg-stone-50 border border-stone-200 rounded-xl outline-none focus:border-amber-400 focus:bg-white text-stone-800 resize-none"
                />
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 active:scale-98 text-white text-xs font-semibold rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  {editingRecord ? 'Save Changes' : 'Add Refill Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────
          5. DELETE CONFIRMATION MODAL
      ───────────────────────────────────────────── */}
      {recordToDelete && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 shadow-xl border border-stone-200 text-center">
            <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 size={22} />
            </div>
            <h4 className="text-sm font-bold font-heading text-stone-900">Delete Refill Record?</h4>
            <p className="text-xs text-stone-500 mt-1 mb-5">
              Are you sure you want to delete this refill record from your timeline? This action cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setRecordToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
