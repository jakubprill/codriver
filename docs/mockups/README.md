# Mockups

The first design proposals (2026-11-13), made on a Claude design canvas:
https://claude.ai/artifact/Pz8XmYx3AyuoECnrD39tKu

| File | Variant | In the app |
|---|---|---|
| `Main.dc.html` | A – Odcinek (stage), rally digital – chosen as the main look | `public/themes/odcinek.js` |
| `Zegary.dc.html` | B – Zegary (gauges), analog dials | `public/themes/zegary.js` |
| `Kierownica.dc.html` | C – Kokpit (cockpit), steering-wheel display | `public/themes/kokpit.js` |
| `Neon.dc.html` | D – Neon, essentials only | `public/themes/neon.js` |

Variants E (Papier – paper) and F (LCD) were designed directly in code – see `docs/screens/`.

The `.dc.html` files are design-canvas artboard sources (Design Component format); they render on the canvas,
not on their own in a browser. The current look of every variant: `docs/screens/*.png`.
