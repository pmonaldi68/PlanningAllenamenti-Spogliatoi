import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TrainingSession, LockerRoom, DAYS_OF_WEEK, DayOfWeek } from '../types';

// Day sorting helper
const DAY_ORDER: Record<string, number> = {
  Lunedì: 1,
  Martedì: 2,
  Mercoledì: 3,
  Giovedì: 4,
  Venerdì: 5,
  Sabato: 6,
  Domenica: 7,
};

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const parts = t.split(':').map((p) => parseInt(p, 10));
  return (parts[0] || 0) * 60 + (parts[1] || 0);
}

// Locker room color definitions (RGB)
export const LOCKER_ROOM_PALETTE: Record<
  string,
  {
    fill: [number, number, number];
    text: [number, number, number];
    border: [number, number, number];
    solid: [number, number, number];
  }
> = {
  'lr-1': {
    fill: [239, 246, 255],   // sky/blue-50
    text: [29, 78, 216],     // blue-700
    border: [147, 197, 253], // blue-300
    solid: [37, 99, 235],    // blue-600
  },
  'lr-2': {
    fill: [236, 253, 245],   // emerald-50
    text: [4, 120, 87],      // emerald-700
    border: [110, 231, 183], // emerald-300
    solid: [16, 185, 129],   // emerald-500
  },
  'lr-3': {
    fill: [245, 243, 255],   // violet-50
    text: [109, 40, 217],    // violet-700
    border: [196, 181, 253], // violet-300
    solid: [139, 92, 246],   // violet-500
  },
  'lr-4': {
    fill: [254, 243, 199],   // amber-100
    text: [180, 83, 9],      // amber-700
    border: [252, 211, 77],  // amber-300
    solid: [245, 158, 11],   // amber-500
  },
};

const DEFAULT_ROOM_COLOR = {
  fill: [241, 245, 249] as [number, number, number],
  text: [71, 85, 105] as [number, number, number],
  border: [203, 213, 225] as [number, number, number],
  solid: [100, 116, 139] as [number, number, number],
};

/**
 * 1A. GENERAZIONE DOCUMENTO PDF PLANNING SETTIMANALE SCHEMATICO - A4 ORIZZONTALE (1 FOGLIO SINGOLO)
 * Layout: Griglia a Colonne Giornaliere (Lunedì - Venerdì)
 * Ottimizzato specificamente per entrare esattamente in 1 FOGLIO A4 ORIZZONTALE (Landscape),
 * con visualizzazione a colpo d'occhio di orari, squadre, campi e spogliatoi con codifica colore.
 */
