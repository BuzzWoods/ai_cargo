import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRequest } from "ahooks";
import {
  Alert,
  Button,
  Input,
  Modal,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableProps } from "antd";
import {
  fetchShipmentBatchPlanList,
  type LogisticsShipmentBatchPlan,
  type LogisticsShipmentPlan,
  type ShipmentBatchPlanQuery,
} from "../../api/shipmentBatch";

const { Text } = Typography;

interface ShipmentBatchSelectorModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (batchPlanNos: string[]) => void;
}

type ShipmentPlanRow = LogisticsShipmentPlan & {
  rowKey: string;
  parentKey: string;
};

type ShipmentBatchRow = LogisticsShipmentBatchPlan & {
  rowKey: string;
  childRows: ShipmentPlanRow[];
};

const DEFAULT_PAGE_SIZE = 20;

const buildBatchRowKey = (batch: LogisticsShipmentBatchPlan, index: number) =>
  `batch-${batch.id ?? batch.batchPlanNo ?? index}`;

const buildPlanRowKey = (
  batchRowKey: string,
  plan: LogisticsShipmentPlan,
  index: number,
) => `${batchRowKey}-plan-${plan.id ?? plan.shipmentPlanNo ?? index}`;

const renderText = (value?: string | number | null) =>
  value === undefined || value === null || value === "" ? "-" : value;

const getApprovalText = (plan: LogisticsShipmentPlan) => {
  const process = plan.approvalProcess;
  const users = process?.bpmTaskVOs
    ?.map((user) => user.realName)
    .filter(Boolean)
    .join("、");

  if (!process?.nodeName && !users) {
    return "-";
  }

  return [process?.nodeName, users].filter(Boolean).join(" / ");
};

const normalizeBatchRows = (
  list: LogisticsShipmentBatchPlan[],
): ShipmentBatchRow[] =>
  list.map((batch, batchIndex) => {
    const rowKey = buildBatchRowKey(batch, batchIndex);
    const childRows = (batch.logisticsShipmentPlanList ?? []).map(
      (plan, planIndex) => ({
        ...plan,
        rowKey: buildPlanRowKey(rowKey, plan, planIndex),
        parentKey: rowKey,
      }),
    );

    return {
      ...batch,
      rowKey,
      childRows,
    };
  });

