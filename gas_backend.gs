// =========================================================
// NỀN NẾP CNT — Google Apps Script Backend
// Phiên bản: 1.4 (Cập nhật lần cuối: 2026-03-16)
// Tác giả: Lương Hải Anh
// Mô tả: Backend xử lý CRUD cho Google Sheets
// =========================================================

// --- CẤU HÌNH ---
const SPREADSHEET_ID = '1taypp0IhgTN2hGPi5GpHl9TC-viDwMLiclAtcO7kREk';
const DRIVE_FOLDER_ID = '1VfEXuGC3XjDPiAW3wQZCAQ-I4OF3EVvC';

// --- ĐỊNH NGHĨA CẤU TRÚC DỮ LIỆU ---
const SCHEMA = {
  Users: ['id', 'name', 'username', 'password', 'role', 'className', 'email', 'summaryMeetings'],
  Classes: ['id', 'name', 'grade', 'homeroomTeacher'],
  Students: ['id', 'name', 'classId', 'bikeNumber'],
  Criteria: ['id', 'content', 'points', 'type'],
  Violations: ['id', 'date', 'classId', 'studentId', 'criteriaId', 'points', 'note', 'images', 'reportedBy', 'isSecurityReport', 'timestamp'],
  // Sheet Mới: Achievements (Thành tích) - Cấu trúc tương tự để đồng bộ hệ thống
  Achievements: ['id', 'date', 'classId', 'studentId', 'criteriaId', 'points', 'note', 'images', 'reportedBy', 'timestamp'],
  TimeConfigs: ['id', 'name', 'type', 'startDate', 'endDate']
};

// --- HÀM SETUP DATABASE ---
function setupDatabase() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  Object.keys(SCHEMA).forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
    }
    const headers = SCHEMA[sheetName];
    const lastCol = sheet.getLastColumn() || 1;
    const currentHeaderRange = sheet.getRange(1, 1, 1, Math.max(lastCol, headers.length));
    const currentHeaderValues = currentHeaderRange.getValues()[0];
    
    // Update header nếu khác
    const needUpdate = JSON.stringify(currentHeaderValues.slice(0, headers.length)) !== JSON.stringify(headers);
    if (needUpdate) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e2e8f0");
    }
  });
  
  // Đảm bảo sheet AuditLogs cũng được tạo
  let auditSheet = ss.getSheetByName('AuditLogs');
  if (!auditSheet) {
    auditSheet = ss.insertSheet('AuditLogs');
    auditSheet.appendRow([
      'ID', 'Thời gian', 'Người thực hiện', 'Vai trò',
      'Hành động', 'ID Vi phạm', 'Ngày vi phạm',
      'Lớp', 'Nội dung lỗi', 'Điểm trừ', 'Ghi chú'
    ]);
    auditSheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    auditSheet.setFrozenRows(1);
  }
}

