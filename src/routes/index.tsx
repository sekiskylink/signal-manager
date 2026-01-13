import {
    AlertOutlined,
    BellOutlined,
    CheckCircleOutlined,
    ExclamationCircleOutlined,
    MailOutlined,
} from "@ant-design/icons";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createRoute } from "@tanstack/react-router";
import type { TableProps } from "antd";
import {
    Card,
    Col,
    Flex,
    Row,
    Space,
    Statistic,
    Table,
    Tag,
    Typography,
} from "antd";
import dayjs from "dayjs";
import React from "react";
import { signalsQueryOptions, smsQueryOptions } from "../collections";
import type { SMS } from "../types";
import { RootRoute } from "./__root";

export const IndexRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/",
    component: IndexRouteComponent,

    loader: (opts) => {
        const smsPromise = opts.context.queryClient.ensureQueryData(
            smsQueryOptions(opts.context.engine),
        );
        const signalsPromise = opts.context.queryClient.ensureQueryData(
            signalsQueryOptions(opts.context.engine, {
                filters: {},
                pagination: { current: 1, pageSize: 500 },
            }),
        );
        return Promise.all([smsPromise, signalsPromise]);
    },
});

function IndexRouteComponent() {
    const { engine } = IndexRoute.useRouteContext();
    const { data: smsData } = useSuspenseQuery(smsQueryOptions(engine));
    const { data: signalsData } = useSuspenseQuery(
        signalsQueryOptions(engine, {
            filters: {},
            pagination: { current: 1, pageSize: 500 },
        }),
    );

    const forwardedCount = smsData.inboundsmss.filter(
        (sms) => sms.forwarded,
    ).length;
    const pendingCount = smsData.inboundsmss.filter(
        (sms) => !sms.forwarded,
    ).length;

    const riskCounts = signalsData.events.reduce((acc, event) => {
        const riskLevel = event.dataValues["x84ZTtD0Z8u"] || "Unknown";
        acc[riskLevel] = (acc[riskLevel] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const riskColors: Record<string, string> = {
        "Very High": "#ff4d4f",
        High: "#ff7a45",
        Moderate: "#ffa940",
        Low: "#fadb14",
    };

    const smsColumns: TableProps<SMS>["columns"] = [
        {
            title: "Status",
            dataIndex: "forwarded",
            key: "status",
            width: 120,
            render: (forwarded) =>
                forwarded ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">
                        Forwarded
                    </Tag>
                ) : (
                    <Tag color="default">Pending</Tag>
                ),
        },
        {
            title: "Originator",
            dataIndex: "originator",
            key: "originator",
            width: 150,
            render: (text) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: "Message",
            dataIndex: "text",
            key: "message",
            ellipsis: true,
        },
        {
            title: "Received",
            dataIndex: "receiveddate",
            key: "timestamp",
            width: 180,
            render: (date) => dayjs(date).format("DD/MM/YYYY HH:mm"),
        },
    ];

    const signalsColumns: TableProps<
        (typeof signalsData.events)[0]
    >["columns"] = [
        {
            title: "Risk Level",
            dataIndex: "dataValues",
            key: "riskLevel",
            width: 140,
            render: (dataValues) => {
                const val = dataValues["x84ZTtD0Z8u"];
                return val ? (
                    <Tag
                        color={riskColors[val] || "default"}
                        style={{ fontSize: 13, fontWeight: 500 }}
                    >
                        {val}
                    </Tag>
                ) : null;
            },
        },
        {
            title: "Organization Unit",
            dataIndex: "orgUnitName",
            key: "orgUnitName",
            ellipsis: true,
        },
        {
            title: "Event Date",
            dataIndex: "eventDate",
            key: "eventDate",
            width: 150,
            render: (date) => (
                <Tag color="blue" style={{ fontSize: 13 }}>
                    {dayjs(date).format("DD/MM/YYYY")}
                </Tag>
            ),
        },
    ];

    return (
        <Flex
            vertical
            gap={24}
            style={{ height: "100%", overflow: "auto", padding: 8 }}
        >
            <Flex justify="space-between" align="center">
                <Typography.Title
                    level={2}
                    style={{ margin: 0, fontWeight: 700 }}
                >
                    Dashboard Overview
                </Typography.Title>
                <Tag
                    color="blue"
                    style={{
                        fontSize: 14,
                        padding: "6px 16px",
                        fontWeight: 500,
                    }}
                >
                    {dayjs().format("DD MMMM YYYY")}
                </Tag>
            </Flex>

            <Row gutter={[24, 24]}>
                <Col xs={24} sm={12} lg={6}>
                    <Card
                        bordered={false}
                        style={{
                            background:
                                "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                            boxShadow: "0 8px 24px rgba(102, 126, 234, 0.4)",
                            minHeight: 160,
                        }}
                        bodyStyle={{ padding: 24 }}
                    >
                        <Space
                            direction="vertical"
                            size={8}
                            style={{ width: "100%" }}
                        >
                            <MailOutlined
                                style={{ fontSize: 40, color: "white" }}
                            />
                            <Statistic
                                title={
                                    <span
                                        style={{
                                            color: "rgba(255,255,255,0.95)",
                                            fontSize: 16,
                                            fontWeight: 500,
                                        }}
                                    >
                                        Total SMS
                                    </span>
                                }
                                value={smsData.pager.total}
                                valueStyle={{
                                    color: "white",
                                    fontSize: 42,
                                    fontWeight: 700,
                                }}
                            />
                        </Space>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card
                        bordered={false}
                        style={{
                            background:
                                "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
                            boxShadow: "0 8px 24px rgba(240, 147, 251, 0.4)",
                            minHeight: 160,
                        }}
                        bodyStyle={{ padding: 24 }}
                    >
                        <Space
                            direction="vertical"
                            size={8}
                            style={{ width: "100%" }}
                        >
                            <BellOutlined
                                style={{ fontSize: 40, color: "white" }}
                            />
                            <Statistic
                                title={
                                    <span
                                        style={{
                                            color: "rgba(255,255,255,0.95)",
                                            fontSize: 16,
                                            fontWeight: 500,
                                        }}
                                    >
                                        Total Signals
                                    </span>
                                }
                                value={signalsData.pager.total}
                                valueStyle={{
                                    color: "white",
                                    fontSize: 42,
                                    fontWeight: 700,
                                }}
                            />
                        </Space>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card
                        bordered={false}
                        style={{
                            background:
                                "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
                            boxShadow: "0 8px 24px rgba(79, 172, 254, 0.4)",
                            minHeight: 160,
                        }}
                        bodyStyle={{ padding: 24 }}
                    >
                        <Space
                            direction="vertical"
                            size={8}
                            style={{ width: "100%" }}
                        >
                            <CheckCircleOutlined
                                style={{ fontSize: 40, color: "white" }}
                            />
                            <Statistic
                                title={
                                    <span
                                        style={{
                                            color: "rgba(255,255,255,0.95)",
                                            fontSize: 16,
                                            fontWeight: 500,
                                        }}
                                    >
                                        Forwarded
                                    </span>
                                }
                                value={forwardedCount}
                                valueStyle={{
                                    color: "white",
                                    fontSize: 42,
                                    fontWeight: 700,
                                }}
                            />
                        </Space>
                    </Card>
                </Col>
                <Col xs={24} sm={12} lg={6}>
                    <Card
                        bordered={false}
                        style={{
                            background:
                                "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
                            boxShadow: "0 8px 24px rgba(250, 112, 154, 0.4)",
                            minHeight: 160,
                        }}
                        bodyStyle={{ padding: 24 }}
                    >
                        <Space
                            direction="vertical"
                            size={8}
                            style={{ width: "100%" }}
                        >
                            <ExclamationCircleOutlined
                                style={{ fontSize: 40, color: "white" }}
                            />
                            <Statistic
                                title={
                                    <span
                                        style={{
                                            color: "rgba(255,255,255,0.95)",
                                            fontSize: 16,
                                            fontWeight: 500,
                                        }}
                                    >
                                        Pending
                                    </span>
                                }
                                value={pendingCount}
                                valueStyle={{
                                    color: "white",
                                    fontSize: 42,
                                    fontWeight: 700,
                                }}
                            />
                        </Space>
                    </Card>
                </Col>
            </Row>

            <Card
                title={
                    <Flex align="center" gap={12}>
                        <AlertOutlined
                            style={{ color: "#667eea", fontSize: 20 }}
                        />
                        <span style={{ fontSize: 18, fontWeight: 600 }}>
                            Risk Level Distribution
                        </span>
                    </Flex>
                }
                bordered={false}
                style={{
                    boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                headStyle={{
                    borderBottom: "2px solid #f0f0f0",
                    padding: "20px 24px",
                }}
            >
                <Row gutter={[20, 20]}>
                    {Object.entries(riskCounts).map(([level, count]) => (
                        <Col xs={24} sm={12} md={6} key={level}>
                            <Card
                                bordered={false}
                                style={{
                                    background: `${
                                        riskColors[level] || "#d9d9d9"
                                    }20`,
                                    borderLeft: `6px solid ${
                                        riskColors[level] || "#d9d9d9"
                                    }`,
                                    boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                                    minHeight: 120,
                                }}
                                styles={{ body: { padding: 20 } }}
                            >
                                <Statistic
                                    title={
                                        <span
                                            style={{
                                                fontSize: 15,
                                                fontWeight: 500,
                                            }}
                                        >
                                            {level}
                                        </span>
                                    }
                                    value={count}
                                    valueStyle={{
                                        color: riskColors[level] || "#595959",
                                        fontSize: 36,
                                        fontWeight: 700,
                                    }}
                                />
                            </Card>
                        </Col>
                    ))}
                </Row>
            </Card>

            <Row gutter={[24, 24]}>
                <Col xs={24} lg={12}>
                    <Card
                        title={
                            <span style={{ fontSize: 18, fontWeight: 600 }}>
                                Recent SMS Messages
                            </span>
                        }
                        bordered={false}
                        style={{
                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        }}
                        headStyle={{
                            borderBottom: "2px solid #f0f0f0",
                            padding: "20px 24px",
                        }}
                        bodyStyle={{ padding: 0 }}
                    >
                        <Table
                            columns={smsColumns}
                            dataSource={smsData.inboundsmss.slice(0, 5)}
                            rowKey="id"
                            pagination={false}
                            size="middle"
                            onRow={(record) => ({
                                style: {
                                    backgroundColor: record.forwarded
                                        ? "#f6ffed"
                                        : "transparent",
                                },
                            })}
                        />
                    </Card>
                </Col>
                <Col xs={24} lg={12}>
                    <Card
                        title={
                            <span style={{ fontSize: 18, fontWeight: 600 }}>
                                Recent Signals
                            </span>
                        }
                        bordered={false}
                        style={{
                            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                        }}
                        headStyle={{
                            borderBottom: "2px solid #f0f0f0",
                            padding: "20px 24px",
                        }}
                        bodyStyle={{ padding: 0 }}
                    >
                        <Table
                            columns={signalsColumns}
                            dataSource={signalsData.events.slice(0, 5)}
                            rowKey="event"
                            pagination={false}
                            size="middle"
                            onRow={(record) => ({
                                style: {
                                    backgroundColor: record.dataValues[
                                        "x84ZTtD0Z8u"
                                    ]
                                        ? `${
                                              riskColors[
                                                  record.dataValues[
                                                      "x84ZTtD0Z8u"
                                                  ]
                                              ]
                                          }10`
                                        : "transparent",
                                },
                            })}
                        />
                    </Card>
                </Col>
            </Row>
        </Flex>
    );
}
