/*
 * Copyright (c) 2022-2023 GlassBricks
 * This file is part of Staged Blueprint Planning.
 *
 * Staged Blueprint Planning is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Staged Blueprint Planning is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License along with Staged Blueprint Planning. If not, see <https://www.gnu.org/licenses/>.
 */

import { BlueprintEntity, LuaEntity, LuaPlayer, LuaSurface, PlayerIndex, SurfaceCreateEntity } from "factorio:runtime"
import expect from "tstl-expect"
import { oppositedirection } from "util"
import { Prototypes, Settings } from "../../constants"
import {
  circuitConnectionEquals,
  CircuitOrPowerSwitchConnection,
  ProjectCircuitConnection,
} from "../../entity/circuit-connection"
import { emptyBeltControlBehavior, emptyInserterControlBehavior } from "../../entity/empty-control-behavior"
import { LuaEntityInfo, UndergroundBeltEntity } from "../../entity/Entity"
import { isPreviewEntity } from "../../entity/entity-prototype-info"
import {
  ProjectEntity,
  RollingStockProjectEntity,
  StageNumber,
  UndergroundBeltProjectEntity,
} from "../../entity/ProjectEntity"
import { checkUndergroundPairFlippable, saveEntity } from "../../entity/save-load"
import { findUndergroundPair } from "../../entity/underground-belt"
import { addPowerSwitchConnections } from "../../entity/wires"
import { assert, Events } from "../../lib"
import { BBox, Pos } from "../../lib/geometry"
import { runEntireCurrentTask } from "../../lib/task"
import { syncMapGenSettings } from "../../project/map-gen"
import { EntityUpdateResult, StageMoveResult } from "../../project/project-updates"

import { UserProject } from "../../project/ProjectDef"
import { _simulateUndo } from "../../project/undo"
import { _deleteAllProjects, createUserProject } from "../../project/UserProject"

import { createRollingStock } from "../entity/createRollingStock"
import {
  assertConfigChangedHighlightsCorrect,
  assertErrorHighlightsCorrect,
  assertLastStageHighlightCorrect,
  assertNoHighlightsAfterLastStage,
} from "./entity-highlight-test-util"
import direction = defines.direction

let project: UserProject
let surfaces: LuaSurface[]
let player: LuaPlayer
before_each(() => {
  project = createUserProject("test", 6)
  surfaces = project.getAllStages().map((stage) => stage.surface)
  player = game.players[1]
})
after_each(() => {
  _deleteAllProjects()
})

const pos = Pos(10.5, 10.5)

function assertEntityCorrect(entity: ProjectEntity, expectedHasError: number | false) {
  expect(entity.isSettingsRemnant).toBeFalsy()
  const found = project.content.findCompatibleEntity(entity.firstValue.name, entity.position, entity.direction, 1)
  expect(found).toBe(entity)

  let hasError: number | false = false
  for (const stage of $range(1, project.lastStageFor(entity))) {
    const worldEntity = entity.getWorldOrPreviewEntity(stage)!
    assert(worldEntity, `entity does not exist at stage ${stage}`)
    const isPreview = isPreviewEntity(worldEntity)
    const value = entity.getValueAtStage(stage)
    if (value == nil) {
      assert(isPreview, `entity must be preview at stage ${stage}`)
    } else if (isPreview) {
      assert(entity.hasErrorAt(stage), `entity must have error at stage ${stage} to be preview`)
      hasError ||= stage
    } else if (entity.hasErrorAt(stage)) {
      assert(
        worldEntity.type == "underground-belt",
        "Only underground belt currently can have error with existing entity",
      )
      assert(entity.isUndergroundBelt())
      hasError ||= stage
      const type = worldEntity.belt_to_ground_type
      const oppositeType = type == "input" ? "output" : "input"
      expect(entity.direction).toBe(oppositedirection(worldEntity.direction))
      expect(entity.firstValue.type).toBe(oppositeType)
    } else {
      const savedValue = saveEntity(worldEntity)
      expect(savedValue).toEqual(value)
      expect(worldEntity.direction).toBe(entity.direction)
    }
    if (isPreview) {
      expect(worldEntity.name).toBe(Prototypes.PreviewEntityPrefix + (value ?? entity.firstValue).name)
    }
    expect(worldEntity.position).toEqual(entity.position)
    if (isPreview) {
      expect(worldEntity.direction).toEqual(entity.getPreviewDirection())
    } else if (entity.isUndergroundBelt() && entity.hasErrorAt(stage)) {
      expect(worldEntity.direction).toEqual(oppositedirection(entity.direction))
    } else {
      expect(worldEntity.direction).toEqual(entity.direction)
    }

    expect(entity.getExtraEntity("settingsRemnantHighlight", stage)).toBeNil()
  }

  expect(hasError).toBe(expectedHasError)

  // nothing after the last stage
  for (const stage of $range(project.lastStageFor(entity) + 1, project.numStages())) {
    expect(entity.getWorldOrPreviewEntity(stage)).toBeNil()
  }

  assertErrorHighlightsCorrect(entity, project.lastStageFor(entity))
  assertConfigChangedHighlightsCorrect(entity, project.lastStageFor(entity))
  assertLastStageHighlightCorrect(entity)
  assertNoHighlightsAfterLastStage(entity, project.numStages())

  // cables
  const cableConnections = entity.cableConnections
  const isElectricPole = game.entity_prototypes[entity.firstValue.name].type == "electric-pole"
  if (!cableConnections) {
    if (isElectricPole) {
      for (const stage of $range(entity.firstStage, project.lastStageFor(entity))) {
        const pole = entity.getWorldEntity(stage)
        if (!pole) continue
        const cableNeighbors = (pole.neighbours as Record<"copper", LuaEntity[]>).copper.filter(
          (x) => x.type != "power-switch",
        )
        expect(cableNeighbors).toEqual([])
      }
    }
    // else, ok
  } else {
    expect(isElectricPole).toBe(true)
    const otherNeighbors = Object.keys(cableConnections)
    for (const stage of $range(entity.firstStage, project.lastStageFor(entity))) {
      const expectedNeighbors = otherNeighbors
        .map((o) => o.getWorldEntity(stage))
        .filter((o) => o)
        .map((o) => o?.unit_number)
        .sort()
      const actualNeighbors = (entity.getWorldEntity(stage)?.neighbours as Record<"copper", LuaEntity[]>).copper
        .filter((x) => x.type != "power-switch")
        .map((o) => o.unit_number)
        .sort()
      expect(actualNeighbors).toEqual(expectedNeighbors)
    }
  }

  // circuit wires
  const wireConnections = entity.circuitConnections
  if (!wireConnections) {
    for (const stage of $range(entity.firstStage, project.lastStageFor(entity))) {
      const worldEntity = entity.getWorldEntity(stage)
      if (!worldEntity) continue
      const wireNeighbors: CircuitOrPowerSwitchConnection[] | nil = worldEntity.circuit_connection_definitions
      if (!wireNeighbors) continue
      addPowerSwitchConnections(worldEntity, wireNeighbors)
      expect(wireNeighbors).toEqual([])
    }
  } else {
    for (const stage of $range(entity.firstStage, project.lastStageFor(entity))) {
      const thisWorldEntity = entity.getWorldEntity(stage)
      if (!thisWorldEntity) continue
      const expectedNeighbors = Object.entries(wireConnections).flatMap(([entity, connections]) => {
        const otherWorldEntity = entity.getWorldEntity(stage)
        if (!otherWorldEntity) return []
        return Object.keys(connections).map((connection) => ({
          wire: connection.wire,
          entities: newLuaSet(thisWorldEntity.unit_number!, otherWorldEntity.unit_number!),
        }))
      })
      const actualNeighbors: CircuitOrPowerSwitchConnection[] = thisWorldEntity.circuit_connection_definitions ?? []
      addPowerSwitchConnections(thisWorldEntity, actualNeighbors)

      const actualNeighborsSet = actualNeighbors.map((x) => ({
        wire: x.wire,
        entities: newLuaSet(x.target_entity.unit_number!, thisWorldEntity.unit_number!),
      }))
      expect(actualNeighborsSet).toEqual(expectedNeighbors)
    }
  }
}

