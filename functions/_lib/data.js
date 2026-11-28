const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validText(value, max) {
  return typeof value === "string" && value.length <= max;
}

function validDate(value) {
  if (!validText(value, 10) || !DATE_RE.test(value)) return false;
  const parsed = new Date(value + "T00:00:00Z");
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function isValidData(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return false;
  if (!Array.isArray(data.operations) || !Array.isArray(data.positions) ||
      !data.diary || typeof data.diary !== "object" || Array.isArray(data.diary)) return false;
  if (data.operations.length > 50000 || data.positions.length > 50000 ||
      Object.keys(data.diary).length > 50000) return false;

  const operationsValid = data.operations.every(item =>
    item && typeof item === "object" &&
    validDate(item.fecha) &&
    validText(item.activo, 100) && item.activo.trim().length > 0 &&
    ["Compra", "Venta"].includes(item.dir) &&
    (item.entrada == null || validText(item.entrada, 100)) &&
    (item.salida == null || validText(item.salida, 100)) &&
    typeof item.resultado === "number" && Number.isFinite(item.resultado) &&
    Math.abs(item.resultado) <= 1e15
  );

  const positionsValid = data.positions.every(item =>
    item && typeof item === "object" &&
    validDate(item.fecha) &&
    validText(item.activo, 100) && item.activo.trim().length > 0 &&
    ["Compra", "Venta"].includes(item.dir) &&
    ["entrada", "stop", "objetivo"].every(key => item[key] == null || validText(item[key], 100)) &&
    (item.nota == null || validText(item.nota, 5000))
  );

  const diaryValid = Object.entries(data.diary).every(([date, note]) =>
    validDate(date) && validText(note, 20000)
  );
  return operationsValid && positionsValid && diaryValid;
}
