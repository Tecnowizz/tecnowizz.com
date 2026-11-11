// Genera la web estática (/, /en/) a partir del diseño exportado de Claude Design.
// Uso: node build.mjs   (lee design/Main.dc.html, escribe index.html y en/index.html)
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const SITE = "https://tecnowizz.com";
const src = readFileSync(new URL("./design/Main.dc.html", import.meta.url), "utf8");

// --- Plantilla y lógica del diseño -------------------------------------------
const template = src
  .match(/<x-dc>([\s\S]*?)<\/x-dc>/)[1]
  .replace(/<helmet>[\s\S]*?<\/helmet>/, "")
  .trim();
const logic = src.match(/<script type="text\/x-dc"[^>]*>([\s\S]*?)<\/script>/)[1];
const Component = new Function("DCLogic", `${logic}; return Component;`)(class {});

const esc = (v) =>
  String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const lookup = (scope, path) =>
  path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), scope);

function render(tpl, scope) {
  // Bucles <sc-for list="{{ xs }}" as="x">…</sc-for>
  tpl = tpl.replace(
    /<sc-for list="\{\{\s*([\w.]+)\s*\}\}" as="(\w+)"[^>]*>([\s\S]*?)<\/sc-for>/g,
    (_, list, name, inner) =>
      lookup(scope, list).map((item) => render(inner, { ...scope, [name]: item })).join("\n"),
  );
  // Valores {{ a.b }}
  return tpl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, path) => {
    const v = lookup(scope, path);
    if (typeof v === "function") return ""; // manejadores de eventos: se sustituyen más abajo
    if (v === undefined) throw new Error(`Valor sin resolver: ${m}`);
    return esc(v);
  });
}

// --- Piezas propias de la web (no están en el diseño) ------------------------
const PAGES = {
  es: { path: "/", out: "index.html", ogLocale: "es_ES" },
  en: { path: "/en/", out: "en/index.html", ogLocale: "en_GB" },
};

const META = {
  es: {
    title: "Tecnowizz - Consultoría de dirección, ingeniería e IA",
    description:
      "Tecnowizz Sistemas: consultoría de dirección, ingeniería e inteligencia artificial, especializada en el desarrollo de dispositivos localizadores GNSS compactos.",
    skip: "Ir al contenido",
    fundingAlt:
      "Gobierno de España, Ministerio de Asuntos Económicos y Transformación Digital. Red.es. Kit Digital. Plan de Recuperación, Transformación y Resiliencia. Financiado por la Unión Europea, NextGenerationEU.",
  },
  en: {
    title: "Tecnowizz - Management, engineering and AI consulting",
    description:
      "Tecnowizz Sistemas: management, engineering and artificial intelligence consulting, specialised in developing compact GNSS tracking devices.",
    skip: "Skip to content",
    fundingAlt:
      "Government of Spain, Ministry of Economic Affairs and Digital Transformation. Red.es. Kit Digital. Recovery, Transformation and Resilience Plan. Funded by the European Union, NextGenerationEU.",
  },
};

const CSS = `
@font-face{font-family:"Sora";src:url("/assets/fonts/sora-latin.woff2") format("woff2");font-weight:300 800;font-display:swap}
@font-face{font-family:"Inter";src:url("/assets/fonts/inter-latin.woff2") format("woff2");font-weight:400 600;font-display:swap}
@font-face{font-family:"JetBrains Mono";src:url("/assets/fonts/jetbrains-mono-latin.woff2") format("woff2");font-weight:400 500;font-display:swap}
*,*::before,*::after{box-sizing:border-box}
html{scroll-behavior:smooth;-webkit-text-size-adjust:100%}
body{margin:0;background:#0e1013;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
a:hover{opacity:.82}
:focus-visible{outline:3px solid #ff5a5f;outline-offset:3px}
img{max-width:100%}
.skip{position:absolute;left:-9999px}
.skip:focus{left:16px;top:16px;z-index:10;background:#fff;color:#0e1013;padding:8px 14px;border-radius:6px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`.trim();

