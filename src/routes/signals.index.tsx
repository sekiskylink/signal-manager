import { createRoute, useLoaderData } from "@tanstack/react-router";
import {
    Button,
    DatePicker,
    Flex,
    FloatButton,
    Input,
    InputRef,
    Space,
    Table,
    TableColumnType,
    TableProps,
    Tag,
    Typography,
} from "antd";
import dayjs from "dayjs";
import React, { useMemo, useRef, useState } from "react";
import SignalModal from "../components/signal-modal";
import { EventWithValues } from "../types";
import { currentStatus, nextAction, getUniqueNumber } from "../utils/utils";

import { CloseOutlined, PlusOutlined, SearchOutlined } from "@ant-design/icons";
import { FilterDropdownProps } from "antd/es/table/interface";
import { querySignals } from "../collections";
import { SignalContext } from "../machines/signal";
import { SignalsRoute } from "./signals";
import { generateUid } from "../utils/id";
import { RootRoute } from "./__root";

const nextLabels: Record<string, string> = {
    "0": "Create Signal",
    "1": "Triage Signal",
    "2": "Verify Signal",
    "3": "Assess Risk",
    "4": "Archived",
};

const riskColors: Record<string, string> = {
    "Very High": "#ff4d4f",
    High: "#ff7a45",
    Moderate: "#ffa940",
    Low: "#fadb14",
};
export const SignalsIndexRoute = createRoute({
    getParentRoute: () => SignalsRoute,
    path: "/",
    component: SignalsRouteComponent,
});

