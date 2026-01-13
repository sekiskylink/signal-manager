import { createRoute, Outlet } from "@tanstack/react-router";
import React from "react";
import { SMSSearchParams } from "../types";
import { RootRoute } from "./__root";

import { SignalContext } from "../machines/signal";

export const SignalsRoute = createRoute({
    getParentRoute: () => RootRoute,
    path: "/signals",
    component: () => {
        const { engine } = SignalsRoute.useRouteContext();
        return (
            <SignalContext.Provider options={{ input: { engine } }}>
                <Outlet />
            </SignalContext.Provider>
        );
    },
});
