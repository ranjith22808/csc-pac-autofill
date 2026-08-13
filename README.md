# CSC PAC Autofill

A Chrome (Manifest V3) extension that automates filling the **PAC Generation form** on [Digital Seva](https://digitalseva.csc.gov.in) and generating PAC codes.

## Features

- **Auto-fill** – Fills Client Operator ID, Customer and Wallet PIN on the PAC Generate page.
- **Auto-capture** – Detects and stores the generated PAC number with transaction details (CSC Txn, Merchant Txn, State, Transaction Date, Transaction Status, Mobile).
- **Excel export** – Downloads all captured codes as `csc_pac_codes.csv` with serial numbers.
- **Auto-generate loop** – Fills the form, ticks the consent box, clicks **Pay 75**, waits for the response, then goes to the next form automatically. Repeats for as many codes as you set and downloads the Excel file when done.

> ⚠️ **Note:** Each code is a real ₹75 wallet transaction. Watch it run.

## Install (unpacked extension)

1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle top-right).
4. Click **Load unpacked**.
5. Select the `csc-pac-autofill` folder.

## Usage

1. Log in to [Digital Seva](https://digitalseva.csc.gov.in) and open the PAC Generation page (`https://digitalseva.csc.gov.in/services/pac/generate`).
2. Click the extension icon → enter **Client Operator ID, Customer, Wallet PIN** → **Save**.
3. Enter the number of codes in **Auto-Generate** and click **Start Auto-Generate**.
4. Watch the panel on the page. The Excel file downloads automatically when all codes are done.
5. You can also **Export to Excel (CSV)** anytime from the popup.

## Permissions

- `storage` – keep your saved fields and captured PAC records locally.
- `scripting` + host permission for `digitalseva.csc.gov.in` – fill the form and capture results.
- `downloads` – export the CSV.

## Privacy

Everything is stored locally in your browser's `chrome.storage.local`. Nothing is uploaded anywhere.

## Files

| File | Purpose |
| --- | --- |
| `manifest.json` | Extension manifest (MV3) |
| `content_script.js` | Form filling, PAC capture and the auto-generate driver |
| `popup.html` / `popup.js` | Popup UI (fields, export, diagnostics, auto-generate controls) |
| `background.js` | Auto-downloads the CSV on completion |
