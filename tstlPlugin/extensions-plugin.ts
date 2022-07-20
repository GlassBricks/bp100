import * as assert from "assert"
import * as path from "path"
import * as ts from "typescript"
import {
  createAssignmentStatement,
  createBooleanLiteral,
  createNilLiteral,
  createStringLiteral,
  createTableExpression,
  createTableFieldExpression,
  createTableIndexExpression,
  File,
  getEmitOutDir,
  getSourceDir,
  isCallExpression,
  LuaLibFeature,
  Plugin,
  TransformationContext,
} from "typescript-to-lua"
import { transformExpressionList } from "typescript-to-lua/dist/transformation/visitors/expression-list"
import { createSerialDiagnosticFactory } from "typescript-to-lua/dist/utils"

const useNilInstead = createSerialDiagnosticFactory((node: ts.Node) => ({
  file: ts.getOriginalNode(node).getSourceFile(),
  start: ts.getOriginalNode(node).getStart(),
  length: ts.getOriginalNode(node).getWidth(),
  messageText: "Use nil instead of undefined.",
  category: ts.DiagnosticCategory.Warning,
}))

const testPattern = /\.test\.tsx?$/

function getTestFiles(context: TransformationContext) {
  const rootDir = getSourceDir(context.program)
  const sourceFiles = context.program.getSourceFiles()
  const fields = sourceFiles
    .filter((f) => testPattern.test(f.fileName))
    .map((f) => {
      let filePath = path.relative(rootDir, f.fileName).replace(/\\/g, "/")
      // remove extension
      filePath = filePath.substring(0, filePath.lastIndexOf("."))
      // replace remaining . with -
      filePath = filePath.replace(/\./g, "-")
      return createTableFieldExpression(createStringLiteral(filePath))
    })
  return createTableExpression(fields)
}

function transformLuaSetNewCall(context: TransformationContext, node: ts.CallExpression) {
  const args = node.arguments?.slice() ?? []
  const expressions = transformExpressionList(context, args)
  return createTableExpression(
    expressions.map((e) => createTableFieldExpression(createBooleanLiteral(true), e)),
    node,
  )
}

const plugin: Plugin = {
  visitors: {
    [ts.SyntaxKind.DeleteExpression](node: ts.DeleteExpression, context: TransformationContext) {
      const deleteCall = context.superTransformExpression(node)
      assert(isCallExpression(deleteCall))
      // replace with set property to nil
      const table = deleteCall.params[0]
      const key = deleteCall.params[1]
      context.addPrecedingStatements(
        createAssignmentStatement(createTableIndexExpression(table, key), createNilLiteral(), node),
      )
      return createBooleanLiteral(true)
    },
    [ts.SyntaxKind.SourceFile](node, context) {
      const [result] = context.superTransformNode(node) as [File]
      context.usedLuaLibFeatures.delete(LuaLibFeature.Delete) // replaced by above
      return result
    },
    [ts.SyntaxKind.CallExpression](node: ts.CallExpression, context: TransformationContext) {
      // handle special case when call = __getTestFiles(), replace with list of files
      if (ts.isIdentifier(node.expression)) {
        if (node.expression.text === "__getTestFiles") {
          return getTestFiles(context)
        }
        if (node.expression.text === "newLuaSet") {
          const type = context.checker.getTypeAtLocation(node.expression)
          if (type.getProperty("__newLuaSetBrand")) {
            return transformLuaSetNewCall(context, node)
          }
        }
      }
      return context.superTransformExpression(node)
    },
    [ts.SyntaxKind.Identifier](node: ts.Identifier, context: TransformationContext) {
      if (node.text === "nil") {
        const declaration = context.checker.getSymbolAtLocation(node)?.valueDeclaration
        // check if declaration matches `declare const nil: undefined`
        if (
          declaration &&
          ts.isVariableDeclaration(declaration) &&
          declaration.initializer === undefined &&
          declaration.type !== undefined &&
          context.checker.getTypeFromTypeNode(declaration.type).getFlags() === ts.TypeFlags.Undefined
        ) {
          return createNilLiteral(node)
        }
      }
      if (node.originalKeywordKind === ts.SyntaxKind.UndefinedKeyword) {
        context.diagnostics.push(useNilInstead(node))
      }
      return context.superTransformExpression(node)
    },
  },
  beforeEmit(program, __, ___, files) {
    if (files.length === 0) return // also if there are errors and noEmitOnError
    for (const file of files) {
      const outPath = file.outputPath
      if (!outPath.endsWith(".lua")) continue
      const fileName = path.basename(outPath, ".lua")
      // replace . with - in file name
      const newFileName = fileName.replace(/\./g, "-")
      file.outputPath = path.join(path.dirname(outPath), newFileName + ".lua")
    }

    const currentTimestampString = new Date().toLocaleString()
    const outDir = getEmitOutDir(program)
    files.push({
      outputPath: path.join(outDir, "last-compile-time.lua"),
      code: `return ${JSON.stringify(currentTimestampString)}`,
    })
  },
}
// noinspection JSUnusedGlobalSymbols
export default plugin