function assertEntityNotPresent(entity: ProjectEntity) {
  const found = project.content.findCompatibleEntity(entity.firstValue.name, entity.position, entity.direction, 1)
  expect(found).toBeNil()

  for (const stage of $range(1, project.lastStageFor(entity))) {
    expect(entity.getWorldOrPreviewEntity(stage)).toBeNil()
  }
  expect(entity.hasAnyExtraEntities("errorOutline")).toBe(false)
  expect(entity.hasAnyExtraEntities("errorElsewhereIndicator")).toBe(false)
}

function assertIsSettingsRemnant(entity: ProjectEntity) {
  expect(entity.isSettingsRemnant).toBe(true)
  for (const stage of $range(1, project.lastStageFor(entity))) {
    const preview = entity.getWorldOrPreviewEntity(stage)!
    expect(preview).toBeAny()
    expect(isPreviewEntity(preview)).toBe(true)
    expect(entity.getExtraEntity("settingsRemnantHighlight", stage)).toBeAny()
  }
  expect(entity.hasAnyExtraEntities("errorOutline")).toBe(false)
  expect(entity.hasAnyExtraEntities("errorElsewhereIndicator")).toBe(false)
}
let defaultName = "inserter"
before_each(() => {
  defaultName = "inserter"
})

function createEntity(stage: StageNumber, args?: Partial<SurfaceCreateEntity>) {
  const params = {
    name: defaultName ?? error("defaultName not set"),
    position: pos,
    force: "player",
    direction: defines.direction.east,
    ...args,
  }
  const entity = surfaces[stage - 1].create_entity(params)
  assert(entity, "created entity")
  const proto = game.entity_prototypes[params.name]
  if (proto.type == "inserter") {
    entity.inserter_stack_size_override = 1
    entity.inserter_filter_mode = "whitelist"
  }
  return entity
}
function buildEntity(stage: StageNumber, args?: Partial<SurfaceCreateEntity>): ProjectEntity<BlueprintEntity> {
  const luaEntity = createEntity(stage, args)
  const saved = recordEntity(luaEntity)
  project.actions.onEntityCreated(luaEntity, stage, player.index)
  const entity = project.content.findCompatibleWithLuaEntity(saved, nil, stage)! as ProjectEntity<BlueprintEntity>
  assert(entity)
  expect(entity.firstStage).toBe(stage)
  expect(entity.getWorldEntity(stage)).toEqual(luaEntity)
  return entity
}

