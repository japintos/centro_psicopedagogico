const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function partes(iso) {
  if (!iso) return null;
  const [anio, mes, dia] = String(iso).slice(0, 10).split('-').map(Number);
  if (!anio || !mes || !dia) return null;
  return { anio, mes, dia };
}

export function hoyISO() {
  const ahora = new Date();
  const mes = String(ahora.getMonth() + 1).padStart(2, '0');
  const dia = String(ahora.getDate()).padStart(2, '0');
  return `${ahora.getFullYear()}-${mes}-${dia}`;
}

export function fechaCorta(iso) {
  const p = partes(iso);
  if (!p) return '—';
  if (String(iso).slice(0, 10) === hoyISO()) return 'Hoy';
  return `${p.dia} ${MESES[p.mes - 1]}`;
}

export function fechaConAnio(iso) {
  const p = partes(iso);
  if (!p) return '—';
  if (String(iso).slice(0, 10) === hoyISO()) return 'Hoy';
  return `${p.dia} ${MESES[p.mes - 1]} ${p.anio}`;
}

export function sumarDias(iso, cantidad) {
  const p = partes(iso);
  if (!p) return iso;
  const date = new Date(p.anio, p.mes - 1, p.dia);
  date.setDate(date.getDate() + cantidad);
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mes}-${dia}`;
}

export function lunesDe(iso) {
  const p = partes(iso);
  if (!p) return iso;
  const dia = new Date(p.anio, p.mes - 1, p.dia).getDay();
  const delta = dia === 0 ? -6 : 1 - dia;
  return sumarDias(iso, delta);
}

export function etiquetaSemana(lunesIso) {
  const viernes = sumarDias(lunesIso, 4);
  const a = partes(lunesIso);
  const b = partes(viernes);
  if (!a || !b) return '';
  if (a.mes === b.mes && a.anio === b.anio) return `${a.dia}–${b.dia} ${MESES[a.mes - 1]} ${a.anio}`;
  if (a.anio === b.anio) return `${a.dia} ${MESES[a.mes - 1]} – ${b.dia} ${MESES[b.mes - 1]} ${a.anio}`;
  return `${a.dia} ${MESES[a.mes - 1]} ${a.anio} – ${b.dia} ${MESES[b.mes - 1]} ${b.anio}`;
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export function nombreDiaCorto(iso) {
  const p = partes(iso);
  if (!p) return '';
  return DIAS_CORTOS[new Date(p.anio, p.mes - 1, p.dia).getDay()];
}

export function fechaLarga(fecha = new Date()) {
  const texto = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  }).format(fecha);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export function saludo(fecha = new Date()) {
  const hora = fecha.getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}
