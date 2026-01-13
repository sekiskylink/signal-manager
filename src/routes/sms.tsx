import { SearchOutlined } from "@ant-design/icons";
import { createRoute, Outlet } from "@tanstack/react-router";
import { Card, Flex, Input } from "antd";
import React from "react";
import { SMSSearchParams } from "../types";
import { RootRoute } from "./__root";
import { SMSContext } from "../machines/sms";

export const SMSRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/sms",
    component: () => {
        const navigate = SMSRoute.useNavigate();
        const { engine } = SMSRoute.useRouteContext();
        return (
            <Flex vertical gap={16} style={{ width: "100%", height: "100%" }}>
                <Card
                    variant="borderless"
                    style={{
                        background:
                            "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                    styles={{ body: { padding: 16 } }}
                >
                    <Flex gap={16} align="center">
                        <SearchOutlined
                            style={{ fontSize: 18, color: "#667eea" }}
                        />
                        <Input.Search
                            placeholder="Search SMS messages..."
                            style={{ width: 500 }}
                            onSearch={(value) =>
                                navigate({
                                    search: (prev) => ({
                                        ...prev,
                                        q: value,
                                        page: 1,
                                    }),
                                })
                            }
                        />
                    </Flex>
                </Card>

                <SMSContext.Provider
                    options={{
                        input: {
                            engine,
                        },
                    }}
                >
                    <Outlet />
                </SMSContext.Provider>
            </Flex>
        );
    },
    validateSearch: SMSSearchParams,
});
