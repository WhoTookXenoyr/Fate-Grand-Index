# Third-party code in the page

These files are copied unchanged from npm and are put into the page by `tools/build.py`
(`@@include:vendor/...@@` in `src/app/59-bg3d.js`). They only run when the 3D background is on.

| File | Package | Version | Licence |
|---|---|---|---|
| `three.min.js` | [three](https://www.npmjs.com/package/three) | 0.134.0 (r134, the release vanta.js is made for) | MIT, `LICENSE-three.txt` |
| `vanta.waves.min.js`, `vanta.fog.min.js`, `vanta.clouds.min.js`, `vanta.net.min.js`, `vanta.globe.min.js`, `vanta.cells.min.js` | [vanta](https://www.npmjs.com/package/vanta) | 0.5.24 | MIT, `LICENSE-vanta.txt` |

To update: `npm install vanta three@0.134.0`, then copy `node_modules/three/build/three.min.js` and
`node_modules/vanta/dist/vanta.<effect>.min.js` over these files.
