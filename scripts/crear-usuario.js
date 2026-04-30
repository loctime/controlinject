const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey-controlfile.json");

// ─── EDITAR ESTOS CAMPOS ───────────────────────────────────────────────────
const EMAIL = "licvidalfernando@gmail.com";
const PASSWORD = "123123123";
// ──────────────────────────────────────────────────────────────────────────

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  // Buscar el usuario existente por email (el Auth es compartido entre apps)
  console.log(`Buscando usuario: ${EMAIL} …`);
  const user = await admin.auth().getUserByEmail(EMAIL);
  console.log(`✅ Usuario encontrado. UID: ${user.uid}`);

  // Crear documento en Firestore solo para control-inject
  const userRef = db.doc(`apps/control-inject/users/${user.uid}`);
  const snap = await userRef.get();

  if (snap.exists) {
    console.log(`ℹ️  El documento ya existe en Firestore. No se sobreescribe.`);
    console.log(`   Ruta: apps/control-inject/users/${user.uid}`);
  } else {
    await userRef.set({
      email: EMAIL,
      creadoEn: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log(`✅ Documento Firestore creado en apps/control-inject/users/${user.uid}`);
  }

  console.log(`\nYa podés iniciar sesión desde la extensión con:`);
  console.log(`  Email:      ${EMAIL}`);
  console.log(`  Contraseña: ${PASSWORD}  (la que ya tenés en Firebase Auth)`);

  process.exit(0);
}

main().catch((e) => {
  console.error("❌ Error:", e.message);
  process.exit(1);
});
