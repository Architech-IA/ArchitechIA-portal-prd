// Genera src/inventario.ts para el fixture zz-eval-motor: un archivo LARGO (~15 KB, más que lo que read_file muestra de una vez)
// con 40 funciones auxiliares deterministas y, en el medio, la función cuyo comportamiento debe cambiar el eval.
const fs = require('fs')
const partes = []
partes.push(`// Utilidades de inventario del proyecto de evaluación.
// Este archivo es largo A PROPÓSITO: se usa para comprobar que un agente puede modificar UNA función del medio
// sin reescribir (ni romper) el resto. Cada función calcNN(x) devuelve x * (NN + 1) + NN.

export interface Producto {
  sku: string
  nombre: string
  precio: number
  stock: number
}

export function normalizarSku(sku: string): string {
  return sku.trim().toUpperCase()
}
`)
function calc(i) {
  const nn = String(i).padStart(2, '0')
  return `
/**
 * Cálculo auxiliar número ${nn} del inventario.
 * Se usa en los reportes internos para ponderar existencias; el factor depende del número de la función
 * y no debe cambiarse: otros módulos dependen del resultado exacto (x * ${i + 1} + ${i}).
 * Ejemplo: calc${nn}(7) = ${7 * (i + 1) + i}.
 */
export function calc${nn}(x: number): number {
  // Primero se multiplica por el factor propio de esta función y luego se suma el desplazamiento.
  const factor = ${i + 1}
  const desplazamiento = ${i}
  return x * factor + desplazamiento
}
`
}
for (let i = 0; i < 20; i++) partes.push(calc(i))
partes.push(`
/**
 * Total de una compra con descuento por volumen.
 * Regla vigente: a partir de 100 unidades se aplica 10 % de descuento sobre el total bruto; con menos
 * unidades se cobra el total bruto sin descuento.
 */
export function totalConDescuento(cantidad: number, precioUnitario: number): number {
  const bruto = cantidad * precioUnitario
  if (cantidad >= 100) {
    return bruto * 0.9
  }
  return bruto
}
`)
for (let i = 20; i < 40; i++) partes.push(calc(i))
partes.push(`
export function valorDeInventario(productos: Producto[]): number {
  return productos.reduce((acc, p) => acc + p.precio * p.stock, 0)
}
`)
const texto = partes.join('')
fs.writeFileSync(process.argv[2] || 'inventario.ts', texto)
console.log('bytes:', Buffer.byteLength(texto), '| líneas:', texto.split('\n').length)
