import {
  bind,
  bound,
  Classes,
  ContextualFun,
  Func,
  funcRef,
  Functions,
  reg,
  RegisterClass,
  registerFunctions,
} from "./references"

declare const global: {
  __tbl1: object
  __tbl2: object
  __tbl3: object
  __ref1: Func<ContextualFun>
  __ref2: Func<ContextualFun>
  __ref3: Func<ContextualFun>
}

describe("classes", () => {
  @RegisterClass("Test Class")
  class TestClass {
    constructor(protected readonly value: string) {}

    @bound
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

  test("Name registered correctly", () => {
    assert.same("Test Class", Classes.nameOf(TestClass))
  })

  test("Static function registered correctly", () => {
    assert.same("Test Class.foo2", Functions.nameOf(TestClass.foo2))
  })

  test("overridden static function registered correctly", () => {
    assert.same("Test Subclass.foo2", Functions.nameOf(TestSubclass.foo2))
  })

  test("Error when registering after load", () => {
    assert.error(() => {
      @RegisterClass("Test Class 2")
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      class TestClass2 {}
    })
  })

  function assertRefsCorrect() {
    assert.true(global.__tbl1 instanceof TestClass)
    assert.false(global.__tbl1 instanceof TestSubclass)

    assert.true(global.__tbl2 instanceof TestSubclass)

    assert.true(global.__tbl3 instanceof TestSubclass2)

    assert.equal("12", global.__ref1.invoke())
    assert.equal("23", global.__ref2.invoke())
    assert.equal("35", global.__ref3.invoke())
  }
  test("class and boundMethod survives reload", () => {
    const instance = new TestClass("1")
    global.__tbl1 = instance
    const subclassInstance = new TestSubclass("2")
    global.__tbl2 = subclassInstance
    const subclass2Instance = new TestSubclass2("3")
    global.__tbl3 = subclass2Instance

    global.__ref1 = reg(instance.foo)
    global.__ref2 = reg(subclassInstance.foo)
    global.__ref3 = reg(subclass2Instance.foo)
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
    assert.not_function(ref)
    assert.same(["hi"], ref.invoke("hi"))
  })

  describe.each(["func", "funcRef"], "bound func ref with type %s", (type) => {
    test.each([0, 1, 2, 3, 4, 5, 10], "%d args", (n) => {
      const args = Array.from({ length: n }, (_, i) => i)
      const fun = type === "func" ? func : funcRef(func)

      const boundFn = bind(fun, ...args)
      assert.same([...args, 15, 16, 17], boundFn.invoke(15, 16, 17))
    })
  })

  test("func ref survives reload", () => {
    global.__ref1 = funcRef(func)
    global.__ref2 = bind(func, 2)
    assert.same(["foo"], global.__ref1.invoke("foo"))
    assert.same([2, "foo"], global.__ref2.invoke("foo"))
  }).after_mod_reload(() => {
    assert.same(["foo"], global.__ref1.invoke("foo"), "after reload")
    assert.same([2, "foo"], global.__ref2.invoke("foo"), "after reload")
  })
})
