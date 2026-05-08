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

  const data = unwrapApiResponseData(rawJson) as Partial<ShipmentBatchPlanPage>;

  return {
    list: Array.isArray(data.list) ? data.list : [],
    pageNum: data.pageNum,
    pageSize: data.pageSize,
    total: data.total,
  };
};
