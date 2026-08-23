export interface OilTravelRecord {
  id: string;
  date: string; // YYYY-MM-DD format
  stationId: string;
  stationName: string;
  fuelTypeId: string;
  fuelTypeName: string;
  amountPaid: number;   // In currency, e.g. 500.00
  fuelQuantity: number; // In liters, e.g. 18.42
  costPerUnit: number;  // amountPaid / fuelQuantity
  percentageDifference: number; // % diff relative to baseline average
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface OilTravelStation {
  id: string;
  name: string;
  createdAt: number;
}

export interface OilTravelFuelType {
  id: string;
  name: string;
  createdAt: number;
}

export interface OilTravelData {
  version: 1;
  mode: 'oiltravel';
  records: OilTravelRecord[];
  customStations: OilTravelStation[];
  customFuelTypes: OilTravelFuelType[];
  unit: string;     // default: 'L'
  currency: string; // default: '฿'
}

export const OIL_PREFIX = '<!--OILTRAVEL_DATA:';
export const OIL_SUFFIX = ':END_OILTRAVEL-->';

export const DEFAULT_FUEL_TYPES: string[] = [
  'Gasohol 95',
  'Gasohol 91',
  'E20',
  'E85',
  'Diesel',
  'Premium Diesel',
  'Premium Gasoline'
];

export const DEFAULT_STATIONS: string[] = [
  'PTT Station',
  'Bangchak',
  'Shell',
  'Caltex',
  'PT',
  'Esso / ExxonMobil',
  'Susco'
];

export function isOilTravelContent(content: string): boolean {
  return typeof content === 'string' && content.includes(OIL_PREFIX) && content.includes(OIL_SUFFIX);
}

/**
 * Calculates average cost per unit and the % difference for each record.
 * Difference % = ((record.costPerUnit - baselineCostPerUnit) / baselineCostPerUnit) * 100
 */
export function recalculateRecords(records: OilTravelRecord[]): OilTravelRecord[] {
  if (!records || records.length === 0) return [];

  // Calculate baseline average cost/L across all records with valid quantity > 0
  const valid = records.filter(r => r.fuelQuantity > 0 && r.amountPaid > 0);
  const totalSpent = valid.reduce((acc, r) => acc + r.amountPaid, 0);
  const totalLiters = valid.reduce((acc, r) => acc + r.fuelQuantity, 0);
  const baselineCost = totalLiters > 0 ? totalSpent / totalLiters : 0;

  return records.map(r => {
    const costPerUnit = r.fuelQuantity > 0 ? Number((r.amountPaid / r.fuelQuantity).toFixed(2)) : 0;
    let percentageDifference = 0;
    if (baselineCost > 0 && costPerUnit > 0) {
      percentageDifference = Number((((costPerUnit - baselineCost) / baselineCost) * 100).toFixed(2));
    }
    return {
      ...r,
      costPerUnit,
      percentageDifference
    };
  });
}

export function parseOilTravelContent(content: string): { data: OilTravelData; text: string } {
  if (!isOilTravelContent(content)) {
    return {
      data: {
        version: 1,
        mode: 'oiltravel',
        records: [],
        customStations: DEFAULT_STATIONS.map(name => ({ id: crypto.randomUUID(), name, createdAt: Date.now() })),
        customFuelTypes: DEFAULT_FUEL_TYPES.map(name => ({ id: crypto.randomUUID(), name, createdAt: Date.now() })),
        unit: 'L',
        currency: '฿'
      },
      text: content
    };
  }

  try {
    const startIndex = content.indexOf(OIL_PREFIX) + OIL_PREFIX.length;
    const endIndex = content.indexOf(OIL_SUFFIX);
    const jsonStr = content.substring(startIndex, endIndex);
    const parsedData: OilTravelData = JSON.parse(jsonStr);
    const regularText = content.substring(0, content.indexOf(OIL_PREFIX)).trim();

    return {
      data: {
        ...parsedData,
        records: recalculateRecords(parsedData.records || []),
        customStations: parsedData.customStations || [],
        customFuelTypes: parsedData.customFuelTypes || [],
        unit: parsedData.unit || 'L',
        currency: parsedData.currency || '฿'
      },
      text: regularText
    };
  } catch (e) {
    return {
      data: {
        version: 1,
        mode: 'oiltravel',
        records: [],
        customStations: [],
        customFuelTypes: [],
        unit: 'L',
        currency: '฿'
      },
      text: content
    };
  }
}

export function serializeOilTravelContent(text: string, data: OilTravelData): string {
  const dataToSave: OilTravelData = {
    ...data,
    records: recalculateRecords(data.records || [])
  };
  const jsonStr = JSON.stringify(dataToSave);
  const cleanText = text ? text.replace(new RegExp(`${OIL_PREFIX}[\\s\\S]*?${OIL_SUFFIX}`, 'g'), '').trim() : '';
  return cleanText ? `${cleanText}\n\n${OIL_PREFIX}${jsonStr}${OIL_SUFFIX}` : `${OIL_PREFIX}${jsonStr}${OIL_SUFFIX}`;
}
