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

// noinspection JSUnusedGlobalSymbols

export interface ButtonEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface SpriteButtonEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface CheckboxEvents {
  on_gui_click: true
  on_gui_checked_state_changed: "state"
  on_gui_opened: true
  on_gui_closed: true
}

export interface FlowEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface FrameEvents {
  on_gui_click: true
  on_gui_location_changed: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface LabelEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface LineEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface ProgressBarEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface TableEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface TextFieldEvents {
  on_gui_click: true
  on_gui_confirmed: true
  on_gui_text_changed: "text"
  on_gui_opened: true
  on_gui_closed: true
}

export interface RadioButtonEvents {
  on_gui_click: true
  on_gui_checked_state_changed: "state"
  on_gui_opened: true
  on_gui_closed: true
}

export interface SpriteEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface ScrollPaneEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface DropDownEvents {
  on_gui_click: true
  on_gui_selection_state_changed: "selected_index"
  on_gui_opened: true
  on_gui_closed: true
}

export interface ListBoxEvents {
  on_gui_click: true
  on_gui_selection_state_changed: "selected_index"
  on_gui_opened: true
  on_gui_closed: true
}

export interface CameraEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface ChooseElemButtonEvents {
  on_gui_click: true
  on_gui_elem_changed: "elem_value"
  on_gui_opened: true
  on_gui_closed: true
}

export interface TextBoxEvents {
  on_gui_click: true
  on_gui_confirmed: true
  on_gui_text_changed: "text"
  on_gui_opened: true
  on_gui_closed: true
}

export interface SliderEvents {
  on_gui_click: true
  on_gui_value_changed: "slider_value"
  on_gui_opened: true
  on_gui_closed: true
}

export interface MinimapEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface EntityPreviewEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface EmptyWidgetEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface TabbedPaneEvents {
  on_gui_click: true
  on_gui_selected_tab_changed: "selected_tab_index"
  on_gui_opened: true
  on_gui_closed: true
}

export interface TabEvents {
  on_gui_click: true
  on_gui_opened: true
  on_gui_closed: true
}

export interface SwitchEvents {
  on_gui_click: true
  on_gui_switch_state_changed: "switch_state"
  on_gui_opened: true
  on_gui_closed: true
}
