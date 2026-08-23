export type TransportType = 'walk' | 'train' | 'car' | 'bus' | 'flight' | 'ferry' | 'custom';

export interface CheckInItem {
  id: string;
  label: string;
  isChecked: boolean;
}

export interface TripLocationNode {
  id: string;
  name: string;
  checkInSubHeading?: string; // legacy fallback
  isCheckedIn?: boolean;      // legacy fallback
  checkIns?: CheckInItem[];   // list of multiple sub-checkin points
  timeStart: string; // e.g. '09:00'
  timeEnd: string;   // e.g. '11:30'
  isVisited: boolean;
  note?: string;
  cost?: string;
  category?: 'attraction' | 'food' | 'hotel' | 'airport' | 'shopping' | 'other';
  day?: number;
}

export interface TripTransit {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  transportType: TransportType;
  duration?: string; // e.g. '25m'
  note?: string;
}

export interface TripToGoData {
  version: 1;
  mode: 'triptogo';
  nodes: TripLocationNode[];
  transits: TripTransit[];
  coverNoteText?: string;
}

export const TRIP_PREFIX = '<!--TRIPTOGO_DATA:';
export const TRIP_SUFFIX = ':END_TRIPTOGO-->';

export function isTripToGoContent(content: string): boolean {
  return typeof content === 'string' && content.includes(TRIP_PREFIX) && content.includes(TRIP_SUFFIX);
}

export function parseTripToGoContent(content: string): { data: TripToGoData; text: string; blocks?: any[] } {
  if (!isTripToGoContent(content)) {
    return {
      data: {
        version: 1,
        mode: 'triptogo',
        nodes: [
          {
            id: crypto.randomUUID(),
            name: 'First Stop (e.g. Airport / Station)',
            timeStart: '09:00',
            timeEnd: '10:30',
            isVisited: false,
            category: 'airport',
            day: 1
          },
          {
            id: crypto.randomUUID(),
            name: 'Hotel Check-in',
            timeStart: '11:30',
            timeEnd: '12:30',
            isVisited: false,
            category: 'hotel',
            day: 1
          },
          {
            id: crypto.randomUUID(),
            name: 'Famous Sightseeing Point',
            timeStart: '13:30',
            timeEnd: '16:00',
            isVisited: false,
            category: 'attraction',
            day: 1
          }
        ],
        transits: []
      },
      text: content
    };
  }

  try {
    const startIndex = content.indexOf(TRIP_PREFIX) + TRIP_PREFIX.length;
    const endIndex = content.indexOf(TRIP_SUFFIX);
    const jsonStr = content.substring(startIndex, endIndex);
    const parsedData: TripToGoData = JSON.parse(jsonStr);
    const regularText = content.substring(0, content.indexOf(TRIP_PREFIX)).trim();

    return {
      data: parsedData,
      text: regularText
    };
  } catch (e) {
    return {
      data: {
        version: 1,
        mode: 'triptogo',
        nodes: [],
        transits: []
      },
      text: content
    };
  }
}

export function serializeTripToGoContent(text: string, data: TripToGoData): string {
  const jsonStr = JSON.stringify(data);
  const cleanText = text ? text.replace(new RegExp(`${TRIP_PREFIX}[\\s\\S]*?${TRIP_SUFFIX}`, 'g'), '').trim() : '';
  return cleanText ? `${cleanText}\n\n${TRIP_PREFIX}${jsonStr}${TRIP_SUFFIX}` : `${TRIP_PREFIX}${jsonStr}${TRIP_SUFFIX}`;
}


