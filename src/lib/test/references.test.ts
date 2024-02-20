/*
 * Copyright (c) 2022 GlassBricks
 * This file is part of Staged Blueprint Planning.
 *
 * Staged Blueprint Planning is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
 *
 * Staged Blueprint Planning is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License along with Staged Blueprint Planning. If not, see <https://www.gnu.org/licenses/>.
 */

import expect from "tstl-expect"
import { bind, Func, funcRef, Functions, ibind, RegisterClass, registerFunctions } from "../references"

declare const global: {
  __tbl1: object
  __tbl2: object
  __tbl3: object
  __ref1: Func
  __ref2: Func
  __ref3: Func
  __ref4: Func
}

describe("classes", () => {
  @RegisterClass("Test Class")
  class TestClass {
    constructor(protected readonly value: string) {}

    foo() {
      return this.value + "2"
    }

    static foo2() {
      // noop
    }
  }

  @RegisterClass("Test Subclass")
  class TestSubclass extends TestClass {
    override foo() {
      return this.value + "3"
    }

    static override foo2() {
      // noop
    }
    nonOverridden() {
      return "non overridden"
    }
  }

  @RegisterClass("Test Subclass2")
  class TestSubclass2 extends TestSubclass {
    override foo() {
      return this.value + "5"
    }

    static override foo2() {
      // noop
    }
  }

  test("Static function registered correctly", () => {
    expect(Functions.nameOf(TestClass.foo2)).toEqual("Test Class.foo2")
  })

  test("overridden static function registered correctly", () => {
    expect(Functions.nameOf(TestSubclass.foo2)).toEqual("Test Subclass.foo2")
  })

  test("Error when registering after load", () => {
    expect(() => {
      @RegisterClass("Test Class 2")
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestClass2 {}
    }).toError()
  })

  function assertRefsCorrect() {
    expect(global.__tbl1 instanceof TestClass).toBe(true)
    expect(global.__tbl1 instanceof TestSubclass).toBe(false)

    expect(global.__tbl2 instanceof TestSubclass).toBe(true)

    expect(global.__tbl3 instanceof TestSubclass2).toBe(true)

    expect(global.__ref1.invoke()).toBe("12")
    expect(global.__ref2.invoke()).toBe("23")
    expect(global.__ref3.invoke()).toBe("35")
    expect(global.__ref4.invoke()).toBe("non overridden")
  }
  test("class and boundMethod survives reload", () => {
    const instance = new TestClass("1")
    global.__tbl1 = instance
    const subclassInstance = new TestSubclass("2")
    global.__tbl2 = subclassInstance
    const subclass2Instance = new TestSubclass2("3")
    global.__tbl3 = subclass2Instance

    global.__ref1 = ibind(instance.foo)
    global.__ref2 = ibind(subclassInstance.foo)
    global.__ref3 = ibind(subclass2Instance.foo)
    global.__ref4 = ibind(subclass2Instance.nonOverridden)
    assertRefsCorrect()
  }).after_mod_reload(() => {
    assertRefsCorrect()
  })
})

describe("functions", () => {
  function func(...args: any) {
    return args
  }

  registerFunctions("test func", { func })

  test("funcRef", () => {
    const ref = funcRef(func)
    expect(ref).not.toBeA("function")
    expect(ref.invoke("hi")).toEqual(["hi"])
  })

  describe.each(["func", "funcRef"])("bound func ref with type %s", (type) => {
    test.each([0, 1, 2, 3, 4, 5, 10])("%d args", (n) => {
      const args = Array.from({ length: n }, (_, i) => i)
      const fun = type == "func" ? func : funcRef(func)

      const boundFn = bind(fun, ...args)
      expect(boundFn.invoke(15, 16, 17)).toEqual([...args, 15, 16, 17])
    })
  })

  test("func ref survives reload", () => {
    global.__ref1 = funcRef(func)
    global.__ref2 = bind(func, 2)
    expect(global.__ref1.invoke("foo")).toEqual(["foo"])
    expect(global.__ref2.invoke("foo")).toEqual([2, "foo"])
  }).after_mod_reload(() => {
    expect(global.__ref1.invoke("foo")).toEqual(["foo"])
    expect(global.__ref2.invoke("foo")).toEqual([2, "foo"])
  })
})