function SignalsRouteComponent() {
    const { assignedDistricts } = RootRoute.useLoaderData();
    const signals = SignalContext.useSelector((state) => state.context.signals);
    const total = SignalContext.useSelector((state) => state.context.total);
    const activeFilters = SignalContext.useSelector(
        (state) => state.context.search.filters,
    );
    const current = SignalContext.useSelector(
        (state) => state.context.search.pagination?.current || 1,
    );
    const pageSize = SignalContext.useSelector(
        (state) => state.context.search.pagination?.pageSize || 10,
    );
    const loading = SignalContext.useSelector((state) =>
        state.matches("loading"),
    );
    const signalActorRef = SignalContext.useActorRef();
    const [open, setOpen] = useState(false);
    const [tableKey, setTableKey] = useState(0);
    const { programStageDataElements } = useLoaderData({ from: "__root__" });
    const dataElements = Array.from(programStageDataElements.values()).filter(
        (de) => de.displayInReports,
    );

    const all: Array<(typeof dataElements)[number] & { compulsory: boolean }> =
        [
            {
                formName: "Status",
                name: "status",
                id: "status",
                compulsory: true,
                code: "status",
                valueType: "TEXT",
                optionSet: {
                    options: [],
                },
                optionSetValue: false,
                displayInReports: true,
            },
            {
                formName: "Event Date",
                name: "Event Date",
                id: "eventDate",
                compulsory: true,
                code: "eventDate",
                valueType: "DATETIME",
                optionSet: {
                    options: [],
                },
                optionSetValue: false,
                displayInReports: true,
            },
            {
                formName: "District",
                name: "District",
                id: "orgUnit",
                compulsory: true,
                code: "orgUnit",
                valueType: "TEXT",
                optionSet: {
                    options: [],
                },
                optionSetValue: false,
                displayInReports: true,
            },
            ...dataElements,
            {
                formName: "Actions",
                name: "actions",
                id: "actions",
                compulsory: true,
                code: "actions",
                valueType: "TEXT",
                optionSet: {
                    options: [],
                },
                optionSetValue: false,
                displayInReports: true,
            },
        ];
    const performAction = (
        event: Awaited<ReturnType<typeof querySignals>>["events"][number],
    ) => {
        signalActorRef.send({
            type: "SET_SIGNAL",
            signal: event,
        });
        signalActorRef.send({
            type: "SET_ACTION",
            action: "UPDATE",
        });
        setOpen(() => true);
    };

    const [, setSearchText] = useState("");
    const [, setSearchedColumn] = useState("");
    const searchInput = useRef<InputRef>(null);

    const handleSearch = (
        selectedKeys: string[],
        confirm: () => void,
        dataIndex: keyof EventWithValues,
    ) => {
        confirm();
        setSearchText(selectedKeys[0]);
        setSearchedColumn(dataIndex);
    };

    const handleReset = (clearFilters?: () => void) => {
        clearFilters?.();
        setSearchText("");
    };

    const getColumnSearchProps = (
        dataIndex: (typeof dataElements)[number],
    ): TableColumnType<
        Awaited<ReturnType<typeof querySignals>>["events"][number]
    > => {
        let filterDropdown = undefined;

        if (
            dataIndex.valueType === "DATE" ||
            dataIndex.valueType === "DATETIME" ||
            dataIndex.valueType === "TIME" ||
            dataIndex.valueType === "AGE"
        ) {
            filterDropdown = ({
                setSelectedKeys,
                selectedKeys,
                confirm,
                clearFilters,
                close,
            }: FilterDropdownProps) => (
                <div
                    style={{ padding: 8 }}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <DatePicker
                        onChange={(date, dateString) => {
                            setSelectedKeys([dateString].flat());
                        }}
                        value={
                            selectedKeys[0]
                                ? dayjs(String(selectedKeys[0]))
                                : null
                        }
                        style={{ marginBottom: 8, display: "block" }}
                    />
                    <Space>
                        <Button
                            type="primary"
                            onClick={() =>
                                handleSearch(
                                    selectedKeys as string[],
                                    confirm,
                                    dataIndex.id as keyof EventWithValues,
                                )
                            }
                            icon={<SearchOutlined />}
                            size="small"
                            style={{ width: 90 }}
                        >
                            Search
                        </Button>
                        <Button
                            onClick={() => handleReset(clearFilters)}
                            size="small"
                            style={{ width: 90 }}
                        >
                            Reset
                        </Button>
                        <Button
                            type="link"
                            size="small"
                            onClick={() => {
                                close();
                            }}
                        >
                            Close
                        </Button>
                    </Space>
                </div>
            );
        } else if (dataIndex.optionSetValue === false) {
            filterDropdown = ({
                setSelectedKeys,
                selectedKeys,
                confirm,
                clearFilters,
            }: FilterDropdownProps) => (
                <div
                    style={{ padding: 8 }}
                    onKeyDown={(e) => e.stopPropagation()}
                >
                    <Input
                        ref={searchInput}
                        placeholder={`Search ${String(
                            dataIndex.formName || dataIndex.name,
                        )}`}
                        value={selectedKeys[0]}
                        onChange={(e) =>
                            setSelectedKeys(
                                e.target.value ? [e.target.value] : [],
                            )
                        }
                        onPressEnter={() =>
                            handleSearch(
                                selectedKeys as string[],
                                confirm,
                                dataIndex.id as keyof EventWithValues,
                            )
                        }
                        style={{ marginBottom: 8, display: "block" }}
                    />
                    <Space>
                        <Button
                            type="primary"
                            onClick={() =>
                                handleSearch(
                                    selectedKeys as string[],
                                    confirm,
                                    dataIndex.id as keyof EventWithValues,
                                )
                            }
                            icon={<SearchOutlined />}
                            size="small"
                            style={{ width: 90 }}
                        >
                            Search
                        </Button>
                        <Button
                            onClick={() => handleReset(clearFilters)}
                            size="small"
                            style={{ width: 90 }}
                        >
                            Reset
                        </Button>
                    </Space>
                </div>
            );
        }
        if (dataIndex.optionSetValue && dataIndex.optionSet?.options) {
            return {
                filters: dataIndex.optionSet.options.map((opt) => ({
                    text: opt.name,
                    value: opt.code,
                })),
                onFilterDropdownOpenChange: (visible) => {
                    if (visible) {
                        setTimeout(() => searchInput.current?.select(), 100);
                    }
                },
            };
        }

        return {
            filterDropdown,
            onFilterDropdownOpenChange: (visible) => {
                if (visible) {
                    setTimeout(() => searchInput.current?.select(), 100);
                }
            },
        };
    };
    const columns: TableProps<
        Awaited<ReturnType<typeof querySignals>>["events"][number]
    >["columns"] = useMemo(() => {
        return all.flatMap((de) => {
            if (de.id === "status") {
                return {
                    title: de.formName || de.name,
                    key: de.id,
                    render: (_, record) => {
                        const { text, color } = currentStatus(record);
                        return (
                            <Tag color={color} style={{ fontSize: 13 }}>
                                {text}
                            </Tag>
                        );
                    },
                    align: "center",
                    fixed: "left",
                };
            }
            if (de.id === "orgUnit") {
                return {
                    title: de.formName || de.name,
                    key: de.id,
                    render: (_, record) => {
                        return (
                            <span>
                                {assignedDistricts.find(
                                    (d) => d.value === record.orgUnit,
                                )?.label || record.orgUnit}
                            </span>
                        );
                    },
                    ...getColumnSearchProps(de),
                };
            }
            if (de.id === "actions") {
                return {
                    title: "Actions",
                    dataIndex: "actions",
                    render: (
                        _,
                        record: Awaited<
                            ReturnType<typeof querySignals>
                        >["events"][number],
                    ) => {
                        const action = nextAction(record.dataValues);
                        return (
                            <Button
                                type="primary"
                                onClick={() => performAction(record)}
                                style={{
                                    background:
                                        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    border: "none",
                                    width: 100,
                                }}
                            >
                                {nextLabels[action.next] || "View"}
                            </Button>
                        );
                    },
                    align: "center",
                    fixed: "right",
                };
            }

            if (de.id === "eventDate") {
                return {
                    title: <span>Date of Report</span>,
                    key: de.id,
                    render: (_, record) => {
                        return (
                            <Tag color="blue" style={{ fontSize: 13 }}>
                                {dayjs(record.eventDate).format("DD/MM/YYYY")}
                            </Tag>
                        );
                    },
                    fixed: "left",
                    ...getColumnSearchProps(de),
                };
            }

            if (de.id === "x84ZTtD0Z8u") {
                return {
                    title: de.formName || de.name,
                    key: de.id,
                    render: (
                        _,
                        record: Awaited<
                            ReturnType<typeof querySignals>
                        >["events"][number],
                    ) => {
                        const val = record.dataValues?.[de.id];
                        return val ? (
                            <Tag
                                color={riskColors[val] || "default"}
                                style={{ fontSize: 13 }}
                            >
                                {val}
                            </Tag>
                        ) : null;
                    },
                    ...getColumnSearchProps(de),
                };
            }

            return {
                title: de.formName || de.name,
                key: de.id,
                render: (
                    _,
                    record: Awaited<
                        ReturnType<typeof querySignals>
                    >["events"][number],
                ) => {
                    const val =
                        record[de.id as keyof typeof record] ||
                        record.dataValues?.[de.id];

                    if (val && de.valueType === "BOOLEAN") {
                        return val === "true" ? (
                            <Tag color="success">Yes</Tag>
                        ) : (
                            <Tag color="default">No</Tag>
                        );
                    }
                    if (
                        val &&
                        (de.valueType === "DATE" ||
                            de.valueType === "DATETIME" ||
                            de.valueType === "TIME" ||
                            de.valueType === "AGE")
                    ) {
                        return dayjs(String(val)).format("DD/MM/YYYY");
                    }
                    return String(val ?? "");
                },
                ...getColumnSearchProps(de),
            };
        });
    }, [dataElements]);

    const onChange: TableProps<
        Awaited<ReturnType<typeof querySignals>>["events"][number]
    >["onChange"] = (pagination, filters, sorter, extra) => {
        signalActorRef.send({
            type: "FETCH_NEXT_PAGE",
            search: { pagination, filters },
        });
    };

    const addSignal = () => {
        signalActorRef.send({
            type: "SET_SIGNAL",
            signal: {
                programStage: "Nnnqw1XKpZL",
                programType: "WITHOUT_REGISTRATION",
                orgUnit: "",
                program: "iaN1DovM5em",
                event: generateUid(),
                status: "COMPLETED",
                orgUnitName: "Hoima District",
                eventDate: dayjs().format("YYYY-MM-DD"),
                created: dayjs().format("YYYY-MM-DD"),
                lastUpdated: dayjs().format("YYYY-MM-DD"),
                deleted: false,
                attributeOptionCombo: "HllvX50cXC0",
                dataValues: { SXmppM2WKNo: `SIG-${getUniqueNumber()}` },
            },
        });
        signalActorRef.send({
            type: "SET_ACTION",
            action: "CREATE",
        });
        signalActorRef.send({
            type: "NEXT_ACTION",
            action: "0",
        });
        setOpen(true);
    };

    const getFilterDisplayName = (key: string) => {
        const element = all.find((de) => de.id === key);
        return element?.formName || element?.name || key;
    };

    const removeFilter = (filterKey: string) => {
        const newFilters = { ...activeFilters };
        delete newFilters[filterKey];
        setTableKey((prev) => prev + 1);
    };

    const clearAllFilters = () => {
        setTableKey((prev) => prev + 1);
    };

    const hasActiveFilters =
        Object.keys(activeFilters).length > 0 &&
        Object.values(activeFilters).some(
            (val) => val !== null && val !== undefined && val.length > 0,
        );

    return (
        <Flex vertical gap={16} style={{ width: "100%", height: "100%" }}>
            {hasActiveFilters && (
                <Flex
                    gap={8}
                    align="center"
                    wrap="wrap"
                    style={{
                        padding: "12px 16px",
                        background: "#f5f5f5",
                        borderRadius: "8px",
                    }}
                >
                    <Typography.Text strong style={{ marginRight: 8 }}>
                        Active Filters:
                    </Typography.Text>
                    {Object.entries(activeFilters).map(([key, values]) => {
                        if (!values || values.length === 0) return null;
                        return (
                            <Tag
                                key={key}
                                closable
                                onClose={() => removeFilter(key)}
                                closeIcon={<CloseOutlined />}
                                color="blue"
                                style={{ margin: 0, fontSize: 13 }}
                            >
                                <strong>{getFilterDisplayName(key)}:</strong>{" "}
                                {Array.isArray(values)
                                    ? values.join(", ")
                                    : String(values)}
                            </Tag>
                        );
                    })}
                    <Button
                        type="link"
                        size="small"
                        onClick={clearAllFilters}
                        style={{ padding: 0, height: "auto" }}
                    >
                        Clear All
                    </Button>
                </Flex>
            )}
            <Table
                key={tableKey}
                columns={columns}
                dataSource={signals}
                rowKey="event"
                pagination={{ total, pageSize, current }}
                scroll={{ x: "max-content" }}
                bordered={true}
                onChange={onChange}
                loading={loading}
            />
            <SignalModal open={open} setOpen={(open) => setOpen(() => open)} />
            <FloatButton
                onClick={() => addSignal()}
                shape="circle"
                type="primary"
                tooltip="New Signal"
                icon={<PlusOutlined />}
            />
        </Flex>
    );
}