// --- API HANDLING ---
function doGet(e) { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000); 

  try {
    const action = e.parameter.action;
    let data = {};
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    }

    let result = {};

    switch (action) {
      case 'getAllData':
        result = getAllData();
        break;
      case 'createViolation':
        // Tự động phân loại dựa trên điểm số (Dương -> Vi phạm, Âm -> Thành tích)
        if (data.points < 0) {
           result = createRecord('Achievements', data);
        } else {
           result = createRecord('Violations', data);
        }
        break;
      case 'updateViolation':
         // Thử update ở Violations trước, nếu không thấy thì tìm ở Achievements
         result = updateRecordMultiSheet(['Violations', 'Achievements'], data);
         break;
      case 'deleteViolation':
        result = deleteRecordMultiSheet(['Violations', 'Achievements'], data.id);
        break;
      case 'deleteViolations': 
        result = deleteRecordsMultiSheet(['Violations', 'Achievements'], data.ids);
        break;
      case 'syncSettings': 
        result = syncSettingsData(data);
        break;
      case 'uploadImage': 
        result = handleImageUpload(data);
        break;
      // ✅ Audit Log endpoints
      case 'saveAuditLog':
        result = saveAuditLog(data);
        break;
      case 'getAuditLogs':
        result = getAuditLogs();
        break;
      // ✅ Xác thực server-side (password không bao giờ rời khỏi server)
      case 'verifyLogin':
        result = verifyLogin(data.username, data.password);
        break;
      default:
        result = { error: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// --- CORE FUNCTIONS ---

// 1. Lấy dữ liệu (Gộp cả Violations và Achievements vào mảng Violations trả về)
// ⚠️ BẢO MẬT: Trường 'password' bị loại bỏ khỏi mảng Users trước khi trả về client
function getAllData() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const result = {};
  
  Object.keys(SCHEMA).forEach(sheetName => {
    // Bỏ qua xử lý riêng Achievements ở vòng lặp này, sẽ xử lý gộp
    if (sheetName === 'Achievements') return;

    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    
    const lastRow = sheet.getLastRow();
    const headers = SCHEMA[sheetName];
    
    let sheetData = [];
    if (lastRow > 1) {
       const rawData = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
       sheetData = mapDataToObjects(rawData, headers);
    }

    // Nếu là Violations, lấy thêm từ Achievements và gộp vào
    if (sheetName === 'Violations') {
       const achSheet = ss.getSheetByName('Achievements');
       if (achSheet && achSheet.getLastRow() > 1) {
           const achHeaders = SCHEMA['Achievements'];
           const achRawData = achSheet.getRange(2, 1, achSheet.getLastRow() - 1, achHeaders.length).getValues();
           const achData = mapDataToObjects(achRawData, achHeaders);
           sheetData = sheetData.concat(achData);
       }
    }

    // ⚠️ BẢO MẬT: Xóa trường password khỏi dữ liệu Users trước khi gửi về client
    // Password chỉ được dùng trong verifyLogin() — so sánh hoàn toàn trên server
    if (sheetName === 'Users') {
      sheetData = sheetData.map(function(u) {
        var safe = {};
        Object.keys(u).forEach(function(k) { if (k !== 'password') safe[k] = u[k]; });
        return safe;
      });
    }

    result[sheetName] = sheetData;
  });
  
  return result;
}

// ✅ Xác thực đăng nhập server-side
// Password so sánh hoàn toàn trên GAS, KHÔNG gửi password về browser
// Trả về: { success: true, user: {...} } hoặc { success: false, error: '...' }
function verifyLogin(username, password) {
  if (!username || !password) {
    return { success: false, error: 'Thiếu thông tin đăng nhập' };
  }
  
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('Users');
  if (!sheet || sheet.getLastRow() <= 1) {
    return { success: false, error: 'Không tìm thấy dữ liệu người dùng' };
  }
  
  const headers = SCHEMA['Users'];
  const rawData = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  const users = mapDataToObjects(rawData, headers);
  
  // Tìm user khớp username + password (so sánh trên server)
  const matched = users.find(function(u) {
    return u.username === username && u.password === password;
  });
  
  if (!matched) {
    return { success: false, error: 'Tên đăng nhập hoặc mật khẩu không đúng' };
  }
  
  // Trả về user object KHÔNG có trường password
  var safeUser = {};
  Object.keys(matched).forEach(function(k) { if (k !== 'password') safeUser[k] = matched[k]; });
  
  return { success: true, user: safeUser };
}

/**
 * Chuyển Date object (do Google Sheets tự parse từ string ngày) về string YYYY-MM-DD
 * PHẢI dùng getFullYear/getMonth/getDate (Local Time của Spreadsheet),
 * KHÔNG dùng toISOString() vì sẽ lệch 7 tiếng (UTC vs UTC+7).
 */
function formatDateSafe(value) {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  // Nếu đã là string, đảm bảo chỉ lấy phần YYYY-MM-DD
  if (typeof value === 'string' && value.includes('T')) {
    return value.split('T')[0];
  }
  return value || '';
}

// Các trường ngày cần được xử lý đặc biệt
const DATE_FIELDS = ['startDate', 'endDate', 'date'];

function mapDataToObjects(rows, headers) {
    return rows.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
        let value = row[index];
        if (header === 'images') { try { value = value ? JSON.parse(value) : [] } catch(e) { value = [] } }
        if (header === 'summaryMeetings') { value = value ? parseInt(value) : 0; }
        // ✅ FIX: Xử lý Date object cho các trường ngày tháng
        if (DATE_FIELDS.indexOf(header) !== -1) { value = formatDateSafe(value); }
        obj[header] = value;
      });
      return obj;
    });
}

// 2. Thêm mới
function createRecord(sheetName, record) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);
  const headers = SCHEMA[sheetName];
  
  const row = headers.map(header => {
    let val = record[header];
    if (header === 'images' && Array.isArray(val)) val = JSON.stringify(val);
    return (val !== undefined && val !== null) ? val : '';
  });
  
  sheet.appendRow(row);
  return { status: 'success', id: record.id, sheet: sheetName };
}

// 3. Update (Đa bảng)
function updateRecordMultiSheet(sheetNames, record) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  for (const sheetName of sheetNames) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == record.id) { // Cột ID là cột 0
           const headers = SCHEMA[sheetName];
           const newRow = headers.map(header => {
              let val = record[header];
              if (header === 'images' && Array.isArray(val)) val = JSON.stringify(val);
              return (val !== undefined) ? val : data[i][headers.indexOf(header)];
           });
           
           sheet.getRange(i + 1, 1, 1, newRow.length).setValues([newRow]);
           return { status: 'success', action: 'updated', sheet: sheetName };
        }
      }
  }
  return { status: 'error', message: 'ID not found in any sheet' };
}

