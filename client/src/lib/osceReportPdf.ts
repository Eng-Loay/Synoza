import { jsPDF } from 'jspdf';
import reshaper from 'arabic-persian-reshaper';

export interface OsceReportLabels {
  certificateTitle: string;
  officialReport: string;
  totalScore: string;
  station: string;
  patient: string;
  date: string;
  sessionId: string;
  scoreCommunication: string;
  scoreHistory: string;
  scoreClinicalReason: string;
  scoreOrganization: string;
  scoreClosing: string;
  strengths: string;
  weaknesses: string;
  missedQuestions: string;
  clinicalErrors: string;
  recommendations: string;
  idealApproach: string;
  fullReport: string;
  certifiedSeal: string;
  platformName: string;
}

export interface OsceReportData {
  sessionId: string;
  stationTitle: string;
  patientName: string;
  result: Record<string, unknown>;
  isAr: boolean;
  labels: OsceReportLabels;
}

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 14;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H = 5.2;

let cairoRegularBase64: string | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function loadFontBase64(): Promise<string> {
  if (cairoRegularBase64) return cairoRegularBase64;
  const res = await fetch('/fonts/Cairo-Regular.ttf');
  if (!res.ok) throw new Error('font-load-failed');
  cairoRegularBase64 = arrayBufferToBase64(await res.arrayBuffer());
  return cairoRegularBase64;
}

async function loadReportLogo(): Promise<string | null> {
  for (const path of ['/report-logo.png', '/report-logo.svg', '/favicon.svg']) {
    try {
      const res = await fetch(path);
      if (!res.ok) continue;
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('logo-read-failed'));
        reader.readAsDataURL(blob);
      });
    } catch {
      /* try next */
    }
  }
  return null;
}

function prepareText(text: string, isAr: boolean): string {
  if (!text) return '';
  if (!isAr) return text;
  return reshaper.ArabicShaper.convertArabic(text);
}

function scoreColor(score: number): [number, number, number] {
  if (score >= 70) return [5, 150, 105];
  if (score >= 50) return [217, 119, 6];
  return [220, 38, 38];
}

function stripMarkdown(text: string): string {
  return text
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^[-*]\s+/gm, '• ')
    .trim();
}

function setupDoc(fontBase64: string, isAr: boolean): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.addFileToVFS('Cairo-Regular.ttf', fontBase64);
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'normal');
  doc.addFont('Cairo-Regular.ttf', 'Cairo', 'bold');
  doc.setFont('Cairo', 'normal');
  if (isAr) doc.setR2L(true);
  return doc;
}

function textX(isAr: boolean): number {
  return isAr ? PAGE_W - MARGIN : MARGIN;
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > PAGE_H - MARGIN) {
    doc.addPage();
    return MARGIN + 4;
  }
  return y;
}

function drawHeader(
  doc: jsPDF,
  labels: OsceReportLabels,
  logoDataUrl: string | null,
  isAr: boolean,
): number {
  let y = MARGIN + 2;
  const x = textX(isAr);

  if (logoDataUrl) {
    try {
      const fmt = logoDataUrl.includes('png') ? 'PNG' : 'JPEG';
      doc.addImage(logoDataUrl, fmt, isAr ? PAGE_W - MARGIN - 16 : MARGIN, y - 2, 16, 16);
    } catch {
      /* skip logo */
    }
  }

  doc.setFont('Cairo', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 118, 110);
  doc.text(prepareText(labels.platformName, isAr), x, y + 5, { align: isAr ? 'right' : 'left' });

  doc.setFont('Cairo', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(prepareText(labels.certificateTitle, isAr), x, y + 11, { align: isAr ? 'right' : 'left' });

  doc.setFontSize(8);
  doc.text(prepareText(labels.officialReport, isAr), isAr ? MARGIN : PAGE_W - MARGIN, y + 5, {
    align: isAr ? 'left' : 'right',
  });

  y += 16;
  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(0.8);
  doc.line(MARGIN, y, PAGE_W - MARGIN, y);
  return y + 6;
}

function drawMeta(
  doc: jsPDF,
  data: OsceReportData,
  dateStr: string,
  y: number,
  isAr: boolean,
): number {
  const items = [
    [data.labels.station, data.stationTitle],
    [data.labels.patient, data.patientName],
    [data.labels.date, dateStr],
    [data.labels.sessionId, data.sessionId.slice(0, 12)],
  ] as const;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN, y, CONTENT_W, 22, 3, 3, 'FD');

  const colW = CONTENT_W / 2;
  items.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cellX = isAr
      ? PAGE_W - MARGIN - col * colW - 4
      : MARGIN + col * colW + 4;
    const cellY = y + 6 + row * 10;

    doc.setFont('Cairo', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(prepareText(label, isAr), cellX, cellY, { align: isAr ? 'right' : 'left' });

    doc.setFont('Cairo', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(prepareText(value, isAr), cellX, cellY + 4.5, { align: isAr ? 'right' : 'left' });
  });

  return y + 28;
}

