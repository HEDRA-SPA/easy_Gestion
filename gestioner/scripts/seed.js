
import { db, FirebaseTimestamp } from "../src/firebase/config.js"; 
import { collection, doc, writeBatch } from "firebase/firestore";

const seedDatabase = async () => {
  const batch = writeBatch(db); // Usamos el db que viene del config
  console.log("🚀 Iniciando carga limpia con conexión centralizada...");

  // 1. PROPIEDADES (Igual que antes)
  const propiedades = [
    { id: 'chilpancingo', nombre: 'Chilpancingo', limite_agua: 250, limite_luz: 250, total_unidades: 9 },
    { id: 'emperadores', nombre: 'Emperadores', limite_agua: 250, limite_luz: 250, total_unidades: 8 },
    { id: 'otay', nombre: 'Casa Otay', limite_agua: 0, limite_luz: 0, total_unidades: 1 },
  ];
  propiedades.forEach(p => batch.set(doc(db, "propiedades", p.id), p));

  // 2. UNIDADES (Estructura inicial)
  const crearUnidadesBase = (cantidad, prefijo, propId, rentaDefault) => {
    for (let i = 1; i <= cantidad; i++) {
      const id = `${prefijo}-${i}`;
      batch.set(doc(db, "unidades", id), {
        no_depto: `${i}`,
        id_propiedad: propId,
        id_inquilino: null,
        nombre_inquilino: "",
        estado: "Disponible",
        renta_mensual: rentaDefault,
        no_personas: 0
      });
    }
  };
  crearUnidadesBase(9, 'CH', 'chilpancingo', 4000);
  crearUnidadesBase(8, 'EM', 'emperadores', 4500);
  batch.set(doc(db, "unidades", "OT-01"), { no_depto: "1", id_propiedad: 'otay', id_inquilino: null, nombre_inquilino: "", estado: "Disponible", renta_mensual: 8000, no_personas: 0 });

// 3. DATOS REALES: RODERICK (Con Historial de Contratos)
  const inqId = "inq_001";
  const inqData = {
    nombre_completo: "Roderick Cutberto Duarte",
    telefono_contacto: "66892580209",
    telefono_emergencia: "6682580209",
    deposito_garantia: 6800,
    dia_pago: 5,
    renta_actual: 6800, 
    fecha_inicio_contrato: FirebaseTimestamp.fromDate(new Date("2025-05-05")),
    fecha_fin_contrato: FirebaseTimestamp.fromDate(new Date("2026-05-05")),
    acompanantes: [
      { nombre: "Maria Isabel Muñoz", telefono_emergencia: "6641755930" }
    ],
    docs: { ine: "", contrato: "", carta: "" },
    historial_contratos: [
      {
        periodo: "",
        renta: 0,
        notas: ""
      }
    ]
  };

  batch.set(doc(db, "inquilinos", inqId), inqData);

  // VINCULAR RODERICK A CH-1 (Asegúrate de que la renta coincida con inqData.renta_actual)
  batch.update(doc(db, "unidades", "CH-1"), {
    id_inquilino: inqId,
    nombre_inquilino: inqData.nombre_completo,
    estado: "Ocupado",
    renta_mensual: inqData.renta_actual, // Usamos la renta vigente
    no_personas: 2
  });
// 3.1 DATOS REALES: ROSA ANAHÍ (inq_006)
  const inqRosaId = "inq_006";
  const inqRosaData = {
    nombre_completo: "Rosa Anahí Marquez Murillo",
    telefono_contacto: "6632015470", // Como string para evitar problemas
    telefono_emergencia: "",
    deposito_garantia: 3000,
    dia_pago: 16,
    renta_actual: 5700,
    fecha_inicio_contrato: FirebaseTimestamp.fromDate(new Date("2025-01-16")),
    fecha_fin_contrato: FirebaseTimestamp.fromDate(new Date("2026-12-16")),
    acompanantes: [], // Limpié el acompañante vacío
    docs: { ine: "si", contrato: "", carta: "si" },
    historial_contratos: []
  };

  batch.set(doc(db, "inquilinos", inqRosaId), inqRosaData);

  // VINCULAR ROSA A EM-2
  batch.update(doc(db, "unidades", "EM-2"), {
    id_inquilino: inqRosaId,
    nombre_inquilino: inqRosaData.nombre_completo,
    estado: "Ocupado",
    renta_mensual: 5700,
    no_personas: 1
  });
  // 4. HISTORIAL DE PAGOS
  // 4.1 HISTORIAL ROSA (JUNIO - DICIEMBRE 2025)
  const mesesRosa = [6, 7, 8, 9, 10, 11, 12];
  mesesRosa.forEach(mes => {
    const mesStr = mes < 10 ? `0${mes}` : `${mes}`;
    const pagoId = `EM2_2025_${mesStr}`;
    
    // Lógica para el último mes (Diciembre) que pusiste como no pagado
    const esDiciembre = mes === 12;

    batch.set(doc(db, "pagos", pagoId), {
      id_unidad: "EM-2",
      id_inquilino: inqRosaId,
      periodo: `2025-${mesStr}`,
      mes: mes,
      anio: 2025,
      monto_renta: mes === 10 ? 6800 : 5700, // Ajuste de renta en Octubre según tu data
      monto_pagado: esDiciembre ? 0 : (mes === 11 ? 5000 : 5700),
      servicios: { luz_lectura: 0, agua_lectura: 0, excedente_total: 0 },
      estatus: esDiciembre ? "pendiente" : "pagado",
      medio_pago: "transferencia",
      notas: esDiciembre ? "Pendiente de pago" : "",
      fecha_limite: FirebaseTimestamp.fromDate(new Date(`2025-${mesStr}-16`)),
      fecha_pago_realizado: esDiciembre ? null : FirebaseTimestamp.fromDate(new Date(`2025-${mesStr}-15`))
    });
  });


  const meses = [6, 7, 8, 9, 10, 11, 12];
  meses.forEach(mes => {
    const mesStr = mes < 10 ? `0${mes}` : `${mes}`;
    const pagoId = `CH1_2025_${mesStr}`;
    batch.set(doc(db, "pagos", pagoId), {
      id_unidad: "CH-1",
      id_inquilino: inqId,
      periodo: `2025-${mesStr}`,
      mes: mes,
      anio: 2025,
      monto_renta: 6800,
      monto_pagado: 6800,
      servicios: { luz_lectura: 0, agua_lectura: 0, excedente_total: 0 },
      estatus: "pagado",
      medio_pago: "transferencia",
      notas: "Carga inicial historial",
      fecha_limite: FirebaseTimestamp.fromDate(new Date(`2025-${mesStr}-05`)),
      fecha_pago_realizado: FirebaseTimestamp.fromDate(new Date(`2025-${mesStr}-07`))
    });
  });

  try {
    await batch.commit();
    console.log("✅ ¡Todo listo! Base de datos sincronizada desde config centralizado.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en el batch:", error);
    process.exit(1);
  }
};

seedDatabase();