import { useDataEngine } from "@dhis2/app-runtime";
import { createActorContext } from "@xstate/react";
import { assign, fromPromise, setup } from "xstate";
import { smsQueryOptions } from "../collections";
import { queryClient } from "../query-client";
import { SMS, SMSSearchParams } from "../types";

interface SMSContext {
    sms: SMS[];
    error?: string;
    pending?: SMS;
    engine: ReturnType<typeof useDataEngine>;
    search: SMSSearchParams;
    total: number;
    orgUnit: string;
    dataValues: Record<string, any>;
}

type SMSEvent =
    | { type: "RETRY" }
    | {
          type: "CREATE_SIGNAL";
          orgUnit: string;
          dataValues: Record<string, any>;
      }
    | { type: "FETCH_NEXT_PAGE"; search: SMSSearchParams }
    | { type: "SET_SMS"; sms: SMS }
    | { type: "UPDATE_SIGNAL"; sms: SMS }
    | { type: "SUCCESS"; data: SMS };

export const smsMachine = setup({
    types: {
        context: {} as SMSContext,
        events: {} as SMSEvent,
        input: {} as { engine: ReturnType<typeof useDataEngine> },
    },
    actors: {
        fetchSMS: fromPromise<
            { sms: SMS[]; total: number },
            {
                engine: ReturnType<typeof useDataEngine>;
                search: SMSSearchParams;
            }
        >(async ({ input: { engine, search } }) => {
            const data = await queryClient.fetchQuery(
                smsQueryOptions(engine, search),
            );
            return { sms: data.inboundsmss, total: data.pager.total };
        }),

        createSignal: fromPromise<
            SMS,
            {
                sms: SMS;
                engine: ReturnType<typeof useDataEngine>;
                orgUnit: string;
                dataValues: Record<string, any>;
            }
        >(async ({ input: { engine, sms, orgUnit, dataValues } }) => {
            const { orgUnit: e, ...eventValues } = sms.event?.dataValues || {};
            const allDataValues = {
                ...eventValues,
                ...dataValues,
            };
            await engine.mutate({
                resource: "events",
                type: "create",
                data: {
                    events: [
                        {
                            ...sms.event,
                            dataValues: Object.entries(allDataValues).flatMap(
                                ([dataElement, value]) => {
                                    if (value === undefined) return [];
                                    if (value === null) return [];
                                    if (value === false) return [];
                                    return { dataElement, value };
                                },
                            ),
                            orgUnit,
                        },
                    ],
                },
                params: {
                    async: false,
                },
            });

            return { ...sms, forwarded: true };
        }),
    },
}).createMachine({
    id: "sms",
    initial: "loading",
    context: ({ input: { engine } }) => {
        return {
            sms: [],
            engine,
            search: { page: 1, pageSize: 10, q: "" },
            total: 0,
            orgUnit: "",
            dataValues: {},
        };
    },

    states: {
        loading: {
            invoke: {
                src: "fetchSMS",
                input: ({ context: { engine, search } }) => {
                    return { engine, search };
                },
                onDone: {
                    target: "success",
                    actions: assign({
                        sms: ({ event }) => event.output.sms,
                        total: ({ event }) => event.output.total,
                    }),
                },
                onError: {
                    target: "failure",
                    actions: assign({
                        error: ({ event }) =>
                            event.error instanceof Error
                                ? event.error.message
                                : String(event.error),
                    }),
                },
            },
        },

        success: {
            on: {
                CREATE_SIGNAL: {
                    guard: ({ context }) => !!context.pending,
                    target: "optimisticUpdate",
                    actions: assign({
                        sms: ({ context, event }) => {
                            return context.sms.map((t) => {
                                if (t.id === context.pending!.id) {
                                    return {
                                        ...t,
                                        forwarded: true,
                                        event: {
                                            ...t.event,
                                            dataValues: {
                                                ...(t.event?.dataValues ?? {}),
                                                ...context.dataValues,
                                                orgUnit: event.orgUnit,
                                            },
                                        },
                                    };
                                }
                                return t;
                            });
                        },
                        orgUnit: ({ event }) => event.orgUnit,
                        dataValues: ({ event }) => event.dataValues,
                    }),
                },

                SET_SMS: {
                    actions: assign({
                        pending: ({ event }) => event.sms,
                    }),
                },
                FETCH_NEXT_PAGE: {
                    target: "loading",
                    actions: assign({
                        search: ({ event }) => event.search,
                    }),
                },
                UPDATE_SIGNAL: {
                    actions: assign({
                        pending: ({ event }) => event.sms,
                    }),
                },
            },
        },

        optimisticUpdate: {
            invoke: {
                src: "createSignal",
                input: ({ context }) => ({
                    sms: context.pending!,
                    engine: context.engine,
                    orgUnit: context.orgUnit,
                    dataValues: context.dataValues,
                }),
                onDone: {
                    target: "success",
                    actions: assign({
                        sms: ({ context, event }) =>
                            context.sms.map((t) =>
                                t.id === event.output.id ? event.output : t,
                            ),
                        pending: undefined,
                    }),
                },
                onError: {
                    target: "success",
                    actions: assign({
                        sms: ({ context }) => context.sms,
                        error: ({ event }) =>
                            event.error instanceof Error
                                ? event.error.message
                                : String(event.error),
                        pending: undefined,
                    }),
                },
            },
        },

        failure: {
            on: {
                RETRY: "loading",
            },
        },
    },
});

export const SMSContext = createActorContext(smsMachine);
