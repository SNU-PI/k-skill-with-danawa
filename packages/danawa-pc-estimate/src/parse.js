"use strict"

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

function stripTags(value) {
  return decodeHtmlEntities(String(value || "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " "))
}

function normalizeText(value) {
  return stripTags(value).replace(/\s+/g, " ").trim()
}

function normalizeComparable(value) {
  return normalizeText(value).toLowerCase().replace(/[\s:_/\\|,-]+/g, "")
}

function getAttr(tag, attrName) {
  const escaped = attrName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const regex = new RegExp(`${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")
  const match = regex.exec(tag || "")
  return match ? decodeHtmlEntities(match[1] || match[2] || match[3] || "") : ""
}

function parseInteger(value) {
  const text = String(value || "").replace(/[^\d-]/g, "")
  if (!text) return 0
  const parsed = parseInt(text, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function absolutizeUrl(url, baseUrl = "https://shop.danawa.com") {
  if (!url) return ""
  if (url.startsWith("//")) return `https:${url}`
  try {
    return new URL(url, baseUrl).toString()
  } catch (_) {
    return url
  }
}

function splitByMarker(html, markerRegex) {
  const indexes = []
  let match
  const regex = new RegExp(markerRegex.source, markerRegex.flags.includes("g") ? markerRegex.flags : `${markerRegex.flags}g`)
  while ((match = regex.exec(html)) !== null) {
    indexes.push(match.index)
  }
  return indexes.map((start, index) => html.slice(start, indexes[index + 1] || html.length))
}

function parseInputs(html) {
  const result = []
  const regex = /<input\b[^>]*>/gi
  let match
  while ((match = regex.exec(html || "")) !== null) {
    const tag = match[0]
    result.push({
      tag,
      type: getAttr(tag, "type"),
      name: getAttr(tag, "name"),
      value: getAttr(tag, "value"),
      key: getAttr(tag, "key"),
      data: getAttr(tag, "data")
    })
  }
  return result
}

function parseHiddenInputs(html) {
  const values = {}
  for (const input of parseInputs(html)) {
    if (input.name) values[input.name] = input.value
  }
  return values
}

function parseCategories(html) {
  const categories = []
  const groupBlocks = splitByMarker(html || "", /<dl\b[^>]*class="[^"]*\bpd_list\b[^"]*"[^>]*>/i)

  for (const block of groupBlocks) {
    const groupMatch = /<dt\b[^>]*class="[^"]*\bpd_group\b[^"]*"[^>]*>([\s\S]*?)<\/dt>/i.exec(block)
    const group = normalizeText(groupMatch ? groupMatch[1].replace(/<a[\s\S]*?<\/a>/gi, "") : "")
    const itemRegex = /<dd\b([^>]*)class="([^"]*\bcategory_(\d+)\b[^"]*)"([^>]*)>([\s\S]*?)<\/dd>/gi
    let itemMatch
    while ((itemMatch = itemRegex.exec(block)) !== null) {
      const body = itemMatch[5]
      const clickMatch = /category\((\d+)\s*,\s*(\d+)\)/i.exec(body)
      const titleMatch = /<a\b[^>]*class="[^"]*\bpd_item_title\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i.exec(body)
      const categorySeq = Number(clickMatch ? clickMatch[1] : itemMatch[3])
      const categoryDepth = Number(clickMatch ? clickMatch[2] : 0)
      const name = normalizeText(titleMatch ? titleMatch[1] : "")
      if (!categorySeq || !name) continue
      categories.push({
        group,
        name,
        categorySeq,
        categoryDepth,
        key: normalizeComparable(name)
      })
    }
  }

  return categories
}

function parseSearchOptions(html) {
  const categoryTitleMatch = /<div\b[^>]*class="[^"]*\bsearch_option_title\b[^"]*"[^>]*data="([^"]*)"[^>]*>/i.exec(html || "")
  const category = normalizeText(categoryTitleMatch ? categoryTitleMatch[1] : "")
  const groups = []
  const blocks = splitByMarker(html || "", /<div\b[^>]*class="[^"]*\bsearch_option_item\b[^"]*"[^>]*>/i)

  for (const block of blocks) {
    const titleMatch = /<div\b[^>]*class="[^"]*\bsearch_cate_title\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i.exec(block)
    const groupName = normalizeText(titleMatch ? titleMatch[1] : "")
    if (!groupName) continue

    const options = parseInputs(block)
      .filter((input) => input.type.toLowerCase() === "checkbox" && input.name && input.value)
      .map((input) => {
        const valueParts = input.value.split("|")
        return {
          name: input.name,
          value: input.value,
          key: input.key,
          label: normalizeText(input.data || ""),
          group: groupName,
          categorySeq: input.name === "attribute" ? parseInteger(valueParts[0]) : 0,
          attributeSeq: input.name === "attribute" ? parseInteger(valueParts[1]) : 0,
          attributeValueSeq: input.name === "attribute" ? parseInteger(valueParts[2]) : 0
        }
      })

    groups.push({ name: groupName, options })
  }

  return {
    category,
    groups,
    options: groups.flatMap((group) => group.options)
  }
}

function getFirstMatch(html, regex) {
  const match = regex.exec(html || "")
  return match ? match[1] : ""
}

function parseProductList(html, options = {}) {
  const totalCount = parseInteger(getFirstMatch(html, /id="goodsCount"\s+value="([^"]*)"/i))
  const items = []
  const rowRegex = /<tr\b[^>]*class="([^"]*\bproductList_(\d+)\b[^"]*)"[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch

  while ((rowMatch = rowRegex.exec(html || "")) !== null) {
    const className = rowMatch[1]
    const codeFromClass = rowMatch[2]
    const row = rowMatch[3]
    const hidden = parseHiddenInputs(row)
    const subject = normalizeText(getFirstMatch(row, /<p\b[^>]*class="[^"]*\bsubject\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i))
    const spec = normalizeText(getFirstMatch(row, /<a\b[^>]*class="[^"]*\bspec\b[^"]*"[^>]*>([\s\S]*?)<\/a>/i))
    const imageTag = getFirstMatch(row, /(<img\b[^>]*>)/i)
    const imageUrl = absolutizeUrl(getAttr(imageTag, "src"))
    const code = hidden.code || codeFromClass
    const price = parseInteger(hidden.price)
    const cardPrice = parseInteger(hidden.cardPrice)

    if (!code) continue

    items.push({
      code,
      productSeq: code,
      name: normalizeText(hidden.name || subject || getAttr(imageTag, "alt")),
      category: normalizeText(hidden.category || ""),
      categorySeq: parseInteger(hidden.linkCategorySeq),
      categoryDepth: parseInteger(hidden.categoryDepth),
      categorySeq1: parseInteger(hidden.categorySeq1),
      categorySeq2: parseInteger(hidden.categorySeq2),
      categorySeq3: parseInteger(hidden.categorySeq3),
      categorySeq4: parseInteger(hidden.categorySeq4),
      price,
      cashPrice: price,
      cardPrice,
      priceText: price > 0 ? `${price.toLocaleString("ko-KR")}원` : "판매준비",
      cardPriceText: cardPrice > 0 ? `${cardPrice.toLocaleString("ko-KR")}원` : "판매준비",
      earnPoint: parseInteger(hidden.earnPoint),
      quantity: parseInteger(hidden.quantity) || 1,
      spec,
      imageUrl,
      productUrl: absolutizeUrl(`/pc/?controller=estimateDeal&methods=productInformation&productSeq=${encodeURIComponent(code)}${options.marketPlaceSeq ? `&marketPlaceSeq=${encodeURIComponent(options.marketPlaceSeq)}` : ""}`),
      eventTitle: normalizeText(hidden.eventTitle || ""),
      eventUrl: absolutizeUrl(hidden.eventUrl || ""),
      oemProductYN: hidden.oemProductYN || "",
      oemSupportProductYN: hidden.oemSupportProductYN || "",
      isRecommended: /\brecom_area\b/.test(className),
      rawClassName: className
    })
  }

  return { totalCount, items }
}

function dedupeProducts(items) {
  const seen = new Set()
  const result = []
  for (const item of items || []) {
    if (seen.has(item.code)) continue
    seen.add(item.code)
    result.push(item)
  }
  return result
}

function parseEstimatePriceTable(html) {
  const tbodyMatch = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(html || "")
  const tbody = tbodyMatch ? tbodyMatch[1] : html || ""
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  const items = []
  let rowMatch

  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const row = rowMatch[1]
    const cells = []
    const cellRegex = /<td\b[^>]*>([\s\S]*?)<\/td>/gi
    let cellMatch
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(normalizeText(cellMatch[1]))
    }
    if (cells.length < 7) continue

    items.push({
      category: cells[0],
      name: cells[1],
      quantity: parseInteger(cells[2]) || 1,
      cardPrice: parseInteger(cells[3]),
      cashPrice: parseInteger(cells[4]),
      cardTotal: parseInteger(cells[5]),
      cashTotal: parseInteger(cells[6])
    })
  }

  return {
    items,
    totalCardPrice: items.reduce((sum, item) => sum + item.cardTotal, 0),
    totalCashPrice: items.reduce((sum, item) => sum + item.cashTotal, 0)
  }
}

function normalizeCompatibilityPayload(payload) {
  const result = payload && payload.result && typeof payload.result === "object" && !Array.isArray(payload.result) ? payload.result : {}
  const checks = Object.entries(result).map(([key, check]) => {
    const messages = [check.cpuMessage, check.mainboardMessage, check.memoryMessage, check.powerMessage, check.message]
      .filter(Boolean)
      .map((message) => normalizeText(message))
    return {
      key,
      resultCode: String(check.result || ""),
      compatible: String(check.result || "") === "0001",
      categoryCode: check.categoryCode || "",
      messages: [...new Set(messages)],
      raw: check
    }
  })

  return {
    desc: normalizeText(payload ? payload.desc : ""),
    compatible: !normalizeText(payload ? payload.desc : "") && checks.length > 0 && checks.every((check) => check.compatible),
    checks,
    raw: payload
  }
}

module.exports = {
  absolutizeUrl,
  decodeHtmlEntities,
  dedupeProducts,
  getAttr,
  normalizeComparable,
  normalizeCompatibilityPayload,
  normalizeText,
  parseCategories,
  parseEstimatePriceTable,
  parseHiddenInputs,
  parseInteger,
  parseProductList,
  parseSearchOptions,
  stripTags
}
