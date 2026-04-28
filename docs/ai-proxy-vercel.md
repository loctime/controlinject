# Proxy IA en Vercel (recomendado)

## 1) Carpeta lista

Usa esta carpeta del repo:

- `docs/vercel-proxy/`

Contiene:
- `api/anthropic/messages.js`
- `vercel.json`

## 2) Crear proyecto en Vercel

1. Importá el repo en Vercel.
2. En **Root Directory**, elegí: `docs/vercel-proxy`
3. Framework: `Other`

## 3) Variable de entorno

En Vercel -> Settings -> Environment Variables:

Configura al menos una:

- `ANTHROPIC_API_KEY = sk-ant-...`
- `GEMINI_API_KEY = ...`

Opcional para Gemini:

- `GEMINI_MODEL = gemini-2.0-flash`

Prioridad automática del proxy:

1. Si existe `ANTHROPIC_API_KEY`, usa Anthropic.
2. Si no, usa Gemini.
3. Si no hay ninguna, responde error.

Aplicala al entorno `Production` (y Preview si querés).

## 4) Deploy

Hacé deploy normal desde Vercel.

La URL final para la extensión será:

`https://<tu-proyecto>.vercel.app/api/anthropic/messages`

## 5) Configurar extensión

En Opciones de la extensión:

- Campo **Proxy IA** -> pegar la URL anterior
- Guardar
- Probar conexión

Con eso, la API key queda centralizada en Vercel y no en cada Chrome. El usuario final no elige proveedor ni ve estos detalles.
