import { DisciplineConfig } from '@/types/models';

export async function generateCoordinationTemplate(
  buildingAreas: string[],
  costCodes: string[],
  disciplines: DisciplineConfig[]
): Promise<Blob> {
  // Use dynamic import to avoid bloating the main Next.js client bundle
  // and specifically use the browser-safe minified version to prevent Node.js stream errors.
  const ExcelJSModule = await import('exceljs/dist/exceljs.min.js');
  const ExcelJS = ExcelJSModule.default || ExcelJSModule;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Design Pulse';
  workbook.lastModifiedBy = 'Design Pulse';
  workbook.created = new Date();

  // Create the main worksheet
  const sheet = workbook.addWorksheet('Coordination Import');

  // Define columns
  const baseColumns = [
    { header: 'Title', key: 'title', width: 30 },
    { header: 'Description', key: 'description', width: 50 },
    { header: 'Priority', key: 'priority', width: 15 },
    { header: 'Building Area', key: 'building_area', width: 30 },
    { header: 'Cost Code', key: 'cost_code', width: 40 },
    { header: 'Cost Type', key: 'cost_type', width: 20 },
  ];

  const disciplineColumns = disciplines.map(d => ({
    header: `[Disc] ${d.label}`,
    key: `disc_${d.id}`,
    width: 20
  }));

  sheet.columns = [...baseColumns, ...disciplineColumns];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF4F46E5' }, // Indigo 600
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  // Lock header row (protect sheet but allow inserting rows and formatting cells)
  await sheet.protect('designpulse', {
    selectLockedCells: true,
    selectUnlockedCells: true,
    formatCells: true,
    formatColumns: true,
    formatRows: true,
    insertRows: true,
    insertColumns: false,
    insertHyperlinks: true,
    deleteRows: true,
    deleteColumns: false,
    sort: true,
    autoFilter: true
  });
  
  // Unlock all cells below the header so users can type
  const totalColumns = baseColumns.length + disciplineColumns.length;
  for (let col = 1; col <= totalColumns; col++) {
    for (let row = 2; row <= 1000; row++) {
      sheet.getCell(row, col).protection = { locked: false };
    }
  }

  // --- Hidden Metadata Sheet for Dropdowns ---
  // Using a hidden sheet bypasses the 255 character limit for Data Validation lists
  const metaSheet = workbook.addWorksheet('Metadata', { state: 'hidden' });
  
  const safeBuildingAreas = buildingAreas.length > 0 ? buildingAreas : ['N/A'];
  const safeCostCodes = costCodes.length > 0 ? costCodes : ['N/A'];
  const priorities = ['Critical', 'High', 'Medium', 'Low'];
  const costTypes = ['Labor', 'Material', 'Subcontract', 'Equipment', 'Other'];

  // Write dropdown data to columns A, B, C, D
  metaSheet.getColumn('A').values = ['Priority', ...priorities];
  metaSheet.getColumn('B').values = ['Building Area', ...safeBuildingAreas];
  metaSheet.getColumn('C').values = ['Cost Code', ...safeCostCodes];
  metaSheet.getColumn('D').values = ['Cost Type', ...costTypes];

  // Apply Data Validations to the main sheet
  for (let i = 2; i <= 1000; i++) {
    // Priority Validation (Column C)
    sheet.getCell(`C${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=Metadata!$A$2:$A$${priorities.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Priority',
      error: 'Please select a valid priority from the dropdown.'
    };

    // Building Area Validation (Column D)
    sheet.getCell(`D${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=Metadata!$B$2:$B$${safeBuildingAreas.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Building Area',
      error: 'Please select a valid building area from the dropdown.'
    };

    // Cost Code Validation (Column E)
    sheet.getCell(`E${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=Metadata!$C$2:$C$${safeCostCodes.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Cost Code',
      error: 'Please select a valid cost code from the dropdown.'
    };

    // Cost Type Validation (Column F) — Rosetta Stone
    sheet.getCell(`F${i}`).dataValidation = {
      type: 'list',
      allowBlank: true,
      formulae: [`=Metadata!$D$2:$D$${costTypes.length + 1}`],
      showErrorMessage: true,
      errorTitle: 'Invalid Cost Type',
      error: 'Please select a valid cost type (Labor, Material, Subcontract, Equipment, or Other).'
    };

    // Discipline Validations (Yes/No)
    for (let j = 0; j < disciplineColumns.length; j++) {
      // Columns are 1-indexed
      const colIndex = baseColumns.length + 1 + j;
      const colLetter = sheet.getColumn(colIndex).letter;
      sheet.getCell(`${colLetter}${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: ['"Yes,No"'],
        showErrorMessage: true,
        errorTitle: 'Invalid Input',
        error: 'Please select Yes or No.'
      };
    }
  }

  // Generate ArrayBuffer and return as Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
