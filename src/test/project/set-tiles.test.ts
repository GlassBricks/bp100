/*
 * Copyright (c) 2023 GlassBricks
 * This file is part of Staged Blueprint Planning.
 *
 * Staged Blueprint Planning is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Staged Blueprint Planning is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License along with Staged Blueprint Planning. If not, see <https://www.gnu.org/licenses/>.
 */

import { LuaSurface } from "factorio:runtime"
import expect from "tstl-expect"
import { Events } from "../../lib"
import { BBox, Pos } from "../../lib/geometry"
import { setTiles, setTilesAndCheckerboard, setTilesAndWater, setTilesAndWaterForStage } from "../../project/set-tiles"
import { createUserProject } from "../../project/UserProject"
import { fStub } from "../f-mock"

let surface: LuaSurface
before_each(() => {
  surface = game.surfaces[1]
  surface.build_checkerboard(bbox.expand(20))
  surface.find_entities().forEach((entity) => entity.destroy())
})

const bbox = BBox.around({ x: 0, y: 0 }, 10)
after_each(() => {
  surface.build_checkerboard(bbox.expand(20))
  surface.find_entities().forEach((entity) => entity.destroy())
})

let eventCount = 0
Events.script_raised_set_tiles(() => {
  eventCount++
})
before_each(() => {
  eventCount = 0
})
test("setTiles", () => {
  const result = setTiles(surface, bbox, "stone-path")
  expect(result).toBe(true)
  for (const tile of surface.find_tiles_filtered({ area: bbox })) {
    expect(tile).toMatchTable({
      name: "stone-path",
    })
  }
  expect(eventCount).toBe(1)
})

test("setTilesAndWater", () => {
  setTiles(surface, bbox, "lab-white")
  eventCount = 0
  assert(
    surface.create_entity({
      name: "iron-chest",
      position: { x: 0.5, y: 0.5 },
    }),
  )

  const [result, freeTiles] = setTilesAndWater(surface, bbox, "stone-path")
  expect(result).toBe(true)
  for (const tile of surface.find_tiles_filtered({ area: bbox })) {
    const expectedTile = Pos.isZero(tile.position) ? "stone-path" : "water"
    expect(tile).toMatchTable({
      name: expectedTile,
    })
  }
  expect(freeTiles).not.toContainEqual(
    expect.tableContaining({
      position: { x: 0, y: 0 },
    }),
  )
  expect(freeTiles).toContainEqual(
    expect.tableContaining({
      position: { x: 0, y: 1 },
    }),
  )

  expect(eventCount).toBe(1)
})

test("setTilesAndWater, nonexistent tile", () => {
  const result = setTilesAndWater(surface, bbox, "this doesn't exist")
  expect(result).toEqual([false])
})

test("setTilesAndCheckerboard", () => {
  setTiles(surface, bbox, "lab-white")
  assert(
    surface.create_entity({
      name: "iron-chest",
      position: { x: 0.5, y: 0.5 },
    }),
  )
  eventCount = 0

  const [result, freeTiles] = setTilesAndCheckerboard(surface, bbox, "stone-path")
  expect(result).toBe(true)
  for (const tile of surface.find_tiles_filtered({ area: bbox })) {
    if (Pos.isZero(tile.position)) {
      expect(tile).toMatchTable({
        name: "stone-path",
      })
    } else {
      expect(tile).toMatchTable({
        name: expect.stringMatching("^lab%-"),
      })
    }
  }

  expect(freeTiles).not.toContainEqual(
    expect.tableContaining({
      position: { x: 0, y: 0 },
    }),
  )
  expect(freeTiles).toContainEqual(
    expect.tableContaining({
      position: { x: 0, y: 1 },
    }),
  )

  expect(eventCount).toBe(1)
})

test("setTilesAndWater with staged tiles enabled", () => {
  const project = createUserProject("test", 2)
  const updates = fStub(project.updates)
  project.stagedTilesEnabled.set(true)

  setTilesAndWaterForStage(project.getStage(1)!)
  expect(updates.ensureAllTilesNotPresentAtStage).toHaveBeenCalledWith(expect.anything(), 1)
})
