# Calculadora online

Versión independiente de las 16 calculadoras existentes de Cuadra, sin cuentas, diario, presupuesto personal ni backend.

Incluye porcentajes y descuentos, margen, punto de equilibrio, flujo de caja, IVA, débito y crédito fiscal, honorarios, depreciación, interés simple y compuesto, ahorro con aportes, préstamos, rentabilidad, VAN, TIR y conversión UF/UTM/dólar.

## Uso

Con Node.js, ejecuta `npm start` y abre http://127.0.0.1:8766. No requiere instalar dependencias para ejecutar la página. También puede alojarse como página estática con `index.html` y `calculator-core.js`.

Los cálculos se realizan en el navegador. Incluye copia de resultados, impresión y descarga CSV para las tablas. Los indicadores se consultan en Mindicador; también se pueden ingresar manualmente. Las tasas y advertencias tributarias se conservaron del proyecto original y deben revisarse para el período de uso.

## Verificación

`npm test` ejecuta las pruebas de fórmulas. `npm run test:browser` requiere Playwright y Chrome para verificar la interfaz.