function recordEntity(luaEntity: LuaEntity): LuaEntityInfo {
  return {
    name: luaEntity.name,
    type: luaEntity.type,
    position: luaEntity.position,
    direction: luaEntity.direction,
    belt_to_ground_type: luaEntity.type == "underground-belt" ? luaEntity.belt_to_ground_type : nil,
    surface: luaEntity.surface,
  }
}
describe.each([
  ["transport-belt", "fast-transport-belt", false, false],
  ["underground-belt", "fast-underground-belt", false, false],
  [
    "filter-inserter",
    "stack-filter-inserter",
    { override_stack_size: 2 },
    (e: LuaEntity): any => (e.inserter_stack_size_override = 2),
  ],
  [
    "assembling-machine-1",
    "assembling-machine-2",
    { recipe: "iron-gear-wheel" },
    (e: LuaEntity) => e.set_recipe("iron-gear-wheel"),
  ],
  [
    "wooden-chest",
    "iron-chest",
    { bar: 5 },
    (e: LuaEntity) => e.get_inventory(defines.inventory.chest)!.set_bar(5 + 1),
  ],
])("using %s, upgrade to %s", (name, upgradeName, diff, applyToEntity) => {
  before_each(() => {
    defaultName = name
  })
  test("can add a new entity", () => {
    const entity = buildEntity(3)
    assertEntityCorrect(entity, false)
  })

  test("is correct when entity dies", () => {
    const entity = buildEntity(3)
    const worldEntity = entity.getWorldEntity(4)!
    worldEntity.destructible = true
    worldEntity.die()
    assertEntityCorrect(entity, 4)
  })

  test("has error when entity cannot be placed at some stage", () => {
    createEntity(4, { name: "stone-wall" }) // blocker
    const entity = buildEntity(3)
    expect(isPreviewEntity(entity.getWorldOrPreviewEntity(4)!)).toBe(true)
    assertEntityCorrect(entity, 4)
  })

  test("can fix missing entity via onTryFixEntity", () => {
    const blocker = createEntity(4, { name: "stone-wall" })
    const entity = buildEntity(3)
    blocker.destroy()
    project.actions.onTryFixEntity(entity.getWorldOrPreviewEntity(4)!, 4)
    assertEntityCorrect(entity, false)
  })

  test("refreshWorldEntityAtStage will fix incorrect direction", () => {
    const entity = buildEntity(3)
    entity.getWorldOrPreviewEntity(4)!.direction = direction.north

    project.entityUpdates.refreshWorldEntityAtStage(entity, 4)
    assertEntityCorrect(entity, false)
  })

  test("can move entity by replacing preview", () => {
    const entity = buildEntity(3)
    const newEntity = buildEntity(2)
    expect(newEntity).toBe(entity)
    expect(entity.firstStage).toBe(2)
    assertEntityCorrect(entity, false)
  })

  test("will disallow entity deletion at a higher stage", () => {
    const entity = buildEntity(3)
    const worldEntity = entity.getWorldEntity(4)!
    worldEntity.mine({
      force: true,
      ignore_minable: true,
      raise_destroyed: true,
    })
    expect(worldEntity.valid).toBe(false)
    assertEntityCorrect(entity, false)
  })

  test("can delete entity at first stage", () => {
    const entity = buildEntity(3)
    const worldEntity = entity.getWorldEntity(3)!
    player.mine_entity(worldEntity, true)
    expect(worldEntity.valid).toBe(false)
    assertEntityNotPresent(entity)
  })

  test("deleting entity may create settings remnant", () => {
    const entity = buildEntity(3)
    entity._applyDiffAtStage(4, { override_stack_size: 2 })
    const worldEntity = entity.getWorldEntity(3)!
    player.mine_entity(worldEntity, true)
    expect(worldEntity.valid).toBe(false)
    assertIsSettingsRemnant(entity)
  })

  if (name.includes("inserter")) {
    describe("reviving settings remnants", () => {
      test.each([1, 2, 3, 4, 5, 6])("settings remnant 1->3->5, revive at stage %d", (reviveStage) => {
        const entity = buildEntity(1)
        entity._applyDiffAtStage(3, { override_stack_size: 2 })
        entity._applyDiffAtStage(5, { override_stack_size: 3 })
        project.updates.deleteEntityOrCreateSettingsRemnant(entity)
        assertIsSettingsRemnant(entity)

        assert(project.updates.tryReviveSettingsRemnant(entity, reviveStage))
        expect(entity.isSettingsRemnant).toBeFalsy()
        expect(reviveStage).toBe(entity.firstStage)

        if (reviveStage >= 5) {
          expect(entity.firstValue.override_stack_size).toBe(3)
          expect(entity.hasStageDiff()).toBe(false)
        } else if (reviveStage >= 3) {
          expect(entity.firstValue.override_stack_size).toBe(2)
          expect(entity.stageDiffs).toEqual({ 5: { override_stack_size: 3 } })
        } else {
          expect(entity.firstValue.override_stack_size).toBe(1)
          expect(entity.stageDiffs).toEqual({ 3: { override_stack_size: 2 }, 5: { override_stack_size: 3 } })
        }

        assertEntityCorrect(entity, false)
      })

      test("settings remnant 2->3, revive at stage 1", () => {
        const entity = buildEntity(2)
        entity._applyDiffAtStage(3, { override_stack_size: 3 })
        project.updates.deleteEntityOrCreateSettingsRemnant(entity)
        assertIsSettingsRemnant(entity)

        project.updates.tryReviveSettingsRemnant(entity, 1)
        expect(entity.isSettingsRemnant).toBeFalsy()
        expect(1).toBe(entity.firstStage)

        expect(entity.firstValue.override_stack_size).toBe(1)
        expect(entity.stageDiffs).toEqual({ 3: { override_stack_size: 3 } })

        assertEntityCorrect(entity, false)
      })
    })
  }

  test("can force delete an entity at any stage", () => {
    const entity = buildEntity(3)
    entity._applyDiffAtStage(4, { override_stack_size: 2 })
    project.actions.onEntityForceDeleteUsed(entity.getWorldEntity(4)!, 4, player.index)
    assertEntityNotPresent(entity)
  })

  test("can rotate in the first stage", () => {
    const entity = buildEntity(3)
    const worldEntity = entity.getWorldEntity(3)!
    if (
      worldEntity.type == "underground-belt" ||
      !worldEntity.supports_direction ||
      worldEntity.direction == direction.north
    )
      return
    assert(worldEntity.rotate({ by_player: player }))
    expect(entity.direction).toBe(defines.direction.south)
    assertEntityCorrect(entity, false)
  })

  test("rotation forbidden at higher stage", () => {
    const entity = buildEntity(3)
    const worldEntity = entity.getWorldEntity(4)!
    if (!worldEntity.supports_direction || worldEntity.direction == direction.north) return // skip
    worldEntity.rotatable = true
    worldEntity.rotate({ by_player: player })
    expect(entity.direction).toBe(direction.east)
    assertEntityCorrect(entity, false)
  })

  test("can upgrade at first stage via fast replace", () => {
    const dir = direction.east
    const entity = buildEntity(3)
    player.teleport(player.position, project.getSurface(3))
    player.cursor_stack!.set_stack(upgradeName)
    player.build_from_cursor({ position: pos, direction: dir })

    expect(entity.firstValue.name).toBe(upgradeName)
    expect(entity.hasStageDiff()).toBe(false)

    assertEntityCorrect(entity, false)
  })

  test("can create upgrade from %s to %s", () => {
    const entity = buildEntity(3)
    const worldEntity = entity.getWorldEntity(4)!
    worldEntity.order_upgrade({
      force: worldEntity.force,
      target: upgradeName,
      player,
    })

    expect(entity.firstValue.name).toBe(name)
    expect(entity.getStageDiff(4)).toEqual({ name: upgradeName })
    expect(entity.getWorldEntity(4)!.name).toBe(upgradeName)
    expect(entity.getWorldEntity(5)!.name).toBe(upgradeName)
    assertEntityCorrect(entity, false)
  })

  test("upgrading entities still project.updates error entity previews", () => {
    createEntity(5, { name: "stone-wall" })
    const entity = buildEntity(3)

    let preview = entity.getWorldOrPreviewEntity(5)!
    expect(isPreviewEntity(preview)).toBe(true)
    expect(preview.name).toBe(Prototypes.PreviewEntityPrefix + name)

    assertEntityCorrect(entity, 5)

    entity.getWorldOrPreviewEntity(4)!.order_upgrade({
      force: "player",
      target: upgradeName,
      player,
    })

    preview = entity.getWorldOrPreviewEntity(5)!
    expect(isPreviewEntity(preview)).toBe(true)
    expect(preview.name).toBe(Prototypes.PreviewEntityPrefix + upgradeName)

    assertEntityCorrect(entity, 5)
  })

  test("can move entity up", () => {
    const entity = buildEntity(3)
    project.actions.onMoveEntityToStageCustomInput(entity.getWorldOrPreviewEntity(4)!, 4, player.index)
    expect(entity.firstStage).toBe(4)
    assertEntityCorrect(entity, false)
  })

  test("can move entity down", () => {
    const entity = buildEntity(3)
    project.actions.onMoveEntityToStageCustomInput(entity.getWorldOrPreviewEntity(2)!, 2, player.index)
    expect(entity.firstStage).toBe(2)
    assertEntityCorrect(entity, false)
  })

  if (remote.interfaces.PickerDollies && remote.interfaces.PickerDollies.dolly_moved_entity_id) {
    test("can dolly entity", () => {
      const entity = buildEntity(3)
      const worldEntity = entity.getWorldEntity(3)!
      if (!worldEntity.teleport(1, 0)) return
      const newPosition = worldEntity.position
      project.actions.onEntityDollied(worldEntity, 3, pos, player.index)

      expect(entity.position).toEqual(newPosition)
      assertEntityCorrect(entity, false)
    })
  }

  if (diff) {
    if (!applyToEntity) error("applyToEntity not set")
    const [k] = Object.keys(diff)

    test("can update value at first stage from world", () => {
      const entity = buildEntity(3)
      const worldEntity = entity.getWorldEntity(3)!
      applyToEntity(worldEntity)
      const ret = project.updates.tryUpdateEntityFromWorld(entity, 3)
      expect(ret).toBe(EntityUpdateResult.Updated)
      expect(entity.firstValue).toMatchTable(diff)
      assertEntityCorrect(entity, false)
    })

    test("updating higher value from world", () => {
      const entity = buildEntity(3)
      const worldEntity = entity.getWorldEntity(4)!
      applyToEntity(worldEntity)
      const ret = project.updates.tryUpdateEntityFromWorld(entity, 4)
      expect(ret).toBe(EntityUpdateResult.Updated)
      expect(entity.firstValue).not.toMatchTable(diff)
      expect(entity.hasStageDiff(4)).toBe(true)
      expect(entity.getStageDiff(4)).toEqual(diff)

      assertEntityCorrect(entity, false)
    })

    test("refreshing and rebuilding an entity with diffs", () => {
      const entity = buildEntity(2)
      entity._applyDiffAtStage(5, { name: upgradeName })
      entity._applyDiffAtStage(3, diff)
      project.entityUpdates.refreshAllWorldEntities(entity)
      for (const stage of $range(1, 6)) {
        project.entityUpdates.refreshWorldEntityAtStage(entity, stage)
        assertEntityCorrect(entity, false)
      }
      for (const stage of $range(1, 6)) {
        project.entityUpdates.rebuildWorldEntityAtStage(entity, stage)
        assertEntityCorrect(entity, false)
      }
      for (const stage of $range(1, 6)) {
        project.entityUpdates.rebuildStage(stage)
        assertEntityCorrect(entity, false)
      }
      project.entityUpdates.rebuildAllStages()
      runEntireCurrentTask()
      assertEntityCorrect(entity, false)
    })

    test("resetProp", () => {
      const entity = buildEntity(3)
      entity._applyDiffAtStage(4, diff)
      project.updates.resetProp(entity, 4, k as keyof BlueprintEntity)
      expect(entity.hasStageDiff()).toBe(false)
      expect(entity.firstValue).not.toMatchTable(diff)
      expect(entity.hasStageDiff()).toBe(false)
      assertEntityCorrect(entity, false)
    })

    test("movePropDown", () => {
      const entity = buildEntity(3)
      entity._applyDiffAtStage(4, diff)
      project.updates.movePropDown(entity, 4, k as keyof BlueprintEntity)
      expect(entity.hasStageDiff()).toBe(false)
      expect(entity.firstValue).toMatchTable(diff)
      assertEntityCorrect(entity, false)
    })

    test("resetAllProps", () => {
      const entity = buildEntity(3)
      entity._applyDiffAtStage(4, diff)
      project.updates.resetAllProps(entity, 4)
      expect(entity.hasStageDiff()).toBe(false)
      expect(entity.firstValue).not.toMatchTable(diff)
      assertEntityCorrect(entity, false)
    })

    test("moveAllPropsDown", () => {
      const entity = buildEntity(3)
      entity._applyDiffAtStage(4, diff)
      project.updates.moveAllPropsDown(entity, 4)
      expect(entity.hasStageDiff()).toBe(false)
      expect(entity.firstValue).toMatchTable(diff)
      assertEntityCorrect(entity, false)
    })
  }

  test("using stage delete tool", () => {
    const entity = buildEntity(1, { name: "inserter", position: pos, direction: direction.west })
    Events.raiseFakeEventNamed("on_player_selected_area", {
      player_index: player.index,
      item: Prototypes.StageDeconstructTool,
      entities: [entity.getWorldEntity(3)!],
      tiles: [],
      surface: surfaces[2],
      area: { left_top: pos, right_bottom: pos },
    })

    expect(entity.lastStage).toBe(2)
    assertEntityCorrect(entity, false)
  })

  test("using stage delete tool alt select", () => {
    const entity = buildEntity(1, { name: "inserter", position: pos, direction: direction.west })
    project.actions.userSetLastStageWithUndo(entity, 3, player.index)

    Events.raiseFakeEventNamed("on_player_alt_selected_area", {
      player_index: player.index,
      item: Prototypes.StageDeconstructTool,
      entities: [entity.getWorldEntity(3)!],
      tiles: [],
      surface: surfaces[2],
      area: { left_top: pos, right_bottom: pos },
    })

    expect(entity.lastStage).toBe(nil)
    assertEntityCorrect(entity, false)

    _simulateUndo(player)

    expect(entity.lastStage).toBe(3)
  })
})

