# RenderCrZ · Planos 3D

Aplicación web para diseñar **almacenes y centros logísticos**: dibuja naves de planta **irregular**, ubica racks, anaqueles, equipos, letreros y zonas, define **varios niveles** y recórrelos en **3D** (vista de volumen y recorrido virtual en primera persona). Todo se guarda en el navegador (`localStorage`), sin servidor.

## Funciones

- **Intro animada** de 5 s: tubos de colores que trazan un plano y lo levantan en 3D, con botón **Iniciar**.
- **Proyectos con nombre** guardados en `localStorage`: crear, abrir, duplicar, eliminar, exportar/importar JSON. Autoguardado opcional.
- **Editor 2D**
  - Ambientes irregulares por vértices (clic a clic) o rectangulares (arrastrar).
  - Editar vértices arrastrando, agregar vértices con doble clic en una arista y borrar con Alt+clic.
  - Ajuste a cuadrícula y a vértices existentes, ángulos de 45° con Shift, cotas en metros y áreas.
  - Puertas, **portones de andén** y ventanas sobre los muros (también cortan muros compartidos entre ambientes).
  - Catálogo logístico que se agrega con clic o arrastrando al plano:
    - **Almacenaje**: rack selectivo, rack doble fondo, rack bajo, anaqueles metálicos y de picking, cantilever, contenedores.
    - **Carga**: pallets vacíos, pallets con carga, cajas, bultos.
    - **Equipos**: montacargas, transpaleta, banda transportadora, mesa de embalaje, báscula.
    - **Señalización**: letreros colgantes y de pie con texto editable (pasillos, andenes, salidas).
    - **Zonas** de piso rotuladas: recepción, despacho, picking, cuarentena, devoluciones, pasillo peatonal.
    - **Seguridad**: extintores, conos, bolardos, malla divisoria, columnas.
    - También oficina, servicios y mobiliario residencial.
  - Cada objeto se mueve, gira, duplica y edita (medidas, color, elevación, texto y niveles de carga).
  - Indicadores por nivel: posiciones de pallet, m² en zonas y número de estructuras.
  - Niveles: indica cuántos tendrá el proyecto, la altura de cada uno, y copia el contorno de un nivel a otro. El nivel inferior se muestra como guía.
  - Deshacer y rehacer, atajos de teclado y diseño adaptable a móvil.
- **Vista 3D** (Three.js / React Three Fiber)
  - **Vista volumen**: órbita, filtro de niveles visibles, modo rayos X, sombras y captura PNG.
  - **Recorrido virtual**: primera persona con WASD/flechas y mouse (pointer lock), con colisión contra muros, racks y equipos, cambio de nivel y controles táctiles.
  - Racks con largueros y pallets cargados, letreros con texto, zonas pintadas en el piso, montacargas y equipos 3D paramétricos.
  - Pisos con texturas procedurales (epóxico industrial, concreto, cerámica, madera, alfombra, mármol).
- **Ejemplo incluido**: centro de distribución con nave irregular, 4 andenes, racks, picking, cuarentena, oficinas y mezzanine.

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
| D / G / W / H | Puerta / portón de andén / ventana / desplazar |
| R, Q, E | Girar mueble 90°, −15°, +15° |
| Flechas | Mover la selección |
| Supr | Eliminar |
| Ctrl+Z / Ctrl+Y | Deshacer / rehacer |
| Ctrl+D | Duplicar |
| F | Encuadrar el plano |
| Espacio + arrastrar / rueda | Desplazar / zoom |
