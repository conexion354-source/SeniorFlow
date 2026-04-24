# Endpoint IA de Ofertas

Este endpoint recibe los datos del flyer (plantilla, logo, producto, precio, vigencia) y devuelve una imagen final para usar en el módulo **Ofertas**.

## 1) Instalar dependencias

```bash
npm install
```

## 2) Variables de entorno

Puedes usar Gemini o OpenAI como proveedor.

También puedes copiar el ejemplo:

```bash
cp server/.env.oferta.example server/.env.oferta
# luego editar server/.env.oferta
```

### Opción A: Gemini

```bash
export IA_PROVIDER=gemini
export GEMINI_API_KEY="TU_API_KEY_GEMINI"
export GEMINI_MODEL="gemini-2.0-flash-preview-image-generation"
```

### Opción B: OpenAI

```bash
export IA_PROVIDER=openai
export OPENAI_API_KEY="TU_API_KEY_OPENAI"
export OPENAI_IMAGE_MODEL="gpt-image-1"
export OPENAI_IMAGE_SIZE="1024x1536"
export OPENAI_IMAGE_QUALITY="high"
```

### Seguridad opcional

```bash
export ENDPOINT_TOKEN="TOKEN_PRIVADO"
```

### Puerto opcional

```bash
export PORT=8787
```

## 3) Levantar endpoint

```bash
npm run server:ofertas
```

Salud:

```bash
curl http://localhost:8787/health
```

## 4) Configurar en la app (Ajustes)

- **Endpoint IA de ofertas (ChatGPT/Gemini)**: `http://localhost:8787/render-oferta`
- **Token del endpoint IA**: el mismo valor de `ENDPOINT_TOKEN` (si configuraste uno)

## 5) Formatos de respuesta soportados

El frontend acepta:
- respuesta binaria `image/*`
- o JSON con `imageDataUrl` / `imageBase64` / `dataUrl`

## Nota

Si el endpoint falla o no está configurado, la app vuelve automáticamente al render local.
