import React, { useState, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  DoorClosed,
  Share2,
  CalendarPlus,
  Search,
  Filter,
  Info,
  CheckCircle2,
  Printer,
  ChevronRight,
  Shield,
} from 'lucide-react';
import { TrainingSession, LockerRoom, DayOfWeek, DAYS_OF_WEEK } from '../types';
import { exportWeeklyPlanningPdf, exportTodayPlanningPdf } from '../services/pdfExport';

interface ParentsViewProps {
  sessions: TrainingSession[];
  lockerRooms: LockerRoom[];
  selectedTeam: string;
  onSelectTeam: (team: string) => void;
  availableTeams: string[];
  onSwitchToToday?: () => void;
}

function getSessionLiveStatus(startTime: string, endTime: string, currentMins: number) {
  const partsStart = (startTime || '').split(':').map((p) => parseInt(p, 10));
  const start = (partsStart[0] || 0) * 60 + (partsStart[1] || 0);
  const partsEnd = (endTime || '').split(':').map((p) => parseInt(p, 10));
  const end = (partsEnd[0] || 0) * 60 + (partsEnd[1] || 0);

  if (currentMins >= start - 15 && currentMins <= end) {
    return {
      label: 'IN CORSO ADESSO',
      badgeClass: 'bg-emerald-500 text-slate-950 font-black animate-pulse shadow-sm',
      isLive: true,
    };
  }
  if (currentMins < start && start - currentMins <= 45) {
    return {
      label: `TRA POCO (${start - currentMins} min)`,
      badgeClass: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold',
      isSoon: true,
    };
  }
  if (currentMins > end) {
    return {
      label: 'TERMINATO',
      badgeClass: 'bg-slate-800 text-slate-500 border border-slate-700 font-medium',
      isFinished: true,
    };
  }
  return {
    label: 'PROGRAMMATO',
    badgeClass: 'bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold',
    isScheduled: true,
  };
}

