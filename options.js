const estadoEl = document.getElementById("estado");

const cdUserEl = document.getElementById("cd-user");
const cdPassEl = document.getElementById("cd-pass");

const tgTokenEl = document.getElementById("tg-token");
const tgChatIdEl = document.getElementById("tg-chatid");
const tgDiasPersonalEl = document.getElementById("tg-dias-personal");
const tgDiasVehiculosEl = document.getElementById("tg-dias-vehiculos");
const tgFrecuenciaEl = document.getElementById("tg-frecuencia");
const tgActivoEl = document.getElementById("tg-activo");
const tgSilencioDesdeEl = document.getElementById("tg-silencio-desde");
const tgSilencioHastaEl = document.getElementById("tg-silencio-hasta");
const fbEmailEl = document.getElementById("fb-email");
const fbPasswordEl = document.getElementById("fb-password");
const fbLoginFormEl = document.getElementById("login-form");
const fbLoginInfoEl = document.getElementById("login-info");
const fbUserLabelEl = document.getElementById("fb-user-label");

function mostrar(msg, tipo) {
  estadoEl.textContent = msg;
  estadoEl.className = tipo || "";
}

async function actualizarUILogin() {
  try {
    const r = await chrome.runtime.sendMessage({ action: "firebase:status" });
    const user = r?.ok ? r.data?.user : null;
    fbLoginFormEl.style.display = user ? "none" : "block";
    fbLoginInfoEl.style.display = user ? "block" : "none";
    fbUserLabelEl.textContent = user?.email || user?.uid || "-";
  } catch (_) {
    fbLoginFormEl.style.display = "block";
    fbLoginInfoEl.style.display = "none";
    fbUserLabelEl.textContent = "-";
  }
}

async function cargarConfig() {
  await actualizarUILogin();
  try {
    const r = await chrome.runtime.sendMessage({ action: "auth:getCreds" });
    if (r?.ok) {
      cdUserEl.value = r.data.user || "";
      cdPassEl.value = r.data.pass || "";
    }
  } catch (e) {
    // Silencioso
  }

  try {
    const r = await chrome.runtime.sendMessage({ action: "tg:getConfig" });
    if (r?.ok) {
      tgTokenEl.value = r.data.token || "";
      tgChatIdEl.value = r.data.chatId || "";
      tgDiasPersonalEl.value = r.data.diasPersonal || r.data.dias || 7;
      tgDiasVehiculosEl.value = r.data.diasVehiculos || 15;
      if (r.data.frecuencia) tgFrecuenciaEl.value = String(r.data.frecuencia);
      tgActivoEl.checked = !!r.data.activo;
      tgSilencioDesdeEl.value = r.data.silencioDesde || "22:00";
      tgSilencioHastaEl.value = r.data.silencioHasta || "08:00";
    }
  } catch (e) {
    // Silencioso: si todavía no existe la config, queda vacío.
  }
}

document.getElementById("btn-login-email").addEventListener("click", async () => {
  try {
    const email = fbEmailEl.value.trim();
    const password = fbPasswordEl.value;
    if (!email || !password) throw new Error("Completá email y contraseña.");
    mostrar("Iniciando sesión…", "");
    const r = await chrome.runtime.sendMessage({ action: "firebase:login", payload: { email, password } });
    if (!r?.ok) throw new Error(r?.error || "No se pudo iniciar sesión.");
    await actualizarUILogin();
    mostrar("Sesión iniciada y datos sincronizados desde la nube.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("btn-logout").addEventListener("click", async () => {
  try {
    const r = await chrome.runtime.sendMessage({ action: "firebase:logout" });
    if (!r?.ok) throw new Error(r?.error || "No se pudo cerrar sesión.");
    await actualizarUILogin();
    mostrar("Sesión cerrada.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("guardar-cd").addEventListener("click", async () => {
  try {
    const user = cdUserEl.value.trim();
    const pass = cdPassEl.value;
    const r = await chrome.runtime.sendMessage({
      action: "auth:setCreds",
      payload: { user, pass }
    });
    if (!r?.ok) throw new Error(r?.error || "No se pudo guardar.");
    mostrar("Usuario y contraseña guardados correctamente.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("probar-cd").addEventListener("click", async () => {
  try {
    mostrar("Probando login en controldocumentario.com…", "");
    const r = await chrome.runtime.sendMessage({ action: "auth:probarLogin" });
    if (!r?.ok) throw new Error(r?.error || "Falló la prueba.");
    mostrar("Login exitoso. La extensión va a poder reconectarse sola cuando haga falta.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("guardar-tg").addEventListener("click", async () => {
  try {
    const token = tgTokenEl.value.trim();
    const chatId = tgChatIdEl.value.trim();
    const diasPersonal = Math.max(1, Math.min(60, parseInt(tgDiasPersonalEl.value, 10) || 7));
    const diasVehiculos = Math.max(1, Math.min(60, parseInt(tgDiasVehiculosEl.value, 10) || 15));
    const frecuencia = parseInt(tgFrecuenciaEl.value, 10) || 180;
    const activo = !!tgActivoEl.checked;
    const silencioDesde = tgSilencioDesdeEl.value || "";
    const silencioHasta = tgSilencioHastaEl.value || "";
    const r = await chrome.runtime.sendMessage({
      action: "tg:setConfig",
      payload: { token, chatId, diasPersonal, diasVehiculos, frecuencia, activo, silencioDesde, silencioHasta }
    });
    if (!r?.ok) throw new Error(r?.error || "No se pudo guardar.");
    mostrar(activo
      ? `Guardado. Personal: ${diasPersonal} días · Vehículos: ${diasVehiculos} días · Cada ${frecuencia} min.`
      : "Configuración de Telegram guardada. Alertas apagadas.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("probar-tg").addEventListener("click", async () => {
  try {
    mostrar("Mandando mensaje de prueba a Telegram…", "");
    const r = await chrome.runtime.sendMessage({ action: "tg:probar" });
    if (!r?.ok) throw new Error(r?.error || "Falló la prueba.");
    mostrar("Mensaje de prueba enviado. Mirá tu Telegram.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("chequear-ahora").addEventListener("click", async () => {
  try {
    mostrar("Chequeando vencimientos y mandando alerta…", "");
    const r = await chrome.runtime.sendMessage({ action: "tg:chequearAhora" });
    if (!r?.ok) throw new Error(r?.error || "Falló el chequeo.");
    mostrar(r.data?.mensaje || "Chequeo terminado.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("chequear-visible").addEventListener("click", async () => {
  try {
    mostrar("Abriendo pestaña de Vencimientos para que veas el chequeo en vivo…", "");
    const r = await chrome.runtime.sendMessage({ action: "tg:chequearVisible" });
    if (!r?.ok) throw new Error(r?.error || "Falló el chequeo.");
    mostrar((r.data?.mensaje || "Chequeo terminado.") + " La pestaña quedó abierta para que la revises.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

cargarConfig();
