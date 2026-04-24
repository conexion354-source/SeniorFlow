/* eslint-disable no-console */
const express = require('express');

const app = express();
const PORT = Number(process.env.PORT || 8787);
const IA_PROVIDER = (process.env.IA_PROVIDER || 'gemini').toLowerCase();
const ENDPOINT_TOKEN = (process.env.ENDPOINT_TOKEN || '').trim();

app.use(express.json({ limit: '80mb' }));
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
});

const ensureAuth = (req, res) => {
  if (!ENDPOINT_TOKEN) return true;
  const auth = (req.headers.authorization || '').toString();
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (token !== ENDPOINT_TOKEN) {
    res.status(401).json({ error: 'Token inválido para endpoint de ofertas.' });
    return false;
  }
  return true;
};

const normalizarTexto = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return fallback;
};

const parseDataUrl = (dataUrl) => {
  const raw = (dataUrl || '').toString().trim();
  const match = raw.match(/^data:(.*?);base64,(.*)$/);
  if (!match) return null;
  const mime = match[1] || 'image/png';
  const base64 = match[2] || '';
  if (!base64) return null;
  return {
    mime,
    base64,
    buffer: Buffer.from(base64, 'base64')
  };
};

const bufferToDataUrl = (buffer, mime = 'image/png') => {
  if (!buffer) return '';
  return `data:${mime};base64,${buffer.toString('base64')}`;
};

const buildPromptOferta = (payload = {}) => {
  const title = normalizarTexto(payload.title, 'OFERTAS ESPECIALES');
  const validity = normalizarTexto(payload.validity, '');
  const notes = normalizarTexto(payload.notes, '');
  const businessName = normalizarTexto(payload.businessName, 'MUNDO LED');
  const productDesc = normalizarTexto(payload?.product?.description, 'PRODUCTO');
  const productDetails = normalizarTexto(payload?.product?.details, '');
  const price = normalizarTexto(payload?.product?.priceFormatted, '$ 0,00');

  return [
    'Genera un flyer vertical hiper profesional para estado de WhatsApp.',
    'Mantén estrictamente el estilo visual de la plantilla base adjunta.',
    'No cambies la identidad visual ni estructura principal del diseño.',
    'Render final limpio, nítido, sin artifacts, sin pixelado.',
    '',
    `Marca: ${businessName}`,
    `Título principal: ${title}`,
    validity ? `Vigencia: ${validity}` : '',
    `Producto: ${productDesc}`,
    productDetails ? `Detalle técnico: ${productDetails}` : '',
    `Precio oferta: ${price}`,
    notes ? `Aclaración: ${notes}` : '',
    '',
    'Reglas obligatorias:',
    '- Usar el logo entregado.',
    '- Tipografía legible y estética premium.',
    '- Mantener composición elegante y balanceada.',
    '- No agregar textos no solicitados.',
    '- Salida final en formato vertical 9:16.'
  ].filter(Boolean).join('\n');
};

const parseGeminiImage = (json = {}) => {
  const candidates = Array.isArray(json.candidates) ? json.candidates : [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts || [];
    for (const part of parts) {
      const inline = part?.inlineData || part?.inline_data;
      if (inline?.data) {
        return {
          mime: inline.mimeType || inline.mime_type || 'image/png',
          buffer: Buffer.from(inline.data, 'base64')
        };
      }
    }
  }
  return null;
};

