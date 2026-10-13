import { ProcessedLead } from './leadValidator';

export interface SheetPushResponse {
  success: boolean;
  tab_name?: string;
  added?: number;
  total?: number;
  error?: string;
}

export interface SheetLeadItem {
  rowIndex?: number;
  status: string;
  business_name: string;
  phone_number: string;
  category: string;
  zone: string;
  rating: string;
  reviews_count: string;
  website: string;
  place_url: string;
  sent_at: string;
  businessman_notes: string;
  place_id: string;
}

/**
 * Pushes a single batch chunk of validated leads to Google Sheets via the Apps Script Webhook.
 */
async function pushSingleChunkToSheet(
  webhookUrl: string,
  tabName: string,
  category: string,
  leads: ProcessedLead[]
): Promise<SheetPushResponse> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({
        action: 'append_leads',
        tab_name: tabName,
        category,
        leads,
      }),
    });

    const text = await response.text();
    try {
      return JSON.parse(text) as SheetPushResponse;
    } catch {
      if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
        throw new Error(
          'Google returned a login page instead of JSON. To fix this:\n' +
          '1. In Apps Script, click Deploy > New Deployment.\n' +
          '2. Set "Execute as: Me" and "Who has access: Anyone" (الجميع).\n' +
          '3. Copy the URL ending in "/exec" (not "/dev") and paste it in settings.'
        );
      }
      if (response.ok) {
        return { success: true, tab_name: tabName, added: leads.length, total: leads.length };
      }
      throw new Error(`Google Apps Script returned: ${text.slice(0, 200)}`);
    }
  } catch (err: any) {
    if (err.cause?.code === 'ECONNREFUSED') {
      throw new Error(`Connection refused to ${webhookUrl}. Ensure the URL is a valid Google Apps Script Web App (https://script.google.com/...).`);
    }
    throw err;
  }
}

/**
 * Pushes validated leads directly to Google Sheets via the Google Apps Script Webhook.
 * Automatically chunks large batches to prevent Google Apps Script execution timeouts.
 */
export async function pushLeadsToSheet(
  webhookUrl: string,
  tabName: string,
  category: string,
  leads: ProcessedLead[]
): Promise<SheetPushResponse> {
  if (!webhookUrl || webhookUrl.trim() === '') {
    throw new Error('Google Sheet Webhook URL is not configured. Go to "⚙️ Google Sheets Setup" tab and paste your Web App URL.');
  }

  if (webhookUrl.includes('localhost:5678')) {
    throw new Error('You have the old n8n address configured. Please set your Google Apps Script Web App URL in "⚙️ Google Sheets Setup".');
  }

  if (webhookUrl.endsWith('/dev')) {
    throw new Error('You pasted a developer test URL ending in "/dev". Google Apps Script requires a deployed Web App URL ending in "/exec". Please click Deploy > New Deployment > Web App, set "Who has access: Anyone", and copy the Web App URL.');
  }

  if (leads.length === 0) {
    return { success: true, tab_name: tabName, added: 0, total: 0 };
  }

  // Auto-chunk large lead batches (75 leads per request) to prevent Google Apps Script timeouts
  const CHUNK_SIZE = 75;
  if (leads.length > CHUNK_SIZE) {
    let totalAdded = 0;
    for (let i = 0; i < leads.length; i += CHUNK_SIZE) {
      const chunk = leads.slice(i, i + CHUNK_SIZE);
      const res = await pushSingleChunkToSheet(webhookUrl, tabName, category, chunk);
      totalAdded += res.added || 0;
    }
    return { success: true, tab_name: tabName, added: totalAdded, total: leads.length };
  }

  return pushSingleChunkToSheet(webhookUrl, tabName, category, leads);
}

/**
 * Fetches leads marked with Status == 'New' from a specific category tab.
 */
