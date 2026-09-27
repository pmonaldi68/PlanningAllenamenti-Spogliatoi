import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  isAdminAuthenticated,
  setAdminAuthenticated,
} from './services/adminAuth';
import {
  fetchCsvFromUrl,
  parseCsvText,
  parseCsvRowsToSessions,
} from './services/csvSync';
import { Navbar, AppTab } from './components/Navbar';
import { TodayView } from './components/TodayView';
import { ParentsView } from './components/ParentsView';
import { LiveBoard } from './components/LiveBoard';
import { AdminPanel } from './components/AdminPanel';
import { AdminLoginModal } from './components/AdminLoginModal';
import { TrainingSession, LockerRoom, DayOfWeek } from './types';
import { INITIAL_LOCKER_ROOMS, INITIAL_SESSIONS } from './data/mockASDData';

export default function App() {
  // Navigation tab - 'today' is the default view as requested!
  const [currentTab, setCurrentTab] = useState<AppTab>('today');

  // Admin authentication state
  const [isAdmin, setIsAdmin] = useState<boolean>(() => isAdminAuthenticated());
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);

  // App core data
  const [lockerRooms, setLockerRooms] = useState<LockerRoom[]>(() => {
    const saved = localStorage.getItem('asd_locker_rooms_v3');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 4) {
          return parsed.map((r: LockerRoom) => ({
            ...r,
            notes: (r.notes || '')
              .replace(/Accesso\s+corridoio\s+[A-Za-z0-9]*/gi, '')
              .replace(/corridoio\s+[A-Za-z0-9]*/gi, '')
              .trim(),
          }));
        }
      } catch (e) {
        // fallback
      }
    }
    return INITIAL_LOCKER_ROOMS;
  });

  const [sessions, setSessions] = useState<TrainingSession[]>(() => {
    const saved = localStorage.getItem('asd_sessions_v3');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    return INITIAL_SESSIONS;
  });

  // Configured Shared CSV Link
  const [csvUrl, setCsvUrl] = useState<string>(() => {
    return localStorage.getItem('asd_csv_url') || '';
  });

  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() => {
    return localStorage.getItem('asd_last_synced') || '';
  });

  const [autoSyncMinutes, setAutoSyncMinutes] = useState<number>(() => {
    const saved = localStorage.getItem('asd_autosync_mins');
    return saved ? parseInt(saved, 10) : 5;
  });

  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Filter for Parents view
  const [selectedTeam, setSelectedTeam] = useState<string>('');

  // Persist locker rooms and sessions
  useEffect(() => {
    localStorage.setItem('asd_locker_rooms_v3', JSON.stringify(lockerRooms));
  }, [lockerRooms]);

  useEffect(() => {
    localStorage.setItem('asd_sessions_v3', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('asd_csv_url', csvUrl);
  }, [csvUrl]);

  useEffect(() => {
    localStorage.setItem('asd_autosync_mins', autoSyncMinutes.toString());
  }, [autoSyncMinutes]);

  // Admin login actions
  const handleAdminLoginSuccess = () => {
    setIsAdmin(true);
    setShowAdminLoginModal(false);
    setCurrentTab('admin');
  };

  const handleAdminLogout = () => {
    setAdminAuthenticated(false);
    setIsAdmin(false);
    if (currentTab === 'admin') {
      setCurrentTab('today');
    }
  };

  // Update a single session's locker room assignment
  const handleUpdateSessionLocker = useCallback(
    (sessionId: string, lockerRoomId: string, lockerRoomName: string) => {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? { ...s, lockerRoomId: lockerRoomId || undefined, lockerRoomName }
            : s
        )
      );
    },
    []
  );

  // Update a single session's field (pitch)
  const handleUpdateSessionField = useCallback((sessionId: string, field: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, field } : s))
    );
  }, []);

  // Locker room CRUD
  const handleAddLockerRoom = useCallback((room: LockerRoom) => {
    setLockerRooms((prev) => [...prev, room]);
  }, []);

  const handleUpdateLockerRoom = useCallback((room: LockerRoom) => {
    setLockerRooms((prev) => prev.map((r) => (r.id === room.id ? room : r)));
  }, []);

  const handleDeleteLockerRoom = useCallback((roomId: string) => {
    setLockerRooms((prev) => prev.filter((r) => r.id !== roomId));
    setSessions((prev) =>
      prev.map((s) => (s.lockerRoomId === roomId ? { ...s, lockerRoomId: undefined } : s))
    );
  }, []);

  // Import new sessions from CSV, preserving existing locker assignments where matching
  const handleImportSessions = useCallback(
    (newSessions: TrainingSession[], teams: string[], sourceUrl: string) => {
      setSessions((prevExisting) => {
        const assignmentMap = new Map<string, { id?: string; name?: string }>();
        prevExisting.forEach((s) => {
          if (s.lockerRoomId) {
            assignmentMap.set(`${s.team}-${s.day}-${s.startTime}`, {
              id: s.lockerRoomId,
              name: s.lockerRoomName,
            });
          }
        });

        return newSessions.map((s) => {
          const key = `${s.team}-${s.day}-${s.startTime}`;
          const existingAssign = assignmentMap.get(key);
          if (existingAssign) {
            return {
              ...s,
              lockerRoomId: existingAssign.id,
              lockerRoomName: existingAssign.name,
            };
          }
          return s;
        });
      });

      const nowTime = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      setLastSyncedAt(nowTime);
      localStorage.setItem('asd_last_synced', nowTime);
    },
    []
  );

  // Restore Default Mock Data
  const handleRestoreMockData = useCallback(() => {
    setSessions(INITIAL_SESSIONS);
    setLockerRooms(INITIAL_LOCKER_ROOMS);
    setCsvUrl('');
    setLastSyncedAt('');
    localStorage.removeItem('asd_csv_url');
    localStorage.removeItem('asd_last_synced');
  }, []);

  // Quick refresh from CSV URL
  const handleQuickRefresh = async () => {
    if (!csvUrl) return;

    setIsRefreshing(true);
    try {
      const csvText = await fetchCsvFromUrl(csvUrl);
      const rows = parseCsvText(csvText);
      const { sessions: newSessions, teams } = parseCsvRowsToSessions(rows);

      if (newSessions.length > 0) {
        handleImportSessions(newSessions, teams, csvUrl);
      }
    } catch (err: any) {
      console.error('Auto-refresh error:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Background auto-sync if configured
  useEffect(() => {
    if (!csvUrl) return;

    // Immediately sync on load
    handleQuickRefresh();

    if (autoSyncMinutes > 0) {
      const intervalMs = autoSyncMinutes * 60 * 1000;
      const interval = setInterval(() => {
        handleQuickRefresh();
      }, intervalMs);

      return () => clearInterval(interval);
    }
  }, [csvUrl, autoSyncMinutes]);

  // Auto-sync when user returns/focuses the browser window
  useEffect(() => {
    const handleWindowFocus = () => {
      if (csvUrl) {
        handleQuickRefresh();
      }
    };
    window.addEventListener('focus', handleWindowFocus);
    return () => window.removeEventListener('focus', handleWindowFocus);
  }, [csvUrl]);

  // Unique teams from sessions
  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => set.add(s.team));
    return Array.from(set).sort();
  }, [sessions]);

  // Current real day for TodayView counter in Navbar
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

  const todaySessionsCount = useMemo(() => {
    return sessions.filter((s) => s.day === todayItalianDay).length;
  }, [sessions, todayItalianDay]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-emerald-500 selection:text-white">
      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        onTabChange={(tab) => {
          if (tab === 'admin' && !isAdmin) {
            setShowAdminLoginModal(true);
          } else {
            setCurrentTab(tab);
          }
        }}
        isAdmin={isAdmin}
        onOpenAdminLogin={() => setShowAdminLoginModal(true)}
        onLogoutAdmin={handleAdminLogout}
        csvConnected={!!csvUrl}
        onQuickRefresh={handleQuickRefresh}
        isRefreshing={isRefreshing}
        lastSyncedAt={lastSyncedAt}
        todaySessionsCount={todaySessionsCount}
      />

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Vista Oggi - Predefinita per Genitori e Atleti */}
        {currentTab === 'today' && (
          <TodayView
            sessions={sessions}
            lockerRooms={lockerRooms}
            selectedTeam={selectedTeam}
            onSelectTeam={setSelectedTeam}
            availableTeams={availableTeams}
            onSwitchToWeekly={() => setCurrentTab('weekly')}
          />
        )}

        {/* Planning Settimanale Completo */}
        {currentTab === 'weekly' && (
          <ParentsView
            sessions={sessions}
            lockerRooms={lockerRooms}
            selectedTeam={selectedTeam}
            onSelectTeam={setSelectedTeam}
            availableTeams={availableTeams}
            onSwitchToToday={() => setCurrentTab('today')}
          />
        )}

        {currentTab === 'live' && (
          <LiveBoard sessions={sessions} lockerRooms={lockerRooms} />
        )}

        {currentTab === 'admin' && (
          isAdmin ? (
            <AdminPanel
              csvUrl={csvUrl}
              onSaveCsvUrl={setCsvUrl}
              onImportSessions={handleImportSessions}
              onLogoutAdmin={handleAdminLogout}
              onRestoreMockData={handleRestoreMockData}
              lastSyncedAt={lastSyncedAt}
              autoSyncMinutes={autoSyncMinutes}
              onUpdateAutoSync={setAutoSyncMinutes}
              sessions={sessions}
              onUpdateSessionLocker={handleUpdateSessionLocker}
              onUpdateSessionField={handleUpdateSessionField}
              lockerRooms={lockerRooms}
              onAddLockerRoom={handleAddLockerRoom}
              onUpdateLockerRoom={handleUpdateLockerRoom}
              onDeleteLockerRoom={handleDeleteLockerRoom}
            />
          ) : (
            <div className="p-12 text-center text-slate-400">
              <p>È necessario effettuare l'accesso all'area riservata.</p>
              <button
                onClick={() => setShowAdminLoginModal(true)}
                className="mt-4 px-4 py-2 bg-amber-500 text-slate-950 font-bold rounded-xl"
              >
                Accedi con Password
              </button>
            </div>
          )
        )}
      </main>

      {/* Admin Login Modal (Password: Admin1234) */}
      <AdminLoginModal
        isOpen={showAdminLoginModal}
        onSuccess={handleAdminLoginSuccess}
        onClose={() => setShowAdminLoginModal(false)}
      />
    </div>
  );
}
