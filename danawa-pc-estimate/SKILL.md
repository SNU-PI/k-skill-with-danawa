---
name: danawa-pc-estimate
description: 샵다나와 PC견적 공개 화면 엔드포인트를 사용해 PC 부품 검색 조건/필터, 가격 정보, 선택 부품 가격표, 조합 호환성 체크를 조회한다.
license: MIT
metadata:
  category: retail
  locale: ko-KR
  phase: v1
---

# Danawa PC Estimate

## What this skill does

샵다나와 PC견적의 로그인 없는 공개 화면 요청을 호출해 에이전트가 PC 부품 후보를 찾고, 필터 조건을 적용하고, 선택한 부품 조합의 가격/호환성 결과를 정리한다.

- 부품 카테고리와 검색 옵션 조회
- 제조사, 소켓, 메모리 규격 등 조건 기반 상품 검색
- 상품별 현금/카드 최저가와 스펙 요약 추출
- 선택한 `productSeq` 조합의 호환성 체크
- 선택한 `productSeq` 조합의 견적 가격표 추출

## Boundaries

- 공개 read-only 요청만 사용한다.
- 로그인, 장바구니 저장, 주문, 견적 신청, CAPTCHA/접근통제 우회는 하지 않는다.
- 가격/품절/배송/이벤트는 조회 시점의 샵다나와 노출값으로만 표현한다.
- 호환성은 샵다나와 PC견적의 `compatibility` 응답을 정규화한 결과다. 물리 간섭, BIOS 버전, 케이스 실측, 쿨러 높이 같은 세부 사항은 별도 확인이 필요할 수 있다.

## Package

반복 사용 환경에서는 Node 패키지를 설치해 CLI를 직접 호출한다.

```bash
npm install -g danawa-pc-estimate
danawa-pc-estimate search --category CPU --query 9800X3D --limit 3
```

로컬 저장소에서 개발/검증할 때는 workspace 패키지를 그대로 사용한다.

```bash
npm run lint --workspace danawa-pc-estimate
npm run test --workspace danawa-pc-estimate
node packages/danawa-pc-estimate/bin/danawa-pc-estimate.js search --category CPU --query 9800X3D --limit 3
```

CLI:

```bash
danawa-pc-estimate options --category CPU
danawa-pc-estimate search --category CPU --query 9800X3D --maker AMD --filter "AMD(소켓AM5)" --filter DDR5 --limit 5
danawa-pc-estimate compat 70531547 20324882
danawa-pc-estimate prices 70531547 20324882
```

Programmatic API:

```js
const {
  getSearchOptions,
  searchProducts,
  checkCompatibility,
  extractEstimatePrices
} = require("danawa-pc-estimate")
```

설치된 skill 폴더만 있고 npm 패키지가 없으면 `npx --yes danawa-pc-estimate ...` 로 먼저 smoke test 한다. 패키지가 아직 배포되지 않은 개발 브랜치에서는 repository checkout 안에서 `node packages/danawa-pc-estimate/bin/danawa-pc-estimate.js ...` 를 사용한다.

## Public access path

The package uses these Shop Danawa endpoints:

- `GET /virtualestimate/?controller=estimateMain&methods=wish` for category slots.
- `GET /virtualestimate/?controller=estimateMain&methods=searchOption` for maker/attribute filters.
- `GET /virtualestimate/?controller=estimateMain&methods=product` for product rows and prices.
- `GET /virtualestimate/?controller=estimateMain&methods=compatibility&productSeqList=...` for compatibility JSON.
- `GET /virtualestimate/?controller=estimateMain&methods=estimateByExternalGoodsInfo&productSeqList=...&quantityList=...` for selected-part price tables.

## Workflow

1. Resolve the part category.
   - Common names work: `CPU`, `메인보드`, `메모리`, `그래픽카드`, `SSD`, `케이스`, `파워`.
   - Use `listCategories()` or `categories` CLI if the category is unclear.
2. Inspect filters when the user gives 조건 검색.
   - Call `getSearchOptions("CPU")` or `options --category CPU`.
   - Prefer exact option labels from Danawa, e.g. `AMD`, `AMD(소켓AM5)`, `DDR5`.
3. Search products.
   - Use `searchProducts({ category, query, conditions, limit })`.
   - `conditions` can map natural keys to filters, e.g. `{ manufacturer: "AMD", socket: "AM5", memory: "DDR5" }`.
   - If `unresolvedFilters` is non-empty, tell the user which condition could not be applied.
4. Check compatibility.
   - Pass the selected product codes from search results to `checkCompatibility(["70531547", "20324882"])`.
   - Treat `compatible: true` as "샵다나와 호환성 체크상 문제 없음".
   - For non-`0001` check result codes, surface the normalized messages.
5. Extract selected-part prices.
   - Use `extractEstimatePrices(productSeqList, { quantities })` for the selected quote table.
   - Report cash/card totals separately.

## Response style

- Include product name, `productSeq`, cash price, card price, and a short spec line.
- Say "조회 시점 샵다나와 PC견적 노출가" for prices.
- For compatibility, quote the category pair and the message, not just pass/fail.
- If filters are ambiguous or unresolved, ask for a narrower condition or show available option labels from `getSearchOptions`.

## Failure modes

- Danawa can change HTML structure or endpoint parameters.
- Some endpoint responses are EUC-KR pages; use the package decoder instead of ad hoc UTF-8 reads.
- Empty product lists can mean a real no-result, unsupported filter combination, or upstream layout change.
- Compatibility requires enough relevant parts. For example, CPU alone returns a message asking for memory or motherboard.

## Done when

- The category and applied filters are clear.
- Candidate parts or an explicit no-result reason are returned.
- Price fields are labeled as cash/card and tied to the lookup time.
- Compatibility checks include the raw Danawa result messages when there is a mismatch.
