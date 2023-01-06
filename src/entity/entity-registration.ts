/*
 * Copyright (c) 2022 GlassBricks
 * This file is part of Staged Blueprint Planning.
 *
 * Staged Blueprint Planning is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Staged Blueprint Planning is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License along with Staged Blueprint Planning. If not, see <https://www.gnu.org/licenses/>.
 */

import { Events } from "../lib"
import type { AssemblyEntity } from "./AssemblyEntity"

declare const global: {
  entityByUnitNumber: LuaMap<UnitNumber, AssemblyEntity>
}

Events.on_init(() => {
  global.entityByUnitNumber = new LuaMap()
})

/** Currently only used for rolling stock (train) entities. */
export function registerEntity(luaEntity: LuaEntity, assemblyEntity: AssemblyEntity): boolean {
  if (!luaEntity.valid) return false
  const unitNumber = luaEntity.unit_number
  if (!unitNumber) return false
  const entry = global.entityByUnitNumber.get(unitNumber)
  if (entry) return true
  global.entityByUnitNumber.set(unitNumber, assemblyEntity)
  if (unitNumber != -1) script.register_on_entity_destroyed(luaEntity)
  return true
}

export function getRegisteredAssemblyEntity(entity: LuaEntity): AssemblyEntity | nil {
  if (!entity.valid) return nil
  const unitNumber = entity.unit_number
  return unitNumber && global.entityByUnitNumber.get(unitNumber)
}

Events.on_entity_destroyed((e) => {
  const eNumber = e.unit_number
  if (eNumber) global.entityByUnitNumber.delete(eNumber)
})