export async function fetchNewLeadsFromSheet(
  webhookUrl: string,
  tabName: string
): Promise<SheetLeadItem[]> {
  if (!webhookUrl || webhookUrl.trim() === '' || webhookUrl.includes('localhost:5678')) {
    throw new Error('Please configure a valid Google Apps Script Web App URL in "⚙️ Google Sheets Setup".');
  }

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    redirect: 'follow',
    body: JSON.stringify({
      action: 'get_new_leads',
      tab_name: tabName,
    }),
  });

  const text = await response.text();
  if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
    throw new Error(
      'Google Apps Script returned an HTML page instead of JSON. Ensure your Apps Script Web App is deployed with "Who has access: Anyone" (الجميع).'
    );
  }

  let json: { success: boolean; leads: SheetLeadItem[]; error?: string };
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Google Apps Script returned unexpected non-JSON response: ${text.slice(0, 100)}`);
  }

  if (!json.success) throw new Error(json.error || 'Failed to fetch leads from sheet');
  return json.leads || [];
}

/**
 * Updates a single lead's status in the Google Sheet (e.g. to 'Sent').
 */
export async function updateLeadStatusInSheet(
  webhookUrl: string,
  tabName: string,
  placeId: string,
  phoneNumber: string,
  status: string,
  sentAt: string
): Promise<boolean> {
  if (!webhookUrl || webhookUrl.includes('localhost:5678')) return false;

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({
        action: 'update_status',
        tab_name: tabName,
        place_id: placeId,
        phone_number: phoneNumber,
        status,
        sent_at: sentAt,
      }),
    });
    const text = await response.text();
    if (text.includes('<!DOCTYPE html>') || text.includes('<html')) {
      console.warn('[sheetsService] update_status received HTML from Google. Ensure deployment access is set to Anyone.');
      return false;
    }
    try {
      const json = JSON.parse(text) as { success: boolean };
      return !!json.success;
    } catch {
      return false;
    }
  } catch (err) {
    console.error(`[sheetsService] Failed to update status in sheet:`, err);
    return false;
  }
}

/**
 * Returns the ready-to-deploy Google Apps Script code for the user.
 */
export function getGoogleAppsScriptCode(): string {
  return `// -----------------------------------------------------------------------------
// Google Sheets Webhook & CRM Automation Script for Leads Hunter
// Paste this in: Extensions > Apps Script > Replace Code > Deploy > New Deployment > Web App
// (Execute as: Me, Who has access: Anyone)
// -----------------------------------------------------------------------------

// Status Styling Definition (Full Row Coloring)
function getStatusStyle(status) {
  switch (status) {
    case 'Denied':
      return { bg: '#fee2e2', fg: '#991b1b', bold: false }; // Red
    case 'Deal Closed':
      return { bg: '#bbf7d0', fg: '#14532d', bold: true };  // Emerald Green Bold
    case 'Interested':
      return { bg: '#dcfce7', fg: '#15803d', bold: false }; // Mint Green
    case 'Pending':
      return { bg: '#fef3c7', fg: '#92400e', bold: false }; // Amber / Yellow
    case 'Sent':
      return { bg: '#f3e8ff', fg: '#6b21a8', bold: false }; // Purple
    case 'New':
      return { bg: '#e0f2fe', fg: '#0369a1', bold: false }; // Light Blue
    case 'Invalid Phone':
      return { bg: '#fecdd3', fg: '#9f1239', bold: false }; // Crimson
    case 'No Phone':
    default:
      return { bg: '#f1f5f9', fg: '#64748b', bold: false }; // Slate Gray
  }
}

// Paints the full row across all 12 columns
function paintRow(sheet, rowNum, style) {
  try {
    var maxCols = Math.max(sheet.getLastColumn(), 12);
    var range = sheet.getRange(rowNum, 1, 1, maxCols);
    range.setBackground(style.bg).setFontColor(style.fg);
    range.setFontWeight(style.bold ? 'bold' : 'normal');
  } catch (e) {}
}

