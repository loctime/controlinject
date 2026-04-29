# Chrome Web Store - Respuestas sugeridas (copiar/pegar)

## 1) Single purpose (propósito único)

`La extensión automatiza la carga de documentación en controldocumentario.com, incluyendo mapeo de PDFs, clasificación de páginas, asignación a requerimientos y sincronización de configuración para uso operativo empresarial.`

## 2) Justificación de permisos

### `storage`

`Se utiliza para guardar configuración, mapeos, credenciales operativas y estado necesario para que la automatización funcione entre sesiones.`

### `identity`

`Se utiliza para iniciar sesión con Google/Firebase y obtener autenticación del usuario dentro de la extensión.`

### `alarms`

`Se utiliza para programar chequeos periódicos de vencimientos y ejecutar alertas automáticas de Telegram.`

### `tabs`

`Se utiliza para detectar, abrir y controlar pestañas de controldocumentario.com durante los flujos automáticos de lectura/carga y validación.`

### `activeTab`

`Se utiliza para interactuar con la pestaña activa cuando el usuario dispara acciones de la extensión.`

### `scripting`

`Se utiliza para inyectar scripts en controldocumentario.com y ejecutar pasos del flujo de automatización en el contexto del sitio.`

## 3) Justificación de host permissions

### `https://controldocumentario.com/*`

`Dominio principal donde se ejecuta la automatización de carga documental.`

### `https://identitytoolkit.googleapis.com/*`, `https://securetoken.googleapis.com/*`, `https://firestore.googleapis.com/*`

`Servicios Firebase usados para autenticación de usuario y sincronización de configuración/mapeos.`

### `https://api.telegram.org/*`

`Servicio Telegram Bot API para enviar alertas y recibir comandos/documentos cuando la función Telegram está activa.`

### `https://*.vercel.app/*` (y otros hosts proxy)

`Endpoint backend proxy de IA usado para clasificación/comparación documental.`

### `https://api.anthropic.com/*`

`Compatibilidad técnica/fallback de integración IA.`

## 4) Data use disclosure (resumen)

`La extensión procesa documentos PDF y datos de configuración aportados por el usuario para automatizar su flujo documental. Los datos pueden almacenarse localmente en el navegador y sincronizarse en Firebase/Firestore bajo la cuenta del usuario. Si se habilita Telegram, se usan token/chat ID para enviar alertas. El procesamiento de IA se realiza vía backend proxy del publicador. No se venden datos personales.`

## 5) ¿Se venden o transfieren datos a terceros por publicidad?

`No.`

## 6) ¿Se usan datos para fines no relacionados con la funcionalidad principal?

`No.`

## 7) Soporte / contacto (texto breve)

`Para soporte técnico, incidencias o solicitudes de privacidad, usar el canal de contacto publicado en la ficha de la extensión.`
