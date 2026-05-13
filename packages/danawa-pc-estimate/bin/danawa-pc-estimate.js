#!/usr/bin/env node
"use strict"

const {
  checkCompatibility,
  extractEstimatePrices,
  getSearchOptions,
  listCategories,
  searchProducts
} = require("../src")

function parseArgs(argv) {
  const args = { _: [] }
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    if (!token.startsWith("--")) {
      args._.push(token)
      continue
    }
    const key = token.slice(2)
    const next = argv[index + 1]
    const value = next && !next.startsWith("--") ? argv[++index] : true
    if (args[key] === undefined) {
      args[key] = value
    } else if (Array.isArray(args[key])) {
      args[key].push(value)
    } else {
      args[key] = [args[key], value]
    }
  }
  return args
}

function splitCsv(value) {
  if (value === undefined) return []
  const values = Array.isArray(value) ? value : [value]
  return values.flatMap((item) => String(item).split(",")).map((item) => item.trim()).filter(Boolean)
}

function printUsage() {
  process.stderr.write(`Usage:
  danawa-pc-estimate categories
  danawa-pc-estimate options --category CPU [--query 9800X3D]
  danawa-pc-estimate search --category CPU --query 9800X3D --maker AMD --filter "AMD(소켓AM5)" --filter DDR5 --limit 5
  danawa-pc-estimate compat 70531547 20324882
  danawa-pc-estimate prices 70531547 20324882
`)
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const args = parseArgs(rest)

  if (!command || command === "help" || command === "--help") {
    printUsage()
    return
  }

  let result
  if (command === "categories") {
    result = await listCategories(args)
  } else if (command === "options") {
    result = await getSearchOptions(args.category || args._[0] || "CPU", {
      query: args.query || args.keyword || args.name
    })
  } else if (command === "search") {
    result = await searchProducts({
      category: args.category || args._[0] || "CPU",
      query: args.query || args.keyword || args.name,
      makers: splitCsv(args.maker || args.manufacturer),
      filters: splitCsv(args.filter),
      minPrice: args.minPrice,
      maxPrice: args.maxPrice,
      page: args.page,
      sort: args.sort,
      payment: args.payment,
      limit: args.limit
    })
  } else if (command === "compat" || command === "compatibility") {
    result = await checkCompatibility(args._.length > 0 ? args._ : splitCsv(args.products || args.productSeqList))
  } else if (command === "prices" || command === "estimate-prices") {
    result = await extractEstimatePrices(args._.length > 0 ? args._ : splitCsv(args.products || args.productSeqList), {
      quantities: splitCsv(args.quantities || args.quantityList)
    })
  } else {
    printUsage()
    process.exitCode = 1
    return
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exitCode = 1
})
