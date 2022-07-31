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

// noinspection JSUnusedGlobalSymbols

import {
  ButtonElementSpec,
  CameraElementSpec,
  CheckboxElementSpec,
  ChooseElemButtonElementSpec,
  DropDownElementSpec,
  ElementSpec,
  EmptyWidgetElementSpec,
  EntityPreviewElementSpec,
  FlowElementSpec,
  FrameElementSpec,
  LabelElementSpec,
  LineElementSpec,
  ListBoxElementSpec,
  MinimapElementSpec,
  ProgressBarElementSpec,
  RadioButtonElementSpec,
  ScrollPaneElementSpec,
  SliderElementSpec,
  Spec,
  SpecChildren,
  SpriteButtonElementSpec,
  SwitchElementSpec,
  TabbedPaneElementSpec,
  TabElementSpec,
  TableElementSpec,
  TextBoxElementSpec,
  TextFieldElementSpec,
} from "./spec"

declare global {
  namespace JSX {
    type IntrinsicElement<T extends ElementSpec> = Omit<T, "type" | "children"> & {
      children?: SpecChildren
    }
    export type Element = Spec

    export interface ElementAttributesProperty {
      _props: any
    }
    export interface ElementChildrenAttribute {
      children: any
    }

    export interface IntrinsicElements {
      "choose-elem-button": IntrinsicElement<ChooseElemButtonElementSpec>
      "drop-down": IntrinsicElement<DropDownElementSpec>
      "empty-widget": IntrinsicElement<EmptyWidgetElementSpec>
      "entity-preview": IntrinsicElement<EntityPreviewElementSpec>
      "list-box": IntrinsicElement<ListBoxElementSpec>
      "scroll-pane": IntrinsicElement<ScrollPaneElementSpec>
      "sprite-button": IntrinsicElement<SpriteButtonElementSpec>
      "tabbed-pane": IntrinsicElement<TabbedPaneElementSpec>
      "text-box": IntrinsicElement<TextBoxElementSpec>
      button: IntrinsicElement<ButtonElementSpec>
      camera: IntrinsicElement<CameraElementSpec>
      checkbox: IntrinsicElement<CheckboxElementSpec>
      flow: IntrinsicElement<FlowElementSpec>
      frame: IntrinsicElement<FrameElementSpec>
      label: IntrinsicElement<LabelElementSpec>
      line: IntrinsicElement<LineElementSpec>
      minimap: IntrinsicElement<MinimapElementSpec>
      progressbar: IntrinsicElement<ProgressBarElementSpec>
      radiobutton: IntrinsicElement<RadioButtonElementSpec>
      slider: IntrinsicElement<SliderElementSpec>
      sprite: IntrinsicElement<SpriteButtonElementSpec>
      switch: IntrinsicElement<SwitchElementSpec>
      tab: IntrinsicElement<TabElementSpec>
      table: IntrinsicElement<TableElementSpec>
      textfield: IntrinsicElement<TextFieldElementSpec>
    }
  }
}
