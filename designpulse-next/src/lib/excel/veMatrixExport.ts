import { Opportunity, OpportunityOption, ProjectCsiSpec } from '@/types/models';

export async function generateVeMatrixTemplate(
  opportunities: Opportunity[],
  optionsMap: Record<string, OpportunityOption[]>,
  buildingAreas: string[],
  costCodes: string[],
  maxOptionCount: number,
  csiSpecs?: ProjectCsiSpec[]
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
  const sheet = workbook.addWorksheet('VE Matrix');

  // Define columns
  const baseColumns = [
    { header: 'ID', key: 'display_id', width: 12 },
    { header: 'Title (Element)', key: 'title', width: 30 },
  ];

  const contenderColumns = [];
  // maxOptionCount now correctly includes the empty trailing slot from the UI calculation
  for (let i = 0; i <= maxOptionCount; i++) {
    contenderColumns.push({ header: `[C${i + 1}] Title`, key: `opt_${i}_title`, width: 25 });
    contenderColumns.push({ header: `[C${i + 1}] Cost`, key: `opt_${i}_cost`, width: 15 });
  }

  const trailingColumns = [
    { header: 'Cost Impact ($)', key: 'cost_impact', width: 18 },
    { header: 'Days Impact', key: 'days_impact', width: 15 },
    { header: 'VE Status', key: 'status', width: 20 },
    { header: 'Final Direction', key: 'final_direction', width: 30 },
    { header: 'Building Area', key: 'building_area', width: 25 },
    { header: 'Division', key: 'division', width: 20 },
    { header: 'Cost Code', key: 'cost_code', width: 30 },
    { header: 'CSI Spec', key: 'spec_number_id', width: 25 },
    { header: 'Priority', key: 'priority', width: 15 },
    { header: 'Assigned User', key: 'assignee', width: 25 },
    { header: 'Due Date', key: 'due_date', width: 15 },
  ];

  sheet.columns = [...baseColumns, ...contenderColumns, ...trailingColumns];

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0284C7' }, // Sky 600
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
  const totalColumns = baseColumns.length + contenderColumns.length + trailingColumns.length;
  for (let col = 1; col <= totalColumns; col++) {
    for (let row = 2; row <= 1000; row++) {
      sheet.getCell(row, col).protection = { locked: false };
    }
  }

  // --- Map Data into Rows ---
  opportunities.forEach(opp => {
    const rowData: Record<string, unknown> = {
      display_id: opp.display_id || '',
      title: opp.title || '',
      cost_impact: opp.cost_impact || 0,
      days_impact: opp.days_impact || 0,
      status: opp.status || 'Draft',
      final_direction: opp.final_direction || '',
      building_area: opp.building_area || '',
      division: opp.division || '',
      cost_code: opp.cost_code || '',
      spec_number_id: (() => {
        if (!opp.spec_number_id) return '';
        const spec = csiSpecs?.find(s => s.id === opp.spec_number_id);
        return spec ? `${spec.csi_number} - ${spec.description || ''}`.trim() : opp.spec_number_id;
      })(),
      priority: opp.priority || '',
      assignee: opp.assignee || '',
      due_date: opp.due_date || '',
    };

    const options = optionsMap[opp.id] || [];
    for (let i = 0; i <= maxOptionCount; i++) {
      const opt = options.find(o => o.order_index === i);
      if (opt) {
        rowData[`opt_${i}_title`] = opt.title;
        rowData[`opt_${i}_cost`] = opt.cost_impact;
      }
    }

    sheet.addRow(rowData);
  });

  // --- Hidden Metadata Sheet for Dropdowns ---
  const metaSheet = workbook.addWorksheet('Metadata', { state: 'hidden' });
  
  const safeBuildingAreas = buildingAreas.length > 0 ? buildingAreas : ['N/A'];
  const safeCostCodes = costCodes.length > 0 ? costCodes : ['N/A'];
  const priorities = ['Critical', 'High', 'Medium', 'Low'];
  const statuses = ['Draft', 'Pending Plan Update', 'Ready for Review', 'Implemented', 'Approved', 'Rejected'];

  // Write dropdown data
  metaSheet.getColumn('A').values = ['Priority', ...priorities];
  metaSheet.getColumn('B').values = ['Building Area', ...safeBuildingAreas];
  metaSheet.getColumn('C').values = ['Cost Code', ...safeCostCodes];
  metaSheet.getColumn('D').values = ['Status', ...statuses];

  // Apply Data Validations
  const statusCol = baseColumns.length + contenderColumns.length + 3; // +3 for cost_impact, days_impact, status
  const buildingAreaCol = baseColumns.length + contenderColumns.length + 5;
  const costCodeCol = baseColumns.length + contenderColumns.length + 7;
  const priorityCol = baseColumns.length + contenderColumns.length + 9;

  const getColLetter = (index: number) => sheet.getColumn(index).letter;

  for (let i = 2; i <= Math.max(1000, opportunities.length + 50); i++) {
    // Status
    sheet.getCell(`${getColLetter(statusCol)}${i}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`=Metadata!$D$2:$D$${statuses.length + 1}`],
      showErrorMessage: true, errorTitle: 'Invalid Status', error: 'Please select a valid VE Status.'
    };
    // Building Area
    sheet.getCell(`${getColLetter(buildingAreaCol)}${i}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`=Metadata!$B$2:$B$${safeBuildingAreas.length + 1}`],
      showErrorMessage: true, errorTitle: 'Invalid Area', error: 'Please select a valid building area.'
    };
    // Cost Code
    sheet.getCell(`${getColLetter(costCodeCol)}${i}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`=Metadata!$C$2:$C$${safeCostCodes.length + 1}`],
      showErrorMessage: true, errorTitle: 'Invalid Cost Code', error: 'Please select a valid cost code.'
    };
    // Priority
    sheet.getCell(`${getColLetter(priorityCol)}${i}`).dataValidation = {
      type: 'list', allowBlank: true,
      formulae: [`=Metadata!$A$2:$A$${priorities.length + 1}`],
      showErrorMessage: true, errorTitle: 'Invalid Priority', error: 'Please select a valid priority.'
    };
  }

  // Generate ArrayBuffer and return as Blob
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
