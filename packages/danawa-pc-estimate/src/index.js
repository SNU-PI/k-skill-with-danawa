"use strict"

const { TextDecoder } = require("node:util")
const {
  dedupeProducts,
  normalizeComparable,
  normalizeCompatibilityPayload,
  normalizeText,
  parseCategories,
  parseEstimatePriceTable,
  parseProductList,
  parseSearchOptions
} = require("./parse")

const BASE_URL = "https://shop.danawa.com"
const DEFAULT_MARKET_PLACE_SEQ = 16
const DEFAULT_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
  "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  referer: "https://shop.danawa.com/virtualestimate/?controller=estimateMain&methods=index&marketPlaceSeq=16",
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
  "x-requested-with": "XMLHttpRequest"
}

const CATEGORIES = [
  { group: "PC 주요구성", name: "CPU", categorySeq: 873, categoryDepth: 2, aliases: ["cpu", "processor", "프로세서"] },
  { group: "PC 주요구성", name: "쿨러/튜닝", categorySeq: 887, categoryDepth: 2, aliases: ["cooler", "cooling", "쿨러", "튜닝"] },
  { group: "PC 주요구성", name: "메인보드", categorySeq: 875, categoryDepth: 2, aliases: ["mainboard", "motherboard", "mobo", "보드"] },
  { group: "PC 주요구성", name: "메모리", categorySeq: 874, categoryDepth: 2, aliases: ["memory", "ram", "램"] },
  { group: "PC 주요구성", name: "그래픽카드", categorySeq: 876, categoryDepth: 2, aliases: ["gpu", "vga", "graphics", "그래픽", "그래픽 카드"] },
  { group: "PC 주요구성", name: "SSD", categorySeq: 32617, categoryDepth: 2, aliases: ["ssd"] },
  { group: "PC 주요구성", name: "HDD", categorySeq: 877, categoryDepth: 2, aliases: ["hdd", "harddisk", "하드"] },
  { group: "PC 주요구성", name: "케이스", categorySeq: 879, categoryDepth: 2, aliases: ["case", "pc case"] },
  { group: "PC 주요구성", name: "파워", categorySeq: 880, categoryDepth: 2, aliases: ["power", "psu", "power supply", "파워서플라이"] },
  { group: "PC 주요구성", name: "소프트웨어", categorySeq: 901, categoryDepth: 2, aliases: ["software", "os", "windows", "윈도우"] },
  { group: "모니터 및 주변기기", name: "모니터", categorySeq: 13735, categoryDepth: 2, aliases: ["monitor", "display"] },
  { group: "모니터 및 주변기기", name: "모니터 받침대", categorySeq: 58842, categoryDepth: 3, aliases: ["monitor stand"] },
  { group: "모니터 및 주변기기", name: "키보드", categorySeq: 881, categoryDepth: 2, aliases: ["keyboard"] },
  { group: "모니터 및 주변기기", name: "마우스", categorySeq: 902, categoryDepth: 2, aliases: ["mouse"] },
  { group: "모니터 및 주변기기", name: "사운드바", categorySeq: 47618, categoryDepth: 3, aliases: ["soundbar"] },
  { group: "모니터 및 주변기기", name: "스피커", categorySeq: 23092, categoryDepth: 3, aliases: ["speaker"] },
  { group: "모니터 및 주변기기", name: "PC헤드셋", categorySeq: 221911, categoryDepth: 3, aliases: ["headset", "pc headset", "헤드셋"] },
  { group: "모니터 및 주변기기", name: "이어폰", categorySeq: 49740, categoryDepth: 3, aliases: ["earphone"] },
  { group: "모니터 및 주변기기", name: "공유기/무선랜", categorySeq: 895, categoryDepth: 2, aliases: ["router", "wifi", "무선랜"] },
  { group: "모니터 및 주변기기", name: "IP공유기/허브", categorySeq: 894, categoryDepth: 2, aliases: ["hub", "ip router"] },
  { group: "모니터 및 주변기기", name: "프린터/복합기", categorySeq: 58875, categoryDepth: 2, aliases: ["printer"] },
  { group: "모니터 및 주변기기", name: "컴퓨터 의자", categorySeq: 32346, categoryDepth: 3, aliases: ["chair"] },
  { group: "모니터 및 주변기기", name: "케이블", categorySeq: 10621, categoryDepth: 2, aliases: ["cable"] },
  { group: "모니터 및 주변기기", name: "컨트롤러", categorySeq: 886, categoryDepth: 2, aliases: ["controller", "gamepad"] },
  { group: "모니터 및 주변기기", name: "멀티탭", categorySeq: 59570, categoryDepth: 3, aliases: ["power strip"] },
  { group: "저장장치 및 멀티미디어", name: "ODD", categorySeq: 878, categoryDepth: 2, aliases: ["odd", "optical drive"] },
  { group: "저장장치 및 멀티미디어", name: "외장HDD/SSD", categorySeq: 10620, categoryDepth: 2, aliases: ["external storage", "external hdd", "external ssd"] },
  { group: "저장장치 및 멀티미디어", name: "USB", categorySeq: 1136, categoryDepth: 2, aliases: ["usb"] },
  { group: "저장장치 및 멀티미디어", name: "메모리카드/리더기", categorySeq: 39527, categoryDepth: 2, aliases: ["memory card", "card reader"] },
  { group: "저장장치 및 멀티미디어", name: "사운드카드", categorySeq: 221803, categoryDepth: 3, aliases: ["sound card"] },
  { group: "저장장치 및 멀티미디어", name: "캡처보드/웹캠", categorySeq: 892, categoryDepth: 2, aliases: ["capture card", "webcam", "캡쳐보드"] },
  { group: "저장장치 및 멀티미디어", name: "마이크", categorySeq: 31597, categoryDepth: 3, aliases: ["microphone", "mic"] },
  { group: "저장장치 및 멀티미디어", name: "NAS", categorySeq: 32621, categoryDepth: 2, aliases: ["nas"] },
  { group: "저장장치 및 멀티미디어", name: "데스크 액세서리", categorySeq: 223639, categoryDepth: 3, aliases: ["desk accessory"] },
  { group: "저장장치 및 멀티미디어", name: "모바일 액세서리", categorySeq: 58304, categoryDepth: 2, aliases: ["mobile accessory"] },
  { group: "홈/오피스", name: "노트북", categorySeq: 869, categoryDepth: 2, aliases: ["notebook", "laptop"] },
  { group: "홈/오피스", name: "노트북 주변기기", categorySeq: 870, categoryDepth: 2, aliases: ["laptop accessory"] },
  { group: "홈/오피스", name: "베어본", categorySeq: 59073, categoryDepth: 3, aliases: ["barebone"] }
]

