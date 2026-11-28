import test from "node:test";
import assert from "node:assert/strict";
import { isValidData } from "../functions/_lib/data.js";

const sample = {
  operations: [{
    fecha: "2026-11-28",
    activo: "XAU/USD",
    dir: "Compra",
    entrada: "4100.00",
    salida: "4110.00",
    resultado: 10
  }],
  positions: [{
    fecha: "2026-11-28",
    activo: "XAU/USD",
    dir: "Venta",
    entrada: "4100.00",
    stop: "4120.00",
    objetivo: "4050.00",
    nota: "Prueba"
  }],
  diary: { "2026-11-28": "Registro de prueba" }
};

test("acepta registros válidos", () => {
  assert.equal(isValidData(sample), true);
});

test("rechaza fechas imposibles", () => {
  assert.equal(isValidData({ ...sample, diary: { "2026-02-30": "No válida" } }), false);
});

test("rechaza resultados no numéricos", () => {
  const data = structuredClone(sample);
  data.operations[0].resultado = "10";
  assert.equal(isValidData(data), false);
});

test("rechaza campos excesivamente grandes", () => {
  const data = structuredClone(sample);
  data.positions[0].nota = "x".repeat(5001);
  assert.equal(isValidData(data), false);
});
