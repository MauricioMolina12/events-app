import { readFileSync, writeFileSync } from 'node:fs';

const path = new URL('../src/app/core/i18n/messages.ts', import.meta.url);
let text = readFileSync(path, 'utf8');

const replacements = [
  ['las sedes', 'las sucursales'],
  ['Las sedes', 'Las sucursales'],
  ['una sede', 'una sucursal'],
  ['Una sede', 'Una sucursal'],
  ['la sede', 'la sucursal'],
  ['La sede', 'La sucursal'],
  ['esta sede', 'esta sucursal'],
  ['Esta sede', 'Esta sucursal'],
  ['por sede', 'por sucursal'],
  ['Por sede', 'Por sucursal'],
  ['de sede', 'de sucursal'],
  ['de sedes', 'de sucursales'],
  ['entre sedes', 'entre sucursales'],
  ['Sedes y cupos', 'Sucursales y cupos'],
  ['Sede seleccionada', 'Sucursal seleccionada'],
  ['sedes publicadas', 'sucursales publicadas'],
  ['sedes disponibles', 'sucursales disponibles'],
  ['sedes activas', 'sucursales activas'],
  ['sedes no pueden', 'sucursales no pueden'],
  ['sedes supera', 'sucursales supera'],
  ['sede(s)', 'sucursal(es)'],
  ['sede elegida', 'sucursal elegida'],
  ['elige tu sede', 'elige tu sucursal'],
  ['elige la sede', 'elige tu sucursal'],
  ['Elige una sede', 'Elige una sucursal'],
  ['Elegir otra sede', 'Elegir otra sucursal'],
  ['Nueva sede', 'Nueva sucursal'],
  ['Crear sede', 'Crear sucursal'],
  ['Editar sede', 'Editar sucursal'],
  ['Buscar sedes', 'Buscar sucursales'],
  ['Buscar sede', 'Buscar sucursal'],
  ['Filtros de sedes', 'Filtros de sucursales'],
  ['No hay sedes', 'No hay sucursales'],
  ['Crea una sede', 'Crea una sucursal'],
  ['Añadir sede', 'Añadir sucursal'],
  ['Selecciona una sede', 'Selecciona una sucursal'],
  ['sede nueva', 'sucursal nueva'],
  ['sede existente', 'sucursal existente'],
  ['sede hereda', 'sucursal hereda'],
  ['cancelar la sede', 'cancelar la sucursal'],
  ['código de sede', 'código de sucursal'],
  ['Cupos por sede', 'Cupos por sucursal'],
  ['ocupación y cupos libres de cada sede', 'ocupación y cupos libres de cada sucursal'],
  ['Personas en las sedes', 'Personas en las sucursales'],
  ['capacidad de esa sede', 'capacidad de esa sucursal'],
  ['Detalle de la sede', 'Detalle de la sucursal'],
  ['Personas en la sede', 'Personas en la sucursal'],
  ['Ninguna sede', 'Ninguna sucursal'],
  ['aún no tiene sedes', 'aún no tiene sucursales'],
  ['Toca una sede', 'Toca una sucursal'],
  ['sin sumar sedes', 'sin sumar sucursales'],
  ["'Sedes'", "'Sucursales'"],
  ["'Sede'", "'Sucursal'"],
  ['Sede:', 'Sucursal:'],
];

for (const [from, to] of replacements) {
  text = text.split(from).join(to);
}

writeFileSync(path, text);
console.log('renamed sede copy');
