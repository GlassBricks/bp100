import { RegisterClass } from "../references"
import { Event, Observable, ValueListener } from "./Observable"
import { Subscription } from "./Subscription"

export type ObservableListAdd<T> = {
  list: ObservableList<T>
  type: "add"
  index: number
  value: T
}
export type ObservableListRemove<T> = {
  list: ObservableList<T>
  type: "remove"
  index: number
  value: T
}
export type ObservableListSwap<T> = {
  list: ObservableList<T>
  type: "swap"
  indexA: number
  indexB: number
  newValueA: T
  newValueB: T
}
export type ObservableListSet<T> = {
  list: ObservableList<T>
  type: "set"
  index: number
  oldValue: T
  value: T
}
export type ObservableListChange<T> =
  | ObservableListAdd<T>
  | ObservableListRemove<T>
  | ObservableListSwap<T>
  | ObservableListSet<T>

export type ListObserver<T> = ValueListener<ObservableListChange<T>>

export interface ObservableList<T extends AnyNotNil> extends Observable<ObservableListChange<T>> {
  length(): number
  value(): readonly T[]
  get(index: number): T
}

export interface MutableObservableList<T extends AnyNotNil> extends ObservableList<T> {
  set(index: number, value: T): void
  insert(index: number, value: T): void
  remove(index: number): void
  push(value: T): void
  pop(): T
  swap(indexA: number, indexB: number): void
}

@RegisterClass("ObservableList")
class ObservableListImpl<T extends AnyNotNil> implements MutableObservableList<T> {
  private event = new Event<ObservableListChange<T>>()
  private array: T[] = []

  public subscribe(context: Subscription, observer: ListObserver<T>): Subscription {
    return this.event.subscribe(context, observer)
  }

  public subscribeIndependently(observer: ListObserver<T>): Subscription {
    return this.event.subscribeIndependently(observer)
  }

  public length(): number {
    return this.array.length
  }

  public value(): readonly T[] {
    return this.array
  }

  public get(index: number): T {
    return this.array[index]
  }

  public set(index: number, value: T): void {
    const { array } = this
    const oldValue = array[index]
    if (oldValue !== value) {
      array[index] = value
      this.event.raise({
        list: this,
        type: "set",
        index,
        oldValue,
        value,
      })
    }
  }

  public insert(index: number, value: T): void {
    const { array } = this
    table.insert(array, index + 1, value)
    this.event.raise({
      list: this,
      type: "add",
      index,
      value,
    })
  }

  public remove(index: number): T {
    const { array } = this
    const oldValue = array[index]
    table.remove(array, index + 1)
    this.event.raise({
      list: this,
      type: "remove",
      index,
      value: oldValue,
    })
    return oldValue
  }

  public push(value: T): void {
    this.insert(this.array.length, value)
  }

  public pop(): T {
    return this.remove(this.array.length - 1)
  }

  public swap(indexA: number, indexB: number): void {
    const { array } = this
    const oldValueA = array[indexA]
    const oldValueB = array[indexB]
    array[indexA] = oldValueB
    array[indexB] = oldValueA
    this.event.raise({
      list: this,
      type: "swap",
      indexA,
      indexB,
      newValueA: oldValueB,
      newValueB: oldValueA,
    })
  }
}

export function observableList<T extends AnyNotNil>(): MutableObservableList<T> {
  return new ObservableListImpl<T>()
}
