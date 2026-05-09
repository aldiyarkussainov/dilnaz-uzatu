/**
 * Дильназ — Қыз ұзату · RSVP collector
 * ----------------------------------------------------------------
 * Google Apps Script that receives RSVP submissions from the
 * invitation site and appends them as rows to a Google Sheet.
 * The sheet can then be downloaded as .xlsx anytime
 * (File → Download → Microsoft Excel).
 *
 * SETUP (5 minutes, one-time):
 *   1. Create a new Google Sheet — name it e.g. "Dilnaz RSVPs".
 *   2. In the sheet:  Extensions → Apps Script.
 *   3. Delete the default code, paste THIS file's content.
 *   4. (Optional) put your sheet's ID into SHEET_ID below.
 *      If left empty, the script writes to the active spreadsheet
 *      it's bound to — which is fine when you opened the script
 *      from the sheet itself.
 *   5. Save.  Then:  Deploy → New deployment → type = "Web app".
 *        - Execute as:           "Me"
 *        - Who has access:       "Anyone"
 *      Click Deploy. Copy the Web app URL.
 *   6. Open assets/script.js in this project and paste the URL into
 *      the WEBHOOK_URL constant near the top.
 *   7. Done. Submit a test from the page; a row should appear.
 *
 * Optional: paste your email into NOTIFY_EMAIL to get an email
 * notification on every new RSVP.
 */

const SHEET_ID     = "";              // leave "" to use the bound sheet
const SHEET_NAME   = "RSVPs";          // tab name (auto-created)
const NOTIFY_EMAIL = "";               // e.g. "you@example.com" — or "" to disable

const HEADERS = [
  "Уақыты",       // timestamp (Astana)
  "Аты-жөні",     // name
  "Қатысады",     // attending: yes/no
  "Адам саны",    // guests count
  "Тілектер",     // wishes
  "User-Agent"    // browser info
];

function doPost(e) {
  try {
    const payload = parseBody_(e);

    const sheet = getSheet_();
    ensureHeaders_(sheet);

    const tz = "Asia/Almaty"; // Astana shares UTC+5 with Almaty
    const ts = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH:mm:ss");

    const row = [
      ts,
      String(payload.name || ""),
      attendingLabel_(payload.attending),
      Number(payload.guests || 1),
      String(payload.wishes || ""),
      String(payload.user_agent || "")
    ];
    sheet.appendRow(row);

    if (NOTIFY_EMAIL) {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: "RSVP — " + (payload.name || "белгісіз"),
        body: [
          "Аты-жөні:    " + (payload.name || "—"),
          "Қатысады:    " + attendingLabel_(payload.attending),
          "Адам саны:   " + (payload.guests || 1),
          "Тілектер:    " + (payload.wishes || "—"),
          "Уақыты:      " + ts
        ].join("\n")
      });
    }

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// Browser sanity check — open the URL in a tab and you'll see "OK".
function doGet() {
  return ContentService
    .createTextOutput("OK — RSVP endpoint is live.")
    .setMimeType(ContentService.MimeType.TEXT);
}

/* ───────── helpers ───────── */

function parseBody_(e) {
  if (!e || !e.postData) return {};
  // We send Content-Type: text/plain so Apps Script gives us the
  // raw string in e.postData.contents — parse it as JSON.
  const raw = e.postData.contents || "";
  try {
    return JSON.parse(raw);
  } catch (_) {
    // Fallback: form-encoded
    return e.parameter || {};
  }
}

function getSheet_() {
  const ss = SHEET_ID
    ? SpreadsheetApp.openById(SHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  return sheet;
}

function ensureHeaders_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
}

function attendingLabel_(value) {
  if (value === "yes") return "Иә";
  if (value === "no")  return "Жоқ";
  return String(value || "—");
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