const GROUP_ALIASES = {
  manufacturer: ["제조사", "maker", "brand"],
  maker: ["제조사", "manufacturer", "brand"],
  brand: ["제조사", "manufacturer", "maker"],
  socket: ["소켓", "소켓 구분", "cpu 소켓"],
  memory: ["메모리", "메모리 규격", "memory"],
  ram: ["메모리", "메모리 규격", "memory"],
  chipset: ["칩셋", "chipset"],
  formfactor: ["폼팩터", "규격", "form factor"],
  core: ["코어", "코어 수"],
  thread: ["스레드", "thread"]
}

function coerceArray(value) {
  if (value === undefined || value === null || value === "") return []
  return Array.isArray(value) ? value : [value]
}

function normalizePaymentSeq(options = {}) {
  if (options.paymentSeq) return Number(options.paymentSeq)
  if (options.pseq) return Number(options.pseq)
  const payment = String(options.payment || "cash").toLowerCase()
  return payment === "card" || payment === "cardPrice" || payment === "card-price" ? 1 : 2
}

function resolveCategory(input) {
  if (input && typeof input === "object" && input.categorySeq) {
    return {
      group: input.group || "",
      name: input.name || String(input.categorySeq),
      categorySeq: Number(input.categorySeq),
      categoryDepth: Number(input.categoryDepth || 2),
      aliases: input.aliases || []
    }
  }

  if (typeof input === "number" || /^\d+$/.test(String(input || ""))) {
    const categorySeq = Number(input)
    const found = CATEGORIES.find((category) => category.categorySeq === categorySeq)
    return found || { group: "", name: String(categorySeq), categorySeq, categoryDepth: 2, aliases: [] }
  }

  const comparable = normalizeComparable(input || "CPU")
  const found = CATEGORIES.find((category) => {
    const labels = [category.name, category.categorySeq, ...(category.aliases || [])]
    return labels.some((label) => normalizeComparable(label) === comparable)
  })

  if (!found) {
    throw new Error(`Unknown Danawa PC estimate category: ${input}`)
  }

  return found
}

