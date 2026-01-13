import { CheckCircleOutlined } from "@ant-design/icons";
import { createRoute, useLoaderData } from "@tanstack/react-router";
import {
    Button,
    Card,
    Col,
    DatePicker,
    Form,
    Input,
    InputNumber,
    Modal,
    Row,
    Select,
    Table,
    Tag,
    Typography,
    type TableProps,
} from "antd";
import dayjs from "dayjs";
import React, { useEffect, useState } from "react";
import { SMSContext } from "../machines/sms";
import { ProgramRuleResult, SMS } from "../types";
import { SMSRoute } from "./sms";
import { executeProgramRules } from "../utils/utils";
export const SMSIndexRoute = createRoute({
    getParentRoute: () => SMSRoute,
    path: "/",
    component: SMSRouteComponent,
});

const isDate = (valueType: string | undefined) => {
    return (
        valueType === "DATE" ||
        valueType === "DATETIME" ||
        valueType === "TIME" ||
        valueType === "AGE"
    );
};

function SMSRouteComponent() {
    const [ruleResult, setRuleResult] = useState<ProgramRuleResult>({
        hiddenFields: new Set<string>(),
        assignments: {},
        messages: [],
        warnings: [],
        shownFields: new Set<string>(),
    });
    const sms = SMSContext.useSelector((state) => state.context.sms);
    const total = SMSContext.useSelector((state) => state.context.total);
    const pending = SMSContext.useSelector((state) => state.context.pending);
    const isSuccess = SMSContext.useSelector((state) =>
        state.matches("success"),
    );
    const isLoading = SMSContext.useSelector((state) =>
        state.matches("loading"),
    );
    const smsActorRef = SMSContext.useActorRef();
    const [open, setOpen] = useState(false);
    const [form] = Form.useForm();
    const navigate = SMSIndexRoute.useNavigate();
    const {
        programStageSections,
        programStageDataElements,
        programRuleVariables,
        programRules,
        assignedDistricts,
    } = useLoaderData({ from: "__root__" });
    const search = SMSRoute.useSearch();
    const handleForward = (sms: SMS) => {
        setOpen(true);
        smsActorRef.send({ type: "SET_SMS", sms });
        form.setFieldsValue(sms.event?.dataValues);
    };
    const onCreate = async (values: any) => {
        const { orgUnit, ...dataValues } = values;
        smsActorRef.send({
            type: "CREATE_SIGNAL",
            orgUnit,
            dataValues,
        });
        setOpen(false);
        form.resetFields();
    };

    const evaluateRules = (currentValues: Record<string, any>) => {
        const result = executeProgramRules({
            programRules,
            programRuleVariables,
            dataValues: currentValues,
        });

        setRuleResult(result);
        for (const [key, value] of Object.entries(result.assignments)) {
            form.setFieldValue(key, value);
        }
    };

    useEffect(() => {
        if (pending) {
            evaluateRules(pending.event?.dataValues ?? {});
        }
    }, [open, pending?.event?.dataValues]);

    useEffect(() => {
        if (isSuccess) {
            smsActorRef.send({ type: "FETCH_NEXT_PAGE", search });
        }
    }, Object.values(search).sort());

    const columns: TableProps<SMS>["columns"] = [
        {
            title: "Status",
            dataIndex: "forwarded",
            key: "status",
            width: 100,
            render: (forwarded) =>
                forwarded ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">
                        Forwarded
                    </Tag>
                ) : (
                    <Tag color="default">Open</Tag>
                ),
        },
        {
            title: "Message",
            dataIndex: "text",
            key: "message",
            ellipsis: true,
        },
        {
            title: "Originator",
            dataIndex: "originator",
            key: "originator",
            width: 150,
            render: (text) => <Tag color="blue">{text}</Tag>,
        },
        {
            title: "Received Date",
            dataIndex: "receiveddate",
            key: "timestamp",
            width: 180,
            render: (date) => dayjs(date).format("DD/MM/YYYY HH:mm"),
        },
        {
            title: "Actions",
            dataIndex: "actions",
            key: "actions",
            render: (_, record) => {
                return (
                    <Button
                        type={record.forwarded ? "default" : "primary"}
                        onClick={() => handleForward(record)}
                        style={
                            !record.forwarded
                                ? {
                                      background:
                                          "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                      border: "none",
                                  }
                                : undefined
                        }
                    >
                        {record.forwarded ? "Update" : "Forward"}
                    </Button>
                );
            },
            width: 120,
            align: "center",
        },
    ];

    const handleValuesChange = (_changed: any, allValues: any) => {
        evaluateRules(allValues);
    };

    return (
        <Card
            variant="borderless"
            style={{
                boxShadow:
                    "0 1px 2px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.05)",
                height: "100%",
                display: "flex",
                flexDirection: "column",
            }}
            styles={{ body: { padding: 16 } }}
        >
            <div style={{ flex: 1, overflow: "auto" }}>
                <Table
                    columns={columns}
                    dataSource={sms}
                    rowKey="id"
                    pagination={{
                        total,
                        current: search.page,
                        pageSize: search.pageSize,
                        onChange: (page, pageSize) => {
                            if (pageSize !== search.pageSize) {
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        page: 1,
                                        pageSize,
                                    }),
                                });
                            } else {
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        page,
                                    }),
                                });
                            }
                        },
                        showSizeChanger: true,
                        showTotal: (total, range) =>
                            `${range[0]}-${range[1]} of ${total} messages`,
                    }}
                    size="middle"
                    loading={isLoading}
                />
            </div>
            <Modal
                open={open}
                title={
                    <Typography.Title level={4} style={{ margin: 0 }}>
                        Create Signal from SMS
                    </Typography.Title>
                }
                okText="Create Signal"
                cancelText="Cancel"
                okButtonProps={{ autoFocus: true, htmlType: "submit" }}
                onCancel={() => setOpen(false)}
                destroyOnHidden
                modalRender={(dom) => (
                    <Form
                        layout="vertical"
                        form={form}
                        name="form_in_modal"
                        initialValues={{}}
                        clearOnDestroy
                        onFinish={(values) => onCreate(values)}
                        onValuesChange={handleValuesChange}
                    >
                        {dom}
                    </Form>
                )}
                width="70%"
                styles={{
                    body: {
                        maxHeight: "70vh",
                        overflow: "auto",
                        padding: 0,
                        margin: 0,
                    },
                    content: {},
                }}
            >
                <Row gutter={24} style={{ padding: 0, margin: 0 }}>
                    <Col span={8}>
                        <Form.Item
                            label="District"
                            name="orgUnit"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select a district",
                                },
                            ]}
                        >
                            <Select
                                options={assignedDistricts}
                                showSearch
                                placeholder="Select a district"
                                filterOption={(input, option) =>
                                    option
                                        ? option.label
                                              .toLowerCase()
                                              .includes(input.toLowerCase())
                                        : false
                                }
                            />
                        </Form.Item>
                    </Col>
                    {programStageSections[0].dataElements.map((de) => {
                        const dataElement = programStageDataElements.get(de);
                        if (ruleResult.hiddenFields.has(de)) return null;
                        let element = <Input />;
                        if (
                            dataElement?.optionSetValue &&
                            dataElement?.optionSet
                        ) {
                            element = (
                                <Select
                                    options={dataElement.optionSet.options.map(
                                        (option) => ({
                                            label: option.name,
                                            value: option.code,
                                        }),
                                    )}
                                />
                            );
                        }
                        if (dataElement?.valueType === "BOOLEAN") {
                            element = <Input type="checkbox" />;
                        }
                        if (isDate(dataElement?.valueType)) {
                            element = <DatePicker style={{ width: "100%" }} />;
                        }
                        if (dataElement?.valueType === "LONG_TEXT") {
                            element = <Input.TextArea rows={4} />;
                        }

                        if (
                            ["NUMBER", "INTEGER", "INTEGER_POSITIVE"].includes(
                                dataElement?.valueType ?? "",
                            )
                        ) {
                            element = <InputNumber style={{ width: "100%" }} />;
                        }

                        return (
                            <Col span={8} key={de}>
                                <Form.Item
                                    key={de}
                                    label={
                                        dataElement?.formName ??
                                        dataElement?.name
                                    }
                                    name={de}
                                    rules={[
                                        {
                                            required: dataElement?.compulsory,
                                            message: `${dataElement?.name} is required`,
                                        },
                                    ]}
                                    getValueProps={
                                        isDate(dataElement?.valueType)
                                            ? (value) =>
                                                  isDate(dataElement?.valueType)
                                                      ? {
                                                            value: value
                                                                ? dayjs(value)
                                                                : null,
                                                        }
                                                      : {}
                                            : undefined
                                    }
                                    normalize={(value) =>
                                        isDate(dataElement?.valueType) &&
                                        dayjs.isDayjs(value)
                                            ? value.format("YYYY-MM-DD")
                                            : value
                                    }
                                >
                                    {element}
                                </Form.Item>
                            </Col>
                        );
                    })}
                </Row>
            </Modal>
        </Card>
    );
}
