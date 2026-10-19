# The Shift staff guide

This guide documents the approved chronological timetable. Screenshots are captured from the isolated local preview using fictional staff and in-memory records. No production reads or writes are made. The lab-walk and DVR pages document the present recording controls in The Shift. FETS Online integration is a separate future stage.

## Build

Start the frontend Vite server on `127.0.0.1:3012`. Install Playwright/Chromium and Python packages `reportlab`, `python-pptx`, `fonttools`, and `brotli` in a separate tooling environment. Then run from the repository root:

```bash
FETS_PLAYWRIGHT_MODULE=/path/to/playwright \
CHROMIUM_PATH=/path/to/chromium \
FETS_GUIDE_OUTPUT=/tmp/fets-shift-staff-guide \
node scripts/training/capture-shift-guide.cjs

FETS_GUIDE_OUTPUT=/tmp/fets-shift-staff-guide \
python3 scripts/training/build-shift-guide.py
```

The capture script blocks external requests, waits for the real UI font, checks that all highlight targets lie inside their screenshot, and records screenshot bounds in `screenshots/metadata.json`. The builder matches each numbered instruction to a screenshot highlight, embeds the font in the PDF, and creates a matching editable PowerPoint. The output manifest identifies the documented edition and sample records. Generated PDFs, presentations and screenshots belong outside the repository.

Outputs: `The-Shift-Staff-Guide.pdf`, `The-Shift-Staff-Guide.pptx`, `guide-manifest.json`.

## Typography

Manrope is bundled locally as a 29 KB variable WOFF2 with Latin letters, numbers, common punctuation and the rupee symbol. It loads without a third-party font request. The source is [Google Fonts / Manrope](https://github.com/google/fonts/tree/main/ofl/manrope); copyright and SIL Open Font License are distributed at `fets-point/public/licenses/Manrope-OFL.txt`. The PDF embeds static font instances so the guide renders consistently without staff installing fonts.
