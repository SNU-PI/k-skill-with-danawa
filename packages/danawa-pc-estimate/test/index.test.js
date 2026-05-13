"use strict"

const test = require("node:test")
const assert = require("node:assert/strict")
const {
  checkCompatibility,
  extractEstimatePrices,
  getSearchOptions,
  parse,
  searchProducts
} = require("../src")

function response(body, headers = { "content-type": "text/html; charset=utf-8" }) {
  return {
    ok: true,
    status: 200,
    headers: {
      get(name) {
        return headers[name.toLowerCase()] || headers[name] || ""
      }
    },
    async arrayBuffer() {
      return Buffer.from(body, "utf8")
    }
  }
}

const searchOptionHtml = `
<div class="search_option_wrap">
  <div class="search_option_title" data="CPU">CPU</div>
  <div class="search_option_item">
    <div class="search_cate_title">제조사</div>
    <input type="checkbox" name="makerCode" value="3132" key="makerCode_3132" data="AMD" />
  </div>
  <div class="search_option_item">
    <div class="search_cate_title">소켓 구분</div>
    <input type="checkbox" name="attribute" value="873|41|801631|S" key="attribute_801631" data="AMD(소켓AM5) " />
    <input type="checkbox" name="attribute" value="873|41|748240|S" key="attribute_748240" data="인텔(소켓1700) " />
  </div>
  <div class="search_option_item">
    <div class="search_cate_title">메모리 규격</div>
    <input type="checkbox" name="attribute" value="873|26532|801667|S" key="attribute_801667" data="DDR5 " />
  </div>
</div>`

const productHtml = `
<input type="hidden" id="goodsCount" value="1" />
<table><tbody>
<tr class="productList_70531547">
  <td class="goods_img"><img src="//img.danawa.com/cpu.jpg" alt="AMD CPU" /></td>
  <td class="title_price">
    <p class="subject"><a>AMD 라이젠7-6세대 9800X3D (그래니트 릿지) (멀티팩 정품)</a></p>
    <div class="spec_bg"><a class="spec">AMD(소켓AM5)/DDR5/8코어/16스레드</a></div>
  </td>
  <td class="rig_line">
    <p class="low_price"><span class="prod_price"> 605,540</span>원</p>
    <input type="hidden" name="type" value="1" />
    <input type="hidden" name="category" value="CPU" />
    <input type="hidden" name="linkCategorySeq" value="873" />
    <input type="hidden" name="categoryDepth" value="2" />
    <input type="hidden" name="name" value="AMD 라이젠7-6세대 9800X3D (그래니트 릿지) (멀티팩 정품)" />
    <input type="hidden" name="quantity" value="1" />
    <input type="hidden" name="code" value="70531547" />
    <input type="hidden" name="price" value="605540" />
    <input type="hidden" name="cardPrice" value="627460" />
  </td>
</tr>
</tbody></table>`

test("parseSearchOptions extracts maker and attribute filters", () => {
  const parsed = parse.parseSearchOptions(searchOptionHtml)
  assert.equal(parsed.category, "CPU")
  assert.equal(parsed.groups.length, 3)
  assert.equal(parsed.options.find((item) => item.label === "AMD").value, "3132")
  assert.equal(parsed.options.find((item) => item.label === "DDR5").attributeValueSeq, 801667)
})

test("searchProducts resolves Korean conditions and parses products", async () => {
  const requestedUrls = []
  const fetchImpl = async (url) => {
    requestedUrls.push(url)
    if (url.includes("methods=searchOption")) return response(searchOptionHtml)
    if (url.includes("methods=product")) return response(productHtml)
    throw new Error(`unexpected URL ${url}`)
  }

  const result = await searchProducts({
    category: "CPU",
    query: "9800X3D",
    conditions: {
      manufacturer: "AMD",
      socket: "AM5",
      memory: "DDR5"
    },
    fetchImpl
  })

  assert.equal(result.items.length, 1)
  assert.equal(result.items[0].code, "70531547")
  assert.equal(result.items[0].cashPrice, 605540)
  assert.equal(result.unresolvedFilters.length, 0)
  assert.match(requestedUrls[1], /makerCode%5B%5D=3132/)
  assert.match(requestedUrls[1], /attribute%5B%5D=873%7C41%7C801631%7CS/)
  assert.match(requestedUrls[1], /attribute%5B%5D=873%7C26532%7C801667%7CS/)
})

test("checkCompatibility normalizes Danawa compatibility JSON", async () => {
  const payload = {
    desc: "",
    result: {
      "cpu-mainboard": {
        result: "0002",
        cpuMessage: 'CPU 소켓구분 <strong class="text__point">AMD(소켓AM5)</strong> 옵션과 메인보드 CPU 소켓 <strong>인텔(소켓1700)</strong> 옵션은 호환이 맞지 않습니다.',
        mainboardMessage: "동일 메시지",
        categoryCode: "875"
      }
    }
  }
  const fetchImpl = async () => response(JSON.stringify(payload), { "content-type": "application/json; charset=utf-8" })
  const result = await checkCompatibility(["70531547", "18109313"], { fetchImpl })

  assert.equal(result.compatible, false)
  assert.equal(result.checks[0].resultCode, "0002")
  assert.match(result.checks[0].messages[0], /AMD\(소켓AM5\)/)
})

test("extractEstimatePrices parses selected part price table", async () => {
  const html = `
  <meta charset="utf-8">
  <table><tbody>
    <tr>
      <td>CPU</td><td>AMD 라이젠7-6세대 9800X3D</td><td>1</td>
      <td>627,460원</td><td>605,540원</td><td><strong>627,460</strong>원</td><td><strong>605,540</strong>원</td>
    </tr>
  </tbody></table>`
  const fetchImpl = async () => response(html)
  const result = await extractEstimatePrices(["70531547"], { fetchImpl })

  assert.equal(result.items[0].category, "CPU")
  assert.equal(result.items[0].cashPrice, 605540)
  assert.equal(result.totalCashPrice, 605540)
})
