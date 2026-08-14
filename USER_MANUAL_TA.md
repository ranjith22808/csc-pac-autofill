# CSC PAC Autofill – பயனர் கையேடு (Tamil User Manual)

Digital Seva-வில் (`https://digitalseva.csc.gov.in/services/pac/generate`) PAC Generation
form-ஐ நிரப்பவும், PAC codes-ஐ தானாக உருவாக்கவும் இந்த extension உதவுகிறது.

---

## 1. நிறுவுதல் (Installation)

1. இந்த repository-ஐ download / clone செய்யவும் (அல்லது `csc-pac-autofill` folder-ஐ பெறவும்).
2. Chrome-ஐ திறந்து `chrome://extensions`-க்கு செல்லவும்.
3. மேல் வலது மூலையில் உள்ள **Developer mode**-ஐ ON செய்யவும்.
4. **Load unpacked** பட்டனை கிளிக் செய்யவும்.
5. `csc-pac-autofill` folder-ஐ தேர்ந்தெடுக்கவும்.
6. Extension உங்கள் toolbar-இல் தோன்றும் (puzzle icon → CSC PAC Autofill).

> ⚠️ இந்த folder-ஐ அந்த இடத்திலேயே வைத்திருக்கவும். அதை நகர்த்தினால் / நீக்கினால் extension வேலை செய்யாது.

---

## 2. முதல் முறை அமைப்பு (உங்கள் விவரங்களை சேமித்தல்)

1. **Digital Seva**-இல் login செய்து **PAC Generation** பக்கத்தை திறக்கவும்.
2. CSC PAC Autofill icon-ஐ கிளிக் செய்யவும்.
3. பின்வருவனவற்றை உள்ளிடவும்:
   - **Client Operator ID**
   - **Customer**
   - **Wallet PIN**
4. **Save** பட்டனை அழுத்தவும் (மதிப்புகள் உங்கள் browser-இல் மட்டுமே சேமிக்கப்படும்).
5. பக்கத்தில் உள்ள form-ஐ உடனே நிரப்ப **Apply** பட்டனை அழுத்தவும்.

---

## 3. Auto-fill (ஒற்றை முறை)

- PAC Generation பக்கம் திறந்திருக்கும்போது popup-இல் **Apply** பட்டனை அழுத்தவும்.
- Extension மூன்று புலங்களையும் நிரப்பும். வழக்கம்போல் **Pay 75**-ஐ நீங்களே கிளிக் செய்யவும்.

---

## 4. Auto-Generate loop (தொகுப்பாக செய்ய பரிந்துரைக்கப்படுகிறது)

N codes-க்கு எல்லாவற்றையும் தானாக செய்யும்:

1. **PAC Generation** பக்கத்தை திறக்கவும்.
2. Extension icon-ஐ கிளிக் செய்யவும்.
3. **Auto-Generate**-இல் codes-இன் எண்ணிக்கையை உள்ளிடவும்.
4. **Start Auto-Generate** பட்டனை அழுத்தவும்.
5. பின்னர் extension திரும்ப திரும்ப:
   - form-ஐ நிரப்பும்
   - **consent** checkbox-ஐ tick செய்யும்
   - **Pay 75**-ஐ கிளிக் செய்யும்
   - பதிலுக்காக காத்திருக்கும்
   - PAC எண்ணை பதிவு செய்யும்
   - அடுத்த form-க்கு தானாக செல்லும்
6. எல்லா codes முடிந்ததும் **`csc_pac_codes.csv`** (Excel-இல் திறக்கக்கூடியது) தானாக download ஆகும்.

> ⚠️ **ஒவ்வொரு code-க்கும் உண்மையான ₹75 wallet பரிவர்த்தனை ஆகும்.** பக்கத்தில் உள்ள panel-ஐ கவனித்துக்கொண்டே இருங்கள். Tab-ஐ விட்டு வெளியே செல்ல வேண்டாம். இயங்கும்போது பக்கத்தில் எதையும் கிளிக் செய்ய வேண்டாம்.

### கட்டுப்பாடுகள்

- **Stop Auto-Generate** – loop-ஐ நிறுத்துகிறது (பக்கத்தில் உள்ள panel-இலும் இதே பட்டன் உள்ளது).
- **Retry** (panel) – ஏதாவது தோல்வியானால், காட்டப்பட்ட பிரச்சினையை சரிசெய்த பிறகு **Retry** அழுத்தவும்.

### நின்று விட்டால்

Panel பிழையை விவரத்துடன் காட்டும் (checkbox/button விவரங்கள்). சரிசெய்த பிறகு **Retry** அழுத்தவும். பொதுவான காரணங்கள்:

- பக்கம் PAC Generation URL-இல் இல்லை → திரும்ப சென்று **Retry** அழுத்தவும்.
- புலங்கள்/checkbox தயாராக இல்லை → சிறிது காத்திருந்து **Retry** அழுத்தவும்.

---

## 5. PAC codes-ஐ பார்த்தல் & Export செய்தல்

- Popup-இல் **PAC Records: N** காட்டப்படும் (பதிவான codes எண்ணிக்கை).
- **Export to Excel (CSV)** – `csc_pac_codes.csv`-ஐ உங்கள் Downloads folder-இல் சேமிக்கும்.
  வரிசைகள்: Serial No, PAC Number, CSC Txn, Merchant Txn, State, Transaction Date, Transaction Status, Mobile, Captured At.
- **Clear records** – சேமித்த அனைத்து records-ஐ நீக்கும் (export செய்த பிறகு பயன்படுத்தவும்).
- **Scan page now** – தற்போது பக்கத்தில் உள்ள PAC முடிவை படித்து சேமிக்கும்.

### எனது CSV file எங்கே உள்ளது?

Chrome-இல் download-கள் இயல்பாக **Downloads** folder-இல் சேமிக்கப்படும்
(`C:\Users\<உங்கள் பெயர்>\Downloads\csc_pac_codes.csv`). இது Desktop-க்கு செல்லாது.

---

## 6. சரிசெய்தல் (ஏதேனும் பிரச்சினை இருந்தால்)

- Popup-இல் **Test page (diagnostics)** தற்போதைய பக்கத்தை சரிபார்த்து காட்டும்:
  - form எந்த frame-இல் உள்ளது
  - சமீபத்திய driver ஏற்றப்பட்டுள்ளதா
  - field/checkbox/button எண்ணிக்கைகள்
- **F12 → Console** திறந்து `CSC PAC Autofill` / `CSC PAC Auto:` என்று தொடங்கும் வரிகளை பார்க்கவும்.

---

## 7. குறிப்புகள் & வரம்புகள்

- `digitalseva.csc.gov.in`-இல் மட்டுமே வேலை செய்யும்.
- தளம் தன்னுடைய console-இல் பாதிப்பற்ற பிழைகளை காட்டலாம்
  (`countdownSeconds is not defined`, CSP warnings) – இவை தளத்தின் சொந்த பிரச்சினைகள்,
  extension-ஐ பாதிக்காது.
- எல்லா தரவும் உங்கள் browser-இல் (`chrome.storage.local`) மட்டுமே இருக்கும். எங்கும் upload ஆகாது.
- உங்கள் Wallet PIN-ஐ screenshot-இல் அல்லது மற்றவர்களுடன் ஒருபோதும் பகிர வேண்டாம்.
