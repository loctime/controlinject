# Plan de migración — ControlInject a VPS

Pre-plan para cuando haya escala (3+ clientes). No implementar antes de validar el modelo de negocio.

## Stack definitivo

```
Hetzner CX22 (x86, 2 vCPU, 4GB RAM, ~$6/mes)
└── Ubuntu 22.04
    └── Node.js 20 LTS
        ├── grammy              → bot Telegram
        ├── Playwright          → automatización CD (headless Chromium)
        ├── @anthropic-ai/sdk   → matching de PDFs con Claude
        └── pm2                 → proceso siempre vivo, restart automático, logs
```

> CX22 (x86) — NO usar CAX11 (ARM), puede tener problemas con binarios de Chromium.

## Capacidad estimada

- Un Chromium compartido con múltiples contextos aislados (no un Chrome por cliente)
- Cada contexto = cookies/sesión separada → clientes no se pisan nunca
- 4GB RAM cubre ~30 clientes con hasta 5 simultáneos cómodamente

## Arquitectura de procesos

```
pm2
└── bot.js (único proceso Node.js)
    ├── grammy: escucha todos los chatIds
    ├── Por mensaje: busca credenciales del chatId en clientes/
    └── Playwright: abre contexto aislado → CD → sube → cierra contexto
```

Un solo proceso Node.js maneja todos los clientes. Playwright comparte un browser y abre contextos on-demand.

## Fases

### Fase 1 — Bot Telegram en Node.js
- Librería: grammy
- Mover polling de Telegram de background.js a Node.js
- Solo recibir/responder, sin lógica de CD todavía

### Fase 2 — Lógica Claude/PDF en Node.js
- PDF rendering: pdfjs-dist
- Claude matching: copy casi directo de background.js (es fetch a Anthropic API)
- Mapeos: migrar de chrome.storage/IndexedDB a archivos JSON por cliente

### Fase 3 — Automatización web con Playwright
- Reemplazar content scripts con selectores Playwright
- Login en controldocumentario.com, scan de tabla, upload de archivos

### Fase 4 — Deploy y multi-tenant
- `clientes/garcia.json`: `{ chatId, cdUser, cdPass, diasPersonal, diasVehiculos }`
- `pm2 start bot.js` + `pm2 save` + `pm2 startup`
- Deploy: `git pull && pm2 restart bot`

## Señal para empezar
3+ clientes activos y modelo de negocio validado.