// Idioma por defecto: la portada en español redirige a /en/ si el navegador no tiene
// español (ni catalán, gallego o euskera) entre sus idiomas. La elección manual con el
// selector ES/EN se recuerda y tiene prioridad. Los rastreadores no se redirigen.
const LANG_REDIRECT = `<script>
(function(){try{var s=localStorage.getItem('lang');if(s==='es')return;if(s!=='en'){if(/bot|crawl|spider|slurp|preview|lighthouse|headless/i.test(navigator.userAgent))return;var l=navigator.languages&&navigator.languages.length?navigator.languages:[navigator.language||''];for(var i=0;i<l.length;i++){if(/^(es|ca|gl|eu)(-|$)/i.test(l[i]))return}}location.replace('/en/'+location.hash)}catch(e){}})();
</script>
`;

function page(lang) {
  const c = new Component();
  c.props = { accent: "#e31b23", lang };
  c.state = { lang };
  const vals = c.renderVals();
  const m = META[lang];
  const p = PAGES[lang];

  let body = render(template, vals);

  // Logo: el diseño lo referencia en su carpeta de exportación
  body = body.replace(/\.\/assets\/[0-9a-f]{32}\.png/g, "/assets/logo.png");

  // Selector de idioma: en el diseño son botones con estado; aquí, enlaces a cada versión
  body = body.replace(
    /<button type="button" onClick="[^"]*" aria-pressed="[^"]*" aria-label="([^"]*)" style="([^"]*)">(ES|EN)<\/button>/g,
    (_, label, style, code) => {
      const target = code.toLowerCase();
      const current = target === lang ? ' aria-current="page"' : "";
      return `<a href="${PAGES[target].path}" hreflang="${target}" lang="${target}" aria-label="${label}"${current} onclick="try{localStorage.setItem('lang','${target}')}catch(e){}" style="${style.replace("cursor: pointer; ", "")}; display: flex; align-items: center; justify-content: center">${code}</a>`;
    },
  );
  if (/<button|onClick|\{\{|sc-for/.test(body)) throw new Error("Quedan restos de plantilla sin convertir");

  // Banda de logos del Kit Digital (obligatoria, no está en el diseño): justo antes del pie
  const funding = `<div style="background: #ffffff">
<div style="max-width: 1200px; margin: 0 auto; padding: 24px clamp(20px, 5vw, 48px)">
<img src="/assets/kit-digital.png" alt="${esc(m.fundingAlt)}" width="2048" height="154" loading="lazy" style="display: block; width: min(100%, 900px); height: auto; margin: 0 auto">
</div>
</div>

`;
  if (!body.includes("<footer")) throw new Error("El diseño no tiene <footer>");
  body = body.replace("<footer", `${funding}<footer`);

  const alternates = Object.entries(PAGES)
    .map(([l, pg]) => `<link rel="alternate" hreflang="${l}" href="${SITE}${pg.path}">`)
    .join("\n");

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(m.title)}</title>
${lang === "es" ? LANG_REDIRECT : ""}
<meta name="description" content="${esc(m.description)}">
<link rel="canonical" href="${SITE}${p.path}">
${alternates}
<link rel="alternate" hreflang="x-default" href="${SITE}/">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/logo-192.png">
<meta name="theme-color" content="#0e1013">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(m.title)}">
<meta property="og:description" content="${esc(m.description)}">
<meta property="og:url" content="${SITE}${p.path}">
<meta property="og:image" content="${SITE}/assets/logo.png">
<meta property="og:locale" content="${p.ogLocale}">
<link rel="preload" href="/assets/fonts/sora-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<style>
${CSS}
</style>
</head>
<body>
<a class="skip" href="#inicio">${esc(m.skip)}</a>
${body}
</body>
</html>
`;
}

for (const lang of Object.keys(PAGES)) {
  const out = new URL(`./${PAGES[lang].out}`, import.meta.url);
  mkdirSync(new URL(".", out), { recursive: true });
  writeFileSync(out, page(lang));
  console.log(`✓ ${PAGES[lang].out}`);
}
