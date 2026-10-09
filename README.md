# RenderCrZ · Planos 3D

Aplicación web para diseñar **almacenes y centros logísticos**: dibuja naves de planta **irregular**, ubica racks, anaqueles, equipos, letreros y zonas, define **varios niveles** y recórrelos en **3D** (vista de volumen y recorrido virtual en primera persona). Los proyectos se guardan en Supabase (con copia local en el navegador) y cada uno tiene una liga pública para compartirlo.

## Funciones

- **Intro animada** de 5 s: tubos de colores trazan un plano **aleatorio** (distinto en cada carga) y lo levantan en 3D, con botón **Iniciar**.
- **Login** con animación de 4 s en la que se construye un almacén aleatorio (losa, columnas, muros con andenes, racks, pallets y cerchas). Solo pide una contraseña, que se verifica en Supabase.
- **Proyectos con nombre** guardados en la nube (Supabase) y en `localStorage` como copia inmediata: crear, abrir, duplicar, eliminar, exportar/importar JSON. Autoguardado opcional. Al entrar se sincroniza el navegador con la nube.
- **Compartir**: el botón 🔗 guarda el proyecto y entrega una liga `/v/<clave>` que se abre **sin contraseña**. Quien la abre ve cómo el proyecto se arma desde cero en 10 s (piso, muros, racks y equipos, nivel por nivel) y después solo puede elegir **Vista 3D** o **Recorrer**; no puede editar.
- **Editor 2D**
  - Panel izquierdo con las herramientas siempre a la vista y el resto en secciones plegables (niveles, tipos de pared, puertas y marcos, cercos y barandales, anuncios, objetos); cada cosa aparece en una sola sección.
  - Ambientes irregulares por vértices (clic a clic) o rectangulares (arrastrar).
  - Editar vértices arrastrando, agregar vértices con doble clic en una arista y borrar con Alt+clic.
  - Ajuste a cuadrícula y a vértices existentes, ángulos de 45° con Shift, cotas en metros y áreas.
  - Puertas, **portones de andén** y ventanas sobre los muros (también cortan muros compartidos entre ambientes). Las puertas pueden ser de **madera, vidrio, metal o malla** y al colocarlas se adaptan al muro o cerco: toman el tipo que corresponde, el marco se ajusta al grosor y en un cerco quedan como portón con postes.
  - Sección **Puertas y marcos** en el panel: puertas de madera, vidrio, metal y malla, puerta doble, portón de andén, marco abierto, arco y ventana. Se elige una y se toca la pared (o se coloca sola en el ambiente seleccionado).
  - **Paredes a medida**: cada ambiente tiene su altura y grosor de pared, y cada tramo (lado) puede llevar otro material, otra altura o quedar sin pared. El botón *Agregar esquina* convierte un ambiente rectangular en irregular.
  - Sección **Cercos y barandales**: barandal a medida (amarillo, rojo, azul o gris, con travesaños y rodapié), barrera de protección, cercos de barrotes y de malla.
  - **Mueble con tapa a medida** (tapa abierta o cerrada).
  - **Asas de medida**: al seleccionar un objeto aparecen cuatro asas para estirar su largo y su fondo con el mouse.
  - **Los objetos no se atraviesan** al moverlos (se desactiva en la configuración o manteniendo Alt).
  - **Imagen de piso**: cada ambiente puede llevar una imagen como textura, ajustada al ambiente o en mosaico.
  - **Rack vertical para tuberías**: los tubos van de pie en compartimentos, con base encajonada y tope superior con barandal.
  - **Rack para tuberías**: rack alargado de brazos; en cada nivel se elige la tubería (metal, cobre, PVC o ABS) y su diámetro (de ½″ a 8″).
  - **Resumen** (📊): ambientes con área y perímetro, objetos por tipo, posiciones de pallet y zonas; se descarga para Excel (CSV) o se imprime/guarda en PDF junto con el plano.
  - Sección **Tipos de pared** en el panel: elige el material y se aplica al ambiente seleccionado y a los que dibujes después.
  - **Materiales de muro** por ambiente: liso pintado, ladrillo, block, concreto, lámina metálica, madera, vidrio, cerco de malla metálica y cerco de barrotes (con altura propia).
  - Catálogo logístico que se agrega con clic o arrastrando al plano:
    - **Almacenaje**: rack selectivo, rack doble fondo, rack bajo, anaqueles metálicos y de picking, cantilever, contenedores. Racks y anaqueles pueden ir **con cajas o sin cajas**.
    - **Rack a medida** y **tarima a medida**: defines medidas, niveles y posiciones, y colocas cada caja donde quieras con el color que quieras.
    - **Carga**: pallets vacíos, pallets con carga, cajas, bultos.
    - **Equipos**: rampa de descarga curva, escalera metálica, montacargas, transpaleta, banda transportadora, mesa de embalaje, báscula.
    - **Señalización**: letreros colgantes y de pie con texto editable (pasillos, andenes, salidas).
    - **Anuncios**: torres de anuncio, rótulos en poste (tubo largo con el rótulo rectangular arriba) y cuadros con luz LED (rectangulares o cuadrados). Se les puede **subir una imagen** que rellena el letrero por ambas caras; sin imagen muestran su texto.
    - **Zonas** de piso rotuladas: recepción, despacho, picking, cuarentena, devoluciones, pasillo peatonal.
    - **Seguridad**: extintores, conos, bolardos, cerco metálico blanco, cerco de malla metálica, malla divisoria, columnas.
    - También oficina, servicios y mobiliario residencial.
  - Cada objeto se mueve, gira, duplica y edita (medidas, color, elevación, texto y niveles de carga).
  - Indicadores por nivel: posiciones de pallet, m² en zonas y número de estructuras.
  - Niveles: indica cuántos tendrá el proyecto, la altura de cada uno, y **copia un nivel a otro** (a uno nuevo o sobre planta baja, nivel 1, etc.), completo o solo el contorno. El nivel inferior se muestra como guía.
  - Deshacer y rehacer, atajos de teclado y diseño adaptable a móvil.
