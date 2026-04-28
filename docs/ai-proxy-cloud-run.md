# Proxy IA (Cloud Run) - clave unica para todos

## 1) Crear el servicio

Usa este servidor base: `docs/ai-proxy-server.js`.

`package.json` minimo:

```json
{
  "name": "controlinject-ai-proxy",
  "version": "1.0.0",
  "main": "ai-proxy-server.js",
  "type": "commonjs",
  "scripts": {
    "start": "node ai-proxy-server.js"
  },
  "dependencies": {
    "express": "^4.19.2"
  }
}
```

## 2) Variables de entorno (servidor)

- `ANTHROPIC_API_KEY=sk-ant-...`

En Cloud Run, configuralo como Secret o env var del servicio.

## 3) Deploy rapido (ejemplo)

```bash
gcloud run deploy controlinject-ai-proxy \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

## 4) URL en la extension

En Opciones de la extension, campo **Proxy IA**:

`https://<tu-servicio>.run.app/anthropic/messages`

Con eso, la extension deja de depender de API key por usuario.

## 5) Seguridad recomendada

- Restringir CORS/origen a tu extension ID.
- Agregar un header secreto compartido entre extension y proxy.
- Rate limiting por IP o por empresa.
- Logs de errores sin guardar contenido sensible.
