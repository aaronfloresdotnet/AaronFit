# Plan de la v2 (rama `v2`)

Reglas que no cambian:
- `main` = la app en el cel de Aarón (congelada como `v1.0`). No se toca mientras se desarrolla.
- Todo lo nuevo va en `v2` y se prueba en **AaronFit Beta** (`bash herramientas/publicar-beta.sh`, solo desde `v2`).
- La beta comparte dominio con la real: se separa por nombre (base `entrena-beta`, caché `beta-aaronfit-`).
- Una tanda pasa a `main` solo cuando Aarón la aprueba en la beta. Antes de pasarla: respaldo exportado.
- Si una tanda cambia el esquema: `MIGRACIONES[2]`, subir `VERSION_BD` y prueba de que un respaldo v1 importa en v2.
- Cada decisión propia va a `DECISIONES.tsv`.

## Tanda 1: hecha (en la beta, esperando aprobación)
Cronómetro de serie, deshacer, descanso mejorado (anillo, frases ES/EN y de avance, pitidos), registro de errores, atajos del ícono.

## Tanda 2: hecha (en la beta, esperando aprobación)
Hecha el 2026-09-23. Decisiones 66 a 83 de `DECISIONES.tsv`. Pruebas: 121 de 121.
Sin verificar en el cel: tocar la gráfica con el dedo, el aviso de récord durante un entrenamiento real,
abrir el TSV en Sheets. Revisado en el navegador de escritorio a tamaño de celular, con datos simulados.

No necesita cambiar el esquema: todo se calcula de lo que ya se guarda; el perfil va en `estado`
(llaves nuevas: `perfil` y `avisosAceptados`).

- **Pantalla nueva «Avance»** (cuarto botón de la barra):
  - Resumen de la semana: días hechos de 5, series, qué subió.
  - Constancia: calendario de las últimas semanas (hecho, saltado, recorrido, no hecho) y % de cumplimiento.
  - Récords por ejercicio: peso máximo y 1RM estimado (Epley: peso × (1 + reps/30)). Aviso «¡Nuevo récord!» al guardar una serie.
  - Gráfica por ejercicio (un selector): peso de trabajo por sesión y 1RM estimado, en el mismo eje. Los ejercicios sin peso grafican reps o segundos. Marcas donde se aceptó un aviso: guardar desde ya `estado.avisosAceptados` (y quitarlo al deshacer).
  - Series por grupo muscular: esta semana contra la anterior.
- **Medidas:**
  - Perfil: estatura y fórmula hombre/mujer, que elige Aarón; no se supone.
  - % de grasa estimado (Marina de EE. UU., versión en cm):
    - hombre: 495 / (1.0324 − 0.19077·log10(cintura − cuello) + 0.15456·log10(estatura)) − 450
    - mujer: 495 / (1.29579 − 0.35004·log10(cintura + cadera − cuello) + 0.22100·log10(estatura)) − 450
    - Prueba: hombre, 180 cm, cintura 90, cuello 40 da ≈18.4 %.
  - Relación cintura/estatura.
  - Gráfica de peso corporal y cintura.
  - Comparación contra la medición de hace ~4 semanas.
  - Recordatorio de fotos si pasaron 4 semanas o más.
- **Respaldo:** exportar el historial en TSV para Sheets (`aaronfit-historial-FECHA.tsv`, una fila por serie).
- **Inicio:** aviso si pasaron más de 7 días sin respaldo; resumen de la semana pasada el lunes y martes.
- **Gráficas:** SVG hecho a mano, sin librerías. Seguir la guía `dataviz`: un solo eje, paleta validada con su script, tooltip al tocar, vista de tabla y leyenda si hay 2 o más series.
- **Diseño:** lógica pura en `logica/avance.js` y `logica/cuerpo.js`; `servicios/avance.js`; `vistas/avance.js`; `componentes/grafica.js`.

