import { assertNever, bind, RegisterClass } from "../lib"
import { Subscription } from "../lib/observable"
import { Assembly, AssemblyChangeEvent, Layer } from "./Assembly"

/**
 * Manages in-world outlines and labels.
 */
@RegisterClass("AssemblyDisplay")
class AssemblyDisplay {
  private highlights: [number, number][] = []
  private subscription: Subscription | undefined = new Subscription()

  public invoke(_: Subscription, event: AssemblyChangeEvent) {
    if (event.type === "layer-pushed") {
      this.createHighlightsForNewLayer(event.layer)
    } else if (event.type === "assembly-deleted") {
      this.removeAllHighlights()
    } else {
      assertNever(event)
    }
  }
  private createHighlightsForNewLayer(layer: Layer): void {
    if (!this.subscription) return
    const { surface, left_top, right_bottom } = layer
    const boxId = rendering.draw_rectangle({
      color: [1, 1, 1, 0.5],
      width: 4,
      filled: false,
      left_top,
      right_bottom,
      surface,
      draw_on_ground: true,
    })

    const textId = rendering.draw_text({
      text: layer.displayName.get(),
      surface,
      target: left_top,
      color: [1, 1, 1],
      font: "default",
      scale: 1.5,
      alignment: "left",
      scale_with_zoom: true,
    })
    this.highlights.push([boxId, textId])

    layer.displayName.subscribe(this.subscription!, bind(AssemblyDisplay.onLayerNameChange, textId))
  }

  private static onLayerNameChange(this: void, id: number, _: unknown, name: LocalisedString): void {
    rendering.set_text(id, name)
  }

  private removeAllHighlights(): void {
    if (!this.subscription) return
    this.subscription.close()
    this.subscription = nil
    for (const [boxId, textId] of this.highlights) {
      rendering.destroy(boxId)
      rendering.destroy(textId)
    }
    this.highlights = []
  }
}

export function setupAssemblyDisplay(assembly: Assembly): void {
  assembly.events.subscribeIndependently(new AssemblyDisplay())
}