export function generateWeeklySchematicColumnsPdfDoc(
  sessions: TrainingSession[],
  lockerRooms: LockerRoom[],
  clubName = 'CYNTHIA1920'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  const dateStr = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = new Date().toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Locker room lookup map
  const lockerMap = new Map<string, LockerRoom>();
  lockerRooms.forEach((r) => lockerMap.set(r.id, r));

  // Determine active days: default Lun-Ven, plus Sabato/Domenica only if they have sessions
  const baseDays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
  const hasSaturday = sessions.some((s) => s.day === 'Sabato');
  const hasSunday = sessions.some((s) => s.day === 'Domenica');
  const activeDays = [...baseDays];
  if (hasSaturday) activeDays.push('Sabato');
  if (hasSunday) activeDays.push('Domenica');

  // Top cyan paper accent line
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 0, pageWidth, 3.5, 'F');

  // Header Title
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`ASD ${clubName} — QUADRO SCHEMATICO SETTIMANALE ALLENAMENTI`, 10, 10);

  // Top-Right Official Badge
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(pageWidth - 78, 6.5, 68, 6, 1.2, 1.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('QUADRO GENERALE UFFICIALE • FOGLIO UNICO', pageWidth - 75, 10.7);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Impianti: Via Sardegna (Campi Principali) • Mercoledì U19: Monte Due Torri  |  Totale Sedute: ${sessions.length}  |  Aggiornato al: ${dateStr} ore ${timeStr}`,
    10,
    15
  );

  // Schematic Legend Bar (Spogliatoi & Campi)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(10, 17.5, pageWidth - 20, 7.5, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('LEGENDA SPOGLIATOI:', 13, 22.3);

  // Locker Pills in Legend
  let legendX = 47;
  lockerRooms.forEach((room) => {
    const palette = LOCKER_ROOM_PALETTE[room.id] || DEFAULT_ROOM_COLOR;
    doc.setFillColor(palette.fill[0], palette.fill[1], palette.fill[2]);
    doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
    doc.roundedRect(legendX, 18.7, 30, 5, 1, 1, 'FD');

    // Solid color indicator square
    doc.setFillColor(palette.solid[0], palette.solid[1], palette.solid[2]);
    doc.rect(legendX + 1.2, 19.8, 2.8, 2.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(palette.text[0], palette.text[1], palette.text[2]);
    doc.text(`${room.code}: ${room.name}`, legendX + 5, 22.3);

    legendX += 32;
  });

  // Pitch Notes on right of legend
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Campi: Via Sardegna (Principale)  •  Monte Due Torri (Sintetico)',
    pageWidth - 92,
    22.3
  );

  // Schematic Columns Grid
  const gridStartY = 27;
  const footerStartY = 198;
  const availableHeight = footerStartY - gridStartY; // 171 mm
  const totalUsableWidth = pageWidth - 20; // 277 mm
  const numDays = activeDays.length;
  const colGap = 2.5;
  const colWidth = (totalUsableWidth - (numDays - 1) * colGap) / numDays;

  activeDays.forEach((day, colIndex) => {
    const colX = 10 + colIndex * (colWidth + colGap);

    // Get and sort sessions for this day
    const daySessions = sessions
      .filter((s) => s.day === day)
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

    // Column Header
    const colHeaderH = 8;
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(colX, gridStartY, colWidth, colHeaderH, 1.5, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(day.toUpperCase(), colX + 3.5, gridStartY + 5.5);

    // Badge with count of sessions
    doc.setFillColor(51, 65, 85);
    doc.roundedRect(colX + colWidth - 17, gridStartY + 1.8, 14, 4.4, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(226, 232, 240);
    doc.text(`${daySessions.length} sedute`, colX + colWidth - 16, gridStartY + 4.9);

    // Column Body Background
    const bodyY = gridStartY + colHeaderH + 1;
    const bodyHeight = availableHeight - colHeaderH - 2;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(colX, bodyY, colWidth, bodyHeight, 1.5, 1.5, 'FD');

    if (daySessions.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Nessun allenamento', colX + colWidth / 2, bodyY + 25, {
        align: 'center',
      });
    } else {
      // Calculate dynamic card height to fit perfectly inside the column
      const cardGap = 2;
      const totalGaps = (daySessions.length - 1) * cardGap;
      const maxCardHeight = (bodyHeight - 4 - totalGaps) / daySessions.length;
      // Cap at 36mm max for pleasant proportion, min 22mm
      const cardHeight = Math.min(36, Math.max(22, maxCardHeight));

      daySessions.forEach((session, sIdx) => {
        const cardY = bodyY + 2 + sIdx * (cardHeight + cardGap);
        const room = session.lockerRoomId ? lockerMap.get(session.lockerRoomId) : null;
        const palette = (room && LOCKER_ROOM_PALETTE[room.id]) || DEFAULT_ROOM_COLOR;

        // Card Container
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225);
        doc.roundedRect(colX + 1.5, cardY, colWidth - 3, cardHeight, 1.5, 1.5, 'FD');

        // Color accent strip on left border of card
        doc.setFillColor(palette.solid[0], palette.solid[1], palette.solid[2]);
        doc.roundedRect(colX + 1.5, cardY, 2.2, cardHeight, 0.8, 0.8, 'F');

        // Top Row: Time + Locker Room Badge
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text(`${session.startTime} - ${session.endTime}`, colX + 5, cardY + 4.8);

        // Locker Badge
        const roomCode = room ? room.code : session.lockerRoomName ? session.lockerRoomName.substring(0, 4) : 'SP-?';
        const badgeW = 12;
        const badgeX = colX + colWidth - 3 - badgeW - 1.5;
        doc.setFillColor(palette.fill[0], palette.fill[1], palette.fill[2]);
        doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
        doc.roundedRect(badgeX, cardY + 1.5, badgeW, 4.2, 0.8, 0.8, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.2);
        doc.setTextColor(palette.text[0], palette.text[1], palette.text[2]);
        doc.text(roomCode, badgeX + badgeW / 2, cardY + 4.4, { align: 'center' });

        // Middle Row: Team Name
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.6);
        doc.setTextColor(30, 41, 59);
        const maxTeamChars = colWidth > 50 ? 28 : 22;
        const shortTeam = session.team.length > maxTeamChars ? session.team.substring(0, maxTeamChars - 2) + '..' : session.team;
        doc.text(shortTeam, colX + 5, cardY + 9.5);

        // Third Row: Field Info
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        const isMonteDueTorri = (session.field || '').includes('Monte Due Torri');
        if (isMonteDueTorri) {
          doc.setTextColor(180, 83, 9); // amber-700
          doc.setFont('helvetica', 'bold');
          doc.text('Campo: Monte Due Torri', colX + 5, cardY + 13.8);
        } else {
          doc.setTextColor(100, 116, 139);
          doc.text('Campo: Via Sardegna', colX + 5, cardY + 13.8);
        }

        // Fourth Row: Coach / Notes (if cardHeight allows)
        if (cardHeight >= 20) {
          const coachText = session.coach ? session.coach : session.notes ? session.notes : '';
          if (coachText) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(6.2);
            doc.setTextColor(100, 116, 139);
            const shortCoach = coachText.length > 26 ? coachText.substring(0, 24) + '..' : coachText;
            doc.text(shortCoach, colX + 5, cardY + 17.5);
          }
        }
      });
    }
  });

  // Footer bar on same single page
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `ASD ${clubName} • Quadro Schematizzato Settimanale per Bacheca & Custodi • Stampato il ${dateStr} ore ${timeStr}`,
    10,
    pageHeight - 6
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('FOGLIO UNICO (A4 ORIZZONTALE) — PAGINA 1 DI 1', pageWidth - 70, pageHeight - 6);

  return doc;
}

/**
 * 1B. GENERAZIONE DOCUMENTO PDF MATRICE SETTIMANALE PER SQUADRE - A4 ORIZZONTALE (1 FOGLIO SINGOLO)
 * Layout: Matrice Categorie / Squadre (Righe) × Giorni della Settimana (Colonne)
 * Ottimizzato specificamente per entrare esattamente in 1 FOGLIO A4 ORIZZONTALE (Landscape),
 * offrendo una visione d'insieme immediata di tutta la settimana per ogni categoria.
 */
export function generateWeeklySchematicMatrixPdfDoc(
  sessions: TrainingSession[],
  lockerRooms: LockerRoom[],
  clubName = 'CYNTHIA1920'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  const dateStr = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = new Date().toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Locker room lookup map
  const lockerMap = new Map<string, LockerRoom>();
  lockerRooms.forEach((r) => lockerMap.set(r.id, r));

  // Determine active days: default Lun-Ven
  const baseDays = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì'];
  const hasSaturday = sessions.some((s) => s.day === 'Sabato');
  const activeDays = [...baseDays];
  if (hasSaturday) activeDays.push('Sabato');

  // Extract unique teams in natural chronological order
  const teamOrder: string[] = [
    'Piccoli Amici',
    'Primi Calci',
    'Pulcini',
    'Esordienti',
    'Giovanissimi',
    'Allievi',
    'Under 19',
    'Prima Squadra',
  ];

  const uniqueTeams = Array.from(new Set(sessions.map((s) => s.team))).sort((a, b) => {
    const idxA = teamOrder.findIndex((t) => a.toLowerCase().includes(t.toLowerCase()));
    const idxB = teamOrder.findIndex((t) => b.toLowerCase().includes(t.toLowerCase()));
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });

  // Top cyan paper accent line
  doc.setFillColor(14, 165, 233);
  doc.rect(0, 0, pageWidth, 3.5, 'F');

  // Header
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`ASD ${clubName} — MATRICE SETTIMANALE SQUADRE & SPOGLIATOI`, 10, 10);

  // Top Badge
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(pageWidth - 78, 6.5, 68, 6, 1.2, 1.2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(51, 65, 85);
  doc.text('QUADRO GENERALE UFFICIALE • FOGLIO UNICO', pageWidth - 75, 10.7);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Impianti: Via Sardegna (Campi Principali) • Mercoledì U19: Monte Due Torri  |  Totale Sedute: ${sessions.length}  |  Aggiornato al: ${dateStr} ore ${timeStr}`,
    10,
    15
  );

  // Legend Bar
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(10, 17.5, pageWidth - 20, 7.5, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('SPOGLIATOI:', 13, 22.3);

  let legendX = 35;
  lockerRooms.forEach((room) => {
    const palette = LOCKER_ROOM_PALETTE[room.id] || DEFAULT_ROOM_COLOR;
    doc.setFillColor(palette.fill[0], palette.fill[1], palette.fill[2]);
    doc.setDrawColor(palette.border[0], palette.border[1], palette.border[2]);
    doc.roundedRect(legendX, 18.7, 30, 5, 1, 1, 'FD');

    doc.setFillColor(palette.solid[0], palette.solid[1], palette.solid[2]);
    doc.rect(legendX + 1.2, 19.8, 2.8, 2.8, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(palette.text[0], palette.text[1], palette.text[2]);
    doc.text(`${room.code}: ${room.name}`, legendX + 5, 22.3);

    legendX += 32;
  });

  // Pitch Notes
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Campi: Via Sardegna (Principale)  •  Monte Due Torri (U19 Mercoledì)',
    pageWidth - 96,
    22.3
  );

  // Build Table Data
  const headRow = ['Squadra / Categoria', ...activeDays];
  const bodyRows = uniqueTeams.map((teamName) => {
    const row = [teamName];
    activeDays.forEach((day) => {
      const match = sessions.find((s) => s.team === teamName && s.day === day);
      if (match) {
        const room = match.lockerRoomId ? lockerMap.get(match.lockerRoomId) : null;
        const roomLabel = room ? room.name : match.lockerRoomName || 'Spogl.';
        const fieldLabel = match.field?.includes('Monte Due Torri') ? 'Monte Due Torri' : 'Via Sardegna';
        row.push(`${match.startTime} - ${match.endTime}\n[${roomLabel}]\n${fieldLabel}`);
      } else {
        row.push('—');
      }
    });
    return row;
  });

  // Table Column Widths
  const dayColWidth = (pageWidth - 20 - 52) / activeDays.length;
  const colStyles: Record<number, any> = {
    0: { fontStyle: 'bold', cellWidth: 52, fillColor: [248, 250, 252] },
  };
  activeDays.forEach((_, idx) => {
    colStyles[idx + 1] = { cellWidth: dayColWidth, halign: 'center' };
  });

  // Generate Table using autoTable
  autoTable(doc, {
    startY: 27,
    head: [headRow],
    body: bodyRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 7.2,
      textColor: [30, 41, 59],
      cellPadding: 2.2,
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    columnStyles: colStyles,
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index > 0) {
        const cellText = String(data.cell.raw || '');
        if (cellText === '—') {
          data.cell.styles.textColor = [160, 174, 192];
          data.cell.styles.fillColor = [250, 250, 250];
        } else {
          // Color text based on locker room
          if (cellText.includes('Spogliatoio 1') || cellText.includes('SP-1')) {
            data.cell.styles.textColor = [29, 78, 216];
            data.cell.styles.fillColor = [245, 250, 255];
          } else if (cellText.includes('Spogliatoio 2') || cellText.includes('SP-2')) {
            data.cell.styles.textColor = [4, 120, 87];
            data.cell.styles.fillColor = [240, 253, 248];
          } else if (cellText.includes('Spogliatoio 3') || cellText.includes('SP-3')) {
            data.cell.styles.textColor = [109, 40, 217];
            data.cell.styles.fillColor = [250, 245, 255];
          } else if (cellText.includes('Spogliatoio 4') || cellText.includes('SP-4')) {
            data.cell.styles.textColor = [180, 83, 9];
            data.cell.styles.fillColor = [255, 252, 240];
          }
        }
      }
    },
    margin: { top: 27, left: 10, right: 10, bottom: 12 },
  });

  // Footer bar on same single page
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `ASD ${clubName} • Quadro Sinottico Settimanale per Categorie • Stampato il ${dateStr} ore ${timeStr}`,
    10,
    pageHeight - 6
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('FOGLIO UNICO (A4 ORIZZONTALE) — PAGINA 1 DI 1', pageWidth - 70, pageHeight - 6);

  return doc;
}

