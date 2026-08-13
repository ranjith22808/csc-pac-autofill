# CSC PAC Autofill – User Manual

This extension helps fill the **PAC Generation form** on Digital Seva
(`https://digitalseva.csc.gov.in/services/pac/generate`) and generate PAC codes
automatically.

---

## 1. Installation

1. Download / clone this repository, or receive the `csc-pac-autofill` folder.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top-right corner).
4. Click **Load unpacked**.
5. Select the `csc-pac-autofill` folder.
6. The extension now appears in your toolbar (puzzle icon → CSC PAC Autofill).

> ⚠️ Keep the folder in place. If you move/delete it, the extension stops working.

---

## 2. First-time setup (save your details)

1. Log in to **Digital Seva** and open the **PAC Generation** page.
2. Click the CSC PAC Autofill icon.
3. Enter:
   - **Client Operator ID**
   - **Customer**
   - **Wallet PIN**
4. Click **Save** (values are stored only in your browser).
5. Click **Apply** to fill the form on the page immediately.

---

## 3. Auto-fill (single use)

- Click **Apply** in the popup while the PAC Generation page is open.
- The extension fills the three fields. Click **Pay 75** manually as usual.

---

## 4. Auto-Generate loop (recommended for bulk)

This does everything automatically for N codes:

1. Open the **PAC Generation** page.
2. Click the extension icon.
3. Enter the number of codes in **Auto-Generate**.
4. Click **Start Auto-Generate**.
5. The extension then repeatedly:
   - fills the form
   - ticks the **consent** checkbox
   - clicks **Pay 75**
   - waits for the response
   - captures the PAC number
   - goes to the next form automatically
6. When all codes are done, it downloads **`csc_pac_codes.csv`** (Excel-compatible) automatically.

> ⚠️ **Each code is a real ₹75 wallet transaction.** Stay and watch the panel on
> the page. Do not leave the tab. Do not click anything on the page while it runs.

### Controls

- **Stop Auto-Generate** – stops the loop (also in the panel on the page).
- **Retry** (panel) – if something fails, fix the issue shown and click **Retry**.

### If it stops

The panel shows an error with details (e.g. checkbox/button info). Press
**Retry** after checking. Common causes:

- Page is not on the PAC Generation URL → go back and press **Retry**.
- Fields/checkbox not ready → wait and press **Retry**.

---

## 5. Viewing & exporting captured PACs

- The popup shows **PAC Records: N** (number of captured codes).
- **Export to Excel (CSV)** – downloads `csc_pac_codes.csv` to your Downloads
  folder. Columns: Serial No, PAC Number, CSC Txn, Merchant Txn, State,
  Transaction Date, Transaction Status, Mobile, Captured At.
- **Clear records** – removes all stored records (use after exporting).
- **Scan page now** – reads any PAC result currently on the page and saves it.

### Where is my CSV file?

Chrome saves downloads in your **Downloads** folder by default
(`C:\Users\<you>\Downloads\csc_pac_codes.csv`). It does **not** go to the Desktop.

---

## 6. Diagnostics (if something goes wrong)

- **Test page (diagnostics)** in the popup checks the current page and shows:
  - which frame the form is in
  - whether the latest driver is loaded
  - field/checkbox/button counts
- Open **F12 → Console** and look for lines starting with
  `CSC PAC Autofill` / `CSC PAC Auto:` for detailed logs.

---

## 7. Notes & limitations

- Works only on `digitalseva.csc.gov.in`.
- The site itself may show harmless errors in its console
  (`countdownSeconds is not defined`, CSP warnings) – these are the site's own
  issues and do not affect the extension.
- All data stays in your browser (`chrome.storage.local`). Nothing is uploaded.
- Never share your Wallet PIN in a screenshot or with others.
