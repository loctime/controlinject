# Política de Privacidad - DocAutomatización

Última actualización: 2026-04-28

## 1) Quiénes somos

DocAutomatización es una extensión de Chrome para automatizar la carga de documentación en `controldocumentario.com`.

## 2) Qué datos procesa la extensión

La extensión puede procesar y/o almacenar:

- Datos de configuración del usuario (por ejemplo, preferencias y parámetros de uso).
- Patrones y mapeos de documentos creados por el usuario.
- Credenciales de acceso cargadas por el usuario para `controldocumentario.com` (usuario y contraseña).
- Configuración de Telegram (token de bot, chat ID y parámetros de alertas), si el usuario activa esa función.
- Documentos PDF seleccionados por el usuario para clasificación, separación y carga.
- Datos de autenticación de Firebase (tokens de sesión) cuando el usuario inicia sesión.

## 3) Para qué se usan esos datos

Los datos se usan exclusivamente para:

- Ejecutar las funciones de automatización solicitadas por el usuario.
- Guardar y restaurar configuración/mapeos.
- Enviar alertas de vencimientos por Telegram (si el usuario lo habilita).
- Sincronizar configuración y mapeos entre dispositivos mediante Firebase/Firestore.
- Procesar clasificación de documentos mediante un servicio de IA configurado por el operador de la extensión.

## 4) Dónde se almacenan

- En el navegador del usuario (`chrome.storage.local`) para funcionamiento local.
- En Firebase/Firestore del proyecto, cuando el usuario inicia sesión y sincroniza.
- Las imágenes de referencia derivadas de PDFs pueden guardarse en IndexedDB local del navegador para el matching visual.

## 5) Servicios de terceros

La extensión puede comunicarse con:

- Firebase Authentication y Firestore (Google) para autenticación y sincronización.
- API de Telegram para envío/recepción de mensajes del bot (si está activado).
- Un backend proxy de IA operado por el publicador (actualmente en `vercel.app`) para clasificación/comparación documental.
- `controldocumentario.com` para automatizar la operatoria solicitada por el usuario.

## 6) Compartición de datos

No vendemos datos personales.  
Los datos se comparten únicamente con los servicios técnicos necesarios para prestar la funcionalidad descrita (Firebase, Telegram, proxy IA y sitio objetivo).

## 7) Seguridad

Aplicamos medidas razonables para reducir accesos no autorizados.  
Sin embargo, ningún sistema es 100% invulnerable.

## 8) Conservación y control del usuario

El usuario puede:

- Modificar o borrar datos locales desde la extensión.
- Cerrar sesión para detener sincronización.
- Desinstalar la extensión para remover almacenamiento local asociado.

La eliminación de datos sincronizados en Firestore depende de la cuenta/proyecto Firebase administrado por el operador.

## 9) Menores

La extensión no está dirigida a menores de edad.

## 10) Cambios a esta política

Podemos actualizar esta política para reflejar cambios funcionales o legales.  
La versión vigente se identifica por su fecha de actualización.

## 11) Contacto

Para consultas sobre privacidad o tratamiento de datos, usar el contacto de soporte publicado en la ficha de Chrome Web Store.
