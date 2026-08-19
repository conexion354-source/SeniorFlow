/* Conector de listas web. Las credenciales no se guardan en Firestore.
 * El perfil de Chromium conserva la sesión en el servidor donde corre este proceso.
 */
const express = require('express');
const puppeteer = require('puppeteer-core');
const path = require('node:path');
const fs = require('node:fs');

const app = express();
const PORT = Number(process.env.PROVEEDORES_WEB_PORT || 8790);
const PROFILE_DIR = process.env.PROVEEDORES_WEB_PROFILE || path.join(process.cwd(), 'tmp', 'proveedores-web-profile');
const CHROME_PATH = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH || '';
let browserPromise = null;

app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', process.env.PROVEEDORES_WEB_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
});

const texto = (value, fallback = '') => (value === null || value === undefined ? fallback : String(value).trim() || fallback);
const normalizarPrecio = (value) => {
  const raw = texto(value).replace(/\s/g, '').replace(/\$/g, '');
  if (!raw) return 0;
  const comma = raw.lastIndexOf(',');
  const dot = raw.lastIndexOf('.');
  const normalized = comma > dot ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  return Number(normalized.replace(/[^\d.-]/g, '')) || 0;
};

const findChrome = () => {
  if (CHROME_PATH && fs.existsSync(CHROME_PATH)) return CHROME_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ];
  return candidates.find((item) => fs.existsSync(item)) || '';
};

const getBrowser = async () => {
  if (!browserPromise) {
    const executablePath = findChrome();
    if (!executablePath) throw new Error('No se encontró Chrome/Chromium. Configurá CHROME_PATH en el servidor.');
    fs.mkdirSync(PROFILE_DIR, { recursive: true });
    // En una PC local se abre Chrome para que el usuario pueda iniciar sesión.
    // En un servidor sin pantalla usar PROVEEDORES_WEB_HEADLESS=true.
    browserPromise = puppeteer.launch({ headless: process.env.PROVEEDORES_WEB_HEADLESS === 'true', executablePath, userDataDir: PROFILE_DIR, args: ['--no-sandbox'] });
  }
  return browserPromise;
};

const esperarLogin = (url = '') => /login|ingreso|homeinterno\.aspx/i.test(url);

app.get('/health', (req, res) => res.json({ ok: true, provider: 'jieli', hasChrome: Boolean(findChrome()), profileDir: PROFILE_DIR }));

app.post('/api/proveedores-web/jieli/search', async (req, res) => {
  const query = texto(req.body?.query);
  if (!query) return res.status(400).json({ ok: false, error: 'Ingresá un producto o código.' });
  const proveedores = Array.isArray(req.body?.proveedores) ? req.body.proveedores : [];
  const jieli = proveedores.find((item) => /jieliargentina\.com\.ar/i.test(texto(item?.url)));
  if (!jieli) return res.json({ ok: true, proveedor: '', query, resultados: [], omitidos: proveedores.map((item) => item.proveedor).filter(Boolean) });
  const page = await (await getBrowser()).newPage();
  try {
    await page.goto(texto(jieli.url, 'https://jieliargentina.com.ar/homeinterno.aspx'), { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (esperarLogin(page.url()) && await page.$('input[placeholder="Usuario"]')) {
      return res.json({ ok: false, requiresLogin: true, error: 'La sesión de Jieli no está iniciada en el conector.' });
    }
    const input = 'input[placeholder*="palabras de búsqueda"]';
    await page.waitForSelector(input, { timeout: 15000 });
    await page.click(input, { clickCount: 3 });
    await page.type(input, query);
    await Promise.allSettled([page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 }), page.click('button')]);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const resultados = await page.evaluate(() => {
      const money = /\$\s*[\d.,]+/;
      return Array.from(document.querySelectorAll('body *')).filter((node) => {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        return text && text.length < 350 && money.test(text) && !node.children.length;
      }).map((priceNode) => {
        const priceText = (priceNode.textContent || '').trim();
        let parent = priceNode.parentElement;
        for (let i = 0; i < 5 && parent; i += 1) {
          const text = (parent.textContent || '').replace(/\s+/g, ' ').trim();
          if (text.length > priceText.length + 10 && text.length < 800) return { texto: text, precioTexto: priceText };
          parent = parent.parentElement;
        }
        return { texto: priceText, precioTexto: priceText };
      });
    });
    const unicos = [];
    const vistos = new Set();
    for (const item of resultados) {
      const clave = item.texto;
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      const precio = normalizarPrecio(item.precioTexto);
      const textoProducto = item.texto.replace(item.precioTexto, '').replace(/Agregar al Carro/gi, '').trim();
      if (textoProducto && precio > 0) unicos.push({ proveedor: 'Jieli', descripcion: textoProducto, precio, moneda: 'ARS', unidad: 'C/U', fuente: 'web' });
    }
    return res.json({ ok: true, proveedor: 'Jieli', query, resultados: unicos.slice(0, 100), url: page.url() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || 'No se pudo consultar Jieli.' });
  } finally {
    await page.close().catch(() => {});
  }
});

app.listen(PORT, () => console.log(`Conector de proveedores web escuchando en http://localhost:${PORT}`));
