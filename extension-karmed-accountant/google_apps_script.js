/**
 * ==============================================================================
 *  🏥 KARMED & GOOGLE SHEETS "FARQ" JURNALI INTEGRATSIYA APPS SCRIPT KODI
 * ==============================================================================
 *  Spreadsheet ID: 1n5T8nqmV6cPWoSw-ex8GNmMzWWzxk8ziLRP6148hIy8
 *  Target Sheet: "Farq" (18 ta ustunli Karmed tekshiruvlar jurnali)
 * ==============================================================================
 */

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) || 'get_patient_ids';
    const sheetName = (e && e.parameter && e.parameter.sheetName) || 'Sevinch';

    if (action === 'get_patient_ids' || action === 'get_patients') {
      const sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
      if (!sheet) {
        return jsonResponse({ status: 'error', message: 'Varaq topilmadi: ' + sheetName });
      }

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return jsonResponse({ status: 'success', count: 0, patientIds: [], patients: [] });
      }

      const headers = data[0].map(h => String(h).toLowerCase().trim());
      let idColIdx = headers.findIndex(h => h === 'id' || h === 'bemor id' || h.includes('id') || h.includes('карта'));
      if (idColIdx === -1) idColIdx = 1;

      const patientIds = [];
      const patients = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rawId = String(row[idColIdx] || '').trim();
        if (!rawId) continue;

        const cleanId = rawId.replace(/[^\d]/g, '');
        if (cleanId) {
          patientIds.push(cleanId);
          patients.push({
            rowIndex: i + 1,
            id: cleanId,
            num: row[0] || i,
            fio: row[2] || '',
            birthYear: row[3] || '',
            address: row[4] || '',
            referralRoom: row[5] || '',
            paymentType: row[6] || '',
            date: row[7] ? formatDateValue(row[7]) : '',
            organs: row[8] || '',
            summa: row[9] || ''
          });
        }
      }

      return jsonResponse({
        status: 'success',
        sheetName: sheet.getName(),
        count: patientIds.length,
        patientIds: [...new Set(patientIds)],
        patients: patients
      });
    }

    return jsonResponse({ status: 'error', message: 'Noma\'lum action: ' + action });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let body = {};

    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    const action = body.action || 'save_karmed_records';
    const targetSheetName = body.sheetName || 'Farq';

    // 1. KARMED TEKSHIRUVLARI VA NARXLARINI "FARQ" VARAG'IGA SAQLASH
    if (action === 'save_karmed_records') {
      const records = body.records || body.data || [];
      if (!Array.isArray(records) || records.length === 0) {
        return jsonResponse({ status: 'error', message: 'Saqlash uchun records topilmadi' });
      }

      let sheet = ss.getSheetByName(targetSheetName);
      const standardHeaders = [
        'No', 'ID', 'Ism va familiya', 'Тип', 'Xizmat Turi', 'Funktsional xizmat bolimi',
        'Услуга', '№ Карта', 'Тип Карта', 'Отделения', 'Лечащий врач', 'dr_uygulayan',
        'Время_tarihi', 'Категория лыгот', 'Orderli_Ucret', 'Pulli_Ucret', 'Tolangan_ucret', 'Jami_ucret_toplam'
      ];

      if (!sheet) {
        sheet = ss.insertSheet(targetSheetName);
        sheet.appendRow(standardHeaders);
        sheet.getRange(1, 1, 1, standardHeaders.length)
             .setFontWeight('bold')
             .setBackground('#cfe2f3')
             .setHorizontalAlignment('center');
      }

      const existingData = sheet.getDataRange().getValues();
      const existingKeys = new Set();

      for (let i = 1; i < existingData.length; i++) {
        const row = existingData[i];
        const key = `${row[7] || row[1]}_${row[6]}_${row[12]}`.toLowerCase().replace(/\s+/g, '');
        existingKeys.add(key);
      }

      let addedCount = 0;
      const newRows = [];

      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const cardNo = r.cardNo || r.patientId || r.id || '';
        const serviceName = r.serviceName || r.service || r.usluga || 'Ultratovush tekshiruvi';
        const dateStr = r.date || r.confirmDate || r.vremya || formatDateValue(new Date());
        const key = `${cardNo}_${serviceName}_${dateStr}`.toLowerCase().replace(/\s+/g, '');

        if (!existingKeys.has(key)) {
          existingKeys.add(key);

          const privilegeCategory = r.privilegeCategory || r.muassasa || 'Rezident';
          const isOrder = privilegeCategory.toLowerCase().includes('order');
          const isSugurta = !privilegeCategory.toLowerCase().includes('rezident') || privilegeCategory.toLowerCase().includes("sug'urta") || privilegeCategory.toLowerCase().includes('sugurta') || privilegeCategory.toLowerCase().includes('vaqf');

          const priceVal = r.price || r.pulliUcret || 0;
          const priceStr = formatMoney(priceVal);
          
          let orderliStr = isOrder ? priceStr : '0';
          let pulliStr = isOrder ? '0' : priceStr;
          let tolanganStr = (isOrder || isSugurta) ? '0' : (r.debtStatus === "To'lanmagan" ? '0' : priceStr);
          let jamiStr = priceStr;

          newRows.push([
            r.no || r.orderNo || (2280000 + existingData.length + addedCount),
            r.fullId || r.pinfl || (cardNo ? `2600${cardNo.padStart(5, '0')}` : '260051000'),
            (r.fullName || r.patientName || r.fio || 'BEMOR').toUpperCase(),
            r.patientType || r.department || 'Mamologiya',
            r.serviceCategory || 'Radiologiya',
            r.functionalDept || 'Ultratovush',
            serviceName,
            cardNo,
            r.priority || r.cardType || 'Ambulator',
            r.orderingDoctor || r.fileDoctor || r.doctorName || 'Kasimov Doniyor Abrorovich',
            r.orderingDoctor || r.fileDoctor || r.doctorName || 'Kasimov Doniyor Abrorovich',
            r.performingDoctor || r.doctorName || r.dr_uygulayan || 'Kurbanova Sevinch Musayevna',
            dateStr,
            privilegeCategory, // Muassasa (Sug'urta Toshkent Shahri, Rezident, Order, No Rezident va h.k.)
            orderliStr,        // Orderli_Ucret
            pulliStr,          // Pulli_Ucret
            tolanganStr,       // Tolangan_ucret
            jamiStr            // Jami_ucret_toplam
          ]);
          addedCount++;
        }
      }

      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
      }

      return jsonResponse({
        status: 'success',
        message: `✅ "${targetSheetName}" jurnaliga ${addedCount} ta tekshiruv muvaffaqiyatli saqlandi!`,
        sheetName: targetSheetName,
        addedCount: addedCount
      });
    }

    return jsonResponse({ status: 'error', message: 'Noma\'lum action: ' + action });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatMoney(amount) {
  if (!amount && amount !== 0) return '0,00';
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^\d.]/g, '')) || 0;
  return num.toLocaleString('ru-RU') + ',00';
}

function formatDateValue(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const d = String(val.getDate()).padStart(2, '0');
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const y = val.getFullYear();
    const h = String(val.getHours()).padStart(2, '0');
    const min = String(val.getMinutes()).padStart(2, '0');
    return `${d}.${m}.${y} ${h}:${min}`;
  }
  return String(val);
}
