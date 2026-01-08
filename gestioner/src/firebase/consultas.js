import { db } from './config'; 
import { collection, getDocs, query, where } from 'firebase/firestore';

export const getDatosDashboard = async (periodoActual) => {
  try {
const inquilinosQuery = query(collection(db, "inquilinos"), where("activo", "==", true));
    // 1. Traer datos de Firebase
  const [uSnap, iSnap, pSnap] = await Promise.all([
      getDocs(collection(db, "unidades")),
      getDocs(inquilinosQuery), // <--- USAR la query filtrada aquí
      getDocs(query(collection(db, "pagos"), where("periodo", "==", periodoActual)))
    ]);
const inqsMap = {};
    iSnap.forEach(doc => {
      inqsMap[doc.id] = doc.data();
    });

    // 3. Crear lista de IDs de unidades pagadas
    const unidadesPagadas = pSnap.docs.map(doc => doc.data().id_unidad);

    // 4. Procesar Unidades
 const unidadesFinales = uSnap.docs.map(doc => {
  const uData = doc.data();
  const uId = doc.id;
      const infoInq = uData.id_inquilino ? inqsMap[uData.id_inquilino] : null;
      const elInquilinoExiste = !!infoInq;
const formatearFecha = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return "N/A";
    return timestamp.toDate().toLocaleDateString('es-MX', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

     return {
    id: uId,
    id_propiedad: uData.id_propiedad,
    id_inquilino: uData.id_inquilino || null,
    estado: elInquilinoExiste ? uData.estado : "Disponible",
    nombre_inquilino: elInquilinoExiste ? infoInq.nombre_completo : "Unidad Libre",
    renta_mensual: elInquilinoExiste ? (infoInq.renta_actual || uData.renta_mensual) : uData.renta_mensual,
    telefono_emergencia: infoInq?.telefono_emergencia || "",
    telefono_contacto: infoInq?.telefono_contacto || "",
    deposito_garantia: infoInq?.deposito_garantia || 0,
    dia_pago: infoInq?.dia_pago || 5,
    fecha_inicio: formatearFecha(infoInq?.fecha_inicio_contrato),
    fecha_fin: formatearFecha(infoInq?.fecha_fin_contrato),
    docs: infoInq?.docs || { ine: "no", contrato: "no", carta: "no" },
    
    pagado: unidadesPagadas.includes(uId)
  };
});

    // 5. Cálculos para los StatCards
    const ocupadas = unidadesFinales.filter(u => u.estado === "Ocupado");
    const esperado = ocupadas.reduce((acc, u) => acc + (u.renta_mensual || 0), 0);
    const pagado = ocupadas.filter(u => u.pagado).reduce((acc, u) => acc + (u.renta_mensual || 0), 0);

    return {
      stats: {
        esperado: esperado,
        pagado: pagado,
        adeudo: esperado - pagado
      },
      listaAdeudos: ocupadas.filter(u => !u.pagado).map(u => ({
        id: u.id,
        nombre: u.nombre_inquilino,
        monto: u.renta_mensual,
        propiedad: u.id_propiedad,
        dia_pago: u.dia_pago
      })),
      unidades: unidadesFinales
    };

  } catch (error) {
    console.error("Error al obtener datos:", error);
    return { stats: { esperado: 0, pagado: 0, adeudo: 0 }, listaAdeudos: [], unidades: [] };
  }
};