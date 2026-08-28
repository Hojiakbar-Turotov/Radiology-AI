/**
 * ==============================================================================
 *  🏥 KARMED & GOOGLE SHEETS AVTOMATIK INTEGRATSIYA APPS SCRIPT KODI
 * ==============================================================================
 *  Spreadsheet ID: 1n5T8nqmV6cPWoSw-ex8GNmMzWWzxk8ziLRP6148hIy8
 *  
 *  Ushbu kodni Google Sheets faylingizdagi:
 *  "Расширения" (Extensions) -> "Apps Script" bo'limiga qo'yib,
 *  "Развернуть" (Deploy) -> "Новое развертывание" -> "Веб-приложение" (Web App)
 *  sifatida ishga tushirasiz ("У кого есть доступ: Все" / "Anyone").
 * ==============================================================================
 */

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) || 'get_patient_ids';
    const sheetName = (e && e.parameter && e.parameter.sheetName) || 'Sevinch';

    // 1. SHEETS-DAN BEMOR ID LARINI VA ASOSIY MA'LUMOTLARINI OLISH
    if (action === 'get_patient_ids' || action === 'get_patients') {
      const sheet = ss.getSheetByName(sheetName) || ss.getSheets()[0];
      if (!sheet) {
        return jsonResponse({ status: 'error', message: 'Varaq topilmadi: ' + sheetName });
      }

      const data = sheet.getDataRange().getValues();
      if (data.length <= 1) {
        return jsonResponse({ status: 'success', sheetName: sheet.getName(), count: 0, patientIds: [], patients: [] });
      }

      const headers = data[0].map(h => String(h).toLowerCase().trim());
      
      // ID ustunini aniqlash (ID, Bemor ID, № Карта va h.k.)
      let idColIdx = headers.findIndex(h => h === 'id' || h === 'bemor id' || h.includes('id') || h.includes('карта'));
      if (idColIdx === -1) idColIdx = 1; // Standart B ustun (index 1)

      const patientIds = [];
      const patients = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rawId = String(row[idColIdx] || '').trim();
        if (!rawId) continue;

        // Raqamli toza ID ni olish
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

    // 2. BARCHA VARAQLAR RO'YXATINI OLISH
    if (action === 'get_sheets_list') {
      const sheetNames = ss.getSheets().map(s => s.getName());
      return jsonResponse({ status: 'success', sheets: sheetNames });
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
    const targetSheetName = body.sheetName || 'Karmed';

    // 1. KARMED TEKSHIRUVLARI VA NARXLARINI "KARMED" VARAG'IGA SAQLASH
    if (action === 'save_karmed_records') {
      const records = body.records || body.data || [];
      if (!Array.isArray(records) || records.length === 0) {
        return jsonResponse({ status: 'error', message: 'Saqlash uchun records topilmadi' });
      }

      let sheet = ss.getSheetByName(targetSheetName);
      if (!sheet) {
        sheet = ss.insertSheet(targetSheetName);
        // Sarlavhalarni yaratish (Foydalanuvchi Sheets formatiga 100% mos)
        const standardHeaders = [
          '№', 'ID', 'Ism va familiya', 'Тип', 'Xizmat Turi', 'Funktsional xizmat bolimi',
          'Услуга', '№ Карта', 'Тип Карта', 'Отделения', 'Лечащий врач', 'dr_uygulayan',
          'Время_tarihi', 'Категория лыгот', 'Orderli_Ucret', 'Pulli_Ucret', 'Tolangan_ucret', 'Jami_ucret_toplam'
        ];
        sheet.appendRow(standardHeaders);
        sheet.getRange(1, 1, 1, standardHeaders.length).setFontWeight('bold').setBackground('#e2e8f0');
      }

      const existingData = sheet.getDataRange().getValues();
      const existingKeys = new Set();

      // Takroriy qatorlarni tekshirish uchun kalit: ID + Xizmat + Sana
      for (let i = 1; i < existingData.length; i++) {
        const row = existingData[i];
        const key = `${row[1]}_${row[6]}_${row[12]}`.toLowerCase().replace(/\s+/g, '');
        existingKeys.add(key);
      }

      let addedCount = 0;
      let updatedCount = 0;
      const newRows = [];

      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        const key = `${r.patientId || r.id}_${r.serviceName || r.service || r.usluga}_${r.date || r.confirmDate || r.vremya}`.toLowerCase().replace(/\s+/g, '');

        if (!existingKeys.has(key)) {
          existingKeys.add(key);

          const priceStr = formatMoney(r.price || r.pulliUcret || r.cost || 0);
          const paidStr = formatMoney(r.paidAmount || r.tolanganUcret || r.price || 0);

          newRows.push([
            r.orderNo || (existingData.length + addedCount),
            r.cardNo || r.patientId || r.id || '',
            r.fullName || r.patientName || r.fio || '',
            r.patientType || r.department || 'Mamologiya',
            r.serviceCategory || 'Radiologiya',
            r.functionalDept || 'Ultratovush',
            r.serviceName || r.service || r.usluga || 'Ultratovush tekshiruvi',
            r.patientId || r.cardNo || '',
            r.priority || r.cardType || 'Ambulator',
            r.orderingDoctor || r.fileDoctor || r.doctorName || '',
            r.orderingDoctor || r.fileDoctor || r.doctorName || '',
            r.performingDoctor || r.doctorName || r.dr_uygulayan || 'Kurbanova Sevinch Musayevna',
            r.date || r.confirmDate || r.registeredDate || formatDateValue(new Date()),
            r.privilegeCategory || 'Rezident',
            r.orderliUcret || 0,
            priceStr,
            paidStr,
            paidStr
          ]);
          addedCount++;
        }
      }

      if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
      }

      return jsonResponse({
        status: 'success',
        message: `${addedCount} ta tekshiruv yozuvi muvaffaqiyatli saqlandi`,
        addedCount: addedCount,
        totalInSheet: sheet.getLastRow() - 1
      });
    }

    // 2. "SEVINCH" VARAG'IDAGI BEMORLARNING BO'SH SUMMASINI VA XIZMATLARINI TO'LDIRISH
    if (action === 'update_source_sheet_prices') {
      const sourceSheet = ss.getSheetByName(body.sourceSheetName || 'Sevinch');
      const updates = body.patientSummaries || []; // { patientId: "37065", totalSum: "346000", servicesList: "жкт, почки" }

      if (!sourceSheet || updates.length === 0) {
        return jsonResponse({ status: 'error', message: 'Manba varag\'i yoki yangilanishlar topilmadi' });
      }

      const data = sourceSheet.getDataRange().getValues();
      let updatedRows = 0;

      const updateMap = {};
      updates.forEach(u => {
        if (u.patientId) updateMap[String(u.patientId).trim()] = u;
      });

      for (let i = 1; i < data.length; i++) {
        const pId = String(data[i][1] || '').trim();
        if (updateMap[pId]) {
          const u = updateMap[pId];
          // Organlar (ustun 8 / index 8) agar bo'sh bo'lsa
          if (u.servicesList && !data[i][8]) {
            sourceSheet.getRange(i + 1, 9).setValue(u.servicesList);
          }
          // Summa (ustun 9 / index 9) agar bo'sh bo'lsa
          if (u.totalSum && (!data[i][9] || data[i][9] === 0 || data[i][9] === '')) {
            sourceSheet.getRange(i + 1, 10).setValue(u.totalSum);
            updatedRows++;
          }
        }
      }

      return jsonResponse({
        status: 'success',
        message: `${updatedRows} ta bemor summasi yangilandi`,
        updatedRows: updatedRows
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
