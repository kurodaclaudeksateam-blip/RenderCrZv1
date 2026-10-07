# RenderCrZ · Planos 3D

Aplicación web para dibujar planos de planta **irregulares**, amueblarlos, definir **varios niveles** y recorrerlos en **3D** (vista de volumen y recorrido virtual en primera persona). Todo se guarda en el navegador (`localStorage`), sin servidor.

## Funciones

- **Intro animada** de 5 s: tubos de colores que trazan un plano y lo levantan en 3D, con botón **Iniciar**.
- **Proyectos con nombre** guardados en `localStorage`: crear, abrir, duplicar, eliminar, exportar/importar JSON. Autoguardado opcional.
- **Editor 2D**
  - Ambientes irregulares por vértices (clic a clic) o rectangulares (arrastrar).
  - Editar vértices arrastrando, agregar vértices con doble clic en una arista y borrar con Alt+clic.
  - Ajuste a cuadrícula y a vértices existentes, ángulos de 45° con Shift, cotas en metros y áreas.
  - Puertas y ventanas sobre los muros (también cortan muros compartidos entre ambientes).
  - Catálogo de muebles (sala, dormitorio, comedor, cocina, baño, oficina…) que se agregan con clic o se arrastran al plano; se mueven, giran, duplican y se editan medidas, color y elevación.
  - Niveles: indica cuántos tendrá el proyecto, la altura de cada uno, y copia el contorno de un nivel a otro. El nivel inferior se muestra como guía.
  - Deshacer y rehacer, atajos de teclado y diseño adaptable a móvil.
- **Vista 3D** (Three.js / React Three Fiber)
  - **Vista volumen**: órbita, filtro de niveles visibles, modo rayos X, sombras y captura PNG.
  - **Recorrido virtual**: primera persona con WASD/flechas y mouse (pointer lock), con colisión contra muros, cambio de nivel y controles táctiles.
  - Pisos con texturas procedurales (madera, cerámica, alfombra, concreto, mármol) y muebles 3D paramétricos.

## Desarrollo

```bash
npm install
npm run dev
```

## Despliegue en Vercel

El proyecto es un sitio estático con Vite. En Vercel, importa el repositorio: se detecta como **Vite** (`npm run build` y salida en `dist`). `vercel.json` ya incluye esta configuración.

## Atajos del editor

| Tecla | Acción |
| --- | --- |
| V / P / B | Seleccionar / ambiente irregular / rectángulo |
| D / W / H | Puerta / ventana / desplazar |
| R, Q, E | Girar mueble 90°, −15°, +15° |
| Flechas | Mover la selección |
| Supr | Eliminar |
| Ctrl+Z / Ctrl+Y | Deshacer / rehacer |
| Ctrl+D | Duplicar |
| F | Encuadrar el plano |
| Espacio + arrastrar / rueda | Desplazar / zoom |
