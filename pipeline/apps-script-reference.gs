/**
 * M26 Studio — Google Form → data/submissions.csv reference script.
 *
 * Lives in the Apps Script project attached to the form's response Sheet
 * (Extensions → Apps Script), with an "On form submit" trigger pointed at
 * onFormSubmit(). See pipeline/README.md for full setup.
 *
 * The contract with the site (do not break):
 *   - appends rows in the exact schema  ID,Student,Date,Time,Kind,Type,Image,Text
 *   - Student must match data/students.csv (use a dropdown in the form)
 *   - uploaded Drive files are made "anyone with the link — viewer"
 *   - cells are CSV-quoted properly
 */

// ---------------------------------------------------------------- settings
var GITHUB_REPO = 'khapewie/M26_STUDIO';
var CSV_PATH = 'data/submissions.csv';
var BRANCH = 'main';

// Map each form question TITLE (exactly as it appears in the form) to a field.
// Edit the strings on the right to match your form.
var FORM_FIELDS = {
  student: 'Name',
  kind: 'Kind of work',
  type: 'Type',          // image / text / video / audio
  upload: 'Upload your work',
  text: 'Caption'
};

// ------------------------------------------------------------ entry point
function onFormSubmit(e) {
  var byTitle = {};
  var ranges = e.namedValues; // { 'Question title': ['answer'], ... }
  for (var k in ranges) byTitle[k.trim()] = (ranges[k] && ranges[k][0] || '').trim();

  var student = byTitle[FORM_FIELDS.student] || '';
  var kind = byTitle[FORM_FIELDS.kind] || 'submission';
  var type = (byTitle[FORM_FIELDS.type] || '').toLowerCase();
  var text = byTitle[FORM_FIELDS.text] || '';
  var uploadAnswer = byTitle[FORM_FIELDS.upload] || '';

  if (!student) return; // nothing sensible to publish

  // --- uploaded file → public Drive link -------------------------------
  // File-upload answers arrive as one or more Drive URLs. Make each file
  // viewable by anyone with the link, or the site can't display it.
  var imageUrl = '';
  var fileIds = extractDriveIds(uploadAnswer);
  if (fileIds.length) {
    var id = fileIds[0]; // schema holds one attachment per row
    try {
      DriveApp.getFileById(id)
        .setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (err) {
      // sharing can fail on some workspace policies — still publish the link;
      // the site falls back to an "open ↗" link if it can't inline the file
      console.warn('setSharing failed for ' + id + ': ' + err);
    }
    imageUrl = 'https://drive.google.com/open?id=' + id;
  }
  if (!type) type = imageUrl ? 'image' : 'text';

  // --- timestamps + id ---------------------------------------------------
  var now = new Date();
  var tz = Session.getScriptTimeZone();
  var date = Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  var time = Utilities.formatDate(now, tz, 'HH:mm');
  var id = slug(student) + '-' + date + '-' + Utilities.getUuid().slice(0, 8);

  var row = [id, student, date, time, kind, type, imageUrl, text]
    .map(csvCell).join(',');

  appendRowToGitHub(row);
}

// ------------------------------------------------------------ helpers
function extractDriveIds(answer) {
  var ids = [];
  var re = /[?&]id=([\w-]{10,})|\/file\/d\/([\w-]{10,})/g;
  var m;
  while ((m = re.exec(answer)) !== null) ids.push(m[1] || m[2]);
  return ids;
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'student';
}

/** RFC-4180 quoting: wrap in quotes if the cell holds a comma, quote, or newline. */
function csvCell(v) {
  v = String(v == null ? '' : v).replace(/\r\n|\r|\n/g, ' ').trim();
  if (/[",]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}

/** Append one line to the CSV via the GitHub contents API (with one retry
 *  in case another submission commits in between). */
function appendRowToGitHub(row) {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Script property GITHUB_TOKEN is not set');
  var base = 'https://api.github.com/repos/' + GITHUB_REPO + '/contents/' + CSV_PATH;
  var headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json'
  };

  for (var attempt = 0; attempt < 2; attempt++) {
    var res = UrlFetchApp.fetch(base + '?ref=' + BRANCH, { headers: headers });
    var file = JSON.parse(res.getContentText());
    var current = Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString();
    // keep whatever line-ending style the file already uses; just make sure
    // there is exactly one break before the new row
    var updated = current.replace(/[\r\n]*$/, '\n') + row + '\n';

    var put = UrlFetchApp.fetch(base, {
      method: 'put',
      headers: headers,
      contentType: 'application/json',
      muteHttpExceptions: true,
      payload: JSON.stringify({
        message: 'New submission: ' + row.split(',')[1] + ' (' + row.split(',')[2] + ')',
        content: Utilities.base64Encode(updated, Utilities.Charset.UTF_8),
        sha: file.sha,
        branch: BRANCH
      })
    });
    if (put.getResponseCode() < 300) return;         // committed
    if (put.getResponseCode() !== 409) break;        // real error — don't retry
    Utilities.sleep(1500);                           // conflict — refetch and retry once
  }
  // last resort: tell a human; the response is still safe in the Sheet
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(),
    'M26 pipeline: a submission failed to commit',
    'This row could not be committed to GitHub:\n\n' + row +
    '\n\nIt is still in the response Sheet — re-run onFormSubmit or add it by hand.');
}