// 4. Xóa đơn (Đa bảng)
function deleteRecordMultiSheet(sheetNames, id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  for (const sheetName of sheetNames) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;
      const data = sheet.getDataRange().getValues();
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] == id) {
          sheet.deleteRow(i + 1);
          return { status: 'success', action: 'deleted', sheet: sheetName };
        }
      }
  }
  return { status: 'error', message: 'ID not found' };
}

// 5. Xóa nhiều (Đa bảng)
function deleteRecordsMultiSheet(sheetNames, ids) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const idSet = new Set(ids); 
  let deletedCount = 0;

  for (const sheetName of sheetNames) {
      const sheet = ss.getSheetByName(sheetName);
      if (!sheet) continue;
      const data = sheet.getDataRange().getValues();
      
      // Duyệt ngược để xóa an toàn
      for (let i = data.length - 1; i >= 1; i--) {
        if (idSet.has(data[i][0])) {
          sheet.deleteRow(i + 1);
          deletedCount++;
          idSet.delete(data[i][0]); // Xóa khỏi Set để tối ưu
        }
      }
  }
  return { status: 'success', action: 'bulk_deleted', count: deletedCount };
}

// 6. Đồng bộ Settings (Chỉ áp dụng cho các bảng danh mục, không đụng vào Vi phạm/Thành tích)
function syncSettingsData(payload) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Chỉ sync các bảng danh mục
  const safeSyncSheets = ['Users', 'Classes', 'Students', 'Criteria', 'TimeConfigs'];

  safeSyncSheets.forEach(sheetName => {
    if (!payload[sheetName]) return;
    
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    const newRecords = payload[sheetName];
    const headers = SCHEMA[sheetName];

    // Clear data cũ
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
    }
    
    if (newRecords && newRecords.length > 0) {
       const rows = newRecords.map(rec => {
         return headers.map(h => {
             let val = rec[h];
             if (Array.isArray(val)) return JSON.stringify(val);
             return (val === undefined || val === null) ? '' : val;
         });
       });
       sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
    }
  });
  
  return { status: 'success', message: 'Settings synced' };
}

// 7. Upload ảnh
function handleImageUpload(data) {
  try {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const base64Data = data.base64.split(',')[1]; 
    const decoded = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decoded, 'image/jpeg', 'temp.jpg');
    
    const info = data.fileNameInfo;
    const safeName = `${info.className}_${info.studentName}_${info.violation}_${info.date}`.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    const fileName = `${safeName}_${new Date().getTime()}.jpg`;
    
    blob.setName(fileName);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    return { status: 'success', url: `https://drive.google.com/uc?export=view&id=${file.getId()}` };
  } catch (e) {
    return { status: 'error', message: e.toString() };
  }
}

// 8. Lưu Audit Log lên sheet AuditLogs
function saveAuditLog(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName('AuditLogs');

  // Tự tạo sheet + header nếu chưa có
  if (!sheet) {
    sheet = ss.insertSheet('AuditLogs');
    sheet.appendRow([
      'ID', 'Thời gian', 'Người thực hiện', 'Vai trò',
      'Hành động', 'ID Vi phạm', 'Ngày vi phạm',
      'Lớp', 'Nội dung lỗi', 'Điểm trừ', 'Ghi chú'
    ]);
    sheet.getRange(1, 1, 1, 11).setFontWeight('bold').setBackground('#1e3a5f').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  }

  // Chuyển timestamp (ms) sang giờ Việt Nam (UTC+7)
  const d = new Date(Number(data.timestamp) + 7 * 60 * 60 * 1000);
  const pad = n => String(n).padStart(2, '0');
  const timeStr = `${pad(d.getUTCDate())}/${pad(d.getUTCMonth()+1)}/${d.getUTCFullYear()} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;

  sheet.appendRow([
    data.id            || '',
    timeStr,
    data.userName      || '',
    data.userRole      || '',
    data.action        || '',
    data.violationId   || '',
    data.violationDate || '',
    data.violationClass|| '',
    data.violationCriteria || '',
    data.violationPoints   || '',
    data.details       || ''
  ]);

  return { status: 'success' };
}

// 9. Lấy Audit Logs từ sheet
function getAuditLogs() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('AuditLogs');
  if (!sheet || sheet.getLastRow() < 2) return [];
  const rows = sheet.getDataRange().getValues();
  // Bỏ row header, map thành object
  return rows.slice(1).map(row => ({
    id:                row[0],
    timeStr:           row[1],
    userName:          row[2],
    userRole:          row[3],
    action:            row[4],
    violationId:       row[5],
    violationDate:     row[6],
    violationClass:    row[7],
    violationCriteria: row[8],
    violationPoints:   row[9],
    details:           row[10],
  }));
}
