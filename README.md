# tecnowizz.com

Web estática de Tecnowizz Sistemas, publicada con GitHub Pages.

- `design/Main.dc.html`: diseño exportado de Claude Design (fuente de la portada).
- `build.mjs`: genera `index.html` (español) y `en/index.html` (inglés) a partir del diseño.
- `aviso-legal/`, `404.html`, `styles.css`: páginas de texto, escritas a mano.

Para actualizar la portada: exportar el diseño como HTML, sustituir `design/Main.dc.html`,
ejecutar `node build.mjs` y hacer `git push`.
