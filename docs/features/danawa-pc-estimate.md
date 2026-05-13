# 다나와 PC견적 가이드

## 이 기능으로 할 수 있는 일

- 샵다나와 PC견적 부품 카테고리별 상품 검색
- 제조사, 소켓, 메모리 규격 같은 검색 옵션 적용
- 상품별 현금/카드 노출가와 스펙 요약 추출
- 선택한 부품 조합의 샵다나와 호환성 체크
- 선택한 부품 조합의 견적 가격표와 합계 추출

## 먼저 필요한 것

- 인터넷 연결
- `node` 18+
- 반복 사용이면 `npm install -g danawa-pc-estimate`

로그인, 장바구니, 주문, 견적 신청은 필요하지 않다. 이 스킬은 공개 read-only 요청만 사용한다.

## 입력값

- 부품 카테고리
  - 예: `CPU`, `메인보드`, `메모리`, `그래픽카드`, `SSD`, `케이스`, `파워`
- 검색어
  - 예: `9800X3D`, `B650`, `RTX 5070`
- 조건
  - 예: 제조사 `AMD`
  - 예: 소켓 `AMD(소켓AM5)`
  - 예: 메모리 규격 `DDR5`
- 호환성 체크용 `productSeq`
  - 상품 검색 결과의 `code` / `productSeq` 값을 그대로 사용한다.

## 공개 표면

- category slots: `https://shop.danawa.com/virtualestimate/?controller=estimateMain&methods=wish`
- option filters: `https://shop.danawa.com/virtualestimate/?controller=estimateMain&methods=searchOption`
- product list: `https://shop.danawa.com/virtualestimate/?controller=estimateMain&methods=product`
- compatibility JSON: `https://shop.danawa.com/virtualestimate/?controller=estimateMain&methods=compatibility`
- selected quote table: `https://shop.danawa.com/virtualestimate/?controller=estimateMain&methods=estimateByExternalGoodsInfo`

## 기본 흐름

1. 카테고리를 정한다. 애매하면 `categories` 명령으로 설치된 카테고리 이름을 확인한다.
2. 조건 검색이 필요하면 `options --category <카테고리>` 로 다나와가 노출하는 옵션명을 확인한다.
3. `search` 로 상품 후보를 찾고, `productSeq`, 현금가, 카드가, 스펙을 정리한다.
4. 사용자가 고른 `productSeq` 목록을 `compat` 에 넣어 호환성 결과를 확인한다.
5. 최종 조합은 `prices` 로 견적 가격표를 뽑아 현금/카드 합계를 분리해 답한다.

## CLI 예시

```bash
danawa-pc-estimate options --category CPU

danawa-pc-estimate search \
  --category CPU \
  --query 9800X3D \
  --maker AMD \
  --filter "AMD(소켓AM5)" \
  --filter DDR5 \
  --limit 5

danawa-pc-estimate compat 70531547 20324882
danawa-pc-estimate prices 70531547 20324882
```

로컬 저장소에서 개발 중이면 전역 설치 대신 아래처럼 직접 실행한다.

```bash
node packages/danawa-pc-estimate/bin/danawa-pc-estimate.js search --category CPU --query 9800X3D --limit 3
```

## Node API 예시

```js
const {
  searchProducts,
  checkCompatibility,
  extractEstimatePrices
} = require("danawa-pc-estimate")

async function main() {
  const cpus = await searchProducts({
    category: "CPU",
    query: "9800X3D",
    conditions: {
      manufacturer: "AMD",
      socket: "AM5",
      memory: "DDR5"
    },
    limit: 3
  })

  const compatibility = await checkCompatibility(["70531547", "20324882"])
  const prices = await extractEstimatePrices(["70531547", "20324882"])

  console.log({ cpus: cpus.items, compatibility, prices })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
```

## 실전 운영 팁

- 다나와 검색 옵션은 카테고리마다 다르다. 조건이 안 잡히면 먼저 `options` 출력의 정확한 라벨을 보여 주고 사용자에게 선택하게 한다.
- `cashPrice`는 현금 최저가, `cardPrice`는 카드 최저가다. 둘 중 하나가 `0`이면 해당 결제수단 노출가가 없거나 판매준비 상태로 본다.
- 호환성 결과는 `compatible` 과 `checks[].messages` 를 같이 보여 준다. 불일치가 있으면 메시지에 들어 있는 소켓/규격 차이를 그대로 설명한다.
- 가격/품절/이벤트는 조회 시점 샵다나와 PC견적 노출값이다.
- BIOS 버전, 케이스 내부 간섭, 쿨러 높이, 그래픽카드 길이 같은 세부 물리 조건은 별도 확인이 필요할 수 있다.

## 라이브 확인 메모

2026-05-13 기준 아래 공개 호출이 로그인 없이 응답했다.

- `GET methods=product&categorySeq=873&name=9800X3D` → `70531547` 포함 CPU 후보와 현금/카드가 확인
- `GET methods=compatibility&productSeqList=70531547,20324882` → `cpu-mainboard` 결과 `0001`, "호환 문제 없습니다." 확인
- `GET methods=estimateByExternalGoodsInfo&productSeqList=70531547,20324882&quantityList=1,1` → CPU/메인보드 가격표와 현금/카드 합계 확인

이 표면은 샵다나와 프론트엔드 내부 요청이므로 HTML 구조나 파라미터가 바뀌면 패키지 파서 수정이 필요할 수 있다.
