import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  Calendar,
  DoorClosed,
  Maximize2,
  Minimize2,
  Activity,
  MapPin,
  ChevronRight,
  Flame,
} from 'lucide-react';
import { TrainingSession, LockerRoom, DayOfWeek, DAYS_OF_WEEK } from '../types';

interface LiveBoardProps {
  sessions: TrainingSession[];
  lockerRooms: LockerRoom[];
}

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(':').map((p) => parseInt(p, 10));
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

export const LiveBoard: React.FC<LiveBoardProps> = ({ sessions, lockerRooms }) => {
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [currentMinutes, setCurrentMinutes] = useState<number>(0);
  const [todayName, setTodayName] = useState<DayOfWeek>('Lunedì');
  const [selectedDayOverride, setSelectedDayOverride] = useState<DayOfWeek | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Update real-time clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setCurrentTimeStr(now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      const mins = now.getHours() * 60 + now.getMinutes();
      setCurrentMinutes(mins);

      const days: DayOfWeek[] = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];
      setTodayName(days[now.getDay()]);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeDay = selectedDayOverride || todayName;

  // Day sessions sorted
  const activeDaySessions = useMemo(() => {
    return sessions
      .filter((s) => s.day === activeDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessions, activeDay]);

  // Current active sessions in locker room / on field right now
  const currentOngoingSessions = useMemo(() => {
    return activeDaySessions.filter((s) => {
      const start = timeToMinutes(s.startTime);
      const end = timeToMinutes(s.endTime);
      // Considered ongoing if current time is between start and end (with 15 min locker access before start)
      return currentMinutes >= (start - 15) && currentMinutes <= end;
    });
  }, [activeDaySessions, currentMinutes]);

  // Upcoming sessions today (starting later than current time)
  const upcomingSessions = useMemo(() => {
    return activeDaySessions.filter((s) => {
      const start = timeToMinutes(s.startTime);
      return start > currentMinutes;
    });
  }, [activeDaySessions, currentMinutes]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const lockerRoomsMap = useMemo(() => {
    const map = new Map<string, LockerRoom>();
    lockerRooms.forEach((lr) => map.set(lr.id, lr));
    return map;
  }, [lockerRooms]);

  return (
    <div className={`space-y-6 ${isFullscreen ? 'p-6 bg-slate-950 text-white min-h-screen' : ''}`}>
      {/* Top TV Header Bar */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 border border-purple-800/40 rounded-3xl p-6 shadow-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 bg-gradient-to-tr from-cyan-400 via-sky-300 to-blue-500 shadow-xl shadow-cyan-500/30 shrink-0 overflow-hidden">
            <img
              src="/cynthia1920_logo.jpg"
              alt="CYNTHIA1920"
              className="w-full h-full object-cover rounded-full bg-slate-900"
              referrerPolicy="no-referrer"
            />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-black tracking-widest uppercase text-cyan-400">
                Live Club Monitor • CYNTHIA1920
              </span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight flex items-center gap-3">
              <span>Tabellone Campo & Spogliatoi</span>
            </h2>
            <p className="text-xs sm:text-sm text-purple-200/80 mt-1">
              Display ad alta visibilità per atleti, genitori e custode impianto.
            </p>
          </div>
        </div>

        {/* Big Digital Clock & Fullscreen toggle */}
        <div className="flex items-center gap-4">
          <div className="bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-purple-500/30 text-right">
            <div className="text-xs text-purple-300 font-bold uppercase tracking-wider">
              {activeDay} • {new Date().toLocaleDateString('it-IT')}
            </div>
            <div className="text-2xl sm:text-4xl font-black font-mono text-emerald-400 tracking-tight">
              {currentTimeStr || '17:30:00'}
            </div>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors shadow-lg cursor-pointer"
            title="Schermo Intero per TV / Monitor segreteria"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
        </div>
      </div>

      {/* Day Selector for Live Board test / view */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-xs text-slate-400 font-semibold mr-2 shrink-0">Visualizza Giorno:</span>
        {DAYS_OF_WEEK.map((d) => {
          const isSelected = activeDay === d;
          const isRealToday = todayName === d;
          return (
            <button
              key={d}
              onClick={() => setSelectedDayOverride(d)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isSelected
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {d} {isRealToday && '(Oggi)'}
            </button>
          );
        })}
      </div>

      {/* Live Status Cards: Ongoing Right Now & Next Up */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ongoing / In Corso (Left 7 cols) */}
        <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2.5">
                <span className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/40">
                  <Activity size={18} />
                </span>
                IN CORSO ADESSO ({activeDay})
              </h3>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/30">
                {currentOngoingSessions.length} Attivi
              </span>
            </div>

            {currentOngoingSessions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <DoorClosed size={48} className="mx-auto opacity-30" />
                <div className="text-base font-bold text-slate-400">
                  Nessuna squadra attualmente in spogliatoio o in campo.
                </div>
                <div className="text-xs text-slate-500">
                  I prossimi allenamenti programmati sono elencati nel riquadro a fianco.
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {currentOngoingSessions.map((session) => {
                  const locker = session.lockerRoomId
                    ? lockerRoomsMap.get(session.lockerRoomId)
                    : null;
                  const lockerName = locker?.name || session.lockerRoomName || 'Spogliatoio da assegnare';
                  const lockerColor = locker?.color || '#3B82F6';

                  return (
                    <div
                      key={session.id}
                      className="bg-slate-850 border-2 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md transition-transform hover:scale-[1.01]"
                      style={{ borderColor: `${lockerColor}80` }}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded text-[11px] font-black bg-emerald-500 text-slate-950 uppercase animate-pulse">
                            IN ATTIVITÀ
                          </span>
                          <span className="font-mono text-xs text-emerald-400 font-bold">
                            {session.startTime} - {session.endTime}
                          </span>
                        </div>
                        <h4 className="text-lg font-black text-white">{session.team}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-300">
                          <MapPin size={13} className="text-blue-400" />
                          <span>{session.field || 'Via Sardegna'}</span>
                          {session.coach && <span className="text-slate-500">• {session.coach}</span>}
                        </div>
                      </div>

                      {/* Prominent Locker Room Tag */}
                      <div
                        className="px-4 py-3 rounded-xl flex items-center gap-3 shrink-0 text-white font-black text-base shadow-lg"
                        style={{ backgroundColor: lockerColor }}
                      >
                        <DoorClosed size={22} />
                        <div>
                          <div className="text-[10px] uppercase font-bold text-white/80 tracking-wider">
                            Spogliatoio
                          </div>
                          <div className="text-base tracking-tight leading-none">{lockerName}</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-500 flex items-center justify-between">
            <span>Aggiornato automaticamente in tempo reale</span>
            <span className="font-mono">{activeDay}</span>
          </div>
        </div>

        {/* Next Up / Prossimo Turno (Right 5 cols) */}
        <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2.5">
                <span className="p-1.5 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-500/40">
                  <Clock size={18} />
                </span>
                PROSSIMI TURNI ({activeDay})
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                {upcomingSessions.length} in arrivo
              </span>
            </div>

            {upcomingSessions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 space-y-2">
                <div className="text-base font-bold text-slate-400">
                  Nessun altro allenamento programmato per la giornata.
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                {upcomingSessions.map((session) => {
                  const locker = session.lockerRoomId
                    ? lockerRoomsMap.get(session.lockerRoomId)
                    : null;
                  const lockerName = locker?.name || session.lockerRoomName || 'Da assegnare';
                  const lockerColor = locker?.color || '#3B82F6';

                  return (
                    <div
                      key={session.id}
                      className="bg-slate-850 hover:bg-slate-800 border border-slate-700/60 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="overflow-hidden">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-800 text-blue-400 border border-blue-500/30 mb-1">
                          {session.startTime} - {session.endTime}
                        </span>
                        <h5 className="font-bold text-white text-sm truncate">{session.team}</h5>
                        <p className="text-[11px] text-slate-400 truncate">{session.field}</p>
                      </div>

                      <div
                        className="px-3 py-1.5 rounded-lg text-xs font-black text-white shrink-0 flex items-center gap-1.5 shadow-sm"
                        style={{ backgroundColor: lockerColor }}
                      >
                        <DoorClosed size={14} />
                        <span>{lockerName}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400">
            💡 <span className="text-slate-300 font-medium">Nota per gli atleti:</span> Lo spogliatoio è
            accessibile 15 minuti prima dell'inizio dell'allenamento.
          </div>
        </div>
      </div>

      {/* Full Day Overview Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
        <h3 className="text-base font-black text-white mb-4 flex items-center gap-2">
          <Calendar size={18} className="text-purple-400" />
          Riepilogo Orari e Spogliatoi della Giornata ({activeDay})
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-850 text-slate-400 text-xs uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Orario</th>
                <th className="py-3 px-4">Squadra</th>
                <th className="py-3 px-4">Campo</th>
                <th className="py-3 px-4">Spogliatoio</th>
                <th className="py-3 px-4">Stato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {activeDaySessions.map((session) => {
                const locker = session.lockerRoomId
                  ? lockerRoomsMap.get(session.lockerRoomId)
                  : null;
                const lockerName = locker?.name || session.lockerRoomName || 'Da assegnare';
                const startMins = timeToMinutes(session.startTime);
                const endMins = timeToMinutes(session.endTime);
                const isOngoing = currentMinutes >= startMins - 15 && currentMinutes <= endMins;
                const isFinished = currentMinutes > endMins;

                return (
                  <tr
                    key={session.id}
                    className={`hover:bg-slate-800/60 ${isOngoing ? 'bg-emerald-950/20' : ''}`}
                  >
                    <td className="py-3 px-4 font-mono font-bold text-xs text-emerald-400 whitespace-nowrap">
                      {session.startTime} - {session.endTime}
                    </td>
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                      {session.team}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300 whitespace-nowrap">
                      {session.field || 'Via Sardegna'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-white shadow-xs"
                        style={{ backgroundColor: locker?.color || '#3B82F6' }}
                      >
                        <DoorClosed size={13} />
                        {lockerName}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {isOngoing ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                          IN CORSO
                        </span>
                      ) : isFinished ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400">
                          Terminato
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          Programmato
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
