# danawa-pc-estimate

Read-only Shop Danawa PC estimate client for product search, option filters, selected-part price tables, and compatibility checks.

```bash
npm install -g danawa-pc-estimate
danawa-pc-estimate search --category CPU --query 9800X3D --maker AMD --filter "AMD(소켓AM5)" --filter DDR5 --limit 3
danawa-pc-estimate compat 70531547 20324882
danawa-pc-estimate prices 70531547 20324882
```

```js
const { searchProducts, checkCompatibility } = require("danawa-pc-estimate")

const cpus = await searchProducts({
  category: "CPU",
  query: "9800X3D",
  conditions: { manufacturer: "AMD", socket: "AM5", memory: "DDR5" },
  limit: 3
})

const compatibility = await checkCompatibility(["70531547", "20324882"])
```

The client uses public, login-free Shop Danawa PC estimate endpoints and does not perform cart, order, login, CAPTCHA, or bypass automation.
