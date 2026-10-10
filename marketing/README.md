# CodeCanyon submission kit

Everything in this folder is for the item page on CodeCanyon. It is **not** part of
the product ZIP (`marketing/` is export-ignored).

## Build the upload files

```bash
npm run package
```

Creates in `dist/`:

| File | Upload form field |
|---|---|
| `attendbridge-v1.0.0.zip` | **Main File(s)** — the product: source + `documentation/` |
| `attendbridge-v1.0.0-screenshots.zip` | **Screenshots** (optional ZIP of PNGs) |

## Images

| File | Upload form field | Size |
|---|---|---|
| `thumbnail-80x80.png` | Thumbnail | 80×80 |
| `inline-preview-590x300.jpg` | Inline Preview Image | 590×300 |
| `screenshots/*.png` | Screenshots (via the ZIP above) | 1440×900 |

Sources for the thumbnail and preview are in `src/` (plain HTML); re-render them
with a headless browser at exactly the sizes above after changing the name or design.

## Item details

- **Description:** paste `item-description.html`.
- **Category:** JavaScript → Miscellaneous (Node.js application).
- **Compatible browsers:** Chrome, Firefox, Edge, Safari.
- **Software version / requirements:** Node.js 20+, Windows / Linux.
- **Tags:** zkteco, attendance, biometric, fingerprint, face recognition, adms, hrm, payroll, erp, time attendance, node.js, laravel.

## Before submitting

- [ ] Test a real ADMS device and a real TCP/IP device once
- [ ] Make the GitHub repository private
- [ ] Decide on the final product name (ZK is part of ZKTeco's brand; a name like
      "AttendBridge — for ZKTeco devices" is safer with Envato's trademark review)
- [ ] Bump `version` in `package.json` and the changelog in `documentation/index.html`
      for every update