function buildUrl(path, params = {}) {
  const url = new URL(path, BASE_URL)
  for (const [key, value] of Object.entries(params)) {
    for (const item of coerceArray(value)) {
      if (item !== undefined && item !== null && item !== "") {
        url.searchParams.append(key, String(item))
      }
    }
  }
  return url
}

function sniffCharset(headers, bytes) {
  const contentType = headers && typeof headers.get === "function" ? headers.get("content-type") || "" : ""
  const headerMatch = /charset=([^;\s]+)/i.exec(contentType)
  if (headerMatch) return headerMatch[1].replace(/["']/g, "").toLowerCase()

  const ascii = Buffer.from(bytes).toString("latin1")
  const metaMatch = /charset\s*=\s*["']?([-\w]+)/i.exec(ascii)
  return metaMatch ? metaMatch[1].toLowerCase() : "utf-8"
}

function decodeBytes(bytes, charset) {
  try {
    return new TextDecoder(charset || "utf-8").decode(bytes)
  } catch (_) {
    return new TextDecoder("utf-8").decode(bytes)
  }
}

async function requestText(url, options = {}) {
  const fetchImpl = options.fetchImpl || global.fetch
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required.")

  const response = await fetchImpl(url.toString(), {
    method: options.method || "GET",
    headers: {
      ...DEFAULT_HEADERS,
      ...(options.headers || {})
    },
    signal: options.signal
  })

  if (!response.ok) {
    throw new Error(`Danawa request failed with ${response.status} for ${url}`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  return decodeBytes(bytes, sniffCharset(response.headers, bytes))
}

async function requestJson(url, options = {}) {
  const text = await requestText(url, {
    ...options,
    headers: {
      accept: "application/json,text/plain,*/*",
      ...(options.headers || {})
    }
  })
  return JSON.parse(text)
}

function optionGroupMatches(groupName, requestedGroup) {
  if (!requestedGroup) return true
  const requested = normalizeComparable(requestedGroup)
  const candidates = [requestedGroup, ...(GROUP_ALIASES[requested] || [])].map(normalizeComparable)
  const group = normalizeComparable(groupName)
  return candidates.some((candidate) => group.includes(candidate) || candidate.includes(group))
}

function findOptions(searchOptions, input, options = {}) {
  const allOptions = (searchOptions.options || []).filter((option) => {
    if (options.name && option.name !== options.name) return false
    return optionGroupMatches(option.group, options.group)
  })
  const text = typeof input === "object" ? input.value || input.label || input.name : input
  const comparable = normalizeComparable(text)

  if (!comparable) return []

  const exact = allOptions.filter((option) => {
    return [
      option.value,
      option.key,
      option.label,
      option.attributeValueSeq,
      option.attributeSeq
    ].some((value) => normalizeComparable(value) === comparable)
  })
  if (exact.length > 0) return exact

  return allOptions.filter((option) => {
    return [option.label, option.value, option.key].some((value) => normalizeComparable(value).includes(comparable))
  })
}

function expandConditions(input) {
  const makers = []
  const filters = []
  const conditions = input.conditions || input.criteria

  if (Array.isArray(conditions)) {
    filters.push(...conditions)
  } else if (conditions && typeof conditions === "object") {
    for (const [group, value] of Object.entries(conditions)) {
      for (const item of coerceArray(value)) {
        if (["maker", "manufacturer", "brand", "제조사"].includes(String(group).toLowerCase())) {
          makers.push(item)
        } else {
          filters.push({ group, value: item })
        }
      }
    }
  }

  makers.push(...coerceArray(input.maker))
  makers.push(...coerceArray(input.makers))
  makers.push(...coerceArray(input.manufacturer))
  makers.push(...coerceArray(input.manufacturers))
  filters.push(...coerceArray(input.filter))
  filters.push(...coerceArray(input.filters))
  filters.push(...coerceArray(input.optionLabels))

  return { makers, filters }
}

function resolveSearchCriteria(searchOptions, input = {}) {
  const makerCodes = coerceArray(input.makerCode || input.makerCodes).map(String)
  const attributeValues = coerceArray(input.attribute || input.attributes || input.attributeValues).filter((value) => String(value).includes("|")).map(String)
  const resolved = []
  const unresolved = []
  const { makers, filters } = expandConditions(input)

  for (const maker of makers) {
    if (/^\d+$/.test(String(maker))) {
      makerCodes.push(String(maker))
      resolved.push({ input: maker, name: "makerCode", value: String(maker), source: "direct" })
      continue
    }

    const matches = findOptions(searchOptions, maker, { name: "makerCode", group: "제조사" })
    if (matches.length === 1) {
      makerCodes.push(matches[0].value)
      resolved.push({ input: maker, ...matches[0] })
    } else {
      unresolved.push({ input: maker, reason: matches.length > 1 ? "ambiguous-maker" : "maker-not-found", matches })
    }
  }

  for (const filter of filters) {
    const group = filter && typeof filter === "object" ? filter.group : undefined
    const value = filter && typeof filter === "object" ? filter.value || filter.label || filter.name : filter
    const matches = findOptions(searchOptions, value, { name: "attribute", group })
    if (matches.length === 1) {
      attributeValues.push(matches[0].value)
      resolved.push({ input: filter, ...matches[0] })
    } else {
      unresolved.push({ input: filter, reason: matches.length > 1 ? "ambiguous-filter" : "filter-not-found", matches })
    }
  }

  for (const attribute of coerceArray(input.attributeValueSeqs)) {
    const matches = findOptions(searchOptions, attribute, { name: "attribute" })
    if (matches.length === 1) {
      attributeValues.push(matches[0].value)
      resolved.push({ input: attribute, ...matches[0] })
    } else {
      unresolved.push({ input: attribute, reason: matches.length > 1 ? "ambiguous-attribute" : "attribute-not-found", matches })
    }
  }

  return {
    makerCodes: [...new Set(makerCodes)],
    attributeValues: [...new Set(attributeValues)],
    resolved,
    unresolved
  }
}

async function listCategories(options = {}) {
  const category = resolveCategory(options.category || "CPU")
  const url = buildUrl("/virtualestimate/", {
    controller: "estimateMain",
    methods: "wish",
    marketPlaceSeq: options.marketPlaceSeq || DEFAULT_MARKET_PLACE_SEQ,
    categorySeq: category.categorySeq,
    categoryDepth: category.categoryDepth,
    pseq: normalizePaymentSeq(options)
  })
  const html = await requestText(url, options)
  const categories = parseCategories(html)
  return {
    categories: categories.length > 0 ? categories : CATEGORIES,
    meta: { url: url.toString(), extraction: categories.length > 0 ? "wish-html" : "static-fallback" }
  }
}

async function getSearchOptions(categoryInput = "CPU", options = {}) {
  const category = resolveCategory(categoryInput && typeof categoryInput === "object" && categoryInput.category ? categoryInput.category : categoryInput)
  const mergedOptions = categoryInput && typeof categoryInput === "object" && !categoryInput.categorySeq ? { ...categoryInput, ...options } : options
  const requestParams = {
    controller: "estimateMain",
    methods: "searchOption",
    marketPlaceSeq: mergedOptions.marketPlaceSeq || DEFAULT_MARKET_PLACE_SEQ,
    categorySeq: category.categorySeq,
    name: mergedOptions.query || mergedOptions.keyword || mergedOptions.name,
    serviceSectionSeq: mergedOptions.serviceSectionSeq
  }
  let url = buildUrl("/virtualestimate/", requestParams)
  let html = await requestText(url, mergedOptions)
  let parsed = parseSearchOptions(html)
  let extraction = "search-option-html"

  if (parsed.options.length === 0 && requestParams.name) {
    url = buildUrl("/virtualestimate/", { ...requestParams, name: "" })
    html = await requestText(url, mergedOptions)
    parsed = parseSearchOptions(html)
    extraction = "search-option-html-category-fallback"
  }

  return {
    category,
    groups: parsed.groups,
    options: parsed.options,
    meta: { url: url.toString(), extraction }
  }
}

async function searchProducts(input = {}) {
  const category = resolveCategory(input.category || input.categorySeq || "CPU")
  const marketPlaceSeq = input.marketPlaceSeq || DEFAULT_MARKET_PLACE_SEQ
  const paymentSeq = normalizePaymentSeq(input)
  let criteria = {
    makerCodes: coerceArray(input.makerCode || input.makerCodes).map(String),
    attributeValues: coerceArray(input.attribute || input.attributes || input.attributeValues).filter((value) => String(value).includes("|")).map(String),
    resolved: [],
    unresolved: []
  }

  const needsOptionResolution = Boolean(input.conditions || input.criteria || input.maker || input.makers || input.manufacturer || input.manufacturers || input.filter || input.filters || input.optionLabels || input.attributeValueSeqs)
  if (needsOptionResolution) {
    const options = await getSearchOptions(category, input)
    criteria = resolveSearchCriteria(options, input)
    if (criteria.unresolved.length > 0 && input.strict) {
      throw new Error(`Could not resolve Danawa search filters: ${criteria.unresolved.map((item) => JSON.stringify(item.input)).join(", ")}`)
    }
  }

  const url = buildUrl("/virtualestimate/", {
    controller: "estimateMain",
    methods: "product",
    marketPlaceSeq,
    categorySeq: category.categorySeq,
    categoryDepth: input.categoryDepth || category.categoryDepth,
    pseq: paymentSeq,
    page: input.page,
    orderbyList: input.sort || input.orderBy || input.orderbyList,
    name: input.query || input.keyword || input.name,
    "makerCode[]": criteria.makerCodes,
    "attribute[]": criteria.attributeValues,
    "includeText[]": input.includeText,
    "excludeText[]": input.excludeText,
    minPrice: input.minPrice,
    maxPrice: input.maxPrice,
    oemProductYN: input.oemProductYN
  })
  const html = await requestText(url, input)
  const parsed = parseProductList(html, { marketPlaceSeq })
  const items = input.dedupe === false ? parsed.items : dedupeProducts(parsed.items)
  const limit = input.limit ? Number(input.limit) : 0

  return {
    query: input.query || input.keyword || input.name || "",
    category,
    totalCount: parsed.totalCount,
    items: limit > 0 ? items.slice(0, limit) : items,
    resolvedFilters: criteria.resolved,
    unresolvedFilters: criteria.unresolved,
    meta: {
      url: url.toString(),
      extraction: "product-html",
      marketPlaceSeq,
      payment: paymentSeq === 1 ? "card" : "cash"
    }
  }
}

async function checkCompatibility(productSeqList, options = {}) {
  const productSeqs = coerceArray(productSeqList || options.productSeqList || options.products).flatMap((value) => String(value).split(",")).map((value) => value.trim()).filter(Boolean)
  if (productSeqs.length === 0) throw new Error("productSeqList is required.")

  const url = buildUrl("/virtualestimate/", {
    controller: "estimateMain",
    methods: "compatibility",
    productSeqList: productSeqs.join(",")
  })
  const payload = await requestJson(url, options)
  const normalized = normalizeCompatibilityPayload(payload)
  return {
    productSeqList: productSeqs,
    ...normalized,
    meta: { url: url.toString(), extraction: "compatibility-json" }
  }
}

async function extractEstimatePrices(productSeqList, options = {}) {
  const productSeqs = coerceArray(productSeqList || options.productSeqList || options.products).flatMap((value) => String(value).split(",")).map((value) => value.trim()).filter(Boolean)
  if (productSeqs.length === 0) throw new Error("productSeqList is required.")
  const quantities = coerceArray(options.quantityList || options.quantities)
  const quantityList = productSeqs.map((_, index) => quantities[index] || 1).join(",")
  const marketPlaceSeq = options.marketPlaceSeq || DEFAULT_MARKET_PLACE_SEQ
  const url = buildUrl("/virtualestimate/", {
    controller: "estimateMain",
    methods: "estimateByExternalGoodsInfo",
    marketPlaceSeq,
    productSeqList: productSeqs.join(","),
    quantityList,
    type: options.type || "print"
  })
  const html = await requestText(url, options)
  const parsed = parseEstimatePriceTable(html)
  return {
    productSeqList: productSeqs,
    quantityList: quantityList.split(",").map(Number),
    ...parsed,
    meta: { url: url.toString(), extraction: "estimate-price-html", marketPlaceSeq }
  }
}

module.exports = {
  BASE_URL,
  CATEGORIES,
  checkCompatibility,
  extractEstimatePrices,
  getSearchOptions,
  listCategories,
  parse: {
    normalizeCompatibilityPayload,
    parseCategories,
    parseEstimatePriceTable,
    parseProductList,
    parseSearchOptions
  },
  resolveCategory,
  resolveSearchCriteria,
  searchProducts
}
