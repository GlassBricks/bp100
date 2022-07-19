import {
  AssemblyEntity,
  createAssemblyEntity,
  Entity,
  getValueAtLayer,
  LayerChange,
  LayerChanges,
  LayerNumber,
  MutableAssemblyEntity,
} from "../entity/AssemblyEntity"
import { getEntityDiff, getLayerPosition, saveEntity } from "../entity/diff"
import { nilIfEmpty } from "../lib"
import { Pos } from "../lib/geometry"
import { Layer } from "./Assembly"
import { MutableAssemblyContent } from "./AssemblyContent"

export type AssemblyUpdateType =
  | "added"
  | "addedBelow"
  | "refreshed"
  | "revived"
  | "revivedBelow"
  | "deleted"
  | "deletedMadeLostReference"
  | "deletionForbidden"
// | "updated"
// | "updated-above"

export type AssemblyUpdateHandler = (
  this: void,
  type: AssemblyUpdateType,
  entity: AssemblyEntity,
  layer?: LayerNumber,
) => void

/** If a lua entity is considered to be an assembly entity. */
export function isAssemblyEntity(entity: LuaEntity): boolean {
  return entity.type !== "entity-ghost" && entity.has_flag("player-creation")
}

/**
 * When an entity is added from the world.
 * Does not check isAssemblyEntity.
 */
export function onEntityAdded<E extends Entity = Entity>(
  entity: LuaEntity,
  layer: Layer,
  content: MutableAssemblyContent,
  updateHandler: AssemblyUpdateHandler,
): AssemblyEntity<E> | nil
export function onEntityAdded(
  entity: LuaEntity,
  layer: Layer,
  content: MutableAssemblyContent,
  updateHandler: AssemblyUpdateHandler,
): AssemblyEntity | nil {
  const position = getLayerPosition(entity, layer)
  const { layerNumber } = layer

  // search for existing entity
  const existing = content.findCompatible(entity, position, entity.direction)
  if (existing && layerNumber >= existing.layerNumber) {
    if (existing.isLostReference) {
      return reviveLostReference(existing, layerNumber, updateHandler)
    }
    updateHandler("refreshed", existing, layerNumber)
    return existing
  }

  const saved = saveEntity(entity)
  if (existing) {
    entityAddedBelow(saved!, layerNumber, existing, updateHandler)
    return existing
  }

  if (!saved) return
  const assemblyEntity = createAssemblyEntity(saved, position, entity.direction, layerNumber)
  content.add(assemblyEntity)
  updateHandler("added", assemblyEntity)
  return assemblyEntity
}

function reviveLostReference(
  existing: MutableAssemblyEntity,
  layerNumber: LayerNumber,
  updateHandler: AssemblyUpdateHandler,
): AssemblyEntity {
  assert(layerNumber >= existing.layerNumber)
  assert(existing.isLostReference)
  existing.baseEntity = getValueAtLayer(existing, layerNumber)!
  existing.isLostReference = nil
  existing.layerNumber = layerNumber
  const { layerChanges } = existing
  existing.layerChanges = layerChanges && getWithDeletedLayerChanges(existing.layerChanges, layerNumber)
  updateHandler("revived", existing)
  return existing
}

function getWithDeletedLayerChanges(layerChanges: LayerChanges | nil, layerNumber: LayerNumber): LayerChange | nil {
  if (!layerChanges) return nil
  for (const [layer] of pairs(layerChanges)) {
    if (layer > layerNumber) break
    delete layerChanges[layer]
  }
  return nilIfEmpty(layerChanges)
}

function entityAddedBelow(
  added: Entity,
  layerNumber: LayerNumber,
  existing: MutableAssemblyEntity,
  updateHandler: AssemblyUpdateHandler,
): void {
  assert(layerNumber < existing.layerNumber)
  const diff = getEntityDiff(added, existing.baseEntity)
  if (diff) {
    const layerChanges: LayerChanges = (existing.layerChanges ??= {})
    assert(layerChanges[existing.layerNumber] === nil)
    layerChanges[existing.layerNumber] = diff
  }
  existing.layerNumber = layerNumber
  existing.baseEntity = added
  if (existing.isLostReference) {
    existing.isLostReference = nil
    updateHandler("revivedBelow", existing)
  } else {
    updateHandler("addedBelow", existing)
  }
}

export function entityDeleted(
  entity: LuaEntity,
  layer: Layer,
  content: MutableAssemblyContent,
  updateHandler: AssemblyUpdateHandler,
): void {
  const position = Pos.minus(entity.position, layer.bbox.left_top)
  assert(position.x >= 0 && position.y >= 0, "entity position must be >= 0")
  const compatible = content.findCompatible(entity, position, entity.direction)
  if (!compatible) return
  if (compatible.layerNumber !== layer.layerNumber) {
    if (compatible.layerNumber < layer.layerNumber) {
      updateHandler("deletionForbidden", compatible, layer.layerNumber)
    }
    // else: is bug, ignore.
    return
  }
  if (compatible.layerChanges) {
    compatible.isLostReference = true
    updateHandler("deletedMadeLostReference", compatible)
    return
  }

  content.remove(compatible)
  updateHandler("deleted", compatible)
}
