import React, { useState } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Database,
  Lock,
  LogOut,
  Sliders,
  HelpCircle,
  ClipboardPaste,
  ShieldCheck,
  DoorClosed,
  Clock,
  FileText,
  FileDown,
  Printer,
  Calendar,
  X,
  Eye,
} from 'lucide-react';
import {
  normalizeGoogleSheetCsvUrl,
  parseCsvText,
  parseCsvRowsToSessions,
  fetchCsvFromUrl,
} from '../services/csvSync';
import {
  exportWeeklyPlanningPdf,
  exportLockerRoomsOrderedListPdf,
  exportTodayPlanningPdf,
  exportWeeklySchematicColumnsPdf,
  exportWeeklySchematicMatrixPdf,
} from '../services/pdfExport';
import { TrainingSession, LockerRoom } from '../types';
import { SAMPLE_SHEET_ROWS } from '../data/mockASDData';
import { LockerRoomManager } from './LockerRoomManager';

interface AdminPanelProps {
  csvUrl: string;
  onSaveCsvUrl: (url: string) => void;
  onImportSessions: (sessions: TrainingSession[], teams: string[], sourceUrl: string) => void;
  onLogoutAdmin: () => void;
  onRestoreMockData: () => void;
  lastSyncedAt?: string;
  autoSyncMinutes: number;
  onUpdateAutoSync: (mins: number) => void;
  // Locker room props
  sessions: TrainingSession[];
  onUpdateSessionLocker: (sessionId: string, lockerRoomId: string, lockerRoomName: string) => void;
  onUpdateSessionField: (sessionId: string, field: string) => void;
  lockerRooms: LockerRoom[];
  onAddLockerRoom: (room: LockerRoom) => void;
  onUpdateLockerRoom: (room: LockerRoom) => void;
  onDeleteLockerRoom: (roomId: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  csvUrl,
  onSaveCsvUrl,
  onImportSessions,
  onLogoutAdmin,
  onRestoreMockData,
  lastSyncedAt,
  autoSyncMinutes,
  onUpdateAutoSync,
  sessions,
  onUpdateSessionLocker,
  onUpdateSessionField,
  lockerRooms,
  onAddLockerRoom,
  onUpdateLockerRoom,
  onDeleteLockerRoom,
}) => {
  const [activeAdminSubTab, setActiveAdminSubTab] = useState<'csv' | 'lockers' | 'pdf'>('csv');
  const [inputUrl, setInputUrl] = useState(csvUrl);
  const [isFetching, setIsFetching] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isExportingLandscape, setIsExportingLandscape] = useState(false);
  const [weeklyExportSuccess, setWeeklyExportSuccess] = useState(false);
  const [isExportingPortrait, setIsExportingPortrait] = useState(false);
  const [isExportingToday, setIsExportingToday] = useState(false);
  const [todayExportSuccess, setTodayExportSuccess] = useState(false);

  const todayItalianDay = [
    'Domenica',
    'Lunedì',
    'Martedì',
    'Mercoledì',
    'Giovedì',
    'Venerdì',
    'Sabato',
  ][new Date().getDay()];

  // Check if today has sessions. If not (e.g. on weekends), default to the first day with sessions
  const todaySessionsCount = sessions.filter((s) => s.day === todayItalianDay).length;
  const initialPdfDay = todaySessionsCount > 0 ? todayItalianDay : 'Lunedì';
  const [selectedPdfDay, setSelectedPdfDay] = useState<string>(initialPdfDay);
  const [showTodayPdfModal, setShowTodayPdfModal] = useState(false);
  const [showWeeklyPdfModal, setShowWeeklyPdfModal] = useState(false);
  const [weeklyPdfMode, setWeeklyPdfMode] = useState<'columns' | 'matrix'>('columns');

  // Manual CSV text paste fallback
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pastedText, setPastedText] = useState('');

  // Normalize preview
  const normalizedUrlPreview = normalizeGoogleSheetCsvUrl(inputUrl);

  const handleExportToday = (dayOverride?: string) => {
    const day = dayOverride || selectedPdfDay || initialPdfDay;
    setIsExportingToday(true);
    try {
      exportTodayPlanningPdf(sessions, lockerRooms, day, 'CYNTHIA1920');
      setTodayExportSuccess(true);
      setTimeout(() => setTodayExportSuccess(false), 3500);
    } catch (err) {
      console.error('Error exporting today PDF:', err);
    } finally {
      setTimeout(() => setIsExportingToday(false), 800);
    }
  };

  const handleExportLandscape = (modeOverride?: 'columns' | 'matrix') => {
    const mode = modeOverride || weeklyPdfMode;
    setIsExportingLandscape(true);
    try {
      exportWeeklyPlanningPdf(sessions, lockerRooms, 'CYNTHIA1920', mode);
      setWeeklyExportSuccess(true);
      setTimeout(() => setWeeklyExportSuccess(false), 3500);
    } catch (err) {
      console.error('Error exporting landscape PDF:', err);
    } finally {
      setTimeout(() => setIsExportingLandscape(false), 800);
    }
  };

  const handleExportPortrait = () => {
    setIsExportingPortrait(true);
    try {
      exportLockerRoomsOrderedListPdf(sessions, lockerRooms, 'CYNTHIA1920');
    } catch (err) {
      console.error('Error exporting portrait PDF:', err);
    } finally {
      setTimeout(() => setIsExportingPortrait(false), 800);
    }
  };

  const handleFetchAndSync = async (urlToFetch?: string) => {
    const targetUrl = urlToFetch || inputUrl;
    if (!targetUrl.trim()) {
      setErrorMsg('Inserisci il link del file CSV o Google Sheet.');
      return;
    }

    setIsFetching(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const csvText = await fetchCsvFromUrl(targetUrl);
      const rows = parseCsvText(csvText);

      if (rows.length < 2) {
        throw new Error('Il file CSV sembra vuoto o non contiene abbastanza righe.');
      }

      const { sessions: parsedSessions, teams, headers } = parseCsvRowsToSessions(rows);

      if (parsedSessions.length === 0) {
        throw new Error(
          `Nessun allenamento riconosciuto. Intestazioni lette: [${headers.join(', ')}]. Assicurati che includano 'Squadra' e i giorni della settimana (Lunedì, Martedì, ecc.).`
        );
      }

      // Save URL & sessions
      onSaveCsvUrl(targetUrl);
      onImportSessions(parsedSessions, teams, targetUrl);
      setSuccessMsg(
        `✅ Sincronizzazione completata! Caricati ${parsedSessions.length} allenamenti per ${teams.length} squadre.`
      );
    } catch (err: any) {
      console.error('CSV fetch error:', err);
      setErrorMsg(err.message || 'Errore durante lo scaricamento del file CSV. Verifica il link.');
    } finally {
      setIsFetching(false);
    }
  };

  const handleProcessPastedCsv = () => {
    if (!pastedText.trim()) return;

    try {
      const rows = parseCsvText(pastedText);
      const { sessions: parsedSessions, teams, headers } = parseCsvRowsToSessions(rows);

      if (parsedSessions.length === 0) {
        throw new Error(
          `Nessun allenamento riconosciuto. Intestazioni: [${headers.join(', ')}]. Verifica che siano: Squadra | Lunedì | Martedì ...`
        );
      }

      onImportSessions(parsedSessions, teams, 'Incollato manualmente');
      setShowPasteModal(false);
      setPastedText('');
      setSuccessMsg(
        `✅ CSV incollato elaborato con successo! ${parsedSessions.length} sessioni caricate.`
      );
    } catch (err: any) {
      setErrorMsg(err.message || 'Errore durante la lettura del testo CSV incollato.');
    }
  };

  const handleDownloadSampleCsv = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      SAMPLE_SHEET_ROWS.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join(
        '\n'
      );
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'modello_planning_allenamenti_asd.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Admin Bar */}
      <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-bold">
            <Lock size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">Area Riservata Dirigenti</h2>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Admin Attivo
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Gestione del link al file CSV Google Sheet e controllo assegnazione spogliatoi.
            </p>
          </div>
        </div>

        {/* Sub-nav & Logout */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700">
            <button
              onClick={() => setActiveAdminSubTab('csv')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeAdminSubTab === 'csv'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Link CSV & Sincro
            </button>
            <button
              onClick={() => setActiveAdminSubTab('lockers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                activeAdminSubTab === 'lockers'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Assegnazione Spogliatoi
            </button>
            <button
              onClick={() => setActiveAdminSubTab('pdf')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                activeAdminSubTab === 'pdf'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <FileDown size={14} />
              Esporta PDF (A4)
            </button>
          </div>

          {/* Quick Print & Today Planning PDF Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExportToday()}
              disabled={isExportingToday}
              className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-600/20 transition-all cursor-pointer disabled:opacity-50"
              title="Genera e scarica subito il PDF A4 ufficiale del planning odierno"
            >
              {isExportingToday ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : todayExportSuccess ? (
                <CheckCircle2 size={14} className="text-white" />
              ) : (
                <Printer size={14} />
              )}
              <span>{todayExportSuccess ? 'Foglio Scaricato!' : 'Stampa Foglio di Oggi'}</span>
            </button>
            <button
              onClick={() => setShowTodayPdfModal(true)}
              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-teal-300 hover:text-white border border-slate-700 hover:border-teal-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Apri Anteprima di Stampa e Opzioni Formato Carta"
            >
              <Eye size={14} />
              <span className="hidden sm:inline">Anteprima</span>
            </button>
          </div>

          {/* Quick Weekly Schematic Print Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleExportLandscape()}
              disabled={isExportingLandscape}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer disabled:opacity-50"
              title="Stampa schematica dell'intera settimana su 1 foglio A4 orizzontale"
            >
              {isExportingLandscape ? (
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : weeklyExportSuccess ? (
                <CheckCircle2 size={14} className="text-white" />
              ) : (
                <Calendar size={14} />
              )}
              <span>{weeklyExportSuccess ? 'Settimana Scaricata!' : 'Stampa Tutta la Settimana (A4)'}</span>
            </button>
            <button
              onClick={() => setShowWeeklyPdfModal(true)}
              className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-blue-300 hover:text-white border border-slate-700 hover:border-blue-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
              title="Apri Anteprima Schematica Settimanale (1 Foglio A4 Orizzontale)"
            >
              <Eye size={14} />
              <span className="hidden sm:inline">Anteprima</span>
            </button>
          </div>

          <button
            onClick={onLogoutAdmin}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 border border-slate-700 hover:border-rose-700/50 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="Esci dall'Area Admin"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Esci Admin</span>
          </button>
        </div>
      </div>

      {/* Main Tab 1: CSV Sync Configuration */}
      {activeAdminSubTab === 'csv' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-amber-400" />
                Link al File CSV Condiviso
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Incolla qui l'URL del file CSV esportato dal tuo Google Sheet. L'applicazione lo
                scaricherà e sincronizzerà le tabelle degli orari.
              </p>
            </div>

            {/* Input URL */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                URL File CSV / Google Sheet Pubblicato:
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  placeholder="https://docs.google.com/spreadsheets/d/.../pub?output=csv"
                  value={inputUrl}
                  onChange={(e) => setInputUrl(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:ring-2 focus:ring-amber-500"
                />
                <button
                  onClick={() => handleFetchAndSync()}
                  disabled={isFetching || !inputUrl.trim()}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 disabled:opacity-50 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer shrink-0"
                >
                  {isFetching ? (
                    <span className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  ) : (
                    <RefreshCw size={15} />
                  )}
                  {isFetching ? 'Scaricamento in corso...' : 'Sincronizza Dati Adesso'}
                </button>
              </div>

              {/* URL transformation info */}
              {inputUrl.includes('/edit') && (
                <div className="text-[11px] text-amber-300/90 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                  💡 <strong>Link standard Google Sheet rilevato:</strong> Verrà convertito
                  automaticamente nel formato diretto CSV esportabile.
                </div>
              )}
            </div>

            {/* Feedback messages */}
            {errorMsg && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-600/40 rounded-xl text-rose-300 text-xs flex items-start gap-2.5">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1">{errorMsg}</div>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 bg-emerald-950/40 border border-emerald-600/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2.5">
                <CheckCircle2 size={16} className="shrink-0" />
                <div>{successMsg}</div>
              </div>
            )}

            {/* Settings & Extra Controls */}
            <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-slate-400" />
                <span className="text-xs text-slate-300 font-medium">Auto-aggiornamento:</span>
                <select
                  value={autoSyncMinutes}
                  onChange={(e) => onUpdateAutoSync(parseInt(e.target.value, 10))}
                  className="bg-slate-800 text-white border border-slate-700 rounded-lg px-2.5 py-1 text-xs"
                >
                  <option value={0}>Solo Manuale</option>
                  <option value={5}>Ogni 5 minuti</option>
                  <option value={15}>Ogni 15 minuti</option>
                  <option value={30}>Ogni 30 minuti</option>
                </select>
                {lastSyncedAt && (
                  <span className="text-[11px] text-slate-500 ml-2">
                    (Ultima sincro: <strong className="text-emerald-400">{lastSyncedAt}</strong>)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <ClipboardPaste size={14} />
                  Incolla Testo CSV
                </button>
                <button
                  type="button"
                  onClick={onRestoreMockData}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-semibold border border-amber-500/30 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Database size={14} />
                  Ripristina Demo
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSampleCsv}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download size={14} />
                  Scarica Modello
                </button>
              </div>
            </div>
          </div>

          {/* Guide Card: How to get CSV link in Google Sheets */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-3">
            <h4 className="text-base font-bold text-white flex items-center gap-2">
              <HelpCircle size={18} className="text-blue-400" />
              Come ottenere il link CSV dal tuo Google Sheet in 2 click:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-300">
              <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center mb-2">
                  1
                </div>
                <div className="font-bold text-white mb-1">Apri il Google Sheet</div>
                <p className="text-slate-400">
                  Nel menu in alto clicca su <strong>File</strong> &rarr; <strong>Condividi</strong> &rarr;{' '}
                  <strong>Pubblica sul web</strong>.
                </p>
              </div>

              <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center mb-2">
                  2
                </div>
                <div className="font-bold text-white mb-1">Seleziona Formato CSV</div>
                <p className="text-slate-400">
                  Al posto di "Pagina web", seleziona{' '}
                  <strong className="text-emerald-400">Valori delimitati da virgola (.csv)</strong> e
                  clicca su <strong>Pubblica</strong>.
                </p>
              </div>

              <div className="bg-slate-850 p-4 rounded-2xl border border-slate-800">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center mb-2">
                  3
                </div>
                <div className="font-bold text-white mb-1">Incolla qui sopra</div>
                <p className="text-slate-400">
                  Copia il link generato (termina con <code className="text-amber-300">pub?output=csv</code>)
                  e incollalo nel campo sopra. L'app si sincronizzerà all'istante!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Tab 2: Locker Room Manager */}
      {activeAdminSubTab === 'lockers' && (
        <div className="space-y-6">
          {/* Quick PDF export helper banner inside lockers */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-slate-300">
              <FileDown size={18} className="text-emerald-400 shrink-0" />
              <span>
                Vuoi stampare il foglio di oggi, il planning o i cartelli per i 4 spogliatoi?
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleExportToday()}
                disabled={isExportingToday}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                <Printer size={13} />
                Stampa Foglio di Oggi
              </button>
              <button
                onClick={handleExportLandscape}
                disabled={isExportingLandscape}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download size={13} />
                Planning (A4 Orizzontale)
              </button>
              <button
                onClick={handleExportPortrait}
                disabled={isExportingPortrait}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download size={13} />
                Spogliatoi 1-4 (A4 Verticale)
              </button>
            </div>
          </div>

          <LockerRoomManager
            sessions={sessions}
            onUpdateSessionLocker={onUpdateSessionLocker}
            onUpdateSessionField={onUpdateSessionField}
            lockerRooms={lockerRooms}
            onAddLockerRoom={onAddLockerRoom}
            onUpdateLockerRoom={onUpdateLockerRoom}
            onDeleteLockerRoom={onDeleteLockerRoom}
            onSaveToGoogleSheet={() => {
              alert('✅ Assegnazione spogliatoi salvata nell\'app!');
            }}
            isSavingToSheet={false}
            hasGoogleSheetConnected={false}
          />
        </div>
      )}

      {/* Main Tab 3: PDF Exports (A4 Landscape & A4 Portrait) */}
      {activeAdminSubTab === 'pdf' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Top Info Banner */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 mb-2">
                <FileDown size={14} /> Esportazione Documenti Ufficiali
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Generazione File PDF (Formato A4)
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                Crea ed esporta con 1 click i PDF ufficiali pronti per la stampa, formattati
                con colori ad alto contrasto, orari, campo (Via Sardegna / Monte Due Torri) e spogliatoi assegnati.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-700">
                {sessions.length} allenamenti • 4 spogliatoi
              </span>
            </div>
          </div>

          {/* Three PDF Export Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Card 1: A4 Portrait Daily Planning Sheet */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-850 border border-teal-500/30 hover:border-teal-500/60 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-teal-500/20 text-teal-300 border border-teal-500/40 uppercase tracking-wider flex items-center gap-1.5">
                    <Printer size={13} />
                    A4 Verticale • Foglio Oggi
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">210 × 297 mm</span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Foglio Allenamenti di Oggi
                  </h3>
                  <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">
                    Foglio giornaliero ufficiale <strong>pronto per la stampa immediata</strong> per bacheca,
                    segreteria e custodi dei campi. Riporta la tabella ordinata con orari, squadre, campo e spogliatoio.
                  </p>
                </div>

                {/* Day selector for print */}
                <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/60 space-y-2">
                  <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar size={13} className="text-teal-400" />
                    Giorno da Stampare:
                  </label>
                  <select
                    value={selectedPdfDay}
                    onChange={(e) => setSelectedPdfDay(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-500"
                  >
                    {['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].map((d) => (
                      <option key={d} value={d}>
                        {d} {d === todayItalianDay ? '(Oggi Reale)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Features list */}
                <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                    <span><strong>Formato A4 pronto:</strong> Ottimizzato per bacheca e custode</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                    <span><strong>Spogliatoi evidenziati:</strong> Con codifica colore ufficiale</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                    <span><strong>Spazio per la firma:</strong> Convalidato per custodi / dirigenti</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                    <span><strong>Campi indicati:</strong> Via Sardegna e Monte Due Torri</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => handleExportToday(selectedPdfDay)}
                  disabled={isExportingToday}
                  className="w-full py-3 px-5 rounded-2xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-teal-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isExportingToday ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : todayExportSuccess ? (
                    <CheckCircle2 size={16} className="text-white" />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>
                    {isExportingToday
                      ? 'Generazione PDF...'
                      : todayExportSuccess
                      ? 'Foglio Scaricato!'
                      : `Scarica PDF Ufficiale A4 (${selectedPdfDay})`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowTodayPdfModal(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye size={14} className="text-teal-400" />
                  <span>Anteprima & Opzioni Stampa Carta</span>
                </button>
              </div>
            </div>

            {/* Card 2: A4 Landscape Planning */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-850 border border-blue-500/30 hover:border-blue-500/60 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={13} />
                    A4 Orizzontale &bull; 1 Foglio
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">297 × 210 mm</span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Planning Schematizzato Tutta la Settimana
                  </h3>
                  <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">
                    Stampa schematica dell'intera settimana su <strong>un unico foglio A4 orizzontale</strong>.
                    Visualizzazione ad alto contrasto per capire <strong>in un colpo d'occhio</strong> turni orari,
                    squadre, campi di gioco e spogliatoi con codifica colore.
                  </p>
                </div>

                {/* Layout Mode Selector */}
                <div className="bg-slate-950/80 rounded-2xl p-3 border border-slate-800 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                    Formato Schematizzato:
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setWeeklyPdfMode('columns')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                        weeklyPdfMode === 'columns'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400'
                          : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span>Griglia a 5 Colonne</span>
                      <span className="text-[10px] opacity-80 font-normal">Lun - Ven Timeline</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeeklyPdfMode('matrix')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold transition-all text-left flex flex-col cursor-pointer ${
                        weeklyPdfMode === 'matrix'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-400'
                          : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span>Matrice per Squadre</span>
                      <span className="text-[10px] opacity-80 font-normal">Sinottico Categorie</span>
                    </button>
                  </div>
                </div>

                {/* Features list */}
                <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    <span><strong>1 Foglio Unico Garantito:</strong> Nessun overflow o seconda pagina</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    <span><strong>A Colpo d'Occhio:</strong> Orari, campi e spogliatoi subito chiari</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    <span><strong>Codifica Colore SP-1..SP-4:</strong> Spogliatoio 1 a 4 con tinte distinte</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    <span><strong>Campi Evidenziati:</strong> Via Sardegna e Monte Due Torri (U19 Mercoledì)</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800 space-y-2">
                <button
                  onClick={() => handleExportLandscape()}
                  disabled={isExportingLandscape}
                  className="w-full py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isExportingLandscape ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : weeklyExportSuccess ? (
                    <CheckCircle2 size={16} className="text-white" />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>
                    {isExportingLandscape
                      ? 'Generazione PDF Schematizzato...'
                      : weeklyExportSuccess
                      ? 'Foglio Settimanale Scaricato!'
                      : `Scarica PDF Schematizzato (1 Foglio A4)`}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowWeeklyPdfModal(true)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white font-semibold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Eye size={14} className="text-blue-400" />
                  <span>Anteprima Schematica Settimana</span>
                </button>
              </div>
            </div>

            {/* Card 3: A4 Portrait Locker Rooms */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-850 border border-emerald-500/30 hover:border-emerald-500/60 rounded-3xl p-6 shadow-xl flex flex-col justify-between transition-all">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 uppercase tracking-wider flex items-center gap-1.5">
                    <DoorClosed size={13} />
                    A4 Verticale (Portrait)
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono">210 × 297 mm</span>
                </div>

                <div>
                  <h3 className="text-lg font-black text-white tracking-tight">
                    Cartelli per i 4 Spogliatoi (Elenco Ordinato)
                  </h3>
                  <p className="text-xs text-slate-300/90 mt-1 leading-relaxed">
                    Genera un documento con <strong>una pagina A4 dedicata per ciascuno dei 4 spogliatoi</strong> (Spogliatoio 1, 2, 3 e 4).
                    Contiene l'elenco ordinato di tutte le squadre che utilizzano quello spogliatoio durante la settimana.
                  </p>
                </div>

                {/* Features list */}
                <div className="bg-slate-800/80 rounded-2xl p-4 border border-slate-700/60 space-y-2 text-xs text-slate-300">
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span><strong>4 Pagine dedicate:</strong> 1 pagina per ciascuno spogliatoio</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span><strong>Pronto da stampare:</strong> Da affiggere sulle porte degli spogliatoi</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span><strong>Ordinamento cronologico:</strong> Giorno, orari di turno e campo</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    <span><strong>Box Regole Spogliatoio:</strong> Istruzioni comportamentali per atleti</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button
                  onClick={handleExportPortrait}
                  disabled={isExportingPortrait}
                  className="w-full py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {isExportingPortrait ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>
                    {isExportingPortrait ? 'Generazione PDF...' : 'Scarica Elenco Spogliatoi 1-4 (A4 Verticale)'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fallback Paste CSV Modal */}
      {showPasteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-6 shadow-2xl text-white">
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <ClipboardPaste size={20} className="text-amber-400" />
              Incolla il contenuto CSV del Planning
            </h3>
            <p className="text-xs text-slate-400 mb-3">
              Copia il testo dal tuo foglio Excel o Google Sheet e incollalo qui sotto:
            </p>

            <textarea
              rows={8}
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={`Squadra,Lunedì,Martedì,Mercoledì,Giovedì,Venerdì\nPiccoli Amici,17:00 - 18:15 (Campo a 5),,17:00 - 18:15 (Campo a 5),,\nPulcini 1° Anno,17:30 - 19:00,,17:30 - 19:00,,17:30 - 19:00`}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 font-mono text-xs text-white focus:ring-2 focus:ring-amber-500"
            />

            <div className="flex items-center justify-end gap-2.5 mt-4">
              <button
                type="button"
                onClick={() => setShowPasteModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={handleProcessPastedCsv}
                disabled={!pastedText.trim()}
                className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md"
              >
                Elabora e Applica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Modal: Anteprima & Stampa PDF Foglio Giornaliero (A4 Carta) */}
      {showTodayPdfModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl text-white overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-850">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Stampa Foglio Giornaliero Allenamenti & Spogliatoi
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      Formato A4 Verticale
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Formato ad alta definizione per bacheca, custode e spogliatoi con orari, campi e codici colore.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowTodayPdfModal(false)}
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              {/* Controls bar: Day selector + Stats */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                    <Calendar size={14} className="text-teal-400" />
                    Seleziona Giorno da Stampare:
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    {['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'].map((d) => {
                      const count = sessions.filter((s) => s.day === d).length;
                      const isSelected = selectedPdfDay === d;
                      const isToday = d === todayItalianDay;

                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setSelectedPdfDay(d)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-teal-500 text-slate-950 shadow-md shadow-teal-500/20'
                              : 'bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700'
                          }`}
                        >
                          <span>{d}</span>
                          <span
                            className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                              isSelected
                                ? 'bg-slate-950 text-teal-300'
                                : count > 0
                                ? 'bg-slate-800 text-teal-400'
                                : 'bg-slate-800 text-slate-500'
                            }`}
                          >
                            {count}
                          </span>
                          {isToday && (
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Oggi reale" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportToday(selectedPdfDay)}
                    disabled={isExportingToday}
                    className="px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-teal-600/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isExportingToday ? (
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : todayExportSuccess ? (
                      <CheckCircle2 size={15} />
                    ) : (
                      <Download size={15} />
                    )}
                    <span>
                      {isExportingToday
                        ? 'Generazione PDF...'
                        : todayExportSuccess
                        ? 'Scaricato con Successo!'
                        : `Scarica PDF Ufficiale A4`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Day Alert if 0 sessions */}
              {sessions.filter((s) => s.day === selectedPdfDay).length === 0 && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-200">
                  <AlertCircle size={18} className="text-amber-400 shrink-0" />
                  <div>
                    <strong>Nessun allenamento programmato per {selectedPdfDay}.</strong>
                    <span className="text-slate-300 ml-1">
                      (Il foglio riporterà l'avviso di giorno di riposo. Per stampare le sedute seleziona un giorno feriale come Lunedì, Martedì, ecc.)
                    </span>
                  </div>
                </div>
              )}

              {/* Realistic Paper Preview (A4 Aspect Ratio Sheet) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                  <span className="font-semibold flex items-center gap-1.5">
                    <Eye size={14} className="text-teal-400" />
                    Anteprima Grafica del Foglio di Stampa A4:
                  </span>
                  <span className="text-[11px] font-mono">Ottimizzato per Carta Bianca & Inchiostro Laser/Inkjet</span>
                </div>

                <div className="bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-300 font-sans printable-sheet max-h-[460px] overflow-y-auto">
                  {/* Top Sky Accent Strip */}
                  <div className="h-1.5 w-full bg-sky-500 rounded-full mb-4" />

                  {/* Header */}
                  <div className="flex items-start justify-between border-b border-slate-200 pb-3 mb-4">
                    <div>
                      <h2 className="text-xl font-black text-slate-900 tracking-tight">ASD CYNTHIA 1920</h2>
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mt-0.5">
                        Foglio Allenamenti del Giorno & Assegnazione Spogliatoi
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1">
                        GIORNATA: <strong className="text-slate-900 uppercase">{selectedPdfDay}</strong> &bull; Data:{' '}
                        {new Date().toLocaleDateString('it-IT')} &bull; Sedute:{' '}
                        <strong>{sessions.filter((s) => s.day === selectedPdfDay).length}</strong>
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-[10px] font-extrabold border border-slate-300">
                        DOC. UFFICIALE DI SERVIZIO
                      </span>
                      <p className="text-[10px] text-slate-400 mt-1 font-mono">Formato A4 Portrait</p>
                    </div>
                  </div>

                  {/* Pitch rules badge */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[11px] text-slate-600 mb-4 flex items-center justify-between">
                    <div>
                      <strong>Impianti Sportivi:</strong> Campo Via Sardegna (Principale) &bull; Mercoledì U19: Monte Due Torri
                    </div>
                    <div className="text-slate-500 text-[10px]">
                      Accesso consentito 15 min prima della seduta
                    </div>
                  </div>

                  {/* Sessions Table */}
                  <div className="overflow-x-auto border border-slate-200 rounded-lg mb-5">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-900 text-white text-[11px] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-3 font-bold">Orario</th>
                          <th className="py-2.5 px-3 font-bold">Squadra / Categoria</th>
                          <th className="py-2.5 px-3 font-bold">Campo</th>
                          <th className="py-2.5 px-3 font-bold">Spogliatoio</th>
                          <th className="py-2.5 px-3 font-bold">Istruttore / Note</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {sessions.filter((s) => s.day === selectedPdfDay).length > 0 ? (
                          sessions
                            .filter((s) => s.day === selectedPdfDay)
                            .sort((a, b) => {
                              const [ah, am] = (a.startTime || '00:00').split(':').map(Number);
                              const [bh, bm] = (b.startTime || '00:00').split(':').map(Number);
                              return ah * 60 + am - (bh * 60 + bm);
                            })
                            .map((s, idx) => (
                              <tr key={s.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                <td className="py-2 px-3 font-bold text-slate-900 whitespace-nowrap">
                                  {s.startTime} - {s.endTime}
                                </td>
                                <td className="py-2 px-3 font-semibold text-slate-900">
                                  {s.team}
                                </td>
                                <td className="py-2 px-3 text-slate-600">
                                  {s.field || 'Via Sardegna'}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="font-bold text-blue-700">
                                    {s.lockerRoomName || 'Non Assegnato'}
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-slate-500 text-[11px]">
                                  {s.coach || s.notes || '-'}
                                </td>
                              </tr>
                            ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                              Nessun allenamento programmato per la giornata di {selectedPdfDay}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* 4 Locker Mini Summaries */}
                  <div className="mb-4">
                    <div className="text-[11px] font-bold uppercase text-slate-700 mb-2">
                      Riepilogo Spogliatoi del Giorno ({selectedPdfDay}):
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {lockerRooms.slice(0, 4).map((room) => {
                        const assigned = sessions.filter(
                          (s) =>
                            s.day === selectedPdfDay &&
                            (s.lockerRoomId === room.id || s.lockerRoomName === room.name)
                        );
                        return (
                          <div
                            key={room.id}
                            className="bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-[10px]"
                          >
                            <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 mb-1">
                              {room.name}
                            </div>
                            {assigned.length > 0 ? (
                              assigned.map((a, i) => (
                                <div key={i} className="text-slate-600 truncate">
                                  <strong>{a.startTime}</strong> {a.team}
                                </div>
                              ))
                            ) : (
                              <div className="text-slate-400 italic">Nessun turno</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custodian Instructions & Signature area */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[10px] text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <strong className="text-slate-800">Istruzioni Custode & Dirigente:</strong>
                      <p>
                        Apertura spogliatoi 15 min prima &bull; Verifica chiusura docce e spegnimento luci a fine turno.
                      </p>
                    </div>
                    <div className="text-right sm:text-right shrink-0">
                      <span className="text-slate-700 font-bold">Firma Custode / Dirigente:</span>
                      <div className="w-44 border-b border-slate-400 mt-3 inline-block" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-850">
              <span className="text-xs text-slate-400">
                Giorno selezionato: <strong className="text-teal-300">{selectedPdfDay}</strong> &bull;{' '}
                {sessions.filter((s) => s.day === selectedPdfDay).length} sedute
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowTodayPdfModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  Chiudi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    handleExportToday(selectedPdfDay);
                  }}
                  disabled={isExportingToday}
                  className="px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 active:bg-teal-700 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-teal-600/30 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isExportingToday ? (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : todayExportSuccess ? (
                    <CheckCircle2 size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>
                    {isExportingToday
                      ? 'Generazione PDF...'
                      : todayExportSuccess
                      ? 'Foglio Scaricato!'
                      : `Scarica PDF Ufficiale (${selectedPdfDay})`}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