export const ParentsView: React.FC<ParentsViewProps> = ({
  sessions,
  lockerRooms,
  selectedTeam,
  onSelectTeam,
  availableTeams,
  onSwitchToToday,
}) => {
  // Current real day
  const todayItalianDay = useMemo<DayOfWeek>(() => {
    const days: DayOfWeek[] = [
      'Domenica',
      'Lunedì',
      'Martedì',
      'Mercoledì',
      'Giovedì',
      'Venerdì',
      'Sabato',
    ];
    return days[new Date().getDay()];
  }, []);

  // 'TODAY' is the default view as requested!
  const [activeDayFilter, setActiveDayFilter] = useState<string>('TODAY');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  // Keep live time updated for session status badges
  React.useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // Map locker room id to LockerRoom object
  const lockerRoomsMap = useMemo(() => {
    const map = new Map<string, LockerRoom>();
    lockerRooms.forEach((lr) => map.set(lr.id, lr));
    return map;
  }, [lockerRooms]);

  // Target day for filtering: either today's day name, or specific day, or ALL
  const isTodayMode = activeDayFilter === 'TODAY';
  const effectiveDayTarget = isTodayMode ? todayItalianDay : activeDayFilter;

  // Filter sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // Team filter
      if (selectedTeam && s.team !== selectedTeam) {
        return false;
      }
      // Day filter (handles 'TODAY', 'ALL', or specific DayOfWeek)
      if (activeDayFilter === 'TODAY') {
        if (s.day !== todayItalianDay) return false;
      } else if (activeDayFilter !== 'ALL') {
        if (s.day !== activeDayFilter) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTeam = s.team.toLowerCase().includes(q);
        const matchesField = (s.field || '').toLowerCase().includes(q);
        const matchesCoach = (s.coach || '').toLowerCase().includes(q);
        const matchesNotes = (s.notes || '').toLowerCase().includes(q);
        const matchesLocker = (s.lockerRoomName || '').toLowerCase().includes(q);
        if (!matchesTeam && !matchesField && !matchesCoach && !matchesNotes && !matchesLocker) {
          return false;
        }
      }
      return true;
    });
  }, [sessions, selectedTeam, activeDayFilter, todayItalianDay, searchQuery]);

  // Today sessions total count (unfiltered by search/team to show in stats)
  const todayTotalCount = useMemo(() => {
    return sessions.filter((s) => s.day === todayItalianDay).length;
  }, [sessions, todayItalianDay]);

  // Group filtered sessions by day for nice visual structure
  const sessionsByDay = useMemo(() => {
    const groups: { [day: string]: TrainingSession[] } = {};
    DAYS_OF_WEEK.forEach((day) => {
      groups[day] = [];
    });

    filteredSessions.forEach((s) => {
      if (groups[s.day]) {
        groups[s.day].push(s);
      }
    });

    // Sort within day by startTime
    Object.keys(groups).forEach((d) => {
      groups[d].sort((a, b) => a.startTime.localeCompare(b.startTime));
    });

    return groups;
  }, [filteredSessions]);

  // Next session for the selected team
  const nextSessionForTeam = useMemo(() => {
    if (!selectedTeam) return null;
    const teamSessions = sessions.filter((s) => s.team === selectedTeam);
    if (teamSessions.length === 0) return null;

    // Check if there is one today, or in upcoming days
    const dayOrder = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
    const currentIdx = dayOrder.indexOf(todayItalianDay);

    for (let offset = 0; offset < 7; offset++) {
      const checkDay = dayOrder[(currentIdx + offset) % 7];
      const found = teamSessions.find((s) => s.day === checkDay);
      if (found) {
        return {
          session: found,
          isToday: offset === 0,
          dayText: offset === 0 ? 'Oggi' : offset === 1 ? 'Domani' : found.day,
        };
      }
    }
    return { session: teamSessions[0], isToday: false, dayText: teamSessions[0].day };
  }, [sessions, selectedTeam, todayItalianDay]);

  // Helper to share on WhatsApp
  const handleShareWhatsApp = (session: TrainingSession) => {
    const locker = session.lockerRoomId ? lockerRoomsMap.get(session.lockerRoomId) : null;
    const lockerText = locker ? `${locker.name} (${locker.notes || 'In spogliatoio'})` : (session.lockerRoomName || 'Da definire');

    const text = `⚽ *CYNTHIA1920 - Planning Allenamento*\n` +
      `📌 *Squadra:* ${session.team}\n` +
      `📅 *Giorno:* ${session.day}\n` +
      `⏰ *Orario:* ${session.startTime} - ${session.endTime}\n` +
      `📍 *Campo:* ${session.field || 'Via Sardegna'}\n` +
      `🚪 *Spogliatoio Assegnato:* ${lockerText}\n` +
      (session.coach ? `👤 *Istruttore:* ${session.coach}\n` : '') +
      `\nSi raccomanda la massima puntualità. Forza CYNTHIA1920!`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Helper to add to Google Calendar
  const handleAddToCalendar = (session: TrainingSession) => {
    const title = encodeURIComponent(`Allenamento ${session.team} - CYNTHIA1920`);
    const details = encodeURIComponent(
      `Allenamento CYNTHIA1920\nCampo: ${session.field || 'Via Sardegna'}\nSpogliatoio: ${session.lockerRoomName || 'Assegnato in segreteria'}\nMister: ${session.coach || '-'}`
    );
    const location = encodeURIComponent(`CYNTHIA1920 - ${session.field || 'Via Sardegna'}`);

    // Generate google calendar URL (recurrent weekly template)
    const calUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    window.open(calUrl, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 border border-emerald-700/40 p-6 sm:p-8 shadow-xl text-white">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-500/30">
            <Shield size={14} /> Portale Ufficiale Atleti & Genitori
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2">
            Planning Settimanale & Spogliatoi
          </h1>
          <p className="text-emerald-100/80 text-sm sm:text-base leading-relaxed">
            Consulta in tempo reale gli orari ufficiali di allenamento, il campo assegnato e lo
            spogliatoio per ogni categoria.
          </p>
        </div>

        {/* Decorative background soccer pitch line */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 border-8 border-emerald-500/10 rounded-full pointer-events-none" />
        <div className="absolute right-24 top-0 w-32 h-32 border border-emerald-400/10 rounded-full pointer-events-none" />
      </div>

      {/* Filter and Team Selector Bar */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Team Dropdown */}
          <div className="md:col-span-6 lg:col-span-5">
            <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter size={13} />
              Seleziona la tua Squadra / Leva
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => onSelectTeam(e.target.value)}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            >
              <option value="">-- Tutte le Categorie & Squadre --</option>
              {availableTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Search */}
          <div className="md:col-span-6 lg:col-span-4">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search size={13} />
              Cerca per mister, campo o spogliatoio
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="es. Sintetico, Mister Rossi, Spogliatoio 2..."
                className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl pl-9 pr-3.5 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs bg-slate-700 text-slate-300 hover:text-white px-1.5 py-0.5 rounded"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Action buttons (Switch to Today + Print) */}
          <div className="md:col-span-12 lg:col-span-3 flex items-end justify-start lg:justify-end gap-2">
            {onSwitchToToday && (
              <button
                onClick={onSwitchToToday}
                className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-bold border border-emerald-500/30 transition-all cursor-pointer shadow-xs"
              >
                <span>⭐ Vista Oggi</span>
              </button>
            )}
            <button
              onClick={() => {
                if (isTodayMode || activeDayFilter !== 'ALL') {
                  exportTodayPlanningPdf(
                    sessions,
                    lockerRooms,
                    isTodayMode ? todayItalianDay : (activeDayFilter as DayOfWeek),
                    'CYNTHIA1920'
                  );
                } else {
                  exportWeeklyPlanningPdf(sessions, lockerRooms, 'CYNTHIA1920');
                }
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
              title="Esporta e stampa il documento PDF ufficiale"
            >
              <Printer size={15} />
              <span>Stampa (PDF)</span>
            </button>
          </div>
        </div>

        {/* Day Filter Pills */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-slate-400 font-semibold mr-1 shrink-0">Vista:</span>

          {/* 1. OGGI Pill (Default & Highlighted) */}
          <button
            onClick={() => setActiveDayFilter('TODAY')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5 cursor-pointer shadow-sm ${
              isTodayMode
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 ring-2 ring-emerald-400/50 shadow-emerald-500/20'
                : 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60'
            }`}
          >
            <span>⭐ OGGI ({todayItalianDay})</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${isTodayMode ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
              {todayTotalCount}
            </span>
          </button>

          {/* 2. Tutta la Settimana */}
          <button
            onClick={() => setActiveDayFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer ${
              activeDayFilter === 'ALL'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700/60'
            }`}
          >
            Tutta la Settimana
          </button>

          {/* 3. Individual Day Pills */}
          {DAYS_OF_WEEK.map((day) => {
            const isToday = day === todayItalianDay;
            const isSelected = activeDayFilter === day;
            return (
              <button
                key={day}
                onClick={() => setActiveDayFilter(day)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : isToday
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/40 hover:bg-slate-700'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <span>{day}</span>
                {isToday && (
                  <span className="px-1 py-0.2 text-[9px] bg-emerald-500/20 text-emerald-300 rounded font-bold">
                    Oggi
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dedicated Today Hero Highlight when activeDayFilter === 'TODAY' */}
      {isTodayMode && (
        <div className="bg-gradient-to-r from-emerald-950 via-slate-900 to-teal-950 border border-emerald-500/40 rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-black tracking-widest uppercase text-emerald-400">
                Visualizzazione Predefinita • Giornata Odierna
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Oggi in Campo: {todayItalianDay}</span>
              <span className="text-xs font-normal text-slate-400">
                ({new Date().toLocaleDateString('it-IT')})
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-emerald-200/80">
              {todayTotalCount > 0 ? (
                <>
                  Ci sono <strong>{todayTotalCount} sessioni di allenamento</strong> in programma oggi. Verifica orario, campo (Via Sardegna) e spogliatoi 1-4 assegnati.
                </>
              ) : (
                <>Nessun allenamento programmato per oggi. Puoi visualizzare gli altri giorni dal selettore o mostrare tutta la settimana.</>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveDayFilter('ALL')}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <span>Vedi Tutta la Settimana</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Selected Team Highlight Card */}
      {selectedTeam && nextSessionForTeam && (
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-emerald-500/40 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 text-xs font-bold bg-emerald-500/20 text-emerald-400 rounded-md border border-emerald-500/30">
                  {nextSessionForTeam.dayText}
                </span>
                <span className="text-xs text-slate-400 font-medium">Prossimo appuntamento per:</span>
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
                ⚽ {selectedTeam}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 pt-1">
                <span className="flex items-center gap-1.5 font-semibold text-emerald-300">
                  <Clock size={14} />
                  {nextSessionForTeam.session.startTime} - {nextSessionForTeam.session.endTime}
                </span>
                <span className="flex items-center gap-1.5 text-slate-300">
                  <MapPin size={14} className="text-blue-400" />
                  {nextSessionForTeam.session.field || 'Campo da gioco'}
                </span>
                <span className="flex items-center gap-1.5 font-bold text-amber-300">
                  <DoorClosed size={14} className="text-amber-400" />
                  {nextSessionForTeam.session.lockerRoomName || 'Spogliatoio in assegnazione'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              <button
                onClick={() => handleShareWhatsApp(nextSessionForTeam.session)}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
              >
                <Share2 size={14} />
                Invia su WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Schedule Display */}
      {filteredSessions.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
          <CalendarIcon size={40} className="mx-auto text-slate-600 mb-3" />
          <h3 className="text-lg font-bold text-slate-200 mb-1">Nessun allenamento trovato</h3>
          <p className="text-sm max-w-md mx-auto">
            Non ci sono sessioni di allenamento con i filtri selezionati. Prova a selezionare un altro
            giorno o rimuovi la ricerca.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {DAYS_OF_WEEK.map((day) => {
            const daySessions = sessionsByDay[day] || [];
            const isDayMatch = activeDayFilter === 'ALL' || (activeDayFilter === 'TODAY' ? day === todayItalianDay : activeDayFilter === day);
            if (!isDayMatch) return null;
            if (daySessions.length === 0) return null;

            const isToday = day === todayItalianDay;

            return (
              <div
                key={day}
                className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-md"
              >
                {/* Day Header */}
                <div
                  className={`px-5 py-3.5 flex items-center justify-between border-b ${
                    isToday
                      ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                      : 'bg-slate-850 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <h3 className="font-extrabold text-base tracking-tight text-white flex items-center gap-2">
                      <CalendarIcon size={18} className={isToday ? 'text-emerald-400' : 'text-slate-400'} />
                      {day}
                    </h3>
                    {isToday && (
                      <span className="px-2 py-0.5 text-xs font-extrabold bg-emerald-500 text-slate-950 rounded-full animate-pulse">
                        OGGI
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {daySessions.length} {daySessions.length === 1 ? 'allenamento' : 'allenamenti'}
                  </span>
                </div>

                {/* Sessions Cards Grid */}
                <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {daySessions.map((session) => {
                    const locker = session.lockerRoomId
                      ? lockerRoomsMap.get(session.lockerRoomId)
                      : null;
                    const lockerName = locker?.name || session.lockerRoomName || 'Da assegnare';
                    const lockerColor = locker?.color || '#3B82F6';

                    return (
                      <div
                        key={session.id}
                        className="bg-slate-850 hover:bg-slate-800/90 border border-slate-700/60 rounded-xl p-4 transition-all hover:border-slate-600 shadow-sm flex flex-col justify-between group"
                      >
                        <div>
                          {/* Top: Time badge & Duration */}
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-800 text-emerald-400 border border-emerald-500/30">
                              <Clock size={13} />
                              {session.startTime} - {session.endTime}
                            </span>
                            {session.notes && (
                              <span className="text-[10px] text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 truncate max-w-[120px]" title={session.notes}>
                                {session.notes}
                              </span>
                            )}
                          </div>

                          {/* Team Name */}
                          <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors mb-2">
                            {session.team}
                          </h4>

                          {/* Field */}
                          <div className="flex items-center gap-2 text-xs text-slate-300 mb-2">
                            <MapPin size={14} className="text-blue-400 shrink-0" />
                            <span className="truncate">{session.field || 'Via Sardegna'}</span>
                          </div>

                          {/* Coach */}
                          {session.coach && (
                            <div className="text-xs text-slate-400 mb-3">
                              <span className="text-slate-500">Istruttore:</span> {session.coach}
                            </div>
                          )}

                          {/* Locker Room Badge (Very prominent as requested) */}
                          <div
                            className="mt-2 p-2.5 rounded-xl border flex items-center justify-between gap-2"
                            style={{
                              backgroundColor: `${lockerColor}15`,
                              borderColor: `${lockerColor}40`,
                            }}
                          >
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-xs"
                                style={{ backgroundColor: lockerColor }}
                              >
                                <DoorClosed size={16} />
                              </div>
                              <div className="truncate">
                                <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                                  Spogliatoio
                                </div>
                                <div
                                  className="text-xs font-extrabold truncate"
                                  style={{ color: lockerColor }}
                                >
                                  {lockerName}
                                </div>
                              </div>
                            </div>

                            {locker?.notes && (
                              <span className="text-[10px] text-slate-400 max-w-[100px] text-right truncate">
                                {locker.notes}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Bottom Actions for Parents/Athletes */}
                        <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => handleShareWhatsApp(session)}
                            title="Condividi dettagli su WhatsApp per i genitori"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white text-xs font-semibold transition-all border border-emerald-500/30 cursor-pointer"
                          >
                            <Share2 size={13} />
                            WhatsApp
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAddToCalendar(session)}
                            title="Aggiungi a Google Calendar"
                            className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-all border border-slate-700 cursor-pointer"
                          >
                            <CalendarPlus size={13} />
                            Calendario
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
