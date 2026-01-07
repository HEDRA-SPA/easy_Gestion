/*

// PROPIEDADES
{
  "chilpancingo": {
    "nombre": "Chilpancingo"´
    "limite_agua": 250,
    "limite_luz": 250,
    "total_unidades": 9
  },
  "emperadores": {
    "nombre": "Emperadores",
    "limite_agua": 250,
    "limite_luz": 250,
    "total_unidades": 8
  },
  "otay": {
    "nombre": "Casa Otay",
    "limite_agua": 0,
    "limite_luz": 0,
    "total_unidades": 1
  }
}

// UNIDADES
{
  "CH-01": {
    "no_depto": "1",
    "id_propiedad": "chilpancingo",
    "id_inquilino": "inq_001",
    "no_personas": 2,
    "nombre_inquilino": "Roderick Cutberto Duarte",
    "estado": "Ocupado",
    "renta_mensual": 6800
  }
}

// INQUILINOS
{
  "inq_001": {
    "nombre_completo": "Roderick Cutberto Duarte",
    "telefono_emergencia": "6682580209",
    "deposito_garantia": 6800,
    "dia_pago": 5,
    "fecha_inicio_contrato": "2025-05-05T10:00:00Z",
    "fecha_fin_contrato": "2026-05-05T10:00:00Z",
    "acompanantes": [
      {
        "nombre": "Maria Isabel Muñoz",
        "no_emergencia": 6641755930
      },
    ],
    "docs": {
      "ine": "https://storage...",
      "contrato": "https://storage...",
      "carta": ""
    }
  }
}

// PAGOS 

{
  "CH01_2025_06": {
    "id_unidad": "CH-01",
    "id_inquilino": "inq_001",
    "periodo": "2025-06",
    "mes": 6,
    "anio": 2025,
    "monto_renta": 6800,
    "monto_pagado": 6800,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-06-05T23:59:59Z",
    "fecha_pago_realizado": "2026-06-06T15:30:00Z"
  }
}
{
  "CH01_2025_07": {
    "id_unidad": "CH-01",
    "id_inquilino": "inq_001",
    "periodo": "2025-07",
    "mes": 7,
    "anio": 2025,
    "monto_renta": 6800,
    "monto_pagado": 6800,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-07-05T23:59:59Z",
    "fecha_pago_realizado": "2026-07-07T15:30:00Z"
  }
}
{
  "CH01_2025_08": {
    "id_unidad": "CH-01",
    "id_inquilino": "inq_001",
    "periodo": "2025-08",
    "mes": 8,
    "anio": 2025,
    "monto_renta": 6800,
    "monto_pagado": 6800,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-08-05T23:59:59Z",
    "fecha_pago_realizado": "2026-08-08T15:30:00Z"
  }
}
{
  "CH01_2025_09": {
    "id_unidad": "CH-01",
    "id_inquilino": "inq_001",
    "periodo": "2025-09",
    "mes": 9,
    "anio": 2025,
    "monto_renta": 6800,
    "monto_pagado": 6800,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-09-05T23:59:59Z",
    "fecha_pago_realizado": "2026-09-08T15:30:00Z"
  }
}
{
  "CH01_2025_10": {
    "id_unidad": "CH-01",
    "id_inquilino": "inq_001",
    "periodo": "2025-10",
    "mes": 10,
    "anio": 2025,
    "monto_renta": 6800,
    "monto_pagado": 6800,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-10-05T23:59:59Z",
    "fecha_pago_realizado": "2026-10-08T15:30:00Z"
  }
}
{
  "CH01_2025_11": {
    "id_unidad": "CH-01",
    "id_inquilino": "inq_001",
    "periodo": "2025-11",
    "mes": 11,
    "anio": 2025,
    "monto_renta": 6800,
    "monto_pagado": 6800,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-11-05T23:59:59Z",
    "fecha_pago_realizado": "2026-11-07T15:30:00Z"
  }
}
{
  "CH01_2025_12": {
    "id_unidad": "CH-01",
    "id_inquilino": "inq_001",
    "periodo": "2025-12",
    "mes": 12,
    "anio": 2025,
    "monto_renta": 6800,
    "monto_pagado": 6800,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-12-05T23:59:59Z",
    "fecha_pago_realizado": "2026-12-07T15:30:00Z"
  }
}

// PROPIEDADES
{
  "chilpancingo": {
    "nombre": "Chilpancingo"´
    "limite_agua": 250,
    "limite_luz": 250,
    "total_unidades": 9
  },
  "emperadores": {
    "nombre": "Emperadores",
    "limite_agua": 250,
    "limite_luz": 250,
    "total_unidades": 8
  },
  "otay": {
    "nombre": "Casa Otay",
    "limite_agua": 0,
    "limite_luz": 0,
    "total_unidades": 1
  }
}

// UNIDADES
{
  "EM-02": {
    "no_depto": "2",
    "id_propiedad": "emperadores",
    "id_inquilino": "inq_006",
    "no_personas": 1,
    "nombre_inquilino": "Rosa Anahí Marquez Murillo",
    "estado": "Ocupado",
    "renta_mensual": 5700
  }
}

// INQUILINOS
{
  "inq_006": {
    "nombre_completo": "Rosa Anahí Marquez Murillo",
    "telefono_contacto": 6632015470,
    "telefono_emergencia": "",
    "deposito_garantia": 3000,
    "dia_pago": 16,
    "fecha_inicio_contrato": "2025-01-16T10:00:00Z",
    "fecha_fin_contrato": "2026-12-16T10:00:00Z",
    "acompanantes": [
      {
        "nombre": "",
        "no_emergencia": null
      },
    ],
    "docs": {
      "ine": "si",
      "contrato": "",
      "carta": "si"
    }
  }
}

// PAGOS 

{
  "EM02_2025_06": {
    "id_unidad": "EM-02",
    "id_inquilino": "inq_006",
    "periodo": "2025-06",
    "mes": 6,
    "anio": 2025,
    "monto_renta": 5700,
    "monto_pagado": 5700,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-06-16T23:59:59Z",
    "fecha_pago_realizado": "2026-06-12T15:30:00Z"
  }
}
{
  "EM02_2025_07": {
    "id_unidad": "EM-02",
    "id_inquilino": "inq_006",
    "periodo": "2025-07",
    "mes": 7,
    "anio": 2025,
    "monto_renta": 5700,
    "monto_pagado": 5700,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-07-16T23:59:59Z",
    "fecha_pago_realizado": "2026-07-15T15:30:00Z"
  }
}
{
  "EM02_2025_08": {
    "id_unidad": "EM-02",
    "id_inquilino": "inq_006",
    "periodo": "2025-08",
    "mes": 8,
    "anio": 2025,
    "monto_renta": 5700,
    "monto_pagado": 5700,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-08-16T23:59:59Z",
    "fecha_pago_realizado": "2026-09-15T15:30:00Z"
  }
}
{
  "EM02_2025_09": {
    "id_unidad": "EM-02",
    "id_inquilino": "inq_006",
    "periodo": "2025-09",
    "mes": 9,
    "anio": 2025,
    "monto_renta": 5700,
    "monto_pagado": 5700,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-09-16T23:59:59Z",
    "fecha_pago_realizado": "2026-08-15T15:30:00Z"
  }
}
{
  "EM02_2025_10": {
    "id_unidad": "EM-02",
    "id_inquilino": "inq_006",
    "periodo": "2025-10",
    "mes": 10,
    "anio": 2025,
    "monto_renta": 6800,
    "monto_pagado": 6800,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-10-16T23:59:59Z",
    "fecha_pago_realizado": "2026-10-15T15:30:00Z"
  }
}
{
  "EM02_2025_11": {
    "id_unidad": "EN-02",
    "id_inquilino": "inq_006",
    "periodo": "2025-11",
    "mes": 11,
    "anio": 2025,
    "monto_renta": 5700,
    "monto_pagado": 5000,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-11-16T23:59:59Z",
    "fecha_pago_realizado": "2026-11-16T15:30:00Z"
  }
}
{
  "EM02_2025_12": {
    "id_unidad": "EM-02",
    "id_inquilino": "inq_006",
    "periodo": "2025-12",
    "mes": 12,
    "anio": 2025,
    "monto_renta": 5700,
    "monto_pagado": 0,
    "servicios": {
      "luz_lectura": 0,
      "agua_lectura": 0,
      "excedente_total": 0
    },
    "estatus": "pagado",
    "medio_pago": "transferencia",
    "notas": "",
    "fecha_limite": "2026-12-16T23:59:59Z",
    "fecha_pago_realizado": null
  }
}*/