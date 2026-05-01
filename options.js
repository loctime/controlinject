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
const cfBaseUrlEl = document.getElementById("cf-baseurl");
const cfDebugOutputEl = document.getElementById("cf-debug-output");

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
  await cargarControlFileBaseUrl();
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

async function cargarControlFileBaseUrl() {
  try {
    const r = await chrome.runtime.sendMessage({ action: "controlfile:getBaseUrl" });
    if (r?.ok && cfBaseUrlEl) cfBaseUrlEl.value = r.data?.baseUrl || "";
  } catch (_) {
    // Silencioso
  }
}

document.getElementById("btn-login-email").addEventListener("click", async () => {
  try {
    const email = fbEmailEl.value.trim();
    const password = fbPasswordEl.value;
    if (!email || !password) throw new Error("Completá email y contraseña.");
    mostrar("Iniciando sesiÃ³nâ€¦", "");
    const r = await chrome.runtime.sendMessage({ action: "firebase:login", payload: { email, password } });
    if (!r?.ok) throw new Error(r?.error || "No se pudo iniciar sesiÃ³n.");
    await actualizarUILogin();
    mostrar("SesiÃ³n iniciada y datos sincronizados desde la nube.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});


document.getElementById("btn-logout").addEventListener("click", async () => {
  try {
    const r = await chrome.runtime.sendMessage({ action: "firebase:logout" });
    if (!r?.ok) throw new Error(r?.error || "No se pudo cerrar sesiÃ³n.");
    await actualizarUILogin();
    mostrar("SesiÃ³n cerrada.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});



document.getElementById("limpiar").addEventListener("click", async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: "storage:clearMemory" });
    if (!response?.ok) throw new Error(response?.error || "No se pudo limpiar la memoria.");
    mostrar("Memoria limpiada.", "ok");
  } catch (error) {
    mostrar(`Error: ${error.message}`, "err");
  }
});

document.getElementById("limpiar-sabana").addEventListener("click", async () => {
  try {
    const response = await chrome.runtime.sendMessage({ action: "storage:limpiarPatronesSabana" });
    if (!response?.ok) throw new Error(response?.error || "No se pudo limpiar.");
    mostrar("Patrones de sábana eliminados.", "ok");
  } catch (error) {
    mostrar(`Error: ${error.message}`, "err");
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
    mostrar("Mandando mensaje de prueba a Telegram\u2026", "");
    const r = await chrome.runtime.sendMessage({ action: "tg:probar" });
    if (!r?.ok) throw new Error(r?.error || "Fall\u00f3 la prueba.");
    mostrar("Mensaje de prueba enviado. Mir\u00e1 tu Telegram.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("chequear-ahora").addEventListener("click", async () => {
  try {
    mostrar("Chequeando vencimientos y mandando alerta\u2026", "");
    const r = await chrome.runtime.sendMessage({ action: "tg:chequearAhora" });
    if (!r?.ok) throw new Error(r?.error || "Fall\u00f3 el chequeo.");
    mostrar(r.data?.mensaje || "Chequeo terminado.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("chequear-visible").addEventListener("click", async () => {
  try {
    mostrar("Abriendo pesta\u00f1a de Vencimientos para que veas el chequeo en vivo\u2026", "");
    const r = await chrome.runtime.sendMessage({ action: "tg:chequearVisible" });
    if (!r?.ok) throw new Error(r?.error || "Fall\u00f3 el chequeo.");
    mostrar((r.data?.mensaje || "Chequeo terminado.") + " La pesta\u00f1a qued\u00f3 abierta para que la revises.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("exportar-mapeo").addEventListener("click", async () => {
  try {
    mostrar("Exportando mapeo…", "");
    const r = await chrome.runtime.sendMessage({ action: "storage:exportarMapeo" });
    if (!r) throw new Error("No se pudo leer el mapeo.");
    const json = JSON.stringify(r, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `controldoc-mapeo-${fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);
    const nPatrones = (r.patrones_sabana || []).length;
    const nMapeos = Object.keys(r.mapeos_aprendidos || {}).length;
    mostrar(`Exportado: ${nPatrones} patrón(es) de sábana, ${nMapeos} mapeo(s) aprendido(s).`, "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("importar-mapeo-btn").addEventListener("click", () => {
  document.getElementById("importar-mapeo-input").click();
});

document.getElementById("importar-mapeo-input").addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  try {
    mostrar("Importando mapeo…", "");
    const texto = await file.text();
    const datos = JSON.parse(texto);
    const r = await chrome.runtime.sendMessage({ action: "storage:importarMapeo", payload: datos });
    if (!r?.ok) throw new Error(r?.error || "No se pudo importar.");
    mostrar(`Importado: ${r.data.patrones} patrón(es) de sábana, ${r.data.mapeos} mapeo(s).`, "ok");
  } catch (e) {
    mostrar(`Error al importar: ${e.message}`, "err");
  }
  e.target.value = "";
});

document.getElementById("cf-guardar-baseurl").addEventListener("click", async () => {
  try {
    const baseUrl = (cfBaseUrlEl?.value || "").trim();
    if (!baseUrl) throw new Error("Completá la Base URL de ControlStorage.");
    const r = await chrome.runtime.sendMessage({ action: "controlfile:setBaseUrl", payload: { baseUrl } });
    if (!r?.ok) throw new Error(r?.error || "No se pudo guardar la Base URL.");
    mostrar("ControlStorage Base URL guardada.", "ok");
  } catch (e) {
    mostrar(`Error: ${e.message}`, "err");
  }
});

document.getElementById("cf-debug-upload").addEventListener("click", async () => {
  try {
    if (cfDebugOutputEl) cfDebugOutputEl.value = "";
    mostrar("Probando subida a ControlStorage...", "");
    const r = await chrome.runtime.sendMessage({ action: "controlfile:debugUpload" });
    if (!r?.ok) throw new Error(r?.error || "Falló la subida de debug.");
    if (cfDebugOutputEl) cfDebugOutputEl.value = JSON.stringify(r.data || {}, null, 2);
    mostrar("Debug OK: subida remota completada.", "ok");
  } catch (e) {
    if (cfDebugOutputEl) cfDebugOutputEl.value = `ERROR\n${e.message}`;
    mostrar(`Error: ${e.message}`, "err");
  }
});

cargarConfig();
