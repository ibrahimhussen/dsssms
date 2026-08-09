import ExcelJS from 'exceljs';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

/** Builds a single-sheet .xlsx workbook and returns it as a Buffer, ready to send as a download. */
export async function buildExcelWorkbook(params: {
  sheetName: string;
  columns: ExcelColumn[];
  rows: Record<string, unknown>[];
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'DSSSMS';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(params.sheetName);
  sheet.columns = params.columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 20 }));
  sheet.getRow(1).font = { bold: true };
  sheet.addRows(params.rows);

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