describe.each([true, false])("underground snapping, with flipped %s", (flipped) => {
  const expectedDirection = !flipped ? defines.direction.east : defines.direction.west
  const westType = !flipped ? "input" : "output"
  const eastType = !flipped ? "output" : "input"
  let westUnderground: ProjectEntity<BlueprintEntity>
  before_each(() => {
    westUnderground = buildEntity(4, {
      name: "underground-belt",
      direction: expectedDirection,
      type: westType,
      position: pos.minus(Pos(1, 0)),
    })
    assertEntityCorrect(westUnderground, false)
  })

  test("placing underground", () => {
    // place underground belt facing west (input), should snap to east output
    const placedUnderground = buildEntity(3, {
      name: "underground-belt",
      direction: defines.direction.west,
      type: "input",
    })
    expect(placedUnderground.direction).toBe(expectedDirection)
    expect(placedUnderground.firstValue.type).toBe(eastType)
    assertEntityCorrect(placedUnderground, false)
    // type defaults to input
    expect(westUnderground.direction).toBe(expectedDirection)
    expect(westUnderground.firstValue.type).toBe(westType)

    expect(westUnderground.getWorldEntity(4)!.neighbours).toEqual(placedUnderground.getWorldEntity(4)!)
  })
  test("pasting underground", () => {
    const stack = player.cursor_stack!
    stack.set_stack("blueprint")
    stack.set_blueprint_entities([
      {
        name: "underground-belt",
        direction: defines.direction.west,
        type: "input",
        entity_number: 1,
        position: Pos(0.5, 0.5),
      },
    ])
    player.teleport(pos, surfaces[3 - 1])

    player.build_from_cursor({ position: pos, alt: true })
    const ghost = surfaces[3 - 1].find_entity("entity-ghost", pos)
    expect(ghost).toBeNil()

    const builtEntity = surfaces[3 - 1].find_entity("underground-belt", pos)!
    expect(builtEntity).toBeAny()
    expect(builtEntity.direction).toBe(expectedDirection)
    expect(builtEntity.belt_to_ground_type).toBe(eastType)

    const entity = project.content.findCompatibleWithLuaEntity(builtEntity, nil, 3) as UndergroundBeltProjectEntity
    expect(entity).toBeAny()
    expect(entity.isUndergroundBelt()).toBe(true)
    expect(entity.direction).toBe(expectedDirection)
    expect(entity.firstValue.type).toBe(eastType)
  })
})