const ShipmentBatchSelectorModal: React.FC<ShipmentBatchSelectorModalProps> = ({
  open,
  onCancel,
  onConfirm,
}) => {
  const [rows, setRows] = useState<ShipmentBatchRow[]>([]);
  const [pageNum, setPageNum] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState("");
  const [queryKeyword, setQueryKeyword] = useState("");
  const [selectedBatchMap, setSelectedBatchMap] = useState<
    Record<string, ShipmentBatchRow>
  >({});
  const [selectedPlanKeys, setSelectedPlanKeys] = useState<Set<string>>(
    () => new Set(),
  );
  const queryRef = useRef<ShipmentBatchPlanQuery>({
    pageNum: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    keyword: "",
  });

  const selectedBatchRows = useMemo(
    () => Object.values(selectedBatchMap),
    [selectedBatchMap],
  );
  const selectedBatchNos = selectedBatchRows
    .map((batch) => batch.batchPlanNo)
    .filter((batchPlanNo): batchPlanNo is string => Boolean(batchPlanNo));

  const { loading, error, run } = useRequest(
    () => fetchShipmentBatchPlanList(queryRef.current),
    {
      manual: true,
      onSuccess: (page) => {
        setRows(normalizeBatchRows(page.list));
        setTotal(page.total ?? 0);
      },
      onError: () => {
        setRows([]);
        setTotal(0);
      },
    },
  );

  const loadBatchPlans = useCallback(
    (nextPageNum: number, nextPageSize: number, nextKeyword: string) => {
      queryRef.current = {
        pageNum: nextPageNum,
        pageSize: nextPageSize,
        keyword: nextKeyword,
      };
      run();
    },
    [run],
  );

  useEffect(() => {
    if (open) {
      loadBatchPlans(pageNum, pageSize, queryKeyword);
    }
  }, [loadBatchPlans, open, pageNum, pageSize, queryKeyword]);

  const toggleBatchSelection = (batch: ShipmentBatchRow, selected: boolean) => {
    setSelectedBatchMap((current) => {
      const next = { ...current };

      if (selected) {
        next[batch.rowKey] = batch;
      } else {
        delete next[batch.rowKey];
      }

      return next;
    });

    setSelectedPlanKeys((current) => {
      const next = new Set(current);

      batch.childRows.forEach((plan) => {
        if (selected) {
          next.add(plan.rowKey);
        } else {
          next.delete(plan.rowKey);
        }
      });

      return next;
    });
  };

  const toggleBatchListSelection = (
    batchRows: ShipmentBatchRow[],
    selected: boolean,
  ) => {
    setSelectedBatchMap((current) => {
      const next = { ...current };

      batchRows.forEach((batch) => {
        if (selected) {
          next[batch.rowKey] = batch;
        } else {
          delete next[batch.rowKey];
        }
      });

      return next;
    });

    setSelectedPlanKeys((current) => {
      const next = new Set(current);

      batchRows.forEach((batch) => {
        batch.childRows.forEach((plan) => {
          if (selected) {
            next.add(plan.rowKey);
          } else {
            next.delete(plan.rowKey);
          }
        });
      });

      return next;
    });
  };

  const updateChildSelection = (
    batch: ShipmentBatchRow,
    nextSelectedPlanKeys: React.Key[],
  ) => {
    const selectedChildKeySet = new Set(nextSelectedPlanKeys.map(String));

    setSelectedPlanKeys((current) => {
      const next = new Set(current);

      batch.childRows.forEach((plan) => {
        if (selectedChildKeySet.has(plan.rowKey)) {
          next.add(plan.rowKey);
        } else {
          next.delete(plan.rowKey);
        }
      });

      return next;
    });

    setSelectedBatchMap((current) => {
      const next = { ...current };

      if (selectedChildKeySet.size) {
        next[batch.rowKey] = batch;
      } else {
        delete next[batch.rowKey];
      }

      return next;
    });
  };

  const parentColumns: TableProps<ShipmentBatchRow>["columns"] = [
    {
      title: "出货批次编号",
      dataIndex: "batchPlanNo",
      width: 190,
      render: (value) => <Text strong>{renderText(value)}</Text>,
    },
    {
      title: "创建人",
      dataIndex: "createByName",
      width: 120,
      render: renderText,
    },
    {
      title: "创建时间",
      dataIndex: "createTime",
      width: 180,
      render: renderText,
    },
    {
      title: "批次备注",
      dataIndex: "remark",
      render: renderText,
    },
  ];

  const childColumns: TableProps<ShipmentPlanRow>["columns"] = [
    {
      title: "出货计划编号",
      dataIndex: "shipmentPlanNo",
      width: 170,
      render: renderText,
    },
    {
      title: "SKU 信息",
      width: 220,
      render: (_, record) => (
        <div className="space-y-1">
          <div className="font-medium text-slate-900">
            {renderText(record.skuInfo?.sku)}
          </div>
          <div className="text-xs text-slate-500">
            {renderText(record.skuInfo?.productName)}
          </div>
        </div>
      ),
    },
    {
      title: "SPU 信息",
      width: 180,
      render: (_, record) => (
        <div className="space-y-1">
          <div className="font-medium text-slate-900">
            {renderText(record.spuInfo?.spu)}
          </div>
          <div className="text-xs text-slate-500">
            {renderText(record.spuInfo?.styleName)}
          </div>
        </div>
      ),
    },
    {
      title: "计划出货量",
      dataIndex: "plannedShipmentQuantity",
      width: 120,
      render: renderText,
    },
    {
      title: "出货状态",
      dataIndex: "shipmentStatus",
      width: 120,
      render: (value) =>
        value ? (
          <Tag color="blue">{value}</Tag>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: "目的国家待出货量",
      width: 160,
      render: (_, record) => (
        <div className="space-y-1">
          <div>{renderText(record.countryName)}</div>
          <div className="text-xs text-slate-500">
            待出货：{renderText(record.waitShipmentQuantity)}
          </div>
        </div>
      ),
    },
    {
      title: "审批流程",
      width: 220,
      render: (_, record) => getApprovalText(record),
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: renderText,
    },
  ];

  const parentRowSelection: TableProps<ShipmentBatchRow>["rowSelection"] = {
    selectedRowKeys: Object.keys(selectedBatchMap),
    preserveSelectedRowKeys: true,
    onSelect: (record, selected) => toggleBatchSelection(record, selected),
    onSelectAll: (selected, _selectedRows, changeRows) =>
      toggleBatchListSelection(changeRows, selected),
  };

  const renderExpandedRow = (batch: ShipmentBatchRow) => (
    <Table<ShipmentPlanRow>
      rowKey="rowKey"
      columns={childColumns}
      dataSource={batch.childRows}
      pagination={false}
      size="small"
      scroll={{ x: 1260 }}
      rowSelection={{
        selectedRowKeys: batch.childRows
          .map((plan) => plan.rowKey)
          .filter((rowKey) => selectedPlanKeys.has(rowKey)),
        preserveSelectedRowKeys: true,
        onChange: (nextSelectedRowKeys) =>
          updateChildSelection(batch, nextSelectedRowKeys),
      }}
    />
  );

  return (
    <Modal
      title="选择出货批次"
      open={open}
      width={1180}
      onCancel={onCancel}
      destroyOnHidden
      footer={
        <div className="flex items-center justify-between gap-3">
          <Text type="secondary">
            已选择 {selectedBatchNos.length} 个出货批次
          </Text>
          <Space>
            <Button onClick={onCancel}>取消</Button>
            <Button
              type="primary"
              disabled={!selectedBatchNos.length}
              onClick={() => onConfirm(selectedBatchNos)}
            >
              确定添加
            </Button>
          </Space>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Input.Search
            allowClear
            value={keyword}
            placeholder="按出货批次编号模糊搜索"
            className="max-w-sm"
            onChange={(event) => setKeyword(event.target.value)}
            onSearch={(value) => {
              setPageNum(1);
              setQueryKeyword(value.trim());
            }}
          />
          <Button
            onClick={() => {
              setKeyword("");
              setQueryKeyword("");
              setPageNum(1);
            }}
          >
            重置
          </Button>
        </div>

        {selectedBatchNos.length ? (
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="mb-2 text-xs font-semibold text-slate-500">
              已选出货批次
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedBatchRows.map((batch) => (
                <Tag
                  key={batch.rowKey}
                  closable
                  color="blue"
                  onClose={(event) => {
                    event.preventDefault();
                    toggleBatchSelection(batch, false);
                  }}
                >
                  {batch.batchPlanNo}
                </Tag>
              ))}
            </div>
          </div>
        ) : null}

        {error ? <Alert type="error" showIcon title={error.message} /> : null}

        <Table<ShipmentBatchRow>
          rowKey="rowKey"
          columns={parentColumns}
          dataSource={rows}
          loading={loading}
          rowSelection={parentRowSelection}
          expandable={{
            expandedRowRender: renderExpandedRow,
            rowExpandable: (record) => record.childRows.length > 0,
          }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (count) => `共 ${count} 条`,
            onChange: (nextPageNum, nextPageSize) => {
              setPageNum(nextPageNum);
              setPageSize(nextPageSize);
            },
          }}
          scroll={{ x: 860 }}
        />
      </div>
    </Modal>
  );
};

export default ShipmentBatchSelectorModal;