// Ensures a dedicated pipeline sheet exists with headers & validation
function getOrCreatePipelineSheet(ss, tabName) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    sheet.appendRow([
      'Status', 'Business Name', 'Phone Number', 'Category', 'Zone',
      'Rating', 'Reviews', 'Website', 'Place URL', 'Sent At',
      'Businessman Notes', 'Place ID'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 12)
      .setFontWeight('bold')
      .setBackground('#1e293b')
      .setFontColor('#ffffff');
    setupTabStyleAndValidation(sheet);
  }
  return sheet;
}

// Removes a lead from a specific tab by Place ID or Phone or Business Name
function removeLeadFromTab(ss, tabName, placeId, phone, bName) {
  var sheet = ss.getSheetByName(tabName);
  if (!sheet) return;
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var pId = String(data[i][11] || '').trim();
    var ph = String(data[i][2] || '').replace(/[^\d]/g, '');
    var name = String(data[i][1] || '').trim().toLowerCase();
    var cleanPhone = phone ? String(phone).replace(/[^\d]/g, '') : '';
    var cleanBName = bName ? String(bName).trim().toLowerCase() : '';

    if ((placeId && pId && pId === String(placeId).trim()) ||
        (cleanPhone && cleanPhone.length >= 8 && ph && ph === cleanPhone) ||
        (!cleanPhone && !placeId && cleanBName && name && name === cleanBName)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

// Configures Status Dropdown validation, column widths, and full-row conditional formatting
function setupTabStyleAndValidation(sheet) {
  var totalRows = sheet.getMaxRows();
  if (totalRows <= 1) {
    sheet.insertRowsAfter(1, 100);
    totalRows = sheet.getMaxRows();
  }
  var numRows = totalRows - 1; // from row 2 to bottom of sheet
  var statusRange = sheet.getRange(2, 1, numRows, 1);

  // Status dropdown options (No Landline status)
  var statuses = [
    'New',
    'Sent',
    'Pending',
    'Interested',
    'Deal Closed',
    'Denied',
    'Invalid Phone',
    'No Phone'
  ];

  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(statuses, true)
    .setAllowInvalid(true)
    .build();
  statusRange.setDataValidation(rule);

  // Full-row dynamic conditional formatting (A2:L[totalRows]) using custom formula
  var fullRowRange = sheet.getRange(2, 1, numRows, 12);
  var rules = [];

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A2="Denied"')
    .setBackground('#fee2e2')
    .setFontColor('#991b1b')
    .setRanges([fullRowRange])
    .build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A2="Deal Closed"')
    .setBackground('#bbf7d0')
    .setFontColor('#14532d')
    .setBold(true)
    .setRanges([fullRowRange])
    .build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A2="Interested"')
    .setBackground('#dcfce7')
    .setFontColor('#15803d')
    .setRanges([fullRowRange])
    .build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A2="Pending"')
    .setBackground('#fef3c7')
    .setFontColor('#92400e')
    .setRanges([fullRowRange])
    .build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A2="Sent"')
    .setBackground('#f3e8ff')
    .setFontColor('#6b21a8')
    .setRanges([fullRowRange])
    .build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A2="New"')
    .setBackground('#e0f2fe')
    .setFontColor('#0369a1')
    .setRanges([fullRowRange])
    .build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A2="Invalid Phone"')
    .setBackground('#fecdd3')
    .setFontColor('#9f1239')
    .setRanges([fullRowRange])
    .build());

  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$A2="No Phone"')
    .setBackground('#f1f5f9')
    .setFontColor('#64748b')
    .setRanges([fullRowRange])
    .build());

  sheet.setConditionalFormatRules(rules);

  // Paint existing rows immediately
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var existingStatuses = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var k = 0; k < existingStatuses.length; k++) {
      var val = String(existingStatuses[k][0]).trim();
      if (val) {
        paintRow(sheet, k + 2, getStatusStyle(val));
      }
    }
  }

  // Explicit English number formatting & column widths
  try {
    // Column 3: Phone Number (Plain text with English digits)
    sheet.getRange(2, 3, numRows, 1).setNumberFormat('@').setHorizontalAlignment('left');
    // Column 6: Rating (English decimal format 0.0)
    sheet.getRange(2, 6, numRows, 1).setNumberFormat('0.0').setHorizontalAlignment('center');
    // Column 7: Reviews Count (English integer format 0)
    sheet.getRange(2, 7, numRows, 1).setNumberFormat('0').setHorizontalAlignment('center');

    sheet.setColumnWidth(1, 150); // Status
    sheet.setColumnWidth(2, 220); // Business Name
    sheet.setColumnWidth(3, 140); // Phone Number
    sheet.setColumnWidth(4, 130); // Category
    sheet.setColumnWidth(5, 180); // Zone
    sheet.setColumnWidth(6, 70);  // Rating
    sheet.setColumnWidth(7, 70);  // Reviews
    sheet.setColumnWidth(8, 160); // Website
    sheet.setColumnWidth(9, 160); // Place URL
    sheet.setColumnWidth(10, 140); // Sent At
    sheet.setColumnWidth(11, 240); // Businessman Notes
    sheet.setColumnWidth(12, 180); // Place ID
  } catch (e) {}
}