/**
 * 1C. DISPATCHER & EXPORT PLANNING SETTIMANALE SCHEMATICO - A4 ORIZZONTALE
 * Genera e scarica il file PDF ottimizzato su 1 FOGLIO A4 ORIZZONTALE
 */
export function generateWeeklySchematicPdfDoc(
  sessions: TrainingSession[],
  lockerRooms: LockerRoom[],
  clubName = 'CYNTHIA1920',
  mode: 'columns' | 'matrix' = 'columns'
): jsPDF {
  if (mode === 'matrix') {
    return generateWeeklySchematicMatrixPdfDoc(sessions, lockerRooms, clubName);
  }
  return generateWeeklySchematicColumnsPdfDoc(sessions, lockerRooms, clubName);
}

export function exportWeeklyPlanningPdf(
  sessions: TrainingSession[],
  lockerRooms: LockerRoom[],
  clubName = 'CYNTHIA1920',
  mode: 'columns' | 'matrix' = 'columns'
): void {
  const doc = generateWeeklySchematicPdfDoc(sessions, lockerRooms, clubName, mode);
  doc.save(`Planning_Settimanale_Schematico_${clubName}_A4_Orizzontale.pdf`);
}

export function exportWeeklySchematicColumnsPdf(
  sessions: TrainingSession[],
  lockerRooms: LockerRoom[],
  clubName = 'CYNTHIA1920'
): void {
  const doc = generateWeeklySchematicColumnsPdfDoc(sessions, lockerRooms, clubName);
  doc.save(`Planning_Settimanale_Colonne_${clubName}_A4_Orizzontale.pdf`);
}

