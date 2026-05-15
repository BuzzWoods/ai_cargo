import {
  createApiUrl,
  getResponseErrorMessage,
  unwrapApiResponseData,
} from "./http";

export interface ShipmentBatchPlanQuery {
  pageNum: number;
  pageSize: number;
  keyword?: string;
}

export interface ShipmentApprovalTaskUser {
  flag?: boolean;
  realName?: string;
  userId?: number;
}

export interface ShipmentApprovalProcess {
  bpmTaskVOs?: ShipmentApprovalTaskUser[];
  id?: number;
  nodeName?: string;
}

export interface ShipmentSkuInfo {
  productName?: string;
  productNameEn?: string;
  productType?: string;
  sku?: string;
  skuId?: number;
}

export interface ShipmentSpuInfo {
  spu?: string;
  spuId?: number;
  styleName?: string;
}

export interface LogisticsShipmentPlan {
  id?: number;
  shipmentPlanNo?: string;
  skuInfo?: ShipmentSkuInfo | null;
  spuInfo?: ShipmentSpuInfo | null;
  plannedShipmentQuantity?: number;
  waitShipmentQuantity?: number;
  shipmentStatus?: string;
  countryName?: string;
  destinationCountryArea?: string;
  approvalProcess?: ShipmentApprovalProcess | null;
  status?: string;
}

export interface LogisticsShipmentBatchPlan {
  id?: number;
  batchPlanNo?: string;
  createBy?: number;
  createByName?: string;
  createTime?: string;
  remark?: string;
  logisticsShipmentPlanList?: LogisticsShipmentPlan[];
}

export interface ShipmentBatchPlanPage {
  list: LogisticsShipmentBatchPlan[];
  pageNum?: number;
  pageSize?: number;
  total?: number;
}

// 弹窗查询目前只暴露批次编号模糊搜索和分页，其余固定参数按当前后端联调口径补齐。
const createShipmentBatchRequestBody = ({
  pageNum,
  pageSize,
  keyword = "",
}: ShipmentBatchPlanQuery) => ({
  dateQuery: {
    beginTime: "2026-03-29",
    endTime: "2026-04-27",
    timeType: "create_time",
  },
  queryType: {
    qryField: "batchPlanNo",
    qryType: "fuzzy",
    value: keyword,
    values: [],
  },
  pageNum,
  pageSize,
});

export const fetchShipmentBatchPlanList = async (
  query: ShipmentBatchPlanQuery,
  signal?: AbortSignal,
): Promise<ShipmentBatchPlanPage> => {
  // 业务单号列表是普通 HTTP 查询，不参与聊天 SSE；它只负责辅助组装输入框文本。
  const response = await fetch(createApiUrl("chat/getShipmentBatchPlanList"), {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(createShipmentBatchRequestBody(query)),
  });

  if (!response.ok) {
    throw new Error(
      `查询出货批次失败: ${await getResponseErrorMessage(response)}`,
    );
  }

  const rawJson = (await response.json()) as unknown;
  const rawRecord =
    rawJson && typeof rawJson === "object"
      ? (rawJson as Record<string, unknown>)
      : null;

  if (rawRecord?.success === false) {
    throw new Error(
      typeof rawRecord.msg === "string" && rawRecord.msg
        ? rawRecord.msg
        : "查询出货批次失败",
    );
  }

  // 成功响应也做一层空数组兜底，避免表格因为 list 缺失直接崩。
  const data = unwrapApiResponseData(rawJson) as Partial<ShipmentBatchPlanPage>;

  return {
    list: Array.isArray(data.list) ? data.list : [],
    pageNum: data.pageNum,
    pageSize: data.pageSize,
    total: data.total,
  };
};
