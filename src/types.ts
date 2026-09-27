export type DayOfWeek = 'Lunedì' | 'Martedì' | 'Mercoledì' | 'Giovedì' | 'Venerdì' | 'Sabato' | 'Domenica';

export const DAYS_OF_WEEK: DayOfWeek[] = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica'
];

export interface TrainingSession {
  id: string;
  team: string;
  day: DayOfWeek;
  startTime: string; // e.g. "17:30"
  endTime: string;   // e.g. "19:00"
  field?: string;    // e.g. "Campo Principale", "Sintetico A"
  coach?: string;    // e.g. "Mister Rossi"
  notes?: string;
  lockerRoomId?: string; // Assigned locker room ID
  lockerRoomName?: string;
}

export interface LockerRoom {
  id: string;
  name: string;
  code: string;
  color: string;
  notes?: string;
  isAvailable: boolean;
}

export interface LockerRoomAssignment {
  id: string;
  sessionId: string;
  lockerRoomId: string;
  day: DayOfWeek;
  team: string;
  startTime: string;
  endTime: string;
  bufferMinutes?: number;
  notes?: string;
}

export interface SheetRowData {
  team: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
  [key: string]: any;
}

export interface SheetSyncConfig {
  spreadsheetId: string;
  spreadsheetName?: string;
  sheetTabName: string;
  lastSyncedAt?: string;
  autoSyncIntervalMinutes: number; // 0 for manual
  headers: string[];
}
