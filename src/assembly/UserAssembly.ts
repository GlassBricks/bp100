import { LayerNumber } from "../entity/AssemblyEntity"
import { bound, Events, PRecord, reg, RegisterClass } from "../lib"
import { BBox, Pos, Vec2 } from "../lib/geometry"
import { MutableState, state, State } from "../lib/observable"
import { L_Assembly } from "../locale"
import { WorldPosition } from "../utils/world-location"
import { Assembly, Layer } from "./Assembly"

export type AssemblyId = number & { _assemblyIdBrand: never }

export interface UserAssembly extends Assembly {
  readonly id: AssemblyId

  readonly name: MutableState<string>
  readonly displayName: State<LocalisedString>

  readonly layers: readonly UserLayer[]

  readonly chunkSize: Vec2

  /** Does not do any verification */
  pushLayer(leftTop: WorldPosition): UserLayer
}

export interface UserLayer extends Layer {
  readonly name: MutableState<string>
  readonly displayName: State<LocalisedString>

  readonly assemblyId: AssemblyId
}

declare const global: {
  nextAssemblyId: AssemblyId
  assemblies: PRecord<AssemblyId, AssemblyImpl>
}
Events.on_init(() => {
  global.nextAssemblyId = 1 as AssemblyId
  global.assemblies = {}
})

@RegisterClass("Assembly")
class AssemblyImpl implements UserAssembly {
  name = state("")
  displayName: State<LocalisedString> = this.name.map(reg(this.getDisplayName))
  layers: UserLayer[] = []

  private constructor(readonly id: AssemblyId, readonly chunkSize: Vec2) {}

  static create(chunkSize: Vec2): UserAssembly {
    const id = global.nextAssemblyId++ as AssemblyId
    assert(chunkSize.x > 0 && chunkSize.y > 0, "size must be positive")
    const actualSize = Pos.ceil(chunkSize)
    return (global.assemblies[id] = new AssemblyImpl(id, actualSize))
  }
  static get(id: AssemblyId): UserAssembly | nil {
    return global.assemblies[id]
  }

  pushLayer(leftTop: WorldPosition): UserLayer {
    const nextIndex = this.layers.length + 1
    return (this.layers[nextIndex - 1] = LayerImpl.create(this, nextIndex, leftTop))
  }

  @bound
  private getDisplayName(name: string): LocalisedString {
    return name !== "" ? name : [L_Assembly.UnnamedAssembly, this.id]
  }
}

export function newAssembly(chunkSize: Vec2): UserAssembly {
  return AssemblyImpl.create(chunkSize)
}

@RegisterClass("Layer")
class LayerImpl implements UserLayer {
  name = state("")
  displayName: State<LocalisedString> = this.name.map(reg(this.getDisplayName))

  constructor(
    readonly assemblyId: AssemblyId,
    readonly surface: LuaSurface,
    readonly bbox: BBox,
    public layerNumber: LayerNumber,
  ) {}

  static create(parent: UserAssembly, layerNumber: LayerNumber, worldTopLeft: WorldPosition): LayerImpl {
    const { chunkSize } = parent
    const { surface, position: leftTop } = worldTopLeft
    const actualLeftTop = Pos.floorToNearest(leftTop, 32)
    const rightBottom = Pos.plus(actualLeftTop, Pos.times(chunkSize, 32))
    return new LayerImpl(parent.id, surface, { left_top: actualLeftTop, right_bottom: rightBottom }, layerNumber)
  }

  @bound
  private getDisplayName(name: string): LocalisedString {
    return name !== "" ? name : [L_Assembly.UnnamedLayer, this.layerNumber]
  }
}