describe("underground belt inconsistencies", () => {
  describe("left, high middle, right", () => {
    let leftUnderground: ProjectEntity<UndergroundBeltEntity>
    let rightUnderground: ProjectEntity<BlueprintEntity>
    let middleUnderground: ProjectEntity<BlueprintEntity>
    before_each(() => {
      leftUnderground = buildEntity(1, {
        name: "underground-belt",
        type: "input",
        direction: defines.direction.east,
        position: pos.add(-1, 0),
      }) as UndergroundBeltProjectEntity
      rightUnderground = buildEntity(1, {
        name: "underground-belt",
        type: "output",
        direction: defines.direction.east,
        position: pos.add(1, 0),
      })
      middleUnderground = buildEntity(2, {
        name: "underground-belt",
        type: "output",
        direction: defines.direction.east,
        position: pos,
      })
      const leftStage1 = leftUnderground.getWorldEntity(1)
      assert(leftStage1)
      expect(leftStage1.neighbours).not.toBeNil().and.toEqual(rightUnderground.getWorldEntity(1))
      expect(leftUnderground.getWorldEntity(2)?.neighbours)
        .not.toBeNil()
        .and.toEqual(middleUnderground.getWorldEntity(2))

      const leftStage2 = leftUnderground.getWorldEntity(2)
      assert(leftStage2)
      const middleStage2 = middleUnderground.getWorldEntity(2)
      assert(middleStage2)

      expect(leftStage2.neighbours).toEqual(middleStage2)
      expect(checkUndergroundPairFlippable(middleStage2)).toMatchTable([middleUnderground, false])

      expect(findUndergroundPair(project.content, leftUnderground, 1)).toBe(rightUnderground)
    })
    test("When flipping an left paired with multiple undergrounds, error is shown in stage where left flip failed", () => {
      // stage 1: < >
      // stage 2: <i>
      // flipping in stage 1 will flip both < and >, but in stage 2 because of "i", it fails to flip
      // error should be shown in 2 for <
      const leftStage1 = leftUnderground.getWorldEntity(1)!
      const rightStage1 = rightUnderground.getWorldEntity(1)!
      const leftStage2 = leftUnderground.getWorldEntity(2)!

      leftStage1.rotate({ by_player: player })

      expect(leftUnderground).toMatchTable({
        firstValue: { type: "output" },
        direction: defines.direction.west,
      })
      expect(rightUnderground).toMatchTable({
        firstValue: { type: "input" },
        direction: defines.direction.west,
      })
      // middle unchanged
      expect(middleUnderground).toMatchTable({
        firstValue: { type: "output" },
        direction: defines.direction.east,
      })

      expect(leftStage1).toMatchTable({
        direction: defines.direction.west,
        belt_to_ground_type: "output",
      })
      expect(rightStage1).toMatchTable({
        direction: defines.direction.west,
        belt_to_ground_type: "input",
      })
      // stage 2 should not have changed
      expect(leftStage2).toMatchTable({
        direction: defines.direction.east,
        belt_to_ground_type: "input",
      })
      expect(leftUnderground.hasErrorAt(2)).toBe(true)

      assertEntityCorrect(leftUnderground, 2)
      assertEntityCorrect(rightUnderground, false)
      assertEntityCorrect(middleUnderground, false)
    })
    test("when flipping middle, middle succeeds, but error is shown in left where the flip failed", () => {
      const middle = middleUnderground.getWorldEntity(2)!
      const leftStage1 = leftUnderground.getWorldEntity(1)!
      const leftStage2 = leftUnderground.getWorldEntity(2)!

      middle.rotate({ by_player: player })

      // left and middle should have flipped
      expect(leftUnderground).toMatchTable({
        firstValue: { type: "output" },
        direction: defines.direction.west,
      })
      expect(middleUnderground).toMatchTable({
        firstValue: { type: "input" },
        direction: defines.direction.west,
      })
      // right unchanged
      expect(rightUnderground).toMatchTable({
        firstValue: { type: "output" },
        direction: defines.direction.east,
      })

      // error in left stage 1
      expect(leftStage1).toMatchTable({
        direction: defines.direction.east,
        belt_to_ground_type: "input",
      })
      expect(leftUnderground.hasErrorAt(1)).toBe(true)

      // fine in stage 2
      expect(leftStage2).toMatchTable({
        direction: defines.direction.west,
        belt_to_ground_type: "output",
      })

      assertEntityCorrect(leftUnderground, 1)
      assertEntityCorrect(rightUnderground, false)
      assertEntityCorrect(middleUnderground, false)
    })
    test("when flipping an underground to correct error, also flips its pair", () => {
      const leftStage1 = leftUnderground.getWorldEntity(1)!
      leftStage1.rotate({ by_player: player })
      // see first test for current state

      // now rotate the broken case (left in stage 2)
      const leftStage2 = leftUnderground.getWorldEntity(2)!
      expect(leftStage2).toMatchTable({
        direction: defines.direction.east,
        belt_to_ground_type: "input",
      })
      leftStage2.rotate({ by_player: player })

      // now all 3 should be rotated
      expect(leftUnderground).toMatchTable({
        firstValue: { type: "output" },
        direction: defines.direction.west,
      })
      expect(rightUnderground).toMatchTable({
        firstValue: { type: "input" },
        direction: defines.direction.west,
      })
      expect(middleUnderground).toMatchTable({
        firstValue: { type: "input" },
        direction: defines.direction.west,
      })

      const middle = middleUnderground.getWorldEntity(2)!

      expect(leftStage1).toMatchTable({
        direction: defines.direction.west,
        belt_to_ground_type: "output",
      })
      expect(leftStage2).toMatchTable({
        direction: defines.direction.west,
        belt_to_ground_type: "output",
      })
      expect(middle).toMatchTable({
        direction: defines.direction.west,
        belt_to_ground_type: "input",
      })

      assertEntityCorrect(leftUnderground, false)
      assertEntityCorrect(rightUnderground, false)
      assertEntityCorrect(middleUnderground, false)
    })
    test("when deleting an underground causing old pair to flip, project.updates highlights on old pair", () => {
      middleUnderground.setFirstStageUnchecked(1)
      project.entityUpdates.updateWorldEntities(middleUnderground, 1)

      middleUnderground.getWorldEntity(1)!.rotate({ by_player: player })
      expect(middleUnderground).toMatchTable({
        firstValue: { type: "input" },
        direction: defines.direction.west,
      })
      expect(leftUnderground).toMatchTable({
        firstValue: { type: "output" },
        direction: defines.direction.west,
      })
      assertEntityCorrect(middleUnderground, false)
      assertEntityCorrect(leftUnderground, false)

      player.mine_entity(middleUnderground.getWorldEntity(1)!, true)

      expect(project.content.hasEntity(middleUnderground)).toBe(false)

      expect(leftUnderground.hasErrorAt(1)).toBe(true)

      assertEntityCorrect(leftUnderground, 1)
      assertEntityCorrect(rightUnderground, false)
    })
  })
  describe.each([false, true])("left, middle %s, broken right", (hasMiddle) => {
    let leftUnderground: ProjectEntity<BlueprintEntity>
    let rightUnderground: ProjectEntity<UndergroundBeltEntity>
    let leftWorldEntity: LuaEntity
    before_each(() => {
      leftUnderground = buildEntity(1, {
        name: "underground-belt",
        type: "input",
        direction: defines.direction.east,
      })

      if (hasMiddle) {
        // make an error entity in the middle
        const middle = buildEntity(1, {
          name: "underground-belt",
          type: "output",
          direction: defines.direction.east,
          position: pos.add(1, 0),
        })
        middle.destroyAllWorldOrPreviewEntities()
      }
      rightUnderground = buildEntity(1, {
        name: "underground-belt",
        type: "output",
        direction: defines.direction.east,
        position: pos.add(2, 0),
      }) as UndergroundBeltProjectEntity
      leftWorldEntity = leftUnderground.getWorldEntity(1)!
      expect(leftWorldEntity).toMatchTable({
        belt_to_ground_type: "input",
        direction: defines.direction.east,
        neighbours: rightUnderground.getWorldEntity(1)!,
      })
      // manually break right underground
      rightUnderground.setTypeProperty("input")
      rightUnderground.direction = defines.direction.west

      expect(rightUnderground.hasErrorAt(1)).toBe(true)
      expect(rightUnderground.hasErrorAt(2)).toBe(true)
      project.entityUpdates.updateAllHighlights(rightUnderground)
      assertEntityCorrect(rightUnderground, 1)
    })
    test("flipping an underground with a pair with error project.updates highlight on pair", () => {
      // rotate left
      leftWorldEntity.rotate({ by_player: player })
      expect(leftUnderground).toMatchTable({
        firstValue: { type: "output" },
        direction: defines.direction.west,
      })
      expect(rightUnderground).toMatchTable({
        firstValue: { type: "input" },
        direction: defines.direction.west,
      })

      assertEntityCorrect(leftUnderground, false)
      assertEntityCorrect(rightUnderground, false)
    })
    test("flipping pair with broken underground at higher stage still disallows rotation", () => {
      const leftWorldEntity2 = leftUnderground.getWorldEntity(2)!
      leftWorldEntity2.rotate({ by_player: player })
      expect(leftUnderground).toMatchTable({
        firstValue: { type: "input" },
        direction: defines.direction.east,
      })
      expect(rightUnderground).toMatchTable({
        firstValue: { type: "input" },
        direction: defines.direction.west,
      })
      expect(leftWorldEntity).toMatchTable({
        belt_to_ground_type: "input",
        direction: defines.direction.east,
      })
      // not changed
      expect(leftUnderground.getWorldEntity(2)).toMatchTable({
        belt_to_ground_type: "input",
        direction: defines.direction.east,
      })
      // still broken
      expect(rightUnderground.getWorldEntity(2)).toMatchTable({
        belt_to_ground_type: "output",
        direction: defines.direction.east,
      })
      expect(rightUnderground.hasErrorAt(1)).toBe(true)
      expect(rightUnderground.hasErrorAt(2)).toBe(true)

      assertEntityCorrect(leftUnderground, false)
      assertEntityCorrect(rightUnderground, 1)
    })
  })
  test("calling refresh entity on an broken underground fixes it", () => {
    const underground = buildEntity(1, {
      name: "underground-belt",
      type: "input",
      direction: defines.direction.east,
    })
    assert(underground.getWorldEntity(1)!.rotate())
    project.entityUpdates.refreshWorldEntityAtStage(underground, 1)
    expect(underground).toMatchTable({
      firstValue: { type: "input" },
      direction: defines.direction.east,
    })
    assertEntityCorrect(underground, false)
  })
  test("using cleanup tool on an broken underground fixes it", () => {
    const underground = buildEntity(1, {
      name: "underground-belt",
      type: "input",
      direction: defines.direction.east,
    })
    assert(underground.getWorldEntity(1)!.rotate())
    Events.raiseFakeEventNamed("on_player_selected_area", {
      player_index: 1 as PlayerIndex,
      item: Prototypes.CleanupTool,
      surface: surfaces[0],
      area: BBox.around(pos, 10),
      entities: [underground.getWorldEntity(1)!],
      tiles: [],
    })
    expect(underground).toMatchTable({
      firstValue: { type: "input" },
      direction: defines.direction.east,
    })
    assertEntityCorrect(underground, false)
  })
  test("using cleanup tool on broken pair fixes it", () => {
    const left = buildEntity(1, {
      name: "underground-belt",
      type: "input",
      direction: defines.direction.east,
    })
    const right = buildEntity(1, {
      name: "underground-belt",
      type: "output",
      direction: defines.direction.east,
      position: pos.add(1, 0),
    })
    assert(left.getWorldEntity(1)!.rotate())
    expect(right.hasErrorAt(1)).toBe(true)

    Events.raiseFakeEventNamed("on_player_selected_area", {
      player_index: 1 as PlayerIndex,
      item: Prototypes.CleanupTool,
      surface: surfaces[0],
      area: BBox.around(pos, 10),
      entities: [left.getWorldEntity(1)!],
      tiles: [],
    })

    assertEntityCorrect(left, false)
    assertEntityCorrect(right, false)
  })

  describe("pasting an underground", () => {
    before_each(() => {
      const stack = player.cursor_stack!
      stack.set_stack("blueprint")
      stack.set_blueprint_entities([
        {
          name: "underground-belt",
          type: "input",
          direction: defines.direction.west,
          entity_number: 1,
          position: Pos(0.5, 0.5),
        },
      ])
      player.teleport(pos, surfaces[0])
    })
    test("pasting an underground belt works", () => {
      player.build_from_cursor({
        position: pos.add(2, 0),
      })

      const builtEntity = surfaces[0].find_entity("underground-belt", pos.add(2, 0))!
      expect(builtEntity).toBeAny()

      const projEntity = project.content.findCompatibleWithLuaEntity(
        builtEntity,
        nil,
        1,
      ) as UndergroundBeltProjectEntity
      expect(projEntity).toBeAny()
      expect(projEntity).toMatchTable({
        firstValue: { type: "input" },
        direction: defines.direction.west,
      })
    })

    test.each([false, true])("pasting an underground belt that gets flipped works, with middle %s", (hasMiddle) => {
      buildEntity(1, {
        name: "underground-belt",
        type: "input",
        direction: defines.direction.east,
      })
      if (hasMiddle) {
        const entity = buildEntity(1, {
          name: "underground-belt",
          type: "output",
          direction: defines.direction.east,
          position: pos.add(1, 0),
        })
        entity.destroyAllWorldOrPreviewEntities()
      }
      player.build_from_cursor({
        position: pos.add(2, 0),
      })

      const builtEntity = surfaces[0].find_entity("underground-belt", pos.add(2, 0))!
      expect(builtEntity).toBeAny()

      // should be flipped
      const projEntity = project.content.findCompatibleWithLuaEntity(
        builtEntity,
        nil,
        1,
      ) as UndergroundBeltProjectEntity
      expect(projEntity).toBeAny()
      expect(projEntity).toMatchTable({
        firstValue: { type: "output" },
        direction: defines.direction.east,
      })
    })
  })

  describe("upgrading underground via blueprint paste", () => {
    let underground: UndergroundBeltProjectEntity
    before_each(() => {
      player.mod_settings[Settings.UpgradeOnPaste] = { value: true }
      underground = buildEntity(1, {
        name: "underground-belt",
        type: "input",
        direction: defines.direction.east,
      }) as UndergroundBeltProjectEntity
      const stack = player.cursor_stack!
      stack.set_stack("blueprint")
      stack.set_blueprint_entities([
        {
          name: "fast-underground-belt",
          type: "input",
          direction: defines.direction.east,
          entity_number: 1,
          position: Pos(0.5, 0.5),
        },
        {
          name: "small-electric-pole",
          entity_number: 2,
          position: Pos(1.5, 1.5),
        },
      ])
      stack.blueprint_snap_to_grid = [1, 1]
      stack.blueprint_absolute_snapping = true
      player.teleport(pos, surfaces[0])
    })
    after_each(() => {
      player.mod_settings[Settings.UpgradeOnPaste] = { value: false }
    })
    test("can upgrade underground belt via paste", () => {
      player.build_from_cursor({ position: pos, alt: true })
      expect(underground).toMatchTable({
        firstValue: { name: "fast-underground-belt", type: "input" },
        direction: defines.direction.east,
      })
      expect(underground.getWorldEntity(1)).toMatchTable({
        name: "fast-underground-belt",
        belt_to_ground_type: "input",
        direction: defines.direction.east,
      })
    })
    test("can upgrade underground in flipped direction", () => {
      underground.getWorldEntity(1)!.rotate({ by_player: player })
      player.build_from_cursor({ position: pos, alt: true })

      expect(underground).toMatchTable({
        firstValue: { name: "fast-underground-belt", type: "output" },
        direction: defines.direction.west,
      })
    })
    test("does not upgrade underground belt in wrong direction", () => {
      underground.setTypeProperty("output")
      project.entityUpdates.refreshAllWorldEntities(underground)
      player.build_from_cursor({ position: pos, alt: true })

      expect(underground).toMatchTable({
        firstValue: { name: "underground-belt", type: "output" },
        direction: defines.direction.east,
      })
    })
  })
})