- **Nombres y rótulos**: cada objeto puede mostrar un rótulo con su nombre (plano, 3D y recorrido). El botón 🏷 *Nombres* abre una tabla con los racks (o todos los objetos) para nombrarlos, numerarlos y encender sus rótulos sin cambiar su orden.
- **Vista 3D** (Three.js / React Three Fiber)
  - **Techo**: casilla para ver la cubierta de los ambientes que no tienen otro nivel encima.
  - En el **recorrido** se sube y baja caminando por escaleras y rampas; al llegar arriba se pasa al nivel superior.
  - **Editar en 3D**: con el botón ✏️ se toca una puerta, pared, cerco u objeto y se cambia ahí mismo su tipo, medidas, color o nombre. Al tocar una pared o cerco se le puede **agregar** una puerta, marco, arco o ventana en ese punto, y cada puerta se puede **deslizar** por su pared o **mover** a otra: el hueco anterior se rellena solo. También se cambian ahí la altura y el grosor de las paredes, el material de un solo tramo y las medidas, el giro y la posición de cualquier objeto (se mueve tocando el lugar nuevo).
  - **Vista volumen**: órbita, filtro de niveles visibles, modo rayos X, sombras y captura PNG.
  - **Recorrido virtual**: primera persona con WASD/flechas y mouse (pointer lock), con colisión contra muros, racks y equipos, cambio de nivel y controles táctiles.
  - Racks con largueros y pallets cargados, letreros con texto, zonas pintadas en el piso, montacargas y equipos 3D paramétricos.
  - Pisos con texturas procedurales (epóxico industrial, concreto, cerámica, madera, alfombra, mármol).
- **Ejemplo incluido**: centro de distribución con 4 secciones de distinto tipo de pared (almacenaje, picking y empaque, recepción y despacho, oficinas y servicios), patio con jaula de malla y mezzanine. Usa los 56 tipos de objeto del catálogo y las cuatro clases de puerta.

## Desarrollo

```bash
npm install
npm run dev
```

## Acceso (Supabase)

La contraseña única se guarda como hash bcrypt en la tabla `public.crz_acceso` del proyecto Supabase *gk-control-operativo-entregas*. La tabla tiene RLS activo sin políticas (no se puede leer desde la API) y la app solo llama a la función `crz_verificar_acceso(p_password)`, que devuelve verdadero o falso. La sesión dura mientras la pestaña esté abierta.

Para cambiar la contraseña, ejecuta en el SQL editor de Supabase:

```sql
update public.crz_acceso set password_hash = extensions.crypt('NUEVA_CLAVE', extensions.gen_salt('bf', 10)), actualizado_en = now() where id = 1;
```

Opcionalmente se pueden definir `VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY` (llave publicable) como variables de entorno.

## Proyectos en la nube (Supabase)

Los proyectos viven en la tabla `public.crz_proyectos` del mismo proyecto Supabase (script en `supabase/crz_proyectos.sql`). Igual que `crz_acceso`, la tabla no es legible desde la API: la app usa funciones `crz_*`. Al iniciar sesión, `crz_iniciar_sesion` devuelve un token (12 h) que autoriza listar, guardar y eliminar; `crz_proyecto_compartido(share_id)` es la única función pública y solo lee el proyecto de esa liga.

**Peso**: cada proyecto se guarda en formato compacto (`src/codec.ts`): tuplas en vez de objetos, medidas redondeadas al milímetro, sin ids internos y comprimido con deflate. El almacén de ejemplo (84 objetos, 2 niveles) pasa de 16.3 KB en JSON a **2.4 KB**; la casa de ejemplo, de 7.9 KB a 1.5 KB. Las imágenes de anuncios se reducen a 640 px y se comprimen en WebP al 70 % de calidad y se guardan una sola vez aunque varios anuncios usen la misma. El límite por proyecto es de 600 KB.

### Papelera

Eliminar un proyecto lo manda a la papelera (columna `eliminado_en`, script `supabase/crz_papelera.sql`): desaparece de la lista y su liga deja de funcionar, pero se puede restaurar durante 30 días desde *Mis proyectos → Papelera*. Pasado ese plazo se borra.

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
