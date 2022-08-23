// Generated by gen-locale-defs.ts
// noinspection JSUnusedGlobalSymbols

export declare const enum L_ItemName {
  /** Assembly cleanup tool */
  CleanupTool = "item-name.bp3:cleanup-tool",
  /** Assembly creation tool */
  AssemblyAddTool = "item-name.bp3:assembly-add-tool",
}
export declare const enum L_ShortcutName {
  /** Assembly cleanup tool */
  CleanupTool = "shortcut-name.bp3:cleanup-tool",
  /** Create new assembly */
  AssemblyAddTool = "shortcut-name.bp3:assembly-add-tool",
}
export declare const enum L_EntityName {
  /** Blueprint entity marker */
  EntityMarker = "entity-name.bp3:entity-marker",
}
export declare const enum L_ItemGroupName {
  /** BP3 utility entities */
  Utility = "item-group-name.bp3:utility",
}
export declare const enum L_ModSettingName {
  /** Use cyclic layer navigation */
  CyclicNavigation = "mod-setting-name.bp3:cyclic-navigation",
}
export declare const enum L_Controls {
  /** Next layer */
  NextLayer = "controls.bp3:next-layer",
  /** Previous layer */
  PreviousLayer = "controls.bp3:previous-layer",
  /** Go to entity's first layer */
  GoToBaseLayer = "controls.bp3:go-to-base-layer",
  /** Go to entity's next notable layer */
  GoToNextNotableLayer = "controls.bp3:go-to-next-notable-layer",
}
export declare const enum L_Bp3 {
  /** __1__ (preview) */
  PreviewEntity = "bp3.preview-entity",
  /** __1__ (selection proxy) */
  SelectionProxy = "bp3.selection-proxy",
}
export declare const enum L_Interaction {
  /** An unexpected error occurred: __1__. Additional details outputted to log. Please report this to the mod author! */
  UnexpectedError = "bp3.interaction.unexpected-error",
  /** This area intersects assembly __1__ (possibly on a different surface) */
  AreaIntersectsWithOtherAssembly = "bp3.interaction.area-intersects-with-other-assembly",
  /** WARNING: this blueprint is not handled. Entities that have changed settings due to pasting this blueprint will not be detected in assemblies (newly created entities are fine).\nTo fix, make a copy of the blueprint (if it is in the blueprint library) and paste again. */
  BlueprintNotHandled = "bp3.interaction.blueprint-not-handled",
  /** Entity moved down from __1__ */
  EntityMovedFromLayer = "bp3.interaction.entity-moved-from-layer",
  /** Entity moved back up to __1__ */
  EntityMovedBackToLayer = "bp3.interaction.entity-moved-back-to-layer",
  /** Not in an assembly */
  PlayerNotInAssembly = "bp3.interaction.player-not-in-assembly",
  /** Entity is not in an assembly */
  EntityNotInAssembly = "bp3.interaction.entity-not-in-assembly",
  /** No next layer */
  NoNextLayer = "bp3.interaction.no-next-layer",
  /** No previous layer */
  NoPreviousLayer = "bp3.interaction.no-previous-layer",
  /** Already at entity's first layer */
  AlreadyAtBaseLayer = "bp3.interaction.already-at-base-layer",
}
export declare const enum L_Assembly {
  /** <Unnamed assembly __1__> */
  UnnamedAssembly = "bp3.assembly.unnamed-assembly",
  /** <Layer __1__> */
  UnnamedLayer = "bp3.assembly.unnamed-layer",
}
export declare const enum L_GuiCurrentAssembly {
  /** Assembly: */
  Assembly = "bp3.gui.current-assembly.assembly",
  /** (Not in an assembly) */
  NoAssembly = "bp3.gui.current-assembly.no-assembly",
  /** Open assembly settings */
  OpenAssemblySettings = "bp3.gui.current-assembly.open-assembly-settings",
  /** Show all assemblies */
  ShowAllAssemblies = "bp3.gui.current-assembly.show-all-assemblies",
}
export declare const enum L_GuiAllAssemblies {
  /** All assemblies */
  Title = "bp3.gui.all-assemblies.title",
  /** New assembly [img=info] */
  NewAssembly = "bp3.gui.all-assemblies.new-assembly",
  /** You can also use the "Create new assembly" shortcut (bottom right) to create a new assembly. */
  NewAssemblyTooltip = "bp3.gui.all-assemblies.new-assembly-tooltip",
}
export declare const enum L_GuiNewAssembly {
  /** New Assembly */
  Title = "bp3.gui.new-assembly.title",
  /** Name */
  Name = "bp3.gui.new-assembly.name",
  /** Initial number of layers */
  InitialNumLayers = "bp3.gui.new-assembly.initial-num-layers",
  /** Create */
  Create = "bp3.gui.new-assembly.create",
  /** Delete existing entities [img=info] */
  DeleteExistingEntities = "bp3.gui.new-assembly.delete-existing-entities",
  /** Existing entities are not yet processed (this may be a future feature). To import, paste entities after creating the assembly. */
  DeleteExistingEntitiesTooltip = "bp3.gui.new-assembly.delete-existing-entities-tooltip",
  /** Invalid specified number of layers */
  InvalidNumLayers = "bp3.gui.new-assembly.invalid-num-layers",
}
export declare const enum L_GuiAssemblySettings {
  /** Assembly */
  Title = "bp3.gui.assembly-settings.title",
  /** Rename assembly */
  RenameAssembly = "bp3.gui.assembly-settings.rename-assembly",
  /** Rename current layer */
  RenameLayer = "bp3.gui.assembly-settings.rename-layer",
  /** New layer: */
  NewLayer = "bp3.gui.assembly-settings.new-layer",
  /** Insert before current */
  InsertAboveCurrent = "bp3.gui.assembly-settings.insert-above-current",
  /** Add at end */
  AtEnd = "bp3.gui.assembly-settings.at-end",
  /** Delete assembly */
  DeleteAssembly = "bp3.gui.assembly-settings.delete-assembly",
  /** Are you sure you want to delete assembly __1__? */
  DeleteAssemblyConfirmation1 = "bp3.gui.assembly-settings.delete-assembly-confirmation1",
  /** In-world entities will not be affected. */
  DeleteAssemblyConfirmation2 = "bp3.gui.assembly-settings.delete-assembly-confirmation2",
  /** This action cannot be undone. */
  DeleteAssemblyConfirmation3 = "bp3.gui.assembly-settings.delete-assembly-confirmation3",
  /** Delete layer */
  DeleteLayer = "bp3.gui.assembly-settings.delete-layer",
  /** The first layer cannot be deleted. */
  CannotDeleteFirstLayer = "bp3.gui.assembly-settings.cannot-delete-first-layer",
  /** Are you sure you want to delete layer __1__? */
  DeleteLayerConfirmation1 = "bp3.gui.assembly-settings.delete-layer-confirmation1",
  /** Layer contents will be merged with the previous layer (__1__). */
  DeleteLayerConfirmation2 = "bp3.gui.assembly-settings.delete-layer-confirmation2",
  /** Reset layer [img=info] */
  ResetLayer = "bp3.gui.assembly-settings.reset-layer",
  /** Resets all entities in the layer to match the stored state.\nThis will delete and replace all entities.\nThis can also help resolve errors or inconsistencies due to bugs. */
  ResetLayerTooltip = "bp3.gui.assembly-settings.reset-layer-tooltip",
}
