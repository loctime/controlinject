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

- `ANTHROPIC_API_KEY = sk-ant-...`

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

Con eso, la API key queda centralizada en Vercel y no en cada Chrome.
