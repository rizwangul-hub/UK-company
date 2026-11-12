import PDFDocument from 'pdfkit';

export const reportColors = {
  navy: '173443',
  teal: '087F73',
  ink: '203646',
  muted: '526578',
  border: 'D6E3E8',
  stripe: 'F4F8FA',
  tealLight: 'E6F3F1',
  blue: '284A69',
  blueLight: 'EAF1F8',
  green: '16634C',
  greenLight: 'E9F5EE',
  red: 'A1283D',
  redLight: 'FCEEF1',
  amber: '855713',
  amberLight: 'FFF4DE',
  white: 'FFFFFF',
};

export const gbpNumberFormat = '"£"#,##0.00;[Red]-"£"#,##0.00;"£"0.00';
export const reportSum = (column, first, last) =>
  last >= first ? { formula: `SUM(${column}${first}:${column}${last})` } : 0;
const argb = color => ({ argb: 'FF' + color });
const fill = color => ({ type: 'pattern', pattern: 'solid', fgColor: argb(color) });

// Style existing rows in place so export formulas and references stay intact.
export function styleReportBand(sheet, rowNumber, variant, columnCount = sheet.columnCount) {
  const row = sheet.getRow(rowNumber);
  const isTitle = variant === 'title';
  const isTotal = variant === 'total';
  const background = isTitle ? reportColors.navy : isTotal ? reportColors.blueLight : reportColors.tealLight;
  row.height = Math.max(row.height || 0, isTitle ? 30 : 24);
  for (let index = 1; index <= columnCount; index++) {
    const cell = row.getCell(index);
    if (cell.value === '') cell.value = null;
    cell.fill = fill(background);
    cell.font = {
      ...cell.font, name: 'Calibri', bold: true, size: isTitle ? 15 : 11,
      color: argb(isTitle ? reportColors.white : reportColors.navy),
    };
    cell.alignment = { ...cell.alignment, vertical: 'middle', wrapText: true };
  }
}

export function configureReportSheet(sheet, { freezeRows = 0, headerRow, lastDataRow } = {}) {
  const columnCount = sheet.columnCount;
  sheet.properties.tabColor = argb(reportColors.teal);
  sheet.views = [freezeRows
    ? { state: 'frozen', ySplit: freezeRows, showGridLines: false }
    : { showGridLines: false }];
  sheet.pageSetup = {
    ...sheet.pageSetup, orientation: columnCount > 6 ? 'landscape' : 'portrait',
    paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0,
    ...(headerRow ? { printTitlesRow: `${headerRow}:${headerRow}` } : {}),
  };
  if (headerRow && lastDataRow >= headerRow) {
    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: lastDataRow, column: columnCount },
    };
  }
}

export function styleReportRows(sheet, first, last, { currencyColumns = [] } = {}) {
  for (let number = first; number <= last; number++) {
    const row = sheet.getRow(number);
    let lines = 1;
    row.eachCell({ includeEmpty: true }, (cell, column) => {
      if (cell.value === '') cell.value = null;
      cell.fill = fill((number - first) % 2 === 0 ? reportColors.white : reportColors.stripe);
      cell.font = { name: 'Calibri', size: 11, color: argb(reportColors.ink), ...cell.font };
      cell.alignment = { ...cell.alignment, vertical: 'middle', wrapText: true };
      if (currencyColumns.includes(column)) {
        cell.numFmt = gbpNumberFormat;
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      }
      if (typeof cell.value === 'string') {
        const charsPerLine = Math.max(6, Math.floor((sheet.getColumn(column).width || 12) * 0.9));
        const estimate = cell.value.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
        lines = Math.max(lines, estimate);
      }
    });
    row.height = Math.max(row.height || 0, Math.min(405, 14 * lines + 6));
  }
}

export function styleStatusCell(cell, tone) {
  if (!tone) return;
  cell.fill = fill(reportColors[tone + 'Light']);
  cell.font = { ...cell.font, bold: true, color: argb(reportColors[tone]) };
}

const hex = color => '#' + reportColors[color];
const display = value => String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[–—]/g, '-').trim() || '-';

/**
 * Shared A4 landscape layout. Coordinates and row heights are managed here so
 * PDFKit never has to start a page while drawing a table cell or footer.
 */