function drawScores(doc: jsPDF, data: OsceReportData, y: number, isAr: boolean): number {
  const total = Number(data.result.totalScore ?? 0);
  const scores = [
    [data.labels.scoreCommunication, Number(data.result.communicationScore ?? 0)],
    [data.labels.scoreHistory, Number(data.result.historyTakingScore ?? 0)],
    [data.labels.scoreClinicalReason, Number(data.result.clinicalReasonScore ?? 0)],
    [data.labels.scoreOrganization, Number(data.result.organizationScore ?? 0)],
    [data.labels.scoreClosing, Number(data.result.closingScore ?? 0)],
  ] as const;

  doc.setFillColor(240, 253, 250);
  doc.setDrawColor(153, 246, 228);
  doc.setLineWidth(0.5);
  doc.roundedRect(MARGIN, y, CONTENT_W, 32, 4, 4, 'FD');

  const totalX = isAr ? PAGE_W - MARGIN - 8 : MARGIN + 8;
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(prepareText(data.labels.totalScore, isAr), totalX, y + 10, { align: isAr ? 'right' : 'left' });

  doc.setFont('Cairo', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(...scoreColor(total));
  doc.text(`${total}%`, totalX, y + 22, { align: isAr ? 'right' : 'left' });

  const gridW = 118;
  const gridX = isAr ? MARGIN + 4 : PAGE_W - MARGIN - gridW - 4;
  const cellW = gridW / 5;
  scores.forEach(([label, value], i) => {
    const cx = gridX + i * cellW + 1;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cx, y + 6, cellW - 2, 20, 2, 2, 'FD');

    doc.setFont('Cairo', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    const labelLines = doc.splitTextToSize(prepareText(label, isAr), cellW - 4) as string[];
    doc.text(labelLines.slice(0, 2), cx + cellW / 2, y + 11, { align: 'center', maxWidth: cellW - 4 });

    doc.setFont('Cairo', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...scoreColor(value));
    doc.text(`${value}%`, cx + cellW / 2, y + 21, { align: 'center' });
  });

  return y + 38;
}

function drawSection(
  doc: jsPDF,
  title: string,
  body: string,
  y: number,
  isAr: boolean,
): number {
  if (!body?.trim()) return y;

  const x = textX(isAr);
  const prepared = prepareText(stripMarkdown(body), isAr);
  const bodyLines = doc.splitTextToSize(prepared, CONTENT_W - 8) as string[];
  const boxH = 14 + bodyLines.length * LINE_H;

  y = ensureSpace(doc, y, boxH + 4);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(MARGIN, y, CONTENT_W, boxH, 3, 3, 'FD');

  doc.setFont('Cairo', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 118, 110);
  doc.text(prepareText(title, isAr), x, y + 6, { align: isAr ? 'right' : 'left' });

  doc.setDrawColor(204, 251, 241);
  doc.setLineWidth(0.3);
  doc.line(MARGIN + 4, y + 8, PAGE_W - MARGIN - 4, y + 8);

  doc.setFont('Cairo', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  let lineY = y + 13;
  for (const line of bodyLines) {
    doc.text(line, x, lineY, { align: isAr ? 'right' : 'left', maxWidth: CONTENT_W - 8 });
    lineY += LINE_H;
  }

  return y + boxH + 6;
}

function drawSeal(doc: jsPDF, label: string, y: number, isAr: boolean): number {
  y = ensureSpace(doc, y, 40);
  const cx = isAr ? MARGIN + 22 : PAGE_W - MARGIN - 22;
  const cy = y + 18;

  doc.setDrawColor(20, 184, 166);
  doc.setLineWidth(0.9);
  doc.circle(cx, cy, 18, 'S');
  doc.setLineWidth(0.3);
  doc.circle(cx, cy, 15, 'S');

  doc.setFont('Cairo', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 118, 110);
  doc.text('SYNOZA', cx, cy - 3, { align: 'center' });
  doc.setFontSize(6.5);
  doc.text(prepareText(label, isAr), cx, cy + 2, { align: 'center' });
  doc.setFontSize(6);
  doc.text('OSCE', cx, cy + 7, { align: 'center' });

  return y + 38;
}

export async function downloadOsceReportPdf(data: OsceReportData): Promise<void> {
  const [fontBase64, logoDataUrl] = await Promise.all([loadFontBase64(), loadReportLogo()]);
  const { result, labels, isAr } = data;
  const doc = setupDoc(fontBase64, isAr);

  const dateStr = new Date().toLocaleString(isAr ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  let y = drawHeader(doc, labels, logoDataUrl, isAr);
  y = drawMeta(doc, data, dateStr, y, isAr);
  y = drawScores(doc, data, y, isAr);

  const sections = [
    [labels.strengths, String(result.strengths ?? '')],
    [labels.weaknesses, String(result.weaknesses ?? '')],
    [labels.missedQuestions, String(result.missedQuestions ?? '')],
    [labels.clinicalErrors, String(result.clinicalErrors ?? '')],
    [labels.recommendations, String(result.recommendations ?? '')],
    [labels.idealApproach, String(result.idealApproach ?? '')],
  ] as const;

  for (const [title, body] of sections) {
    y = drawSection(doc, title, body, y, isAr);
  }

  const fullReport =
    (result.fullReport as string) ||
    sections
      .filter(([, body]) => body.trim())
      .map(([title, body]) => `${title}\n${body}`)
      .join('\n\n');

  if (fullReport.trim()) {
    y = drawSection(doc, labels.fullReport, fullReport, y, isAr);
  }

  y = ensureSpace(doc, y, 20);
  const x = textX(isAr);
  doc.setFont('Cairo', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(
    prepareText(`${labels.platformName} — ${labels.officialReport}`, isAr),
    x,
    y,
    { align: isAr ? 'right' : 'left' },
  );
  doc.text(prepareText(dateStr, isAr), x, y + 4, { align: isAr ? 'right' : 'left' });

  drawSeal(doc, labels.certifiedSeal, y - 4, isAr);

  doc.save(`synoza-report-${data.sessionId.slice(0, 8)}.pdf`);
}
