import { useDataEngine } from "@dhis2/app-runtime";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { ConfigProvider } from "antd";
import React, { FC } from "react";
import { router } from "./router";
import { queryClient } from "./query-client";

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}

const MyApp: FC = () => {
    const engine = useDataEngine();
    return (
        <ConfigProvider
            theme={{
                token: {
                    borderRadius: 8,
                    colorPrimary: "#667eea",
                    colorInfo: "#667eea",
                    colorSuccess: "#52c41a",
                    colorWarning: "#faad14",
                    colorError: "#ff4d4f",
                    fontSize: 14,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                },
                components: {
                    Table: {
                        rowHoverBg: "#f5f7fa",
                        headerBg: "#fafafa",
                        headerColor: "#262626",
                        borderColor: "#f0f0f0",
                    },
                    Card: {
                        borderRadiusLG: 8,
                        boxShadowTertiary: "0 1px 2px rgba(0,0,0,0.03), 0 4px 12px rgba(0,0,0,0.05)",
                    },
                    Button: {
                        borderRadius: 6,
                        controlHeight: 36,
                        fontWeight: 500,
                    },
                    Input: {
                        borderRadius: 6,
                        controlHeight: 38,
                    },
                    Select: {
                        borderRadius: 6,
                        controlHeight: 38,
                    },
                    Menu: {
                        itemBg: "transparent",
                        itemSelectedBg: "#f0f5ff",
                        itemSelectedColor: "#667eea",
                        itemHoverBg: "#fafafa",
                        itemActiveBg: "#f0f5ff",
                    },
                },
            }}
        >
            <QueryClientProvider client={queryClient}>
                <RouterProvider router={router} context={{ engine }} />
            </QueryClientProvider>
        </ConfigProvider>
    );
};

export default MyApp;
