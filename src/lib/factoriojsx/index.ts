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

// eslint-disable-next-line @typescript-eslint/triple-slash-reference
///<reference path="./jsx.d.ts" />

import _createElement from "./createElement"
import "./render"

export * from "./spec"
export * from "./render"

export namespace FactorioJsx {
  export const createElement = _createElement
  // noinspection JSUnusedGlobalSymbols
  export const Fragment = "fragment"
}

export type ElemProps<T extends GuiElementType> = JSX.IntrinsicElements[T]
