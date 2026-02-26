import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Este script usa el SDK de administrador porque facilita listar todas
// las colecciones y no depende de las reglas de seguridad de Firestore.
// Para usarlo necesitas generar una clave de servicio desde la consola
// de Firebase y guardarla en la ruta indicada abajo.

// ---------------------------------------------------------------------
// 1. CONFIGURA EL ARCHIVO DE CREDENCIALES (JSON)
// ---------------------------------------------------------------------
// Descarga el archivo JSON de la cuenta de servicio desde:
//   Firebase Console -> Project settings -> Service accounts -> Generate new private key
// Guarda el fichero en la raíz del proyecto con el nombre `serviceAccountKey.json`
// o en la carpeta `scripts` (cualquiera de las dos rutas funciona).
// La variable de abajo comprueba primero 'scripts/serviceAccountKey.json' y luego la raíz.
let serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  // intentamos dentro de la carpeta scripts
  const alt = path.resolve(process.cwd(), 'scripts', 'serviceAccountKey.json');
  if (fs.existsSync(alt)) {
    serviceAccountPath = alt;
  }
}

if (!fs.existsSync(serviceAccountPath)) {
  console.error('No se encontró el archivo de credenciales (buscado en raíz y en /scripts):', serviceAccountPath);
  console.error('Descárgalo desde la consola de Firebase y colócalo en la ruta indicada.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf-8'));

// ---------------------------------------------------------------------
// 2. INICIALIZA FIRESTORE
// ---------------------------------------------------------------------
initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

// ---------------------------------------------------------------------
// 3. EXPORTACIÓN A CSV
// ---------------------------------------------------------------------
// El siguiente proceso recorre cada colección y guarda un archivo CSV
// independiente. Así mantiene la estructura separada y es fácil de
// abrir tanto en Excel como en LibreOffice.
async function exportFirestoreToCSV() {
  console.log('➡️  Leyendo colecciones de Firestore...');

  const collections = await db.listCollections();
  if (collections.length === 0) {
    console.warn('No se encontraron colecciones en la base de datos.');
    return;
  }

  const fechaTag = new Date().toISOString().slice(0, 10);

  for (const coll of collections) {
    const snap = await coll.get();
    const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    console.log(`  • ${coll.id}  (${rows.length} documentos)`);

    // Convierte el array de objetos en hoja y luego a CSV
    const sheet = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(sheet);

    const fileName = `firestore_export_${fechaTag}_${coll.id}.csv`;
    fs.writeFileSync(path.resolve(process.cwd(), fileName), csv, 'utf8');
    console.log(`    → Guardado como ${fileName}`);
  }

  console.log('✅ Exportación CSV completada para todas las colecciones.');
}

// ejecutar la versión CSV (antes de aquí ya no hay más llamadas)
exportFirestoreToCSV().catch(err => {
  console.error('❌ Error durante la exportación:', err);
  process.exit(1);
});
