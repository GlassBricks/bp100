/*
 * Copyright (c) 2022 GlassBricks
 * This file is part of BBPP3.
 *
 * BBPP3 is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * BBPP3 is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with Foobar. If not, see <https://www.gnu.org/licenses/>.
 */

import { LayerNumber } from "../entity/AssemblyEntity"
import { Position } from "../lib/geometry"
import { MutableState, Observable, State } from "../lib/observable"
import { WorldPosition } from "../utils/world-location"
import { AssemblyUpdaterParams } from "./AssemblyUpdater"
import { MutableEntityMap } from "./EntityMap"
import { WorldUpdaterParams } from "./WorldUpdater"

export interface AssemblyPosition {
  readonly layers: readonly LayerPosition[]

  readonly valid: boolean
}

export interface LayerPosition extends BoundingBoxRead {
  readonly layerNumber: LayerNumber
  readonly surface: LuaSurface
  readonly assembly: AssemblyPosition

  readonly valid: boolean
}

export type AssemblyId = number & { _assemblyIdBrand: never }

export interface Assembly extends AssemblyUpdaterParams, WorldUpdaterParams, AssemblyPosition {
  readonly id: AssemblyId

  readonly name: MutableState<string>
  readonly displayName: State<LocalisedString>

  readonly chunkSize: Position

  readonly layers: readonly Layer[]
  pushLayer(leftTop: WorldPosition): Layer

  readonly content: MutableEntityMap

  readonly events: Observable<AssemblyChangeEvent>

  delete(): void
}

export interface Layer extends LayerPosition {
  readonly assembly: Assembly

  readonly name: MutableState<string>
  readonly displayName: State<LocalisedString>
}

// events
export interface LayerPushedEvent {
  readonly type: "layer-pushed"
  readonly assembly: Assembly
  readonly layer: Layer
}

export interface AssemblyDeletedEvent {
  readonly type: "assembly-deleted"
  readonly assembly: Assembly
}
export type AssemblyChangeEvent = LayerPushedEvent | AssemblyDeletedEvent
