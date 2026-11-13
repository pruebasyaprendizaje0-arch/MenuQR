export interface CustomerInvoiceInput {
  doc: string;           // Cédula (10), RUC (13), Pasaporte, o 9999999999999
  docType: "04" | "05" | "06" | "07"; // 04: RUC, 05: Cédula, 06: Pasaporte, 07: Consumidor Final
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

/**
 * Valida formato de RUC en Ecuador (13 dígitos numéricos terminados en 001).
 */
export function validateEcuadorianRuc(ruc: string): boolean {
  const clean = (ruc || "").trim();
  if (!/^\d{13}$/.test(clean)) return false;
  if (!clean.endsWith("001")) return false;
  return true;
}

/**
 * Valida la regla tributaria del SRI de Ecuador:
 * Facturas > $50.00 USD NO pueden emitirse a Consumidor Final (9999999999999).
 */
export function validateSriInvoiceRules(
  total: number,
  customer: CustomerInvoiceInput
): { valid: boolean; error?: string } {
  const isConsumidorFinal =
    customer.docType === "07" ||
    customer.doc.trim() === "9999999999999" ||
    customer.name.trim().toUpperCase() === "CONSUMIDOR FINAL";

  if (total > 50.0 && isConsumidorFinal) {
    return {
      valid: false,
      error:
        "Normativa SRI Ecuador: Las ventas superiores a $50.00 USD no pueden ser emitidas a Consumidor Final. Debe ingresar la identificación del cliente (Cédula, RUC o Pasaporte).",
    };
  }

  if (!isConsumidorFinal) {
    const cleanDoc = customer.doc.trim();
    if (customer.docType === "05" && cleanDoc.length !== 10) {
      return { valid: false, error: "La cédula ecuatoriana debe tener exactamente 10 dígitos numéricos." };
    }
    if (customer.docType === "04" && cleanDoc.length !== 13) {
      return { valid: false, error: "El RUC ecuatoriano debe tener exactamente 13 dígitos numéricos." };
    }
    if (!customer.name.trim()) {
      return { valid: false, error: "Debe ingresar el nombre o razón social del cliente." };
    }
  }

  return { valid: true };
}

/**
 * Enmascara la contraseña de la API para mostrar en el formulario de configuración
 */
export function maskDatilPassword(hasPassword: boolean): string {
  if (!hasPassword) return "";
  return "••••••••••••••••";
}