## Tanda 3: hecha (en la beta, esperando aprobación)
Calculadora de discos (con tu equipo), calentamiento sugerido, aviso de estancamiento (3 semanas sin subir),
notas por ejercicio, voz del teléfono en el descanso. Hecha el 2026-09-23. Decisiones 84 a 95. Pruebas: 133 de 133.
Tu equipo (2026-09-23): barra olímpica de 20 kg; un par de discos de kg (2 pulgadas) de 2.5, 5, 10, 15 y 20 para barra
y polea; mancuernas ajustables de 1 pulgada con discos de lb (4 de 15, 6 de 10, 4 de 5), tope 50 lb. No se mezclan.
Falta: el peso del mango de las mancuernas (sin él no se calculan) y si el carro de la polea pesa algo.
Pendiente de tu respuesta: la guía de respiración en el descanso (no se hizo).
Sin verificar en el cel: la voz (sin internet depende del teléfono) y la calculadora con el dedo.

## Tanda 4: hecha (en la beta, esperando aprobación)
Hecha el 2026-09-23. Decisiones 96 a 108. Pruebas: 146 de 146. Se llega desde Respaldo › Ajustes › Cambiar de rutina.
La regla de progresión ahora vive en la hoja (columna 14 «Regla»); la semilla no cambió (2485aa8e004a).
Varias rutinas en el tiempo (campo `plan`, ids N×1000+…, `estado.planes`); respaldo versión 2 solo si hay más de una.
Sin verificar en el cel: copiar el prompt al portapapeles, y una respuesta real de Claude o Gemini
(la revisión se probó con respuestas escritas a mano).

Lo que se pidió:
1. Aarón escribe qué quiere.
2. La app arma el prompt con: objetivo, equipo, rutina actual en TSV, avance, medidas y notas.
3. El prompt fija el formato de salida: las 13 columnas de la hoja, una columna de regla con mini-sintaxis, y ligas solo de una lista o «SIN LIGA».
4. Aarón pega la respuesta y la app la valida con `parseo.js`, muestra qué cambia y la programa desde el lunes.
5. El historial se conserva por nombre de ejercicio.
6. Hay que generalizar `dias.js` para planes de 3 o 4 días.

## Siguiente (respuestas de Aarón, 2026-09-23; todo en la beta, nada a main)
Aarón compacta el contexto antes; al volver, hacer esto en `v2`, probar, publicar la beta y reportar:
1. Mango de las mancuernas: de aluminio, «no cuenta» → `EQUIPO_INICIAL.maneral = 0` en logica/equipo.js.
   Ojo: si en la beta ya se guardó `maneral: null`, que normalizarEquipo use el inicial (0) en lugar de null.
   Actualizar el texto de «Tu equipo en palabras» (mango de aluminio; la polea se carga parejo).
2. Polea: el carro «no cuenta» (0) y se carga IGUAL DE CADA LADO (si no, se desbalancea) →
   `cargar` de polea como pares por lado: armar(e.polea, 2, 2, discosKg); `pasoDe('polea')` = 2 × disco más chico = 5 kg.
   Consecuencias a reportar: con tus discos la polea sale en saltos de 5 kg; eversión de tobillo 2.5 kg ya no
   se puede parejo (mínimo 5); face pull y extensión de tríceps 12 kg → «10 o 15». Ajustar pruebas
   (equipo.test.js: casos de polea; servicios.test.js: el aviso de face pull dice «10 kg o 15 kg»).
3. Guía de respiración en el descanso: HACERLA. Diseño propuesto: en la pantalla de descanso, «Inhala… / Exhala…»
   sincronizado con el anillo que ya «respira» (animación de 10 s: 4 s crece = inhala, 6 s baja = exhala);
   respetar prefers-reduced-motion; preferencia en «Tu equipo» (encendida por omisión, decisión mía a señalar).
4. Registrar decisiones en DECISIONES.tsv (109+), actualizar este plan y la memoria, publicar beta, verificar.

## Otras ideas aprobadas, sin tanda asignada
Compartir respaldo, notificación de fin de descanso con pantalla apagada (no garantizada en Android), pruebas en Android emulado.
Guía de respiración en el descanso: propuesta y no hecha; esperando respuesta de Aarón.

## Para pasar las tandas a la app real (main)
Solo cuando Aarón las apruebe en la beta. Antes: exportar respaldo en la app real. Luego fusionar v2 en main,
etiquetar, `bash herramientas/publicar.sh` desde main, y verificar que la app real abre con sus datos.