// --- Custom Top Menu inside Google Sheets ---
function onOpen() {
  try {
    var ui = SpreadsheetApp.getUi();
    ui.createMenu('🎯 Leads Hunter CRM')
      .addItem('✨ Apply Dropdowns & Colors to Active Tab', 'formatCurrentTab')
      .addItem('🌟 Setup All Tabs & Pipeline Tabs', 'formatAllTabs')
      .addToUi();
  } catch (e) {}
}

function formatCurrentTab() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  setupTabStyleAndValidation(sheet);
  SpreadsheetApp.getUi().alert('Done! Dropdowns & Colors applied to: ' + sheet.getName());
}

function formatAllTabs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    setupTabStyleAndValidation(sheets[i]);
  }
  getOrCreatePipelineSheet(ss, 'Denied Offers');
  getOrCreatePipelineSheet(ss, 'Pending');
  getOrCreatePipelineSheet(ss, 'Interested');
  getOrCreatePipelineSheet(ss, 'Deal Closed');
  getOrCreatePipelineSheet(ss, 'Invalid Numbers');
  SpreadsheetApp.getUi().alert('Done! All category tabs & pipeline tabs formatted.');
}

// --- Trigger: Real-Time CRM Automation on Cell Edit ---
function onEdit(e) {
  if (!e || !e.range) return;
  var range = e.range;
  var sheet = range.getSheet();
  var sheetName = sheet.getName();
  var col = range.getColumn();
  var row = range.getRow();

  // Only trigger when Status (Column 1) is changed on data rows
  if (col !== 1 || row <= 1) return;

  var status = String(range.getValue()).trim();
  if (!status) return;

  var ss = e.source || SpreadsheetApp.getActiveSpreadsheet();
  var style = getStatusStyle(status);

  // Paint the full row in the current sheet immediately
  paintRow(sheet, row, style);

  var numCols = Math.max(sheet.getLastColumn(), 12);
  var rowValues = sheet.getRange(row, 1, 1, numCols).getValues()[0];
  var phone = rowValues[2];
  var bName = rowValues[1];
  var placeId = rowValues[11];

  // SCENARIO 1: 'Denied' -> Full row colored red and MOVED to 'Denied Offers' tab
  if (status === 'Denied') {
    if (sheetName === 'Denied Offers') return;

    var targetSheet = getOrCreatePipelineSheet(ss, 'Denied Offers');
    var destData = targetSheet.getDataRange().getValues();
    var existingRow = -1;

    for (var r = 1; r < destData.length; r++) {
      var dPid = String(destData[r][11] || '').trim();
      var dPhone = String(destData[r][2] || '').replace(/[^\d]/g, '');
      var dName = String(destData[r][1] || '').trim().toLowerCase();
      var cleanPhone = phone ? String(phone).replace(/[^\d]/g, '') : '';
      var cleanBName = bName ? String(bName).trim().toLowerCase() : '';

      if ((placeId && dPid && dPid === String(placeId).trim()) ||
          (cleanPhone && cleanPhone.length >= 8 && dPhone && dPhone === cleanPhone) ||
          (!cleanPhone && !placeId && cleanBName && dName && dName === cleanBName)) {
        existingRow = r + 1;
        break;
      }
    }

    if (existingRow > 0) {
      targetSheet.getRange(existingRow, 1, 1, numCols).setValues([rowValues]);
      paintRow(targetSheet, existingRow, style);
    } else {
      targetSheet.appendRow(rowValues);
      paintRow(targetSheet, targetSheet.getLastRow(), style);
    }

    // Clean up from active pipeline tabs if it existed there
    removeLeadFromTab(ss, 'Pending', placeId, phone, bName);
    removeLeadFromTab(ss, 'Interested', placeId, phone, bName);
    removeLeadFromTab(ss, 'Deal Closed', placeId, phone, bName);

    // Delete row from current category tab (MOVED)
    sheet.deleteRow(row);
    return;
  }

  // SCENARIO 2: 'Pending', 'Interested', 'Deal Closed' -> COPY row to dedicated tab with full row colored
  var targetTab = null;
  if (status === 'Pending') targetTab = 'Pending';
  else if (status === 'Interested') targetTab = 'Interested';
  else if (status === 'Deal Closed') targetTab = 'Deal Closed';

  if (targetTab) {
    if (sheetName !== targetTab) {
      var destSheet = getOrCreatePipelineSheet(ss, targetTab);
      var destData = destSheet.getDataRange().getValues();
      var existingRow = -1;

      for (var r = 1; r < destData.length; r++) {
        var dPid = String(destData[r][11] || '').trim();
        var dPhone = String(destData[r][2] || '').replace(/[^\d]/g, '');
        var cleanPhone = phone ? String(phone).replace(/[^\d]/g, '') : '';

        if ((placeId && dPid && dPid === String(placeId).trim()) ||
            (cleanPhone && cleanPhone.length >= 8 && dPhone && dPhone === cleanPhone)) {
          existingRow = r + 1;
          break;
        }
      }

      if (existingRow > 0) {
        destSheet.getRange(existingRow, 1, 1, numCols).setValues([rowValues]);
        paintRow(destSheet, existingRow, style);
      } else {
        destSheet.appendRow(rowValues);
        paintRow(destSheet, destSheet.getLastRow(), style);
      }
    }

    // Clean up previous stage tab to maintain a clear pipeline
    if (status === 'Pending') {
      removeLeadFromTab(ss, 'Interested', placeId, phone, bName);
      removeLeadFromTab(ss, 'Deal Closed', placeId, phone, bName);
    } else if (status === 'Interested') {
      removeLeadFromTab(ss, 'Pending', placeId, phone, bName);
      removeLeadFromTab(ss, 'Deal Closed', placeId, phone, bName);
    } else if (status === 'Deal Closed') {
      removeLeadFromTab(ss, 'Pending', placeId, phone, bName);
      removeLeadFromTab(ss, 'Interested', placeId, phone, bName);
    }
  }

  // SCENARIO 3: 'Invalid Phone' or 'No Phone' -> Full row colored and MOVED to 'Invalid Numbers' tab
  if (status === 'Invalid Phone' || status === 'No Phone') {
    if (sheetName === 'Invalid Numbers') return;

    var targetSheet = getOrCreatePipelineSheet(ss, 'Invalid Numbers');
    var destData = targetSheet.getDataRange().getValues();
    var existingRow = -1;

    for (var r = 1; r < destData.length; r++) {
      var dPid = String(destData[r][11] || '').trim();
      var dPhone = String(destData[r][2] || '').replace(/[^\d]/g, '');
      var dName = String(destData[r][1] || '').trim().toLowerCase();
      var cleanPhone = phone ? String(phone).replace(/[^\d]/g, '') : '';
      var cleanBName = bName ? String(bName).trim().toLowerCase() : '';

      if ((placeId && dPid && dPid === String(placeId).trim()) ||
          (cleanPhone && cleanPhone.length >= 8 && dPhone && dPhone === cleanPhone) ||
          (!cleanPhone && !placeId && cleanBName && dName && dName === cleanBName)) {
        existingRow = r + 1;
        break;
      }
    }

    if (existingRow > 0) {
      targetSheet.getRange(existingRow, 1, 1, numCols).setValues([rowValues]);
      paintRow(targetSheet, existingRow, style);
    } else {
      targetSheet.appendRow(rowValues);
      paintRow(targetSheet, targetSheet.getLastRow(), style);
    }

    // Clean up from active pipeline tabs if it existed there
    removeLeadFromTab(ss, 'Pending', placeId, phone, bName);
    removeLeadFromTab(ss, 'Interested', placeId, phone, bName);
    removeLeadFromTab(ss, 'Deal Closed', placeId, phone, bName);

    // Delete row from current category tab (MOVED)
    sheet.deleteRow(row);
    return;
  }

  // If set back to 'New' or 'Sent', clean up any pipeline copies
  if (status === 'New' || status === 'Sent') {
    removeLeadFromTab(ss, 'Pending', placeId, phone, bName);
    removeLeadFromTab(ss, 'Interested', placeId, phone, bName);
    removeLeadFromTab(ss, 'Deal Closed', placeId, phone, bName);
  }
}

