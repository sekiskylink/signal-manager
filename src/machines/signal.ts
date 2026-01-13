import { useDataEngine } from "@dhis2/app-runtime";
import { createActorContext } from "@xstate/react";
import { assign, fromPromise, setup } from "xstate";
import {
    querySignals,
    signalsQueryOptions,
    totalSignalsQueryOptions,
} from "../collections";
import { queryClient } from "../query-client";
import { OnChange } from "../types";
import { nextAction } from "../utils/utils";

interface SignalContext {
    signals: Awaited<ReturnType<typeof querySignals>>["events"];
    error?: string;
    signal?: Awaited<ReturnType<typeof querySignals>>["events"][number];
    engine: ReturnType<typeof useDataEngine>;
    total: number;
    action: "CREATE" | "UPDATE";
    search: OnChange;
    nextActions: { next: string; active: string[] };
}

type SignalEvent =
    | { type: "RETRY" }
    | { type: "GO_BACK" }
    | {
          type: "CREATE_OR_UPDATE_SIGNAL";
          signal: Awaited<ReturnType<typeof querySignals>>["events"][number];
      }
    | { type: "FETCH_NEXT_PAGE"; search: OnChange }
    | {
          type: "SET_SIGNALS";
          signals: Awaited<ReturnType<typeof querySignals>>["events"];
      }
    | {
          type: "SET_ACTION";
          action: "CREATE" | "UPDATE";
      }
    | {
          type: "NEXT_ACTION";
          action: string;
      }
    | {
          type: "SET_SIGNAL";
          signal: Awaited<ReturnType<typeof querySignals>>["events"][number];
      };
export const signalMachine = setup({
    types: {
        context: {} as SignalContext,
        events: {} as SignalEvent,
        input: {} as { engine: ReturnType<typeof useDataEngine> },
    },
    actors: {
        fetchSignals: fromPromise<
            Awaited<ReturnType<typeof querySignals>>,
            {
                engine: ReturnType<typeof useDataEngine>;
                search: OnChange;
            }
        >(async ({ input: { engine, search } }) => {
            const data = await queryClient.fetchQuery(
                signalsQueryOptions(engine, search),
            );
            return data;
        }),
        fetchTotalSignals: fromPromise<
            number,
            {
                engine: ReturnType<typeof useDataEngine>;
                search?: OnChange;
            }
        >(async ({ input: { engine, search } }) => {
            const data = await queryClient.fetchQuery(
                totalSignalsQueryOptions(engine, search),
            );
            return data;
        }),

        createSignal: fromPromise<
            Awaited<ReturnType<typeof querySignals>>["events"][number],
            {
                signal: Awaited<
                    ReturnType<typeof querySignals>
                >["events"][number];
                engine: ReturnType<typeof useDataEngine>;
            }
        >(async ({ input: { engine, signal } }) => {
            const { dataValues, ...rest } = signal;
            const { orgUnit, ...eventValues } = dataValues;
            await engine.mutate({
                resource: "events",
                type: "create",
                data: {
                    events: [
                        {
                            ...rest,
                            dataValues: Object.entries(eventValues).flatMap(
                                ([dataElement, value]) => {
                                    if (value === undefined) return [];
                                    if (value === null) return [];
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

            return signal;
        }),
    },
}).createMachine({
    id: "signal",
    initial: "loading",
    context: ({ input: { engine } }) => {
        return {
            signals: [],
            engine,
            search: {
                pagination: { current: 1, pageSize: 10 },
                filters: {},
            },
            total: 0,
            district: "",
            action: "CREATE",
            nextActions: { next: "0", active: ["0", "1"] },
        };
    },

    states: {
        loading: {
            invoke: {
                src: "fetchSignals",
                input: ({ context: { engine, search } }) => {
                    return { engine, search };
                },
                onDone: {
                    target: "success",
                    actions: assign({
                        signals: ({ event }) => event.output.events,
                        total: ({ event }) => event.output.pager.total,
                    }),
                },
                onError: {
                    target: "failure",
                    actions: assign({
                        error: ({ event }) =>
                            event.error instanceof Error
                                ? event.error.message
                                : String(event.error),
                        total: () => 0,
                    }),
                },
            },
        },

        success: {
            on: {
                SET_SIGNAL: {
                    target: "signalSelection",
                    actions: assign({
                        signal: ({ event }) => event.signal,
                        nextActions: ({ event }) =>
                            nextAction(event.signal.dataValues),
                    }),
                },
                FETCH_NEXT_PAGE: {
                    target: "loading",
                    actions: assign({
                        search: ({ event }) => event.search,
                    }),
                },
                SET_ACTION: {
                    actions: assign({
                        action: ({ event }) => event.action,
                    }),
                },
            },
        },

        optimisticUpdate: {
            invoke: {
                src: "createSignal",
                input: ({ context }) => ({
                    signal: context.signal!,
                    engine: context.engine,
                }),
                onDone: {
                    target: "loading",
                    actions: assign({
                        signal: undefined,
                        action: "CREATE",
                    }),
                },
                onError: {
                    target: "loading",
                    actions: assign({
                        error: ({ event }) =>
                            event.error instanceof Error
                                ? event.error.message
                                : String(event.error),
                        signal: undefined,
                        action: "CREATE",
                        search: ({ context }) => ({
                            ...context.search,
                            pagination: {
                                current: 1,
                                ...context.search.pagination,
                            },
                        }),
                        signals: ({ context }) => {
                            if (context.action === "CREATE") {
                                return context.signals.filter(
                                    (signal) =>
                                        signal.event !== context.signal?.event,
                                );
                            }
                            return context.signals.map((s) =>
                                s.event === context.signal?.event
                                    ? context.signal!
                                    : s,
                            );
                        },
                    }),
                },
            },
        },
        signalSelection: {
            on: {
                CREATE_OR_UPDATE_SIGNAL: {
                    guard: ({ event, context }) =>
                        !!event.signal && !!context.action,
                    target: "optimisticUpdate",
                    actions: assign({
                        signals: ({ context, event }) => {
                            if (context.action === "UPDATE") {
                                const existingSignal = context.signals.find(
                                    (s) => s.event === event.signal.event,
                                );
                                if (existingSignal) {
                                    return context.signals.map((signal) => {
                                        if (
                                            event.signal &&
                                            signal.event === event.signal.event
                                        ) {
                                            return {
                                                ...signal,
                                                ...event.signal,
                                            };
                                        }
                                        return signal;
                                    });
                                }
                                return context.signals;
                            }
                            return [event.signal, ...context.signals];
                        },
                        signal: ({ event }) => event.signal,
                    }),
                },

                NEXT_ACTION: {
                    actions: assign({
                        nextActions: ({ event, context }) => ({
                            ...context.nextActions,
                            next: event.action,
                        }),
                    }),
                },

                GO_BACK: {
                    target: "success",
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

export const SignalContext = createActorContext(signalMachine);
