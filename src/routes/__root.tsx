import { useDataEngine } from "@dhis2/app-runtime";
import { QueryClient } from "@tanstack/react-query";
import {
    createRootRouteWithContext,
    Link,
    Outlet,
    useRouterState,
} from "@tanstack/react-router";
import { Layout } from "antd";
import React from "react";

import {
    DashboardOutlined,
    MailOutlined,
    BellOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { Menu } from "antd";
import { initialQueryOptions } from "../collections";

const { Sider, Content } = Layout;

type MenuItem = Required<MenuProps>["items"][number];

export const RootRoute = createRootRouteWithContext<{
    queryClient: QueryClient;
    engine: ReturnType<typeof useDataEngine>;
}>()({
    component: RootComponent,

    loader: (opts) => {
        return opts.context.queryClient.ensureQueryData(
            initialQueryOptions(opts.context.engine),
        );
    },
});

const items: MenuItem[] = [
    {
        key: "/",
        label: <Link to="/">Dashboard</Link>,
        icon: <DashboardOutlined />,
    },
    {
        key: "/sms",
        label: <Link to="/sms">SMS Messages</Link>,
        icon: <MailOutlined />,
    },
    {
        key: "/signals",
        label: <Link to="/signals">Signals</Link>,
        icon: <BellOutlined />,
    },
];

function RootComponent() {
    const router = useRouterState();
    const selectedKey = router.location.pathname;

    return (
        <Layout
            style={{
                minHeight: "calc(100vh - 48px)",
                maxHeight: "calc(100vh - 48px)",
                overflow: "auto",
            }}
        >
            <Sider
                width={260}
                style={{
                    background: "#fff",
                    boxShadow: "2px 0 8px rgba(0,0,0,0.06)",
                    overflow: "auto",
                }}
            >
                <Menu
                    mode="inline"
                    selectedKeys={[selectedKey]}
                    items={items}
                    style={{
                        borderRight: 0,
                        paddingTop: 16,
                    }}
                />
            </Sider>
            <Layout style={{ flex: 1, overflow: "auto" }}>
                <Content
                    style={{
                        background: "#E8EEF1",
                        padding: 20,
                        overflow: "auto",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    <Outlet />
                </Content>
            </Layout>
        </Layout>
    );
}