describe("poles and wire connections", () => {
  function setupPole(stage: StageNumber, args: Partial<SurfaceCreateEntity> = {}) {
    return buildEntity(stage, { name: "medium-electric-pole", position: pos.minus(Pos(0, 1)), ...args })
  }
  function setupPole2(stage: StageNumber) {
    return setupPole(stage, {
      position: pos.minus(Pos(0, 2)),
    })
  }

  test("saves initial cable connections", () => {
    const pole1 = setupPole(3)
    const pole2 = setupPole2(3)
    expect(pole1.cableConnections?.has(pole2)).toBe(true)
    expect(pole2.cableConnections?.has(pole1)).toBe(true)
    assertEntityCorrect(pole1, false)
    assertEntityCorrect(pole2, false)
  })

  test("saves initial cable connections to a pole in higher stage", () => {
    const pole1 = setupPole(4)
    const pole2 = setupPole2(3) // should connect to pole1
    expect(pole1.cableConnections?.has(pole2)).toBe(true)
    expect(pole2.cableConnections?.has(pole1)).toBe(true)
    assertEntityCorrect(pole1, false)
    assertEntityCorrect(pole2, false)
  })

  test("disconnect and connect cables", () => {
    const pole1 = setupPole(3)
    const pole2 = setupPole2(3)
    pole1.getWorldEntity(3)!.disconnect_neighbour(pole2.getWorldEntity(3))
    project.updates.updateWiresFromWorld(pole1, 3)

    expect(pole1.cableConnections?.has(pole2)).toBeFalsy()
    expect(pole2.cableConnections?.has(pole1)).toBeFalsy()
    assertEntityCorrect(pole1, false)
    assertEntityCorrect(pole2, false)

    pole1.getWorldEntity(3)!.connect_neighbour(pole2.getWorldEntity(3)!)
    project.updates.updateWiresFromWorld(pole1, 3)

    expect(pole1.cableConnections?.has(pole2)).toBe(true)
    expect(pole2.cableConnections?.has(pole1)).toBe(true)
    assertEntityCorrect(pole1, false)
    assertEntityCorrect(pole2, false)
  })

  test("connect and disconnect circuit wires", () => {
    const inserter = buildEntity(3) // is filter inserter
    const pole = setupPole(3)
    pole.getWorldEntity(3)!.connect_neighbour({
      wire: defines.wire_type.red,
      target_entity: inserter.getWorldEntity(3)!,
    })
    project.updates.updateWiresFromWorld(pole, 3)

    const expectedConnection = next(inserter.circuitConnections!.get(pole)!)[0] as ProjectCircuitConnection
    expect(expectedConnection).toBeAny()
    expect(
      circuitConnectionEquals(
        {
          wire: defines.wire_type.red,
          fromEntity: pole,
          toEntity: inserter,
          fromId: 1,
          toId: 1,
        },
        expectedConnection,
      ),
    ).toBe(true)

    assertEntityCorrect(inserter, false)
    assertEntityCorrect(pole, false)
  })
})

describe("train entities", () => {
  function assertTrainEntityCorrect(entity: RollingStockProjectEntity, expectedHasError: number | false) {
    assertEntityCorrect(entity, expectedHasError)
  }

  test("create train entity", () => {
    const train = createRollingStock(surfaces[3 - 1])
    const entity = project.updates.addNewEntity(train, 3)!
    expect(entity).toBeAny()
    assertTrainEntityCorrect(entity, false)
  })
  test("train entity error", () => {
    const train = createRollingStock(surfaces[3 - 1])
    const entity = project.updates.addNewEntity(train, 3)!
    train.destroy()
    surfaces[3 - 1].find_entities().forEach((e) => e.destroy()) // destroys rails too, so train cannot be re-created

    project.entityUpdates.refreshAllWorldEntities(entity)
    assertTrainEntityCorrect(entity, 3)
  })
})

