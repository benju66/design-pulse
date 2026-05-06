const ExcelJS = require('exceljs');

async function run() {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('Sheet1');
  sheet.getCell('A1').value = 'CSI Number';
  sheet.getCell('B1').value = 'Description';
  
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    console.log(`Col ${colNumber}: text='${cell.text}', value='${cell.value}'`);
  });
}
run();
