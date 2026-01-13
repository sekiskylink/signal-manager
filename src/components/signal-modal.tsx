import { useLoaderData } from "@tanstack/react-router";
import {
    Checkbox,
    Col,
    DatePicker,
    Form,
    Input,
    InputNumber,
    Modal,
    Row,
    Select,
    Tabs,
} from "antd";
import dayjs from "dayjs";
import { Dictionary, orderBy, set } from "lodash";
import React, { useEffect, useState } from "react";
import { SignalContext } from "../machines/signal";
import { ProgramRuleResult } from "../types";
import { executeProgramRules } from "../utils/utils";

const isDate = (valueType: string | undefined) => {
    return (
        valueType === "DATE" ||
        valueType === "DATETIME" ||
        valueType === "TIME" ||
        valueType === "AGE"
    );
};

export default function SignalModal({
    open,
    setOpen,
}: {
    open: boolean;
    setOpen: (open: boolean) => void;
}) {
    const signal = SignalContext.useSelector((state) => state.context.signal);
    const active = SignalContext.useSelector(
        (state) => state.context.nextActions.active,
    );
    const next = SignalContext.useSelector(
        (state) => state.context.nextActions.next,
    );
    const signalActorRef = SignalContext.useActorRef();
    const {
        programStageSections,
        programStageDataElements,
        programRuleVariables,
        programRules,
        assignedDistricts,
    } = useLoaderData({ from: "__root__" });

    const [form] = Form.useForm();

    const [ruleResult, setRuleResult] = useState<ProgramRuleResult>({
        hiddenFields: new Set<string>(),
        assignments: {},
        messages: [],
        warnings: [],
        shownFields: new Set<string>(),
    });

    // -------------------------
    // Apply DHIS2 Rules
    // -------------------------
    const evaluateRules = (dataValues: Dictionary<string>) => {
        const result = executeProgramRules({
            programRules,
            programRuleVariables,
            dataValues,
        });

        setRuleResult(result);

        // Apply ASSIGN actions to the form
        for (const [key, value] of Object.entries(result.assignments)) {
            form.setFieldValue(key, value);
        }
    };

    // -------------------------
    // Update form when modal opens with a signal
    // -------------------------
    useEffect(() => {
        if (open && signal) {
            // Always reset first
            form.resetFields();

            if (
                signal.event &&
                signal.dataValues &&
                Object.keys(signal.dataValues).length > 0
            ) {
                // Has data to populate
                const formValues = {
                    orgUnit: signal.orgUnit,
                    ...Object.entries(signal.dataValues).reduce(
                        (acc, [key, value]) => {
                            const el = programStageDataElements.get(key);
                            if (el?.valueType === "BOOLEAN") {
                                set(acc, key, value === "true");
                            } else {
                                set(acc, key, value);
                            }
                            return acc;
                        },
                        {},
                    ),
                };
                // Use setTimeout to ensure form is mounted
                setTimeout(() => {
                    form.setFieldsValue(formValues);
                    evaluateRules(formValues);
                }, 0);
            } else {
                // New signal or empty signal
                console.log("Empty signal, form stays empty");
                if (signal.orgUnit) {
                    form.setFieldValue("orgUnit", signal.orgUnit);
                }
                evaluateRules(signal.dataValues || {});
            }
        }
    }, [open, signal?.event]);

    // -------------------------
    // On value change → re-run rules
    // -------------------------
    const handleValuesChange = (_changed: any, allValues: any) => {
        evaluateRules(allValues);
    };

    const onCreate = async (updatedValues: Dictionary<string>) => {
        if (signal?.dataValues) {
            const mergedValues: Dictionary<string> = {
                ...signal.dataValues,
                ...updatedValues,
            };
            signalActorRef.send({
                type: "CREATE_OR_UPDATE_SIGNAL",
                signal: { ...signal, dataValues: mergedValues },
            });
            setOpen(false);
        }
    };
    const oClose = () => {
        setOpen(false);
        signalActorRef.send({ type: "GO_BACK" });
    };
    return (
        <Modal
            open={open}
            title="Update Signal"
            okText="Update Signal"
            cancelText="Cancel"
            okButtonProps={{ autoFocus: true, htmlType: "submit" }}
            onCancel={oClose}
            styles={{ body: { maxHeight: "70vh", overflow: "auto" } }}
            onOk={() => form.submit()}
            width="70%"
        >
            <Form
                key={signal?.event || `new-${Date.now()}`}
                form={form}
                layout="vertical"
                name="signal_form"
                onValuesChange={handleValuesChange}
                onFinish={onCreate}
            >
                <Tabs
                    items={orderBy(
                        programStageSections,
                        "sortOrder",
                        "asc",
                    ).map((section) => ({
                        key: String(section.sortOrder),
                        label: section.name,
                        disabled: !active.includes(String(section.sortOrder)),
                        children: (
                            <Row gutter={24}>
                                {section.sortOrder === 0 && (
                                    <Col span={8}>
                                        <Form.Item
                                            label="District"
                                            name="orgUnit"
                                            rules={[
                                                {
                                                    required: true,
                                                    message:
                                                        "Please select a district",
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
                                                              .includes(
                                                                  input.toLowerCase(),
                                                              )
                                                        : false
                                                }
                                            />
                                        </Form.Item>
                                    </Col>
                                )}
                                {section.dataElements.map((de) => {
                                    const dataElement =
                                        programStageDataElements.get(de);
                                    if (!dataElement) return null;

                                    if (ruleResult.hiddenFields.has(de))
                                        return null;

                                    let element: React.ReactNode = <Input />;

                                    if (
                                        dataElement.optionSetValue &&
                                        dataElement.optionSet
                                    ) {
                                        element = (
                                            <Select
                                                options={dataElement.optionSet.options.map(
                                                    (o) => ({
                                                        label: o.name,
                                                        value: o.code,
                                                    }),
                                                )}
                                                allowClear
                                            />
                                        );
                                    } else if (
                                        dataElement.valueType === "BOOLEAN"
                                    ) {
                                        element = (
                                            <Checkbox>
                                                {dataElement.formName ??
                                                    dataElement.name}
                                            </Checkbox>
                                        );
                                    } else if (
                                        dataElement.valueType === "DATE" ||
                                        dataElement.valueType === "DATETIME" ||
                                        dataElement.valueType === "TIME" ||
                                        dataElement.valueType === "AGE"
                                    ) {
                                        element = (
                                            <DatePicker
                                                style={{ width: "100%" }}
                                            />
                                        );
                                    } else if (
                                        dataElement.valueType === "LONG_TEXT"
                                    ) {
                                        element = <Input.TextArea rows={4} />;
                                    } else if (
                                        [
                                            "NUMBER",
                                            "INTEGER",
                                            "INTEGER_POSITIVE",
                                        ].includes(dataElement.valueType ?? "")
                                    ) {
                                        element = (
                                            <InputNumber
                                                style={{ width: "100%" }}
                                            />
                                        );
                                    }

                                    return (
                                        <Col span={8} key={de}>
                                            <Form.Item
                                                key={de}
                                                label={
                                                    dataElement.valueType ===
                                                    "BOOLEAN"
                                                        ? null
                                                        : dataElement.formName ??
                                                          dataElement.name
                                                }
                                                name={de}
                                                rules={[
                                                    {
                                                        required:
                                                            dataElement.compulsory,
                                                        message: `${dataElement.name} is required`,
                                                    },
                                                ]}
                                                getValueProps={
                                                    isDate(
                                                        dataElement?.valueType,
                                                    )
                                                        ? (value) =>
                                                              isDate(
                                                                  dataElement?.valueType,
                                                              )
                                                                  ? {
                                                                        value: value
                                                                            ? dayjs(
                                                                                  value,
                                                                              )
                                                                            : null,
                                                                    }
                                                                  : {}
                                                        : undefined
                                                }
                                                normalize={(value) =>
                                                    isDate(
                                                        dataElement?.valueType,
                                                    ) && dayjs.isDayjs(value)
                                                        ? value.format(
                                                              "YYYY-MM-DD",
                                                          )
                                                        : value
                                                }
                                            >
                                                {element}
                                            </Form.Item>
                                        </Col>
                                    );
                                })}
                            </Row>
                        ),
                    }))}
                    activeKey={next || active.at(-1)}
                    onChange={(x) =>
                        signalActorRef.send({ type: "NEXT_ACTION", action: x })
                    }
                />
            </Form>
        </Modal>
    );
}
