import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("Cálculos y Liquidación de Reservas de Mesas con Abono/Anticipo", () => {
  it("1: Aplica el descuento del abono correctamente sobre una comanda con IVA y Servicio", () => {
    const subtotal = 50.0;
    const ivaRate = 15;
    const serviceRate = 10;
    const depositAmount = 20.0; // Abono previo recibido

    const iva = Math.round(subtotal * (ivaRate / 100) * 100) / 100; // $7.50
    const service = Math.round(subtotal * (serviceRate / 100) * 100) / 100; // $5.00
    const grossTotal = Math.round((subtotal + iva + service) * 100) / 100; // $62.50

    // Deducción del anticipo de la reserva
    const netTotal = Math.max(0, Math.round((grossTotal - depositAmount) * 100) / 100);

    assert.equal(grossTotal, 62.5);
    assert.equal(netTotal, 42.5);
  });

  it("2: Si el consumo es menor al abono, el total a cobrar es $0 y no genera saldo negativo", () => {
    const subtotal = 10.0;
    const ivaRate = 15;
    const serviceRate = 0;
    const depositAmount = 25.0; // Abono mayor al consumo

    const iva = Math.round(subtotal * (ivaRate / 100) * 100) / 100; // $1.50
    const grossTotal = Math.round((subtotal + iva) * 100) / 100; // $11.50
    const netTotal = Math.max(0, Math.round((grossTotal - depositAmount) * 100) / 100);

    assert.equal(grossTotal, 11.5);
    assert.equal(netTotal, 0.0);
  });

  it("3: Reserva sin abono ($0) no altera el total normal de la mesa", () => {
    const subtotal = 35.0;
    const ivaRate = 15;
    const serviceRate = 10;
    const depositAmount = 0.0;

    const iva = Math.round(subtotal * (ivaRate / 100) * 100) / 100; // $5.25
    const service = Math.round(subtotal * (serviceRate / 100) * 100) / 100; // $3.50
    const grossTotal = Math.round((subtotal + iva + service) * 100) / 100; // $43.75
    const netTotal = Math.max(0, Math.round((grossTotal - depositAmount) * 100) / 100);

    assert.equal(grossTotal, 43.75);
    assert.equal(netTotal, 43.75);
  });
});

