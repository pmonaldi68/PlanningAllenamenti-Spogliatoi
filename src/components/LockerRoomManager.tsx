import React, { useState, useMemo } from 'react';
import {
  DoorClosed,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  Plus,
  Save,
  Trash2,
  Edit2,
  Users,
  ShieldAlert,
  ArrowRight,
  Info,
  Sparkles,
  MapPin,
  Pencil,
  Printer,
} from 'lucide-react';
import { LockerRoom, TrainingSession, DayOfWeek, DAYS_OF_WEEK } from '../types';
import { exportTodayPlanningPdf } from '../services/pdfExport';

interface LockerRoomManagerProps {
  sessions: TrainingSession[];
  onUpdateSessionLocker: (sessionId: string, lockerRoomId: string, lockerRoomName: string) => void;
  onUpdateSessionField: (sessionId: string, field: string) => void;
  lockerRooms: LockerRoom[];
  onAddLockerRoom: (room: LockerRoom) => void;
  onUpdateLockerRoom: (room: LockerRoom) => void;
  onDeleteLockerRoom: (roomId: string) => void;
  onSaveToGoogleSheet: () => void;
  isSavingToSheet: boolean;
  hasGoogleSheetConnected: boolean;
}

// Helper to convert "HH:MM" to minutes from 00:00
function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(':').map((p) => parseInt(p, 10));
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export const LockerRoomManager: React.FC<LockerRoomManagerProps> = ({
  sessions,
  onUpdateSessionLocker,
  onUpdateSessionField,
  lockerRooms,
  onAddLockerRoom,
  onUpdateLockerRoom,
  onDeleteLockerRoom,
  onSaveToGoogleSheet,
  isSavingToSheet,
  hasGoogleSheetConnected,
}) => {
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('Lunedì');
  const [isAddingRoom, setIsAddingRoom] = useState(false);

  // New room form state (no capacity / no posti as requested)
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomCode, setNewRoomCode] = useState('');
  const [newRoomColor, setNewRoomColor] = useState('#3B82F6');
  const [newRoomNotes, setNewRoomNotes] = useState('');

  // Sessions for the active day
  const daySessions = useMemo(() => {
    return sessions
      .filter((s) => s.day === selectedDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessions, selectedDay]);

  // Conflict Detection: check if any two sessions share the same locker room and overlap in time
  const conflicts = useMemo(() => {
    const list: {
      lockerRoom: LockerRoom;
      session1: TrainingSession;
      session2: TrainingSession;
    }[] = [];

    const roomSessionsMap = new Map<string, TrainingSession[]>();
    daySessions.forEach((s) => {
      if (!s.lockerRoomId) return;
      const arr = roomSessionsMap.get(s.lockerRoomId) || [];
      arr.push(s);
      roomSessionsMap.set(s.lockerRoomId, arr);
    });

    roomSessionsMap.forEach((sessList, roomId) => {
      const room = lockerRooms.find((r) => r.id === roomId);
      if (!room || sessList.length < 2) return;

      for (let i = 0; i < sessList.length; i++) {
        for (let j = i + 1; j < sessList.length; j++) {
          const s1 = sessList[i];
          const s2 = sessList[j];
          const start1 = timeToMinutes(s1.startTime);
          const end1 = timeToMinutes(s1.endTime);
          const start2 = timeToMinutes(s2.startTime);
          const end2 = timeToMinutes(s2.endTime);

          // Overlap condition: start1 < end2 && start2 < end1
          if (start1 < end2 && start2 < end1) {
            list.push({ lockerRoom: room, session1: s1, session2: s2 });
          }
        }
      }
    });

    return list;
  }, [daySessions, lockerRooms]);

  // Handle assign/change locker room for a session
  const handleLockerSelect = (sessionId: string, newLockerId: string) => {
    const room = lockerRooms.find((r) => r.id === newLockerId);
    if (room) {
      onUpdateSessionLocker(sessionId, room.id, room.name);
    } else {
      onUpdateSessionLocker(sessionId, '', 'Nessuno');
    }
  };

  // Submit new room
  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;

    const newRoom: LockerRoom = {
      id: `lr-${Date.now()}`,
      name: newRoomName.trim(),
      code: newRoomCode.trim() || newRoomName.substring(0, 4).toUpperCase(),
      color: newRoomColor,
      notes: newRoomNotes.trim(),
      isAvailable: true,
    };

    onAddLockerRoom(newRoom);
    setIsAddingRoom(false);
    setNewRoomName('');
    setNewRoomCode('');
    setNewRoomNotes('');
  };

  // Auto-assign suggestion: automatically assign unassigned sessions to empty locker rooms without conflicts
  const handleAutoAssign = () => {
    const assignedRoomTimes = new Map<string, { start: number; end: number }[]>();

    // Register existing assignments
    daySessions.forEach((s) => {
      if (s.lockerRoomId) {
        const arr = assignedRoomTimes.get(s.lockerRoomId) || [];
        arr.push({ start: timeToMinutes(s.startTime), end: timeToMinutes(s.endTime) });
        assignedRoomTimes.set(s.lockerRoomId, arr);
      }
    });

    // Try assigning unassigned
    daySessions.forEach((s) => {
      if (s.lockerRoomId) return; // already assigned
      const start = timeToMinutes(s.startTime);
      const end = timeToMinutes(s.endTime);

      // Find first available room with no overlap
      for (const room of lockerRooms) {
        const times = assignedRoomTimes.get(room.id) || [];
        const hasOverlap = times.some((t) => start < t.end && t.start < end);
        if (!hasOverlap) {
          onUpdateSessionLocker(s.id, room.id, room.name);
          times.push({ start, end });
          assignedRoomTimes.set(room.id, times);
          break;
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 mb-2">
            <DoorClosed size={14} /> Assegnazione Spogliatoi & Campi
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Gestione Spogliatoi ({lockerRooms.length} a disposizione) & Campi
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Assegna i 4 spogliatoi e modifica il campo di allenamento per ciascuna squadra. Rilevamento automatico di eventuali sovrapposizioni.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Print day sheet */}
          <button
            onClick={() => {
              exportTodayPlanningPdf(sessions, lockerRooms, selectedDay, 'CYNTHIA1920');
            }}
            className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white text-xs font-bold border border-teal-500/40 flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
            title={`Stampa / Scarica Foglio Allenamenti e Spogliatoi per ${selectedDay}`}
          >
            <Printer size={14} />
            <span>Stampa Foglio ({selectedDay})</span>
          </button>

          {/* Auto assign */}
          <button
            onClick={handleAutoAssign}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Assegna automaticamente gli spogliatoi liberi alle squadre non ancora assegnate"
          >
            <Sparkles size={14} className="text-amber-400" />
            Assegna Automaticamente
          </button>
        </div>
      </div>

      {/* Days Tabs */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2.5 flex items-center gap-2 overflow-x-auto scrollbar-none shadow-md">
        <span className="text-xs text-slate-400 font-semibold px-2">Giorno:</span>
        {DAYS_OF_WEEK.map((day) => {
          const isSelected = selectedDay === day;
          const count = sessions.filter((s) => s.day === day).length;
          return (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                isSelected
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700/60'
              }`}
            >
              <span>{day}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isSelected ? 'bg-blue-800/80 text-white' : 'bg-slate-700 text-slate-400'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Conflict Alert Banner */}
      {conflicts.length > 0 && (
        <div className="bg-rose-950/40 border border-rose-600/50 rounded-2xl p-4 sm:p-5 text-rose-200 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-rose-600 text-white rounded-xl shrink-0">
              <ShieldAlert size={20} />
            </div>
            <div className="flex-1">
              <h3 className="font-extrabold text-sm sm:text-base text-white flex items-center gap-2">
                Attenzione: Rilevati {conflicts.length} Conflitti di Spogliatoio ({selectedDay})
              </h3>
              <p className="text-xs text-rose-300/90 mt-0.5">
                Due o più squadre sono state assegnate allo stesso spogliatoio negli stessi orari.
                Modifica l'assegnazione per evitare sovrapposizioni.
              </p>

              <div className="mt-3 space-y-2">
                {conflicts.map((c, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-900/90 border border-rose-800/60 rounded-xl p-3 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: c.lockerRoom.color }}
                      />
                      <span>{c.lockerRoom.name}:</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-300">
                      <span className="text-emerald-400 font-semibold">{c.session1.team}</span>
                      <span className="text-slate-500 font-mono">
                        ({c.session1.startTime} - {c.session1.endTime})
                      </span>
                      <span className="text-rose-400 font-bold">SOVRAPPOSTO A</span>
                      <span className="text-blue-400 font-semibold">{c.session2.team}</span>
                      <span className="text-slate-500 font-mono">
                        ({c.session2.startTime} - {c.session2.endTime})
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Datalist for Pitch suggestions */}
      <datalist id="fields-datalist">
        <option value="Via Sardegna" />
        <option value="Monte Due Torri" />
      </datalist>

      {/* Main Assignment Table: Teams, Fields & Locker Rooms for the selected day */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Calendar size={18} className="text-blue-400" />
              Tabella Orari, Campo e Spogliatoi ({selectedDay})
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Puoi modificare direttamente sia il <strong>Campo di gioco</strong> che lo <strong>Spogliatoio assegnato</strong>.
            </p>
          </div>
          <span className="text-xs bg-slate-800 text-slate-300 font-medium px-2.5 py-1 rounded-lg border border-slate-700 self-start sm:self-auto">
            {daySessions.length} squadre in programma
          </span>
        </div>

        {daySessions.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            Nessun allenamento programmato per {selectedDay}.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-850 text-slate-400 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Orario</th>
                  <th className="py-3 px-4">Squadra / Categoria</th>
                  <th className="py-3 px-4">
                    <span className="flex items-center gap-1.5 text-blue-300">
                      <MapPin size={13} />
                      Campo di Gioco (Modificabile)
                    </span>
                  </th>
                  <th className="py-3 px-4">Spogliatoio Assegnato (1-4)</th>
                  <th className="py-3 px-4">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {daySessions.map((session) => {
                  const currentRoom = lockerRooms.find((r) => r.id === session.lockerRoomId);
                  const isConflict = conflicts.some(
                    (c) => c.session1.id === session.id || c.session2.id === session.id
                  );
                  const currentField = session.field || 'Via Sardegna';

                  return (
                    <tr
                      key={session.id}
                      className={`hover:bg-slate-800/50 transition-colors ${
                        isConflict ? 'bg-rose-950/20' : ''
                      }`}
                    >
                      {/* Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono font-bold text-xs bg-slate-800 text-emerald-400 border border-emerald-500/20">
                          <Clock size={12} />
                          {session.startTime} - {session.endTime}
                        </span>
                      </td>

                      {/* Team */}
                      <td className="py-3.5 px-4 font-bold text-white whitespace-nowrap">
                        {session.team}
                        {session.coach && (
                          <div className="text-[11px] font-normal text-slate-400">
                            {session.coach}
                          </div>
                        )}
                      </td>

                      {/* Field (Directly Editable with Suggestions) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            list="fields-datalist"
                            value={currentField}
                            onChange={(e) => onUpdateSessionField(session.id, e.target.value)}
                            placeholder="es. Via Sardegna"
                            className="bg-slate-800 hover:bg-slate-750 focus:bg-slate-800 border border-slate-700 focus:border-blue-500 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:ring-1 focus:ring-blue-500 transition-colors w-36 sm:w-44"
                          />
                          {/* Quick switch shortcuts */}
                          {currentField !== 'Via Sardegna' && (
                            <button
                              type="button"
                              onClick={() => onUpdateSessionField(session.id, 'Via Sardegna')}
                              title="Imposta a Via Sardegna"
                              className="text-[10px] px-1.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors"
                            >
                              Via Sardegna
                            </button>
                          )}
                          {currentField !== 'Monte Due Torri' && (
                            <button
                              type="button"
                              onClick={() => onUpdateSessionField(session.id, 'Monte Due Torri')}
                              title="Imposta a Monte Due Torri"
                              className="text-[10px] px-1.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition-colors"
                            >
                              M. Due Torri
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Locker Room Selector (Spogliatoi 1-4) */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <select
                            value={session.lockerRoomId || ''}
                            onChange={(e) => handleLockerSelect(session.id, e.target.value)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 border transition-all cursor-pointer ${
                              isConflict
                                ? 'border-rose-500 text-rose-300 ring-2 ring-rose-500/30'
                                : currentRoom
                                ? 'border-slate-700 text-white'
                                : 'border-amber-500/50 text-amber-300'
                            }`}
                          >
                            <option value="">-- Non Assegnato --</option>
                            {lockerRooms.map((room) => (
                              <option key={room.id} value={room.id}>
                                {room.name}
                              </option>
                            ))}
                          </select>

                          {currentRoom && (
                            <span
                              className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: currentRoom.color }}
                              title={currentRoom.name}
                            />
                          )}
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {session.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4 Locker Rooms Overview Cards */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <DoorClosed size={18} className="text-emerald-400" />
            Stato e Occupazione dei 4 Spogliatoi ({selectedDay})
          </h3>
          <span className="text-xs text-slate-400">
            {lockerRooms.length} spogliatoi totali
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {lockerRooms.map((room) => {
            const assigned = daySessions.filter((s) => s.lockerRoomId === room.id);
            const isBusy = assigned.length > 0;

            return (
              <div
                key={room.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between"
              >
                {/* Color header line */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: room.color }}
                />

                <div>
                  <div className="flex items-start justify-between gap-2 mb-2 pt-1">
                    <div>
                      <h4 className="font-black text-white text-base flex items-center gap-1.5">
                        {room.name}
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {room.code}
                      </span>
                    </div>

                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isBusy
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {isBusy ? `${assigned.length} squadre` : 'Libero'}
                    </span>
                  </div>

                  {room.notes && (
                    <p className="text-xs text-slate-400 mb-3">{room.notes}</p>
                  )}

                  {/* Assigned sessions timeline */}
                  <div className="space-y-1.5 pt-1">
                    {assigned.length === 0 ? (
                      <div className="text-[11px] text-slate-500 italic py-2">
                        Nessuna squadra programmata oggi in questo spogliatoio.
                      </div>
                    ) : (
                      assigned.map((s) => (
                        <div
                          key={s.id}
                          className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-400 font-bold">
                            <span>{s.startTime} - {s.endTime}</span>
                            <span className="text-[10px] text-slate-400 font-normal truncate max-w-[80px]">
                              {s.field || 'Via Sardegna'}
                            </span>
                          </div>
                          <div className="font-bold text-white text-xs truncate mt-0.5">{s.team}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Disponibile per la struttura</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
