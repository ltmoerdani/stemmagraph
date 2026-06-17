# 📸 Social Share Assets

This folder is for social-preview images used in `index.html` and `README.md`.

## Required assets

| File | Purpose | Recommended size |
|---|---|---|
| `public/og-image.png` | Open Graph + Twitter card preview | 1200×630 px |

## How to generate

The easiest way to create a high-quality preview:

1. Run the demo locally:
   ```bash
   npm run dev
   ```
2. Open the family tree canvas at <http://localhost:5201>
3. Capture a screenshot of the canvas showing multiple generations
4. Resize/crop to 1200×630 with any image editor
5. Save as `public/og-image.png`
6. Commit and push — the live demo will pick it up on next deploy

Until an og-image is added, link previews will fall back to text-only cards
(which still look fine — just less eye-catching when shared on social media).