export function exportWeeklySchematicMatrixPdf(
  sessions: TrainingSession[],
  lockerRooms: LockerRoom[],
  clubName = 'CYNTHIA1920'
): void {
  const doc = generateWeeklySchematicMatrixPdfDoc(sessions, lockerRooms, clubName);
  doc.save(`Planning_Settimanale_Matrice_${clubName}_A4_Orizzontale.pdf`);
}

/**
 * 2. EXPORT ELENCO PER OGNI SPOGLIATOIO - A4 VERTICALE (PORTRAIT)
 * Per ogni spogliatoio (Spogliatoio 1, 2, 3, 4), genera l'elenco ordinato
 * di tutte le squadre che lo utilizzano durante la settimana.
 * Formattato come cartello/tabella pronto per essere affisso sulla porta di ciascuno spogliatoio.
 */
export function exportLockerRoomsOrderedListPdf(
  sessions: TrainingSession[],
  lockerRooms: LockerRoom[],
  clubName = 'CYNTHIA1920'
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const dateStr = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Colors for each locker room (RGB)
  const roomColors: Record<string, [number, number, number]> = {
    'lr-1': [37, 99, 235],   // Blue
    'lr-2': [16, 185, 129],  // Emerald
    'lr-3': [139, 92, 246],  // Purple
    'lr-4': [245, 158, 11],  // Amber
  };

  // We print each of the 4 locker rooms on its own clean A4 page (ideal for door signs!)
  lockerRooms.forEach((room, index) => {
    if (index > 0) {
      doc.addPage();
    }

    const roomRgb = roomColors[room.id] || [51, 65, 85];

    // Top banner color band
    doc.setFillColor(roomRgb[0], roomRgb[1], roomRgb[2]);
    doc.rect(0, 0, pageWidth, 28, 'F');

    // Title inside banner
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text(room.name.toUpperCase(), 14, 15);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`${clubName} — PIANO ASSEGNAZIONE SETTIMANALE SQUADRE`, 14, 22);

    // Filter sessions for this locker room
    const roomSessions = sessions
      .filter((s) => s.lockerRoomId === room.id)
      .sort((a, b) => {
        const dayDiff = (DAY_ORDER[a.day] || 99) - (DAY_ORDER[b.day] || 99);
        if (dayDiff !== 0) return dayDiff;
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      });

    // Sub-header box with room details & rules
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(12, 34, pageWidth - 24, 20, 3, 3, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text(`Riepilogo Assegnazione per: ${room.name}`, 16, 41);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `Totale turni settimanali assegnati: ${roomSessions.length} squadre  |  Accesso consentito 15 min prima dell'allenamento`,
      16,
      48
    );

    // Table Data
    const tableData =
      roomSessions.length > 0
        ? roomSessions.map((s) => [
            s.day,
            `${s.startTime} - ${s.endTime}`,
            s.team,
            s.field || 'Via Sardegna',
            s.coach || '-',
          ])
        : [['-', '-', 'Nessuna squadra programmata per questo spogliatoio', '-', '-']];

    autoTable(doc, {
      startY: 58,
      head: [['Giorno', 'Orario Allenamento', 'Squadra / Categoria', 'Campo di Gioco', 'Istruttore / Coach']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: roomRgb,
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9.5,
        halign: 'left',
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [30, 41, 59],
        cellPadding: 3.5,
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 26 }, // Giorno
        1: { fontStyle: 'bold', cellWidth: 32 }, // Orario
        2: { fontStyle: 'bold', cellWidth: 58 }, // Squadra
        3: { cellWidth: 42 },                   // Campo
        4: { cellWidth: 'auto' },               // Coach
      },
      margin: { top: 58, left: 12, right: 12, bottom: 25 },
    });

    // Locker room etiquette notice box at bottom
    const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 180;
    if (finalY < pageHeight - 35) {
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(12, finalY, pageWidth - 24, 18, 2, 2, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text('Regole Spogliatoio:', 16, finalY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        '1. Lasciare lo spogliatoio in ordine e pulito  •  2. Non lasciare oggetti di valore incustoditi  •  3. Rispettare gli orari di fine turno',
        16,
        finalY + 11
      );
    }

    // Page footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Cartello ${room.name} • ${clubName} • Documento A4 Verticale • Aggiornato il ${dateStr}`,
      14,
      pageHeight - 8
    );
    doc.text(`Pagina ${index + 1} di ${lockerRooms.length}`, pageWidth - 32, pageHeight - 8);
  });

  // Save PDF
  doc.save(`Elenco_Spogliatoi_CYNTHIA1920_A4_Verticale.pdf`);
}

