/**
 * M26 — live JSON feed for Framer.
 *
 * Framer's Fetch (and the Ticker code component) read JSON, not CSV.
 * Add this doGet to the SAME Apps Script project that already moves form
 * responses into submissions.csv, then: Deploy → New deployment →
 * Web app → "Anyone". The URL you get is your Feed URL in Framer.
 *
 * It serves the form-response sheet as:
 *   { "submissions": [ { id, student, date, time, kind, type, media, text }, … ] }
 * newest first — the same record the site mirrors, one more way to read it.
 */
function doGet() {
  var ss = SpreadsheetApp.openById(/* your form-response spreadsheet id */ 'SPREADSHEET_ID');
  var sh = ss.getSheets()[0]; // or getSheetByName('Form Responses 1')
  var rows = sh.getDataRange().getValues();
  var head = rows.shift().map(function (h) { return String(h).trim().toLowerCase(); });
  function col(name) { return head.indexOf(name); }

  var out = rows.map(function (r) {
    return {
      id:      String(r[col('id')] || ''),
      student: String(r[col('student')] || ''),
      date:    String(r[col('date')] || ''),
      time:    String(r[col('time')] || ''),
      kind:    String(r[col('kind')] || ''),
      type:    String(r[col('type')] || ''),
      media:   String(r[col('image')] || ''),
      text:    String(r[col('text')] || '')
    };
  }).filter(function (s) { return s.student; }).reverse();

  return ContentService
    .createTextOutput(JSON.stringify({ submissions: out }))
    .setMimeType(ContentService.MimeType.JSON);
}
