# Sistema de Diseño POS Obsidian & Emerald

Este documento define la identidad visual y los principios de diseño para la aplicación Fatboy POS. El objetivo es mantener una estética premium, de alta densidad y optimizada para pantallas táctiles industriales.

## 🎨 Paleta de Colores

El sistema utiliza un tema oscuro de alto contraste con acentos "Emerald & Gold" (Esmeralda y Oro).

| Token | Hex | Uso |
| :--- | :--- | :--- |
| **Surface (Superficie)** | `#131313` | Fondo principal y capas base |
| **Surface Container** | `#201f1f` | Tarjetas, fondos de inputs, barras laterales |
| **Primary (Acento/Oro)** | `#FFD700` | Acciones de alta importancia, estados activos |
| **Secondary (Acero)**    | `#b7c8e1` | Información secundaria, bordes, elementos neutrales |
| **Error (Alerta)**       | `#ffb4ab` | Acciones destructivas, saldos negativos, cancelaciones |
| **Outline (Muted)**      | `#8b90a0` | Texto secundario, etiquetas de baja jerarquía |

## 📐 Tipografía: Public Sans & JetBrains Mono

El diseño se basa en una tipografía de interfaz más clara y abierta para mejorar la lectura rápida en tamaños reducidos y pantallas táctiles.

- **Principales variantes**
  - `font-headline font-black`: Para títulos y montos monetarios.
  - `font-label font-bold text-[8px] tracking-widest`: Para etiquetas de datos técnicos.
  - `font-body font-normal`: Para descripciones y textos largos.

### Reglas de Densidad
- **Mayúsculas (Uppercase)**: Se recomienda el uso de mayúsculas en etiquetas (`labels`) y botones para reforzar el carácter industrial.
- **Tracking (Interlineales)**: Usar `tracking-tighter` en números grandes y `tracking-widest` en etiquetas pequeñas.

## 🧱 Componentes Base

### 1. Botones (Buttons)
- **Primario**: `bg-primary text-on-primary` (Brillante, indica acción final).
- **Control**: `bg-surface-container-highest` (Para navegación o ajustes menores).
- **Haptic Feedback**: Siempre incluir `active:scale-95 transition-all` para dar sensación táctil.

### 2. Contenedores y Modales
- **Fondo de Modal**: `bg-stone-950/80 backdrop-blur-sm` (Efecto cristal translúcido).
- **Bordes**: Deben ser sutiles (`border-outline-variant/10`) para no sobrecargar visualmente la interfaz de alta densidad.

### 3. Scrollbars
- Se utilizan scrollbars personalizados ultra-finos (`width: 4px`) para no desperdiciar espacio en pantalla.

## ⚡ Animaciones (Micro-interacciones)
- Usar `motion.div` de Framer Motion para entradas suaves (`initial={{ opacity: 0, scale: 0.9 }}`).
- Las transiciones deben ser rápidas (entre 150ms y 300ms) para que la sensación sea ágil.

---
*Este sistema de diseño asegura que cualquier vista nueva se sienta integrada en el ecosistema "Obsidian & Emerald".*