export function renderReportPdf({ title, sections }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0, bufferPages: true, info: { Title: title, Author: 'PIXX Property' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const margin = 30;
    const width = doc.page.width - 2 * margin;
    const limit = doc.page.height - 55;
    const pageSections = [];
    let y = margin;

    const font = (size, color = 'ink', bold = false) => doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size).fillColor(hex(color));
    const write = (value, x, top, textWidth, height, align = 'left') =>
      doc.text(display(value), x, top, { width: textWidth, height, align, ellipsis: true, lineGap: 1 });
    const divider = at => doc.strokeColor(hex('border')).lineWidth(0.6).moveTo(margin, at).lineTo(margin + width, at).stroke();

    const header = (section, continued = false) => {
      pageSections.push(section.company);
      doc.rect(0, 0, doc.page.width, 6).fill(hex('teal'));
      let x = margin;
      if (section.logo) {
        try {
          doc.image(section.logo, margin, margin + 2, { fit: [46, 44], align: 'center', valign: 'center' });
          x += 58;
        } catch {
          // The document is still readable when an optional logo is unavailable.
        }
      }
      const metaWidth = 212;
      const titleWidth = margin + width - x - metaWidth - 16;
      font(9, 'teal', true);
      write(section.company, x, margin, titleWidth, 13);
      font(continued ? 15 : 22, 'navy', true);
      write(continued ? `${section.title} (continued)` : section.title, x, margin + 15, titleWidth, 51);
      font(9, 'muted');
      for (const [index, detail] of (section.details || []).entries()) {
        write(detail, margin + width - metaWidth, margin + index * 15, metaWidth, 14, 'right');
      }
      y = margin + 72;
      divider(y);
      y += 13;
    };

    const metricCards = metrics => {
      if (!metrics?.length) return;
      const gap = 9;
      const cardWidth = (width - (metrics.length - 1) * gap) / metrics.length;
      for (const [index, { label, value, tone = 'teal' }] of metrics.entries()) {
        const x = margin + index * (cardWidth + gap);
        doc.roundedRect(x, y, cardWidth, 54, 6).fill(hex(tone + 'Light'));
        font(8, 'muted', true);
        write(label, x + 9, y + 8, cardWidth - 18, 20);
        font(14, tone, true);
        if (doc.widthOfString(display(value)) > cardWidth - 18) font(11, tone, true);
        write(value, x + 9, y + 30, cardWidth - 18, 18);
      }
      y += 70;
    };

    const table = (section, definition) => {
      const { columns, rows, heading, total, empty = 'No records to display.' } = definition;
      const weight = columns.reduce((sum, col) => sum + col.width, 0);
      const widths = columns.map(col => width * col.width / weight);
      const headingHeight = 24;
      const headerHeight = 26;
      const lineHeight = 13;
      const pad = 7;

      const rowHeight = values => {
        font(8.8);
        const needed = values.reduce((height, value, index) => {
          const text = display(value);
          const cellHeight = doc.heightOfString(text, { width: widths[index] - 2 * pad, lineGap: 1 });
          return Math.max(height, cellHeight);
        }, lineHeight);
        return Math.min(82, Math.max(24, needed + 2 * pad));
      };
      const drawHeader = (continued = false) => {
        font(12, 'navy', true);
        write(continued ? `${heading} (continued)` : heading, margin, y, width, 20);
        y += headingHeight;
        doc.roundedRect(margin, y, width, headerHeight, 4).fill(hex('navy'));
        let x = margin;
        columns.forEach((column, i) => {
          font(8.4, 'white', true);
          write(column.label, x + pad, y + 5, widths[i] - 2 * pad, headerHeight - 7, column.align);
          x += widths[i];
        });
        y += headerHeight;
      };
      const drawRow = (values, index, height, isTotal = false) => {
        doc.rect(margin, y, width, height).fill(hex(isTotal ? 'tealLight' : index % 2 ? 'stripe' : 'white'));
        let x = margin;
        values.forEach((value, i) => {
          const column = columns[i];
          if (isTotal && value === '') {
            x += widths[i];
            return;
          }
          const tone = column.tone ? column.tone(value) : 'ink';
          font(8.8, tone, isTotal || Boolean(column.tone));
          if (column.align === 'right' && doc.widthOfString(display(value)) > widths[i] - 2 * pad) {
            font(7.5, tone, isTotal || Boolean(column.tone));
          }
          write(value, x + pad, y + pad - 1, widths[i] - 2 * pad, height - 2 * pad + 2, column.align);
          x += widths[i];
        });
        y += height;
        divider(y);
      };
      const newPage = () => {
        doc.addPage();
        header(section, true);
      };
      if (y + headingHeight + headerHeight + (rows.length ? rowHeight(rows[0]) : 34) > limit) newPage();
      drawHeader();
      if (!rows.length) {
        doc.rect(margin, y, width, 34).fill(hex('stripe'));
        font(9, 'muted');
        write(empty, margin + pad, y + 10, width - pad * 2, 15);
        y += 34;
      }
      rows.forEach((values, index) => {
        const height = rowHeight(values);
        if (y + height > limit) {
          newPage();
          drawHeader(true);
        }
        drawRow(values, index, height);
      });
      if (total && rows.length) {
        const height = rowHeight(total);
        if (y + height > limit) {
          newPage();
          drawHeader(true);
        }
        drawRow(total, 0, height, true);
      }
      y += 20;
    };

    sections.forEach((section, index) => {
      if (index > 0) doc.addPage();
      header(section);
      metricCards(section.metrics);
      for (const definition of section.tables) table(section, definition);
    });

    const { start, count } = doc.bufferedPageRange();
    for (let index = start; index < start + count; index++) {
      doc.switchToPage(index);
      const footer = doc.page.height - 33;
      divider(footer - 4);
      font(8, 'muted');
      write(`${pageSections[index - start]} | Confidential`, margin, footer + 3, width - 90, 13);
      write(`Page ${index - start + 1} of ${count}`, margin + width - 90, footer + 3, 90, 13, 'right');
    }
    doc.end();
  });
}
