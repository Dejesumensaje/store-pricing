# Plan: soporte multi-tienda para store directors

**Contexto:** un store director maneja en promedio ~5 tiendas. Caso borde (no común):
tomar el cambio de precio de una tienda y poder enviarlo a varias de sus tiendas a la vez.
Implica: (1) elegir y cambiar entre tiendas, (2) decidir si un cambio aplica a la tienda
activa u otras asignadas, (3) que el flujo y los mensajes de confirmación sean claros.

**Decisiones tomadas (2026-07-01):**
- El fan-out (a qué tiendas aplica) vive **a nivel de batch**, no de ítem.
- Al replicar una reducción relativa (%/EDLP) se aplica el **precio absoluto resultante**
  calculado en la tienda activa (no se recomputa la fórmula por tienda).
- En **conflicto** (la tienda destino ya tiene un cambio pendiente en ese campo) → default
  **sobrescribir**, con opción de omitir.
- **Reprogramar** un envío multi-tienda afecta a todo el grupo.

---

## 1. Modelo de datos

### 1.1 Catálogo de tiendas — `src/lib/store-config.ts`
`Store = { id, name, address }`, `STORES: Store[]` (~5), `DEFAULT_STORE_ID`, `storeById()`.
Se retiran las constantes `STORE_NAME`/`STORE_ADDRESS`; sus consumidores
(`StorePricingHeader`, `ShelfTagPreview`) pasan a leer la **tienda activa**.

### 1.2 Aislamiento por tienda — `src/store/pricing-store.ts`
Patrón "working set + stash" (mínimo churn):
- Top-level `items/overrides/batches` = **tienda activa** (todas las acciones siguen igual).
- `stash: Record<storeId, StoreSlice>` = el resto de tiendas.
- `activeStoreId` + `setActiveStore(id)` intercambia working set ↔ stash.

Ventaja clave: el id de override es `${itemId}:${field}`, único dentro de cada slice →
**no hay colisión entre tiendas y no cambia el esquema de id**.

### 1.3 Fan-out en `Batch` (Fase 2)
`originStoreId`, `targetStoreIds: string[]`, `groupId?`. Un batch multi-tienda se
**replica** en el slice de cada tienda destino compartiendo `groupId`; así el envío/
confirmación por tienda (`submitBatch`/`confirmBatch`) queda intacto.

### 1.4 Datos mock por tienda — `src/lib/mock-data.ts`
`buildInitialStoreData()`: #1402 = seed rico actual; las demás = variantes limpias con
precios perturbados y subconjunto de HQ distinto (para que el switch se sienta real y,
en Fase 2, se puedan demostrar las excepciones del fan-out).

## 2. Motor de fan-out (Fase 2) — `src/lib/store-fanout.ts` (puro, testeable)
Dado (overrides seleccionados + tiendas destino + datos de todas) → plan por tienda:
`applied` / `conflict` (sobrescribir) / `missing` (SKU ausente) / `locked` (en vuelo).
Copia el **precio absoluto** resultante + ventanas de fecha (allowance/fuel saver).

## 3. Acciones del store
- `setActiveStore(id)` — conserva el trabajo sin enviar de cada tienda.
- `createBatch(..., targetStoreIds)` — corre el plan, crea overrides+batch por slice con
  `groupId`, devuelve el resumen para confirmación/toast.
- `scheduleBatch`/`submitBatch` group-aware (una acción para todo el grupo).
- Undo del fan-out: elimina overrides+batches de todo el `groupId`.

## 4. UI
- **`StoreSwitcher`** (nuevo) en la cabecera de página: el nombre de tienda se vuelve un
  selector con contador de trabajo pendiente por tienda.
- **"Aplicar en"** dentro de `NewBatchModal` con preview en vivo del plan.
- **Confirmación**: "N cambios × M tiendas" + desglose expandible por tienda; badge
  "N tiendas" en tarjetas de batch y toasts con alcance.

## 5. Edge cases cubiertos
Switch a media edición (estado preservado), SKU ausente / campo en vuelo / conflicto,
programación de grupo, conteos sin doble conteo, HQ recs por tienda.

## 6. Verificación
Unit sobre `store-fanout.ts`; e2e Playwright: switch conserva estado, crear fan-out a N
tiendas, confirmación muestra desglose, cada tienda destino muestra su batch.

## 7. Fases
- **Fase 1** — Switcher + aislamiento por tienda (1.1–1.2, 1.4 mínimo, UI 4 switcher).
- **Fase 2** — Fan-out de batch (1.3, §2, §3, UI 4.2–4.3).
