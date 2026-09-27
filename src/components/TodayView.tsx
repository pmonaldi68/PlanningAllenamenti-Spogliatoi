import React, { useState, useMemo, useEffect } from 'react';
import {
  Clock,
  MapPin,
  DoorClosed,
  Share2,
  CalendarPlus,
  Search,
  Filter,
  CheckCircle2,
  Printer,
  ChevronRight,
  Shield,
  Sparkles,
  Calendar,
  AlertCircle,
  Users,
  Compass,
} from 'lucide-react';
import { TrainingSession, LockerRoom, DayOfWeek, DAYS_OF_WEEK } from '../types';
import { exportTodayPlanningPdf } from '../services/pdfExport';

interface TodayViewProps {
  sessions: TrainingSession[];
  lockerRooms: LockerRoom[];
  selectedTeam: string;
  onSelectTeam: (team: string) => void;
  availableTeams: string[];
  onSwitchToWeekly: () => void;
}

function getLiveStatus(startTime: string, endTime: string, currentMins: number) {
  const partsStart = (startTime || '').split(':').map((p) => parseInt(p, 10));
  const start = (partsStart[0] || 0) * 60 + (partsStart[1] || 0);
  const partsEnd = (endTime || '').split(':').map((p) => parseInt(p, 10));
  const end = (partsEnd[0] || 0) * 60 + (partsEnd[1] || 0);

  if (currentMins >= start - 15 && currentMins <= end) {
    return {
      status: 'live',
      label: 'IN CORSO ADESSO',
      badgeClass: 'bg-emerald-500 text-slate-950 font-black animate-pulse shadow-md shadow-emerald-500/20',
      dotClass: 'bg-slate-950 animate-ping',
    };
  }
  if (currentMins < start && start - currentMins <= 45) {
    return {
      status: 'soon',
      label: `INIZIA TRA ${start - currentMins} MIN`,
      badgeClass: 'bg-amber-400 text-slate-950 font-extrabold shadow-sm',
      dotClass: 'bg-slate-950',
    };
  }
  if (currentMins > end) {
    return {
      status: 'finished',
      label: 'TERMINATO',
      badgeClass: 'bg-slate-800 text-slate-400 border border-slate-700 font-semibold',
      dotClass: 'bg-slate-600',
    };
  }
  return {
    status: 'scheduled',
    label: 'PROGRAMMATO',
    badgeClass: 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold',
    dotClass: 'bg-blue-400',
  };
}

