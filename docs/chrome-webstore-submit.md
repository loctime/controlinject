# Chrome Web Store - Checklist de publicacion

## Archivo a subir

- ZIP: `dist/chrome-webstore/controlinject-v1.0.0.zip`

## Flujo de carga

1. Ir a `https://chrome.google.com/webstore/devconsole`
2. `Add new item`
3. Subir el ZIP

## Datos de ficha (Store listing)

- Nombre: `Control Documentario`
- Descripcion corta: `Automatiza la carga de documentos`
- Descripcion completa: explicar que procesa PDFs del usuario para sugerir y subir documentacion
- Icono: usar `icons/icon128.png`
- Capturas: opciones + panel en sitio + flujo de mapeo/aprender

## Privacidad y cumplimiento

- Single purpose: automatizacion de carga documental en controldocumentario.com
- Justificacion de permisos:
  - `storage`: guardar configuracion/mapeos
  - `identity`: login OAuth Google para Firebase
  - `alarms`: chequeos periodicos Telegram
  - `tabs`/`activeTab`/`scripting`: interactuar con pestaña de controldocumentario.com
- Host permissions: detallar uso de dominios Firebase, Telegram y proxy IA en vercel

## Punto sensible

- El dashboard suele pedir politica de privacidad por:
  - autenticacion
  - credenciales de terceros
  - envio a servicios externos (Firebase/Telegram/IA)

Tener URL de politica de privacidad lista antes de enviar.

## Test previo antes de enviar

1. Login Firebase (email o Google)
2. Sync up/down
3. Aprender (mapeo)
4. Trabajar (subida)
5. Telegram prueba