/**
 * 3. EXPORT FOGLIO ALLENAMENTI DI OGGI - A4 VERTICALE (PORTRAIT)
 * Genera il foglio ufficiale delle sedute di allenamento e degli spogliatoi
 * per il giorno indicato (o per la giornata odierna), formattato con impostazioni
 * ad alta leggibilità e ottimizzato per la carta e per il risparmio di inchiostro,
 * pronto per essere stampato e affisso in bacheca o consegnato ai custodi dei campi.
 */
export function generateTodayPlanningPdfDoc(
  sessions: TrainingSession[],
  lockerRooms: LockerRoom[],
  dayName?: string,
  clubName = 'CYNTHIA1920'
): jsPDF {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const DAYS_IT = [
    'Domenica',
    'Lunedì',
    'Martedì',
    'Mercoledì',
    'Giovedì',
    'Venerdì',
    'Sabato',
  ];
  const targetDay = dayName || DAYS_IT[new Date().getDay()];

  // Filter sessions for targetDay and sort by startTime
  const daySessions = sessions
    .filter((s) => s.day === targetDay)
    .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  const dateStr = new Date().toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = new Date().toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Top paper accent strip (3mm ink-efficient)
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Club Name & Official Header
  doc.setTextColor(15, 23, 42); // slate-900
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(`ASD ${clubName}`, 14, 14);

  // Document Badge
  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225); // slate-300
  doc.roundedRect(pageWidth - 80, 8, 66, 7, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.text('DOCUMENTO UFFICIALE DI SERVIZIO', pageWidth - 77, 12.8);

  // Main Sheet Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text(`FOGLIO ALLENAMENTI DEL GIORNO & ASSEGNAZIONE SPOGLIATOI`, 14, 21);

  // Day & Date Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `GIORNATA: ${targetDay.toUpperCase()}   |   DATA: ${dateStr}   |   SEDUTE TOTALI: ${daySessions.length}   |   EMESSO: ORE ${timeStr}`,
    14,
    27
  );

  // Locker map
  const lockerMap = new Map<string, LockerRoom>();
  lockerRooms.forEach((r) => lockerMap.set(r.id, r));

  // Facilities info box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(12, 30, pageWidth - 24, 13, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(30, 41, 59);
  doc.text(
    `IMPIANTI: Campo Via Sardegna (Principale) • Mercoledì U19: Monte Due Torri`,
    15,
    35
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text(
    `Accesso consentito 15 minuti prima dell'allenamento. Consegna spogliatoi in ordine entro 25 minuti dal termine.`,
    15,
    40
  );

  // Table rows
  const tableData =
    daySessions.length > 0
      ? daySessions.map((s) => {
          const room = s.lockerRoomId ? lockerMap.get(s.lockerRoomId) : null;
          const lockerName = room?.name || s.lockerRoomName || 'Non Assegnato';
          const field = s.field || 'Via Sardegna';

          return [
            `${s.startTime} - ${s.endTime}`,
            s.team,
            field,
            lockerName,
            s.coach || s.notes || '-',
          ];
        })
      : [
          [
            '-',
            `Nessun allenamento programmato per la giornata di ${targetDay}`,
            '-',
            '-',
            '-',
          ],
        ];

  autoTable(doc, {
    startY: 46,
    head: [['Orario', 'Squadra / Categoria', 'Campo di Gioco', 'Spogliatoio Assegnato', 'Istruttore / Note']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // slate-800
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [30, 41, 59],
      cellPadding: 2.8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 28 }, // Orario
      1: { fontStyle: 'bold', cellWidth: 52 }, // Squadra
      2: { cellWidth: 38 },                   // Campo
      3: { fontStyle: 'bold', cellWidth: 34 }, // Spogliatoio
      4: { cellWidth: 'auto' },               // Note
    },
    didParseCell: (data) => {
      // Highlight Spogliatoio column based on room name
      if (data.section === 'body' && data.column.index === 3) {
        const val = String(data.cell.raw || '');
        if (val.includes('1')) {
          data.cell.styles.textColor = [29, 78, 216]; // blue-700
        } else if (val.includes('2')) {
          data.cell.styles.textColor = [4, 120, 87]; // emerald-700
        } else if (val.includes('3')) {
          data.cell.styles.textColor = [109, 40, 217]; // purple-700
        } else if (val.includes('4')) {
          data.cell.styles.textColor = [180, 83, 9]; // amber-700
        }
      }
      // Highlight Monte Due Torri pitch
      if (data.section === 'body' && data.column.index === 2) {
        const val = String(data.cell.raw || '');
        if (val.includes('Monte Due Torri')) {
          data.cell.styles.textColor = [180, 83, 9];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    margin: { top: 46, left: 12, right: 12, bottom: 48 },
  });

  // Calculate final Y after table
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 6 : 170;

  // If there's enough space on the page, add Locker Room Summary & Custodian Signatures
  if (finalY < pageHeight - 48) {
    // Locker summary title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(`RIEPILOGO RAPIDO SPOGLIATOI — ${targetDay.toUpperCase()}`, 12, finalY + 4);

    // 4 mini boxes for the 4 locker rooms
    const boxWidth = (pageWidth - 24 - 9) / 4;
    const boxHeight = 18;
    const boxY = finalY + 6;

    const roomColors: Record<string, number[]> = {
      'lr-1': [239, 246, 255], // blue-50
      'lr-2': [236, 253, 245], // emerald-50
      'lr-3': [245, 243, 255], // purple-50
      'lr-4': [254, 252, 232], // amber-50
    };
    const roomBorderColors: Record<string, number[]> = {
      'lr-1': [147, 197, 253],
      'lr-2': [110, 231, 183],
      'lr-3': [196, 181, 253],
      'lr-4': [252, 211, 77],
    };

    lockerRooms.slice(0, 4).forEach((room, idx) => {
      const bx = 12 + idx * (boxWidth + 3);
      const bg = roomColors[room.id] || [248, 250, 252];
      const bc = roomBorderColors[room.id] || [203, 213, 225];

      doc.setFillColor(bg[0], bg[1], bg[2]);
      doc.setDrawColor(bc[0], bc[1], bc[2]);
      doc.roundedRect(bx, boxY, boxWidth, boxHeight, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(room.name, bx + 3, boxY + 4.5);

      // Find teams in this room today
      const assigned = daySessions.filter(
        (s) => s.lockerRoomId === room.id || s.lockerRoomName === room.name
      );

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);

      if (assigned.length === 0) {
        doc.text('Libero per la giornata', bx + 3, boxY + 9.5);
      } else {
        assigned.slice(0, 2).forEach((s, sIdx) => {
          const shortTeam = s.team.length > 20 ? s.team.substring(0, 18) + '...' : s.team;
          doc.text(`${s.startTime}: ${shortTeam}`, bx + 3, boxY + 9 + sIdx * 4);
        });
      }
    });

    // Custodian Sign-off and Notes Box
    const notesY = boxY + boxHeight + 4;
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(12, notesY, pageWidth - 24, 18, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Istruzioni Custode & Dirigente di Servizio:', 15, notesY + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    doc.setTextColor(71, 85, 105);
    doc.text('1. Apertura e aerazione spogliatoi 15 minuti prima della seduta.', 15, notesY + 9.5);
    doc.text('2. Controllo chiusura docce, spegnimento fari campo e porte bloccate a fine turno.', 15, notesY + 13.5);

    // Signature field
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(30, 41, 59);
    doc.text('Firma Custode / Dirigente:', pageWidth - 90, notesY + 9.5);
    doc.setDrawColor(148, 163, 184);
    doc.line(pageWidth - 52, notesY + 10, pageWidth - 15, notesY + 10);
  }

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `ASD ${clubName} • Foglio Giornaliero (${targetDay}) • Pagina ${i} di ${totalPages}`,
      14,
      pageHeight - 6
    );
    doc.text(`Stampato il ${dateStr} ore ${timeStr}`, pageWidth - 55, pageHeight - 6);
  }

  return doc;
}

export function exportTodayPlanningPdf(
  sessions: TrainingSession[],
  lockerRooms: LockerRoom[],
  dayName?: string,
  clubName = 'CYNTHIA1920'
): void {
  const doc = generateTodayPlanningPdfDoc(sessions, lockerRooms, dayName, clubName);
  const DAYS_IT = [
    'Domenica',
    'Lunedì',
    'Martedì',
    'Mercoledì',
    'Giovedì',
    'Venerdì',
    'Sabato',
  ];
  const targetDay = dayName || DAYS_IT[new Date().getDay()];
  const cleanDayName = targetDay.replace(/\s+/g, '_');
  doc.save(`Foglio_Allenamenti_${cleanDayName}_${clubName}.pdf`);
}