describe("circuit connections", () => {
  test("adding wire in higher stage sets empty control behavior", () => {
    const inserter = buildEntity(3) // is filter inserter
    const belt = buildEntity(2, { name: "transport-belt", position: pos.minus(Pos(0, 1)) })
    project.entityUpdates.refreshWorldEntityAtStage(inserter, 4)
    project.entityUpdates.refreshWorldEntityAtStage(belt, 4)
    const inserter4 = inserter.getWorldEntity(4)!
    const belt4 = belt.getWorldEntity(4)!

    inserter4.connect_neighbour({
      wire: defines.wire_type.red,
      target_entity: belt4,
    })
    project.updates.updateWiresFromWorld(inserter, 4)

    const connections = inserter.circuitConnections!
    expect(connections).toBeAny()
    const connection = next(connections.get(belt)!)[0] as ProjectCircuitConnection
    expect(connection).toBeAny()
    expect(
      circuitConnectionEquals(connection, {
        wire: defines.wire_type.red,
        fromEntity: inserter,
        toEntity: belt,
        fromId: 1,
        toId: 1,
      }),
    ).toBe(true)

    expect(inserter.firstValue.control_behavior).toBe(emptyInserterControlBehavior)
    expect(belt.firstValue.control_behavior).toBe(emptyBeltControlBehavior)

    expect(inserter.getStageDiff(4)!.control_behavior).toBeTruthy()
    expect(belt.getStageDiff(4)!.control_behavior).toBeTruthy()

    assertEntityCorrect(inserter, false)
    assertEntityCorrect(belt, false)
  })

  test.each([1, 2])("paste a chain of circuit wires over existing power poles, stage %s", (stage) => {
    const pole1 = buildEntity(stage, { name: "small-electric-pole", position: pos })
    const pole2 = buildEntity(stage, { name: "small-electric-pole", position: pos.plus(Pos(4, 0)) })
    const pole3 = buildEntity(stage, { name: "small-electric-pole", position: pos.plus(Pos(8, 0)) })

    const bpEntities: BlueprintEntity[] = [
      {
        entity_number: 1,
        name: "small-electric-pole",
        position: pos,
        connections: { "1": { red: [{ entity_id: 2 }] } },
      },
      {
        entity_number: 2,
        name: "small-electric-pole",
        position: pos.plus(Pos(4, 0)),
        connections: { "1": { red: [{ entity_id: 1 }, { entity_id: 3 }] } },
      },
      {
        entity_number: 3,
        name: "small-electric-pole",
        position: pos.plus(Pos(8, 0)),
        connections: { "1": { red: [{ entity_id: 2 }] } },
      },
    ]
    const stack = player.cursor_stack!
    stack.set_stack("blueprint")
    stack.set_blueprint_entities(bpEntities)

    player.teleport([0, 0], surfaces[stage - 1])
    player.build_from_cursor({ position: pos.plus(Pos(4, 0)) })

    // should have 2 cable connections

    const connection1 = pole1.circuitConnections?.get(pole2)
    expect(connection1).not.toBeNil()
    const connection21 = pole2.circuitConnections?.get(pole1)
    expect(connection21).not.toBeNil()
    const connection23 = pole2.circuitConnections?.get(pole3)
    expect(connection23).not.toBeNil()
    const connection3 = pole3.circuitConnections?.get(pole2)
    expect(connection3).not.toBeNil()

    assertEntityCorrect(pole1, false)
    assertEntityCorrect(pole2, false)
    assertEntityCorrect(pole3, false)
  })
})
describe("blueprinting", () => {
  test("can build a entity using known value", () => {
    const luaEntity = createEntity(1, { name: "transport-belt", position: pos, direction: defines.direction.east })
    const entity = project.updates.addNewEntity(luaEntity, 1, {
      entity_number: 1,
      name: "transport-belt",
      position: pos,
      direction: defines.direction.east,
      override_stack_size: 1,
    })!
    expect(entity).toMatchTable({
      firstStage: 1,
      firstValue: {
        name: "transport-belt",
        override_stack_size: 1,
      },
    })
  })

  test.each([true, false])("can maybe upgrade entity via blueprint, with setting %s", (enabled) => {
    player.mod_settings[Settings.UpgradeOnPaste] = { value: enabled }
    const bpEntity: BlueprintEntity = {
      entity_number: 1,
      name: "fast-inserter",
      position: Pos(0.5, 0.5),
      direction: direction.west,
    }
    const entity = buildEntity(1, { name: "inserter", position: pos, direction: direction.west })
    const stack = player.cursor_stack!
    stack.set_stack("blueprint")
    stack.blueprint_snap_to_grid = [1, 1]
    stack.blueprint_absolute_snapping = true
    stack.set_blueprint_entities([
      bpEntity,
      {
        entity_number: 2,
        name: "transport-belt",
        position: Pos(0, 2),
        direction: direction.south,
      },
    ])

    player.teleport([0, 0], surfaces[0])
    player.build_from_cursor({ position: pos, alt: true })

    const expected = enabled ? "fast-inserter" : "inserter"
    expect(entity.firstValue).toMatchTable({ name: expected })
    expect(entity.getWorldEntity(1)).toMatchTable({ name: expected })
  })

  test("can upgrade entity with wires via blueprint", () => {
    player.mod_settings[Settings.UpgradeOnPaste] = { value: true }
    const entity1: BlueprintEntity = {
      entity_number: 1,
      name: "fast-inserter",
      position: Pos(0.5, 0.5),
      direction: direction.west,
      connections: {
        1: {
          red: [{ entity_id: 2, circuit_id: 1 }],
        },
      },
    }
    const entity2: BlueprintEntity = {
      entity_number: 2,
      name: "transport-belt",
      position: Pos(0, 2),
      direction: direction.south,
      connections: {
        1: {
          red: [{ entity_id: 1, circuit_id: 1 }],
        },
      },
    }
    const entity = buildEntity(1, { name: "inserter", position: pos, direction: direction.west })
    const stack = player.cursor_stack!
    stack.set_stack("blueprint")
    stack.blueprint_snap_to_grid = [1, 1]
    stack.blueprint_absolute_snapping = true
    stack.set_blueprint_entities([entity1, entity2])

    player.teleport([0, 0], surfaces[0])
    player.build_from_cursor({ position: pos, alt: true })

    const expected = "fast-inserter"
    expect(entity.firstValue).toMatchTable({ name: expected })
    expect(entity.getWorldEntity(1)).toMatchTable({ name: expected })
    expect(entity.circuitConnections).not.toBeNil()
  })

  describe.each([defines.direction.north, defines.direction.northeast])("with rail direction %d", (diag) => {
    test.each([defines.direction.east, defines.direction.south])(
      "can paste a straight rail in all rotations",
      (direction) => {
        const entity: BlueprintEntity = {
          entity_number: 1,
          name: "straight-rail",
          position: Pos(1, 1),
          direction: diag,
        }
        const stack = player.cursor_stack!
        stack.set_stack("blueprint")
        stack.blueprint_snap_to_grid = [2, 2]
        stack.blueprint_absolute_snapping = true
        stack.set_blueprint_entities([entity])

        const pos = Pos(5, 5)
        player.teleport([0, 0], surfaces[0])
        player.build_from_cursor({ position: pos, direction, alt: true })

        const rail = surfaces[0].find_entity("straight-rail", pos)!
        expect(rail).not.toBeNil()
        let expected = (diag + direction) % 8
        if (expected == 4 || expected == 6) expected -= 4 // left=right, up=down
        expect(rail.direction).toEqual(expected)

        const projectEntity = project.content.findCompatibleWithLuaEntity(rail, nil, 1)

        expect(projectEntity).not.toBeNil()
        expect(projectEntity!.getWorldEntity(1)).toEqual(rail)

        expect(projectEntity!.direction).toEqual(expected)
      },
    )
  })

  test("pasting diagonal rail at same position but different direction", () => {
    const entity: BlueprintEntity = {
      entity_number: 1,
      name: "straight-rail",
      position: Pos(1, 1),
      direction: defines.direction.northeast,
    }
    const stack = player.cursor_stack!
    stack.set_stack("blueprint")
    stack.blueprint_snap_to_grid = [2, 2]
    stack.blueprint_absolute_snapping = true
    stack.set_blueprint_entities([entity])

    const pos = Pos(5, 5)
    player.teleport([0, 0], surfaces[0])

    player.build_from_cursor({ position: pos, direction: defines.direction.north, alt: true })
    const rail = surfaces[0].find_entities_filtered({
      name: "straight-rail",
      position: pos,
      radius: 0,
      direction: defines.direction.northeast,
    })[0]
    expect(rail).not.toBeNil()

    player.build_from_cursor({ position: pos, direction: defines.direction.south, alt: true })
    const rail2 = surfaces[0].find_entities_filtered({
      name: "straight-rail",
      position: pos,
      radius: 0,
      direction: defines.direction.southwest,
    })[0]
    expect(rail2).not.toBeNil()

    const entity1 = project.content.findCompatibleWithLuaEntity(rail, nil, 1)
    const entity2 = project.content.findCompatibleWithLuaEntity(rail2, nil, 1)
    expect(entity1).not.toBeNil()
    expect(entity2).not.toBeNil()

    expect(entity1!.direction).toEqual(defines.direction.northeast)
    expect(entity2!.direction).toEqual(defines.direction.southwest)

    expect(entity1!.getWorldEntity(1)).toEqual(rail)
    expect(entity2!.getWorldEntity(1)).toEqual(rail2)
  })

  describe.each([
    "straight-rail",
    "stone-furnace",
    "storage-tank",
    "assembling-machine-1",
    "small-electric-pole",
    "boiler",
    "underground-belt",
  ])("can paste %s", (entityName) => {
    describe.each([defines.direction.east, defines.direction.south])("at direction %d", (entityDirection) => {
      test.each([defines.direction.north, defines.direction.west])("pasted at direction %d", (pasteDirection) => {
        const bboxSize = BBox.size(game.entity_prototypes[entityName].collision_box)
        const pos = Pos(bboxSize.x % 2 == 0 ? 0 : 0.5, bboxSize.y % 2 == 0 ? 0 : 0.5)

        const entity: BlueprintEntity = {
          entity_number: 1,
          name: entityName,
          position: pos,
          direction: entityDirection,
        }
        const stack = player.cursor_stack!
        stack.set_stack("blueprint")
        stack.set_blueprint_entities([entity])
        player.teleport([0, 0], surfaces[0])
        player.build_from_cursor({
          position: Pos(0, 0),
          direction: pasteDirection,
          alt: true,
        })
        const luaEntity = surfaces[0].find_entity(entityName, pos)!
        expect(luaEntity).not.toBeNil()

        const entity1 = project.content.findCompatibleWithLuaEntity(luaEntity, nil, 1)!
        expect(entity1).not.toBeNil()
        expect(entity1.direction).toEqual(luaEntity.direction)
        expect(entity1.getWorldEntity(1)).toEqual(luaEntity)

        assertEntityCorrect(entity1, false)
      })
    })
  })

  test("pasting rotate blueprint with a rotated fluid tank", () => {
    const entity: BlueprintEntity = {
      entity_number: 1,
      name: "storage-tank",
      position: Pos(0, 0),
      direction: 2,
    }
    const stack = player.cursor_stack!
    stack.set_stack("blueprint")
    stack.set_blueprint_entities([entity])

    const pos = Pos(5, 5)

    player.teleport([0, 0], surfaces[0])
    player.build_from_cursor({ position: pos, direction: 2, alt: true })
    const tank = surfaces[0].find_entity("storage-tank", pos)!
    expect(tank).not.toBeNil()

    expect(tank.direction).toBe(0)

    const entity1 = project.content.findCompatibleWithLuaEntity(tank, nil, 1)!
    expect(entity1).not.toBeNil()
    expect(entity1.direction).toEqual(0)
    expect(entity1.getWorldEntity(1)).toEqual(tank)

    assertEntityCorrect(entity1, false)
  })

  test("can paste a power pole at a lower stage to move", () => {
    const pole = buildEntity(3, { name: "medium-electric-pole", position: Pos(0.5, 0.5) })

    const entity: BlueprintEntity = {
      entity_number: 1,
      name: "medium-electric-pole",
      position: Pos(0.5, 0.5),
    }

    const stack = player.cursor_stack!
    stack.set_stack("blueprint")
    stack.set_blueprint_entities([entity])

    player.teleport([0, 0], surfaces[2 - 1])
    player.build_from_cursor({ position: Pos(0.5, 0.5), direction: 0, alt: true })
    // should move to stage 2

    const pole2 = surfaces[2 - 1].find_entity("medium-electric-pole", Pos(0.5, 0.5))!
    expect(pole2).not.toBeNil()

    expect(pole.firstStage).toBe(2)
    expect(pole.getWorldEntity(2)).toEqual(pole2)

    assertEntityCorrect(pole, false)
  })
})