export const TodayView: React.FC<TodayViewProps> = ({
  sessions,
  lockerRooms,
  selectedTeam,
  onSelectTeam,
  availableTeams,
  onSwitchToWeekly,
}) => {
  // Determine real today in Italian
  const realTodayItalianDay = useMemo<DayOfWeek>(() => {
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

  // Allow previewing another day if today has no trainings (e.g. on weekends or for testing)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>(realTodayItalianDay);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTimeMinutes, setCurrentTimeMinutes] = useState<number>(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });
  const [liveClockString, setLiveClockString] = useState<string>('');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [pdfSuccess, setPdfSuccess] = useState(false);

  const handlePrintTodaySheet = () => {
    setIsExportingPdf(true);
    try {
      exportTodayPlanningPdf(sessions, lockerRooms, selectedDay, 'CYNTHIA1920');
      setPdfSuccess(true);
      setTimeout(() => setPdfSuccess(false), 3500);
    } catch (err) {
      console.error('Error generating Today PDF:', err);
    } finally {
      setTimeout(() => setIsExportingPdf(false), 800);
    }
  };

  // Keep live time updated
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTimeMinutes(now.getHours() * 60 + now.getMinutes());
      setLiveClockString(now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  // Locker room lookup map
  const lockerRoomsMap = useMemo(() => {
    const map = new Map<string, LockerRoom>();
    lockerRooms.forEach((lr) => map.set(lr.id, lr));
    return map;
  }, [lockerRooms]);

  // Check how many sessions exist for the real today
  const realTodaySessionsCount = useMemo(() => {
    return sessions.filter((s) => s.day === realTodayItalianDay).length;
  }, [sessions, realTodayItalianDay]);

  // Target day we are viewing
  const isViewingRealToday = selectedDay === realTodayItalianDay;

  // Filter sessions strictly for this day
  const todaySessions = useMemo(() => {
    return sessions
      .filter((s) => s.day === selectedDay)
      .filter((s) => {
        if (selectedTeam && s.team !== selectedTeam) return false;
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
      })
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [sessions, selectedDay, selectedTeam, searchQuery]);

  // Occupied locker rooms today
  const occupiedLockersCount = useMemo(() => {
    const set = new Set<string>();
    todaySessions.forEach((s) => {
      if (s.lockerRoomId) set.add(s.lockerRoomId);
    });
    return set.size;
  }, [todaySessions]);

  // Distinct pitches used today
  const fieldsUsedToday = useMemo(() => {
    const set = new Set<string>();
    todaySessions.forEach((s) => set.add(s.field || 'Via Sardegna'));
    return Array.from(set);
  }, [todaySessions]);

  // Share session on WhatsApp
  const handleShareWhatsApp = (session: TrainingSession) => {
    const locker = session.lockerRoomId ? lockerRoomsMap.get(session.lockerRoomId) : null;
    const lockerText = locker ? `${locker.name} (${locker.notes || 'In spogliatoio'})` : (session.lockerRoomName || 'Spogliatoio in segreteria');
    const fieldText = session.field || 'Via Sardegna';

    const text =
      `⚽ *CYNTHIA1920 - ALLENAMENTO DI ${session.day.toUpperCase()}*\n\n` +
      `🏃 *Squadra:* ${session.team}\n` +
      `⏰ *Orario:* ${session.startTime} - ${session.endTime}\n` +
      `📍 *Campo:* ${fieldText}\n` +
      `🚪 *Spogliatoio:* ${lockerText}\n` +
      (session.coach ? `👤 *Mister:* ${session.coach}\n` : '') +
      (session.notes ? `📝 *Note:* ${session.notes}\n` : '') +
      `\nSi richiede di arrivare almeno 15 minuti prima. Forza CYNTHIA1920!`;

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  };

  // Add to Calendar
  const handleAddToCalendar = (session: TrainingSession) => {
    const title = encodeURIComponent(`Allenamento ${session.team} - CYNTHIA1920`);
    const details = encodeURIComponent(
      `CYNTHIA1920 Allenamento\nCampo: ${session.field || 'Via Sardegna'}\nSpogliatoio: ${session.lockerRoomName || 'Assegnato'}\nOrario: ${session.startTime} - ${session.endTime}`
    );
    const location = encodeURIComponent(`CYNTHIA1920 - ${session.field || 'Via Sardegna'}`);
    const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Hero Banner - High-Impact "OGGI" Focus */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-teal-950 border-2 border-emerald-500/50 p-6 sm:p-8 shadow-2xl shadow-emerald-950/50">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-3xl">
            {/* Live Status Pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider border border-emerald-400/40">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>VISTA PREDEFINITA • GIORNATA DI OGGI</span>
            </div>

            <div className="flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                Allenamenti di {selectedDay}
              </h1>
              <span className="text-emerald-400 font-mono text-sm sm:text-base font-bold bg-emerald-950/80 px-3 py-1 rounded-xl border border-emerald-600/40">
                {new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
            </div>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Visualizzazione rapida ed esclusiva degli allenamenti in programma per oggi.
              Controlla subito l'orario di ritrovo, il campo di allenamento (<strong>Via Sardegna</strong>)
              e lo <strong>spogliatoio assegnato (1-4)</strong>.
            </p>

            {/* Quick Metrics Bar */}
            <div className="pt-2 flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-200">
                <Users size={14} className="text-emerald-400" />
                <span>
                  <strong className="text-white text-sm font-black">{todaySessions.length}</strong> {todaySessions.length === 1 ? 'squadra' : 'squadre in campo'}
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-200">
                <DoorClosed size={14} className="text-amber-400" />
                <span>
                  <strong className="text-white text-sm font-black">{occupiedLockersCount}</strong> su 4 spogliatoi attivi
                </span>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700/80 px-3 py-1.5 rounded-xl text-slate-200">
                <MapPin size={14} className="text-blue-400" />
                <span>
                  {fieldsUsedToday.length > 0 ? fieldsUsedToday.join(', ') : 'Via Sardegna'}
                </span>
              </div>

              {liveClockString && (
                <div className="flex items-center gap-1.5 bg-emerald-900/40 border border-emerald-600/40 px-3 py-1.5 rounded-xl text-emerald-300 font-mono">
                  <Clock size={14} className="text-emerald-400" />
                  <span>Ora attuale: <strong>{liveClockString}</strong></span>
                </div>
              )}
            </div>
          </div>

          {/* Action button: Switch to Full Weekly View */}
          <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-3 shrink-0">
            <button
              onClick={onSwitchToWeekly}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-white font-bold text-sm border border-slate-600/80 shadow-lg hover:border-emerald-500/50 transition-all cursor-pointer group"
            >
              <Calendar size={18} className="text-emerald-400 group-hover:scale-110 transition-transform" />
              <span>Vedi Planning Settimana</span>
              <ChevronRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={handlePrintTodaySheet}
              disabled={isExportingPdf}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 active:bg-slate-700 text-slate-200 hover:text-white font-semibold text-xs border border-slate-700 hover:border-emerald-500/50 shadow-sm transition-all cursor-pointer disabled:opacity-50"
              title="Genera e scarica il foglio stampabile A4 di oggi con orari e spogliatoi"
            >
              {isExportingPdf ? (
                <span className="w-3.5 h-3.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
              ) : pdfSuccess ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <Printer size={14} className="text-emerald-400" />
              )}
              <span>
                {isExportingPdf
                  ? 'Generazione PDF...'
                  : pdfSuccess
                  ? 'Foglio Scaricato!'
                  : 'Stampa Foglio di Oggi'}
              </span>
            </button>
          </div>
        </div>

        {/* Pitch line art decoration */}
        <div className="absolute -right-16 -bottom-16 w-72 h-72 border-8 border-emerald-500/10 rounded-full pointer-events-none" />
        <div className="absolute right-40 top-4 w-40 h-40 border border-teal-400/10 rounded-full pointer-events-none" />
      </div>

      {/* Real Today Alert / Day Selector for testing/convenience */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-lg space-y-4">
        {/* If real today has 0 sessions (e.g. Sunday or Saturday) */}
        {!isViewingRealToday || realTodaySessionsCount === 0 ? (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-amber-200">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-bold text-amber-100">
                  {realTodaySessionsCount === 0
                    ? `Nessun allenamento programmato per oggi (${realTodayItalianDay})`
                    : `Stai visualizzando l'anteprima per ${selectedDay}`}
                </div>
                <div className="text-xs text-amber-300/80">
                  {realTodaySessionsCount === 0
                    ? 'Puoi selezionare un altro giorno feriale qui sotto per visualizzare gli allenamenti previsti.'
                    : `Il giorno effettivo del calendario è ${realTodayItalianDay}.`}
                </div>
              </div>
            </div>

            {/* Quick reset button */}
            {!isViewingRealToday && (
              <button
                onClick={() => setSelectedDay(realTodayItalianDay)}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 cursor-pointer transition-colors shadow-sm"
              >
                Torna a Oggi Reale ({realTodayItalianDay})
              </button>
            )}
          </div>
        ) : null}

        {/* Filter bar: Team Selector + Quick Search + Day Quick Switch */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          {/* Team Dropdown */}
          <div className="md:col-span-6 lg:col-span-5">
            <label className="block text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Filter size={13} />
              Filtra per la tua Squadra / Leva
            </label>
            <select
              value={selectedTeam}
              onChange={(e) => onSelectTeam(e.target.value)}
              className="w-full bg-slate-800 text-white border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors"
            >
              <option value="">-- Tutte le Squadre di Oggi ({todaySessions.length}) --</option>
              {availableTeams.map((team) => (
                <option key={team} value={team}>
                  {team}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Search */}
          <div className="md:col-span-6 lg:col-span-7">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Search size={13} />
              Cerca mister, campo o spogliatoio
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="es. Sintetico, Mister Rossi, Spogliatoio 2, Pulcini..."
                className="w-full bg-slate-800 text-white placeholder-slate-500 border border-slate-700 rounded-xl pl-9 pr-8 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs bg-slate-700 text-slate-300 hover:text-white px-1.5 py-0.5 rounded cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Days Pills (Quick Day Switcher) */}
        <div className="pt-2 border-t border-slate-800 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs text-slate-400 font-semibold mr-1 shrink-0 flex items-center gap-1">
            <Compass size={13} /> Giorno:
          </span>

          {DAYS_OF_WEEK.map((day) => {
            const isRealToday = day === realTodayItalianDay;
            const isSelected = selectedDay === day;
            const dayCount = sessions.filter((s) => s.day === day).length;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 ring-2 ring-emerald-400/50 shadow-md shadow-emerald-500/20'
                    : isRealToday
                    ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900/80'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700/60'
                }`}
              >
                <span>{day}</span>
                {isRealToday && (
                  <span
                    className={`px-1.5 py-0.2 text-[9px] rounded-full font-black ${
                      isSelected ? 'bg-slate-950 text-emerald-300' : 'bg-emerald-500/30 text-emerald-300'
                    }`}
                  >
                    OGGI
                  </span>
                )}
                <span
                  className={`text-[10px] px-1 rounded-sm ${
                    isSelected ? 'bg-slate-900/40 text-slate-950' : 'text-slate-400'
                  }`}
                >
                  ({dayCount})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main List of Today's Training Sessions */}
      {todaySessions.length === 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-12 text-center text-slate-400 shadow-xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-slate-500 text-2xl">
            ⚽
          </div>
          <div>
            <h3 className="text-xl font-bold text-white mb-1">
              Nessun allenamento in programma per {selectedDay}
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {searchQuery || selectedTeam
                ? 'Nessun risultato corrisponde ai filtri selezionati. Prova a rimuovere la ricerca o cambiare squadra.'
                : 'La società non ha previsto sedute di allenamento per questa giornata.'}
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            {searchQuery || selectedTeam ? (
              <button
                onClick={() => {
                  setSearchQuery('');
                  onSelectTeam('');
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-emerald-400 text-xs font-bold border border-slate-700 cursor-pointer"
              >
                Reimposta Filtri
              </button>
            ) : null}

            <button
              onClick={onSwitchToWeekly}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/30 cursor-pointer"
            >
              Consulta il Planning Settimanale Completo
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
              <span>Sedute di Allenamento Oggi</span>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                {todaySessions.length} {todaySessions.length === 1 ? 'squadra' : 'squadre'}
              </span>
            </h2>
            <span className="text-xs text-slate-400 hidden sm:inline">
              Ordinato per orario di inizio
            </span>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {todaySessions.map((session, index) => {
              const liveStatus = isViewingRealToday
                ? getLiveStatus(session.startTime, session.endTime, currentTimeMinutes)
                : {
                    status: 'scheduled',
                    label: 'IN PROGRAMMA',
                    badgeClass: 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-semibold',
                    dotClass: 'bg-blue-400',
                  };

              const locker = session.lockerRoomId ? lockerRoomsMap.get(session.lockerRoomId) : null;
              const lockerName = locker?.name || session.lockerRoomName || 'Da assegnare';
              const lockerColor = locker?.color || '#3B82F6';
              const fieldName = session.field || 'Via Sardegna';

              // Highlight if Wednesday U19 at Monte Due Torri
              const isSpecialField =
                fieldName.toLowerCase().includes('monte due torri') ||
                (session.day === 'Mercoledì' && session.team.toLowerCase().includes('under 19'));

              return (
                <div
                  key={session.id}
                  className={`relative rounded-2xl p-5 transition-all flex flex-col justify-between border shadow-lg group ${
                    liveStatus.status === 'live'
                      ? 'bg-gradient-to-b from-slate-850 to-slate-900 border-emerald-500 ring-2 ring-emerald-500/30 shadow-emerald-500/10'
                      : liveStatus.status === 'soon'
                      ? 'bg-gradient-to-b from-slate-850 to-slate-900 border-amber-500/70 shadow-amber-500/10'
                      : 'bg-slate-900/95 hover:bg-slate-850 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* Header: Live Badge + Order Index */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] ${liveStatus.badgeClass}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${liveStatus.dotClass}`} />
                        <span>{liveStatus.label}</span>
                      </span>

                      <span className="text-[11px] font-mono text-slate-500 font-bold">
                        #{index + 1}
                      </span>
                    </div>

                    {/* Team Name */}
                    <h3 className="text-lg font-black text-white group-hover:text-emerald-300 transition-colors mb-2 tracking-tight">
                      ⚽ {session.team}
                    </h3>

                    {/* Time Window with high prominence */}
                    <div className="flex items-center gap-2 mb-3 bg-slate-950/60 px-3 py-2 rounded-xl border border-slate-800">
                      <Clock size={16} className="text-emerald-400 shrink-0" />
                      <div className="text-sm font-black text-white tracking-wide">
                        {session.startTime} — {session.endTime}
                      </div>
                      <span className="text-[11px] text-slate-400 ml-auto font-mono">
                        {session.day}
                      </span>
                    </div>

                    {/* Pitch / Campo (Via Sardegna or Monte Due Torri) */}
                    <div
                      className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl border mb-3 ${
                        isSpecialField
                          ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
                          : 'bg-blue-950/30 border-blue-500/30 text-blue-200'
                      }`}
                    >
                      <MapPin
                        size={15}
                        className={isSpecialField ? 'text-purple-400 shrink-0' : 'text-blue-400 shrink-0'}
                      />
                      <div className="truncate">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Campo di Gioco
                        </span>
                        <strong className="text-white text-xs truncate block">{fieldName}</strong>
                      </div>
                      {isSpecialField && (
                        <span className="ml-auto text-[10px] font-black uppercase bg-purple-500 text-slate-950 px-1.5 py-0.5 rounded">
                          Campo Speciale
                        </span>
                      )}
                    </div>

                    {/* Assigned Locker Room 1-4 (Prominently Highlighted) */}
                    <div
                      className="p-3 rounded-2xl border flex items-center justify-between gap-3 shadow-inner"
                      style={{
                        backgroundColor: `${lockerColor}18`,
                        borderColor: `${lockerColor}50`,
                      }}
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md font-black text-sm"
                          style={{ backgroundColor: lockerColor }}
                        >
                          <DoorClosed size={20} />
                        </div>
                        <div className="truncate">
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Spogliatoio Assegnato
                          </div>
                          <div
                            className="text-sm font-black truncate"
                            style={{ color: lockerColor }}
                          >
                            {lockerName}
                          </div>
                        </div>
                      </div>

                      {locker?.notes ? (
                        <span className="text-[10px] text-slate-400 max-w-[110px] text-right truncate font-medium">
                          {locker.notes}
                        </span>
                      ) : (
                        <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-600/30">
                          Attivo
                        </span>
                      )}
                    </div>

                    {/* Coach & Notes if present */}
                    {(session.coach || session.notes) && (
                      <div className="mt-3 pt-2 text-xs text-slate-400 flex flex-wrap gap-2">
                        {session.coach && (
                          <div className="text-[11px]">
                            <span className="text-slate-500 font-semibold">Mister:</span>{' '}
                            <span className="text-slate-200 font-bold">{session.coach}</span>
                          </div>
                        )}
                        {session.notes && (
                          <div className="text-[11px] text-amber-300/90 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 truncate max-w-full">
                            {session.notes}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Quick Parent Actions: WhatsApp & Google Calendar */}
                  <div className="mt-5 pt-3.5 border-t border-slate-800 flex items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(session)}
                      title="Condividi dettagli allenamento su WhatsApp per atleti e genitori"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      <Share2 size={14} />
                      <span>WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleAddToCalendar(session)}
                      title="Aggiungi promemoria a Google Calendar"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 active:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition-all border border-slate-700 cursor-pointer"
                    >
                      <CalendarPlus size={14} />
                      <span>Calendario</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
