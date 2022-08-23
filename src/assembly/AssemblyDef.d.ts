/*
 * Copyright (c) 2022 GlassBricks
 * This file is part of BBPP3.
 *
 * BBPP3 is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * BBPP3 is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License along with BBPP3. If not, see <https://www.gnu.org/licenses/>.
 */

import { StageNumber } from "../entity/AssemblyEntity"
import { Position } from "../lib/geometry"
import { MutableState, Observable, State } from "../lib/observable"
import { AssemblyContent, StagePosition } from "./AssemblyContent"
import { MutableEntityMap } from "./EntityMap"

export type AssemblyId = number & { _assemblyIdBrand: never }
export interface Assembly extends AssemblyContent {
  readonly id: AssemblyId

  readonly name: MutableState<string>
  readonly displayName: State<LocalisedString>

  readonly bbox: BoundingBox
  readonly content: MutableEntityMap

  readonly localEvents: Observable<LocalAssemblyEvent>

  getStage(stageNumber: StageNumber): Stage | nil
  iterateStages(start?: StageNumber, end?: StageNumber): LuaIterable<LuaMultiReturn<[StageNumber, Stage]>>
  getAllStages(): readonly Stage[]
  getStageAt(surface: LuaSurface, position: Position): Stage | nil

  insertStage(index: StageNumber): Stage
  /** Cannot be first stage, contents will be merged with previous stage. */
  deleteStage(index: StageNumber): Stage

  readonly valid: boolean

  delete(): void
}
export interface Stage extends StagePosition {
  readonly name: MutableState<string>

  readonly assembly: Assembly

  readonly valid: boolean

  deleteInAssembly(): void
}
export interface AssemblyCreatedEvent {
  readonly type: "assembly-created"
  readonly assembly: Assembly
}
export interface AssemblyDeletedEvent {
  readonly type: "assembly-deleted"
  readonly assembly: Assembly
}
export interface StageAddedEvent {
  readonly type: "stage-added"
  readonly assembly: Assembly
  readonly stage: Stage
}
export interface PreStageDeletedEvent {
  readonly type: "pre-stage-deleted"
  readonly assembly: Assembly
  readonly stage: Stage
}
export interface StageDeletedEvent {
  readonly type: "stage-deleted"
  readonly assembly: Assembly
  readonly stage: Stage
}
export type GlobalAssemblyEvent =
  | AssemblyCreatedEvent
  | AssemblyDeletedEvent
  | StageAddedEvent
  | PreStageDeletedEvent
  | StageDeletedEvent
export type LocalAssemblyEvent = AssemblyDeletedEvent | StageAddedEvent | PreStageDeletedEvent | StageDeletedEvent