describe("power switch", () => {
  test("connecting power switch", () => {
    const pole = buildEntity(2, { name: "medium-electric-pole", position: Pos(0, 0) })
    const powerSwitch = buildEntity(1, { name: "power-switch", position: Pos(2, 0) })

    const poleLuaEntity = pole.getWorldEntity(2)!
    poleLuaEntity.connect_neighbour({
      wire: defines.wire_type.copper,
      target_entity: powerSwitch.getWorldEntity(2)!,
      target_wire_id: defines.wire_connection_id.power_switch_right,
    })

    project.actions.onWiresPossiblyUpdated(poleLuaEntity, 2, player.index)

    assertEntityCorrect(pole, false)
    assertEntityCorrect(powerSwitch, false)
  })

  test("connecting power switch to new pole in higher stage", () => {
    const pole1 = buildEntity(1, { name: "medium-electric-pole", position: Pos(0, 0) })
    const powerSwitch = buildEntity(1, { name: "power-switch", position: Pos(2, 0) })
    const pole2 = buildEntity(2, { name: "medium-electric-pole", position: Pos(4, 0) })

    const pole1LuaEntity = pole1.getWorldEntity(1)!
    pole1LuaEntity.connect_neighbour({
      wire: defines.wire_type.copper,
      target_entity: powerSwitch.getWorldEntity(1)!,
      target_wire_id: defines.wire_connection_id.power_switch_right,
    })

    project.actions.onWiresPossiblyUpdated(pole1LuaEntity, 1, player.index)
    assertEntityCorrect(pole1, false)
    assertEntityCorrect(pole2, false)
    assertEntityCorrect(powerSwitch, false)

    const pole2LuaEntity = pole2.getWorldEntity(3)!
    pole2LuaEntity.connect_neighbour({
      wire: defines.wire_type.copper,
      target_entity: powerSwitch.getWorldEntity(3)!,
      target_wire_id: defines.wire_connection_id.power_switch_right,
    })

    project.actions.onWiresPossiblyUpdated(pole2LuaEntity, 3, player.index)
    assertEntityCorrect(pole1, false)
    assertEntityCorrect(pole2, false)
    assertEntityCorrect(powerSwitch, false)
  })
})

test("rebuildStage", () => {
  const entityPresent = buildEntity(2, { name: "inserter", position: pos.add(1, 0), direction: direction.west })
  const entityPreview = buildEntity(3, { name: "inserter", position: pos.add(2, 0), direction: direction.west })
  const entityPastLastStage = buildEntity(1, { name: "inserter", position: pos.add(3, 0), direction: direction.west })
  expect(project.updates.trySetLastStage(entityPastLastStage, 1)).toEqual(StageMoveResult.Updated)
  entityPresent._applyDiffAtStage(4, { name: "stack-filter-inserter" })
  project.entityUpdates.refreshAllWorldEntities(entityPresent)
  assertEntityCorrect(entityPresent, false)

  for (const stage of $range(1, 6)) {
    project.entityUpdates.rebuildStage(stage)

    assertEntityCorrect(entityPresent, false)
    assertEntityCorrect(entityPreview, false)
    assertEntityCorrect(entityPastLastStage, false)
  }
})

// bobinserters support
if ("bobinserters" in script.active_mods) {
  test("when pasting a inserter with adjustable pickup/dropoff, it gets the correct values", () => {
    const stack = player.cursor_stack!
    stack.set_stack("blueprint")
    stack.set_blueprint_entities([
      {
        entity_number: 1,
        name: "inserter",
        position: Pos(0.5, 0.5),
        direction: direction.north,
        pickup_position: Pos(2, 1),
        drop_position: Pos(1, 2),
      },
    ])
    player.teleport(pos, surfaces[3 - 1])

    player.build_from_cursor({ position: pos, alt: true, direction: direction.west }) // rotated 90 CC

    const builtEntity = surfaces[3 - 1].find_entity("inserter", pos)!
    expect(builtEntity).toBeAny()

    const projEntity = project.content.findCompatibleWithLuaEntity(builtEntity, nil, 1)!

    const rotatedPickupPos = Pos(1, -2)
    const rotatedDropPos = Pos(2, -1)

    expect(projEntity).toBeAny()
    expect(projEntity).toMatchTable({
      firstValue: {
        pickup_position: rotatedPickupPos,
        drop_position: rotatedDropPos,
      },
      direction: direction.west,
    })
    expect(builtEntity.pickup_position).toEqual(rotatedPickupPos.plus(pos))
    expect(builtEntity.drop_position).toEqual(rotatedDropPos.plus(pos))

    assertEntityCorrect(projEntity, false)
  })

  test("when rotating an inserter, the pickup and drop positions also rotate", () => {
    const entity = buildEntity(3, {
      name: "inserter",
      position: pos,
      direction: direction.north,
    })
    entity.setPickupPosition(Pos(2, 1))
    entity.setDropPosition(Pos(1, 2))
    const worldEntity = entity.getWorldEntity(3)!
    worldEntity.pickup_position = pos.plus(Pos(2, 1))
    worldEntity.drop_position = pos.plus(Pos(1, 2))

    worldEntity.rotate({ by_player: player, reverse: true })

    const rotatedPickupPos = Pos(1, -2)
    const rotatedDropPos = Pos(2, -1)

    expect(entity).toMatchTable({
      direction: direction.west,
      firstValue: {
        pickup_position: rotatedPickupPos,
        drop_position: rotatedDropPos,
      },
    })
    expect(worldEntity.pickup_position).toEqual(rotatedPickupPos.plus(pos))
    expect(worldEntity.drop_position).toEqual(rotatedDropPos.plus(pos))

    assertEntityCorrect(entity, false)
  })
}

describe("map gen settings", () => {
  test("rebuild stage after sync map gen settings", () => {
    const entity = buildEntity(1, { name: "inserter", position: pos, direction: direction.west })
    assertEntityCorrect(entity, false)
    surfaces[0].generate_with_lab_tiles = false
    player.teleport(pos, surfaces[0])
    syncMapGenSettings(project.getStage(1)!)
    after_ticks(60, () => {
      assertEntityCorrect(entity, false)
    })
  })
  test("adding a new stage gets the same map settings as previous stage", () => {
    surfaces[2].map_gen_settings = {
      ...surfaces[2].map_gen_settings,
      seed: 42,
    }
    surfaces[2].generate_with_lab_tiles = false
    project.insertStage(4)
    expect(project.getSurface(4)).toMatchTable({
      map_gen_settings: { seed: 42 },
      generate_with_lab_tiles: false,
    })
    surfaces[2].generate_with_lab_tiles = true
  })
})
