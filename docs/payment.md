# 计费与收款对接

DesignKit Commerce 采用 **租户（Workspace）订阅制**，计费主体是租户而不是个人。当前实现支持两条收款路径：

1. **人工开通 / 线下收款**：运营在管理后台创建订单并标记到账，或直接新建「已支付」订单。
2. **支付平台回调**：外部网关（Stripe / 支付宝 / 微信 / 自建适配层）以 HMAC 签名的回调推进订单状态。

无论走哪条路径，最终都会执行同一个方法：把套餐的 `sku_quota`、`export_quota` 套到租户上，并写入审计日志。

---

## 1. 数据模型

| 表 | 用途 | 关键字段 |
| --- | --- | --- |
| `plans` | 套餐定义 | `code`、`price_cents`、`sku_quota`、`export_quota`、`features` |
| `orders` | 订单与收款记录 | `workspace_id`、`plan_code`、`amount_cents`、`status`、`channel`、`paid_at` |
| `coupons` | 优惠码 | `code`、`percent_off`、`amount_off_cents`、`max_redemptions`、`redeemed` |
| `feature_flags` | 运营开关 | `key`、`enabled` |
| `usage_ledger` | 不可变用量流水 | `event`、`units`、`cost_cents`、`note` |

订单状态机：`pending → paid → refunded`，`pending → void`。已支付订单不能再作废，重复回调按幂等处理。

配额口径：订单标记为 `paid` 时**整体覆盖**租户配额（等于套餐值），不做累加；退款只改订单状态，不自动回收配额，需要运营在租户页按需调整。

---

## 2. 支付回调接口

```
POST /v1/webhooks/payments/{provider}
X-Payment-Signature: <hex(HMAC-SHA256(PAYMENT_WEBHOOK_SECRET, raw_body))>
Content-Type: application/json
```

`provider` 取值：`stripe` | `alipay` | `wechat` | `generic`，只用于订单渠道标记与审计，校验逻辑一致。

请求体（统一契约，由适配层把各平台事件转换成这个结构）：

```json
{
  "order_id": "5d0f0e36-...",
  "status": "paid",
  "amount_cents": 9900,
  "provider_txn_id": "pi_3Oxxxx",
  "note": "growth 年付"
}
```

响应：

| 场景 | 状态码 | 说明 |
| --- | --- | --- |
| 首次确认收款 | `200` | `{"status":"paid","already_paid":false}`，同时套用套餐配额 |
| 重复通知 | `200` | `{"status":"paid","already_paid":true}`，幂等确认，不重复开通 |
| 签名错误 | `401` | `bad_signature` |
| 未配置密钥 | `503` | `webhook_disabled` |
| 状态不允许（如对已支付订单发 `void`） | `409` | `invalid_transition` |

实现要点：

- 回调接口**不挂**用户或管理员令牌中间件，只认 HMAC；签名对**原始字节**计算，不要先解析再序列化。
- 幂等边界在数据库事务内判断，重复回调不会二次扣减或二次开通。
- 金额以回调体为准写入订单（便于对账差异排查），但套餐配额只由 `plan_code` 决定。

安全配置：

```bash
PAYMENT_WEBHOOK_SECRET=<32 字节以上随机串>
```

该值同时配到支付平台的 webhook 签名密钥。未配置时接口返回 503，避免出现"任何人都能开通套餐"的裸奔状态。

---

## 3. 人工到账确认

```
POST /v1/admin/orders/{orderID}/paid
Authorization: Bearer <platform_admin_token>
{ "amount_cents": 9900, "note": "银行转账已到账" }
```

用于银行转账、对公汇款等线下渠道。语义与回调的 `status=paid` 完全一致：订单转 `paid`、写 `paid_at`、套用套餐配额、写审计。重复调用返回 `409`。

---

## 4. 接入真实网关时要做的事

1. 在支付平台创建商品/价格，与 `plans.code` 一一对应（建议用 `plan_code` 作为 metadata）。
2. 写一个薄适配层（可独立部署）：接收平台 webhook → 校验平台自身签名 → 查询平台订单确认金额与状态 → 转换成上面的统一契约 → 转发到 `/v1/webhooks/payments/{provider}`。
3. 上线前用平台测试模式跑通：成功支付、重复通知、过期支付、退款通知四条路径。
4. 退款回调只改订单状态；如果要自动降级租户，运营在租户页手动处理，避免自动回收造成资产不可访问。

> 当前版本未内置任何支付 SDK：一人公司阶段先用「人工开通 + 线下收款」验证付费意愿，等有稳定付费客户再接网关，避免过早引入商户资质与对账成本。