const renderWithGemini = async (payload = {}, options = {}) => {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en el servidor.');

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash-preview-image-generation';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const prompt = buildPromptOferta(payload);

  const template = parseDataUrl(payload.templateDataUrl);
  const product = parseDataUrl(payload?.product?.imageDataUrl);
  const logo = parseDataUrl(payload.businessLogoDataUrl);

  const parts = [{ text: prompt }];
  if (template) parts.push({ inline_data: { mime_type: template.mime, data: template.base64 } });
  if (product) parts.push({ inline_data: { mime_type: product.mime, data: product.base64 } });
  if (logo) parts.push({ inline_data: { mime_type: logo.mime, data: logo.base64 } });

  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseModalities: ['IMAGE', 'TEXT'],
      temperature: 0.2
    }
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: options.signal
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Gemini error ${response.status}: ${detail}`);
  }

  const json = await response.json();
  const image = parseGeminiImage(json);
  if (!image?.buffer) {
    throw new Error('Gemini no devolvió imagen.');
  }

  return image;
};

const parseOpenAiImage = async (json = {}) => {
  const item = Array.isArray(json?.data) ? json.data[0] : null;
  if (!item) return null;
  if (item?.b64_json) {
    return {
      mime: 'image/png',
      buffer: Buffer.from(item.b64_json, 'base64')
    };
  }
  if (item?.url) {
    const response = await fetch(item.url);
    if (!response.ok) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    const mime = response.headers.get('content-type') || 'image/png';
    return { mime, buffer };
  }
  return null;
};

const renderWithOpenAI = async (payload = {}, options = {}) => {
  const apiKey = (process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) throw new Error('Falta OPENAI_API_KEY en el servidor.');

  const model = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
  const size = process.env.OPENAI_IMAGE_SIZE || '1024x1536';
  const quality = process.env.OPENAI_IMAGE_QUALITY || 'high';
  const prompt = buildPromptOferta(payload);

  const template = parseDataUrl(payload.templateDataUrl);
  const product = parseDataUrl(payload?.product?.imageDataUrl);
  const logo = parseDataUrl(payload.businessLogoDataUrl);

  const form = new FormData();
  form.append('model', model);
  form.append('prompt', prompt);
  form.append('size', size);
  form.append('quality', quality);
  form.append('response_format', 'b64_json');

  if (template) form.append('image[]', new Blob([template.buffer], { type: template.mime }), 'template.png');
  if (product) form.append('image[]', new Blob([product.buffer], { type: product.mime }), 'product.png');
  if (logo) form.append('image[]', new Blob([logo.buffer], { type: logo.mime }), 'logo.png');

  const response = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: options.signal
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`OpenAI error ${response.status}: ${detail}`);
  }

  const json = await response.json();
  const image = await parseOpenAiImage(json);
  if (!image?.buffer) {
    throw new Error('OpenAI no devolvió imagen.');
  }
  return image;
};

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    provider: IA_PROVIDER,
    hasToken: Boolean(ENDPOINT_TOKEN),
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY)
  });
});

app.post('/render-oferta', async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;

    const payload = req.body || {};
    const provider = normalizarTexto(payload.provider, IA_PROVIDER).toLowerCase();
    const timeoutMs = Number(process.env.OFERTA_IA_TIMEOUT_MS || 90000);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let image;
    try {
      if (provider === 'openai') {
        image = await renderWithOpenAI(payload, { signal: controller.signal });
      } else {
        image = await renderWithGemini(payload, { signal: controller.signal });
      }
    } finally {
      clearTimeout(timeout);
    }

    res.setHeader('Content-Type', image.mime || 'image/png');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(image.buffer);
  } catch (error) {
    console.error('[render-oferta] error:', error);
    return res.status(500).json({
      error: 'No se pudo generar el flyer con IA.',
      detail: error?.message || 'Error desconocido'
    });
  }
});

app.post('/render-oferta/json', async (req, res) => {
  try {
    if (!ensureAuth(req, res)) return;
    const payload = req.body || {};
    const provider = normalizarTexto(payload.provider, IA_PROVIDER).toLowerCase();
    const image = provider === 'openai' ? await renderWithOpenAI(payload) : await renderWithGemini(payload);
    return res.status(200).json({
      ok: true,
      imageDataUrl: bufferToDataUrl(image.buffer, image.mime || 'image/png')
    });
  } catch (error) {
    console.error('[render-oferta/json] error:', error);
    return res.status(500).json({
      error: 'No se pudo generar el flyer con IA.',
      detail: error?.message || 'Error desconocido'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Oferta IA endpoint activo en http://localhost:${PORT}`);
  console.log(`Proveedor por defecto: ${IA_PROVIDER}`);
});