// --- Webhook: Handlers for Scraper Pushes & Status Updates ---
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var action = data.action;

    // --- Action 1: Append Leads with Dynamic Category Tab Creation ---
    if (action === 'append_leads') {
      var tabName = data.tab_name || 'General';
      var sheet = ss.getSheetByName(tabName);

      if (!sheet) {
        sheet = ss.insertSheet(tabName);
        sheet.appendRow([
          'Status', 'Business Name', 'Phone Number', 'Category', 'Zone',
          'Rating', 'Reviews', 'Website', 'Place URL', 'Sent At',
          'Businessman Notes', 'Place ID'
        ]);
        sheet.setFrozenRows(1);
        sheet.getRange(1, 1, 1, 12)
          .setFontWeight('bold')
          .setBackground('#1e293b')
          .setFontColor('#ffffff');
      }

      // Read existing Place IDs, clean phone numbers, and business names to prevent duplicates
      var existingData = sheet.getDataRange().getValues();
      var existingIds = {};
      var existingPhones = {};
      var existingNames = {};
      for (var i = 1; i < existingData.length; i++) {
        var pid = String(existingData[i][11] || '').trim(); // Col 12: Place ID
        if (pid) existingIds[pid] = true;
        var phone = existingData[i][2]; // Col 3: Phone
        if (phone) {
          var cleanP = String(phone).replace(/[^\d]/g, '');
          if (cleanP.length >= 8) existingPhones[cleanP] = true;
        }
        var name = String(existingData[i][1] || '').trim().toLowerCase();
        if (name) existingNames[name] = true;
      }

      var added = 0;
      var leads = data.leads || [];
      var newRows = [];
      for (var j = 0; j < leads.length; j++) {
        var l = leads[j];
        var leadPid = String(l.place_id || '').trim();
        if (leadPid && existingIds[leadPid]) continue;
        var cleanLeadPhone = l.phone_number ? String(l.phone_number).replace(/[^\d]/g, '') : '';
        if (cleanLeadPhone && cleanLeadPhone.length >= 8 && existingPhones[cleanLeadPhone]) continue;
        var cleanLeadName = String(l.business_name || '').trim().toLowerCase();
        if (!cleanLeadPhone && !leadPid && cleanLeadName && existingNames[cleanLeadName]) continue;

        newRows.push([
          l.status || 'New',
          l.business_name || '',
          l.phone_number || '',
          l.category || data.category || '',
          l.zone || '',
          l.rating || '',
          l.reviews_count || '',
          l.website || '',
          l.place_url || '',
          l.sent_at || '',
          l.businessman_notes || '',
          l.place_id || ''
        ]);

        if (leadPid) existingIds[leadPid] = true;
        if (cleanLeadPhone) existingPhones[cleanLeadPhone] = true;
        if (cleanLeadName) existingNames[cleanLeadName] = true;
        added++;
      }

      if (newRows.length > 0) {
        var startRow = sheet.getLastRow() + 1;
        sheet.getRange(startRow, 1, newRows.length, 12).setValues(newRows);
      }

      // Apply dropdown validation, full-row conditional colors, and column widths
      setupTabStyleAndValidation(sheet);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        tab_name: tabName,
        added: added,
        total: leads.length
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- Action 2: Get New Leads for WhatsApp Outreach ---
    if (action === 'get_new_leads') {
      var tabName = data.tab_name || 'General';
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, leads: [] })).setMimeType(ContentService.MimeType.JSON);
      }
      var rows = sheet.getDataRange().getValues();
      var newLeads = [];
      for (var k = 1; k < rows.length; k++) {
        var row = rows[k];
        if (row[0] === 'New' && row[2]) {
          newLeads.push({
            status: row[0],
            business_name: row[1],
            phone_number: row[2],
            category: row[3],
            zone: row[4],
            rating: row[5],
            reviews_count: row[6],
            website: row[7],
            place_url: row[8],
            sent_at: row[9],
            businessman_notes: row[10],
            place_id: row[11]
          });
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, leads: newLeads })).setMimeType(ContentService.MimeType.JSON);
    }

    // --- Action 3: Update Row Status (e.g. to 'Sent') ---
    if (action === 'update_status') {
      var tabName = data.tab_name || 'General';
      var sheet = ss.getSheetByName(tabName);
      if (!sheet) {
        var allSheets = ss.getSheets();
        for (var s = 0; s < allSheets.length; s++) {
          if (allSheets[s].getName().toLowerCase() === String(tabName).toLowerCase()) {
            sheet = allSheets[s];
            break;
          }
        }
      }
      var updated = false;
      if (sheet) {
        var rows = sheet.getDataRange().getValues();
        var targetPhoneClean = data.phone_number ? String(data.phone_number).replace(/[^\d]/g, '') : '';
        var targetPid = data.place_id ? String(data.place_id).trim() : '';

        for (var r = 1; r < rows.length; r++) {
          var rowPid = String(rows[r][11] || '').trim();
          var rowPhoneClean = String(rows[r][2] || '').replace(/[^\d]/g, '');

          var matchPid = targetPid && rowPid && (rowPid === targetPid);
          var matchPhone = targetPhoneClean && rowPhoneClean && (
            rowPhoneClean === targetPhoneClean ||
            (rowPhoneClean.length >= 8 && targetPhoneClean.length >= 8 && (
              rowPhoneClean.slice(-8) === targetPhoneClean.slice(-8)
            ))
          );

          if (matchPid || matchPhone) {
            sheet.getRange(r + 1, 1).setValue(data.status || 'Sent');
            sheet.getRange(r + 1, 10).setValue(data.sent_at || new Date().toISOString());
            paintRow(sheet, r + 1, getStatusStyle(data.status || 'Sent'));
            updated = true;
            break;
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, updated: updated })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'Unknown action' })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}
`;
}



