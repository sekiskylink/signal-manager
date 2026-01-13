import { useDataEngine } from "@dhis2/app-runtime";
import { queryCollectionOptions } from "@tanstack/query-db-collection";
import { createCollection } from "@tanstack/react-db";
import { QueryClient, queryOptions } from "@tanstack/react-query";
import {
    OnChange,
    ProgramRule,
    ProgramRuleVariable,
    ProgramStage,
    SMS,
    SMSSchema,
    SMSSearchParams,
} from "./types";
import { fromPairs, orderBy } from "lodash";
import { Event } from "./types";
import { getUniqueNumber } from "./utils/utils";

const queryClient = new QueryClient();

export const smsCollection = (engine: ReturnType<typeof useDataEngine>) => {
    return createCollection(
        queryCollectionOptions({
            id: `sms`,
            queryKey: [`sms`],
            refetchInterval: 3000,
            queryFn: async () => {
                const { sms } = (await engine.query({
                    sms: {
                        resource: "sms/inbound",
                        params: {
                            pageSize: 10,
                            fields: "*",
                        },
                    },
                })) as { sms: { inboundsmss: SMS[] } };
                return sms?.inboundsmss ?? [];
            },
            getKey: (item) => item.id,
            schema: SMSSchema,
            queryClient,
        }),
    );
};

export const querySignals = async ({
    search,
    engine,
}: {
    search: OnChange;
    engine: ReturnType<typeof useDataEngine>;
}) => {
    const params = new URLSearchParams({
        pageSize: `${search.pagination.pageSize || 12}`,
        page: `${search.pagination.current || 1}`,
        programStage: "Nnnqw1XKpZL",
        ouMode: "ALL",
        order: "updatedAt:desc",
        totalPages: "true",
    });

    for (const [filterKey, filterValues] of Object.entries(
        search?.filters || {},
    )) {
        if (filterValues && filterValues.length > 0) {
            params.append(`filter`, `${filterKey}:eq:${filterValues[0]}`);
        }
    }
    const { events } = (await engine.query({
        events: {
            resource: `tracker/events?${params.toString()}`,
        },
    })) as {
        events: {
            events: Event[];
            pager: {
                page: number;
                total: number;
                pageSize: number;
                pageCount: number;
            };
        };
    };
    return {
        ...events,
        events: events.events.map(({ dataValues, ...event }) => {
            return {
                ...event,
                dataValues: fromPairs(
                    dataValues.map((dv) => [dv.dataElement, dv.value]),
                ),
            };
        }),
    };
};

export const smsQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    searchParams: SMSSearchParams = {
        page: 1,
        pageSize: 10,
        q: "",
    },
) => {
    const { page, pageSize, q } = searchParams;
    return queryOptions({
        queryKey: ["sms-data", page, pageSize, q],
        queryFn: async () => {
            const query = new URLSearchParams();
            query.append("pageSize", pageSize.toString());
            query.append("page", page.toString());
            query.append("fields", "*");

            if (q) {
                query.append("filter", `text:ilike:alert ${q}`);
                query.append("filter", `originator:like:${q}`);
                query.append("rootJunction", "OR");
            } else {
                query.append("filter", `text:ilike:alert`);
            }
            const { sms } = (await engine.query({
                sms: {
                    resource: `sms/inbound?${query.toString()}`,
                },
            })) as {
                sms: {
                    inboundsmss: SMS[];
                    pager: {
                        page: number;
                        total: number;
                        pageSize: number;
                        pageCount: number;
                    };
                };
            };

            const ids = sms.inboundsmss.map((s) => s.id);
            let events: { events: { events: Event[] } } = {
                events: { events: [] },
            };
            if (ids.length > 0) {
                events = (await engine.query({
                    events: {
                        resource: `tracker/events`,
                        params: {
                            pageSize: ids.length,
                            events: ids.join(","),
                            programStage: "Nnnqw1XKpZL",
                        },
                    },
                })) as { events: { events: Event[] } };
            }
            return {
                ...sms,
                inboundsmss: sms.inboundsmss.map((sms) => {
                    const event = events.events.events.find(
                        (e) => e.event === sms.id,
                    );

                    let currentEvent: Partial<
                        Omit<Event, "dataValues"> & {
                            dataValues: Record<string, any>;
                        }
                    > = {
                        event: sms.id,
                        programStage: "Nnnqw1XKpZL",
                        program: "iaN1DovM5em",
                        eventDate: new Date().toISOString(),
                        status: "ACTIVE",
                        dataValues: {
                            thsZG5TJDBV: sms.text,
                            SXmppM2WKNo: `SIG-${getUniqueNumber()}`,
                            nvYHp4qr35Q: "SMS",
                        },
                    };

                    if (event) {
                        const { dataValues: currentDataValues, ...rest } =
                            event;
                        currentEvent = {
                            ...rest,
                            dataValues: fromPairs([
                                ...currentDataValues.map((dv) => [
                                    dv.dataElement,
                                    dv.value,
                                ]),
                                ["district", event.orgUnit],
                            ]),
                        };
                    }
                    return {
                        ...sms,
                        forwarded: event !== undefined,
                        event: currentEvent,
                    };
                }),
            };
        },
    });
};

export const totalSignalsQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    search?: OnChange,
) => {
    return queryOptions({
        queryKey: [
            "total-signals",
            Object.values(search?.filters || {})
                .flat()
                .sort()
                .join(","),
        ],
        queryFn: async () => {
            const params = new URLSearchParams({
                pageSize: "1",
                programStage: "Nnnqw1XKpZL",
                totalPages: "true",
            });

            for (const [filterKey, filterValues] of Object.entries(
                search?.filters || {},
            )) {
                if (filterValues && filterValues.length > 0) {
                    params.append(
                        `filter`,
                        `${filterKey}:eq:${filterValues[0]}`,
                    );
                }
            }

            const {
                events: {
                    pager: { total },
                },
            } = (await engine.query({
                events: {
                    resource: `events?${params.toString()}`,
                },
            })) as {
                events: {
                    pager: {
                        page: number;
                        total: number;
                        pageSize: number;
                        pageCount: number;
                    };
                };
            };
            return total;
        },
    });
};
export const signalsQueryOptions = (
    engine: ReturnType<typeof useDataEngine>,
    search: OnChange,
) => {
    return queryOptions({
        queryKey: [
            "signals-data",
            Object.values(search?.filters || {})
                .flat()
                .sort()
                .join(","),
        ],
        queryFn: async () => {
            return querySignals({ search, engine });
        },
    });
};
export const initialQueryOptions = (engine: ReturnType<typeof useDataEngine>) =>
    queryOptions({
        queryKey: ["initial-data"],
        queryFn: async () => {
            const {
                programStage,
                me,
                programRuleVariables: { programRuleVariables },
                programRules: { programRules },
            } = (await engine.query({
                programStage: {
                    resource: `programStages/Nnnqw1XKpZL.json`,
                    params: {
                        fields: "programStageDataElements[compulsory,displayInReports,dataElement[id,name,formName,code,valueType,optionSetValue,optionSet[options[id,name,code]]]],programStageSections[id,name,sortOrder,description,displayName,dataElements[id]]",
                    },
                },
                me: {
                    resource: "me",
                    params: { fields: "organisationUnits[id,name,level]" },
                },
                programRules: {
                    resource: `programRules.json`,
                    params: {
                        filter: "program.id:eq:iaN1DovM5em",
                        fields: "*,programRuleActions[*]",
                    },
                },
                programRuleVariables: {
                    resource: `programRuleVariables.json`,
                    params: {
                        filter: "program.id:eq:iaN1DovM5em",
                        fields: "*",
                    },
                },
            })) as {
                programStage: ProgramStage;
                me: {
                    organisationUnits: {
                        id: string;
                        name: string;
                        level: number;
                    }[];
                };
                programRules: { programRules: ProgramRule[] };
                programRuleVariables: {
                    programRuleVariables: ProgramRuleVariable[];
                };
            };

            let assignedDistricts = me.organisationUnits.filter(
                (ou) => ou.level === 3,
            );
            const belowDistricts = me.organisationUnits.flatMap((ou) => {
                if (ou.level === 1) {
                    return {
                        resource: `organisationUnits/${ou.id}`,
                        params: { fields: "id,name", level: 2, paging: false },
                    };
                }
                if (ou.level === 2) {
                    return {
                        resource: `organisationUnits/${ou.id}`,
                        params: { fields: "id,name", level: 1, paging: false },
                    };
                }
                return [];
            });

            if (belowDistricts.length > 0) {
                const districtQuery = belowDistricts.reduce<any>(
                    (acc, curr, index) => {
                        if (curr) {
                            acc[`belowDistricts${index}`] = curr;
                        }
                        return acc;
                    },
                    {},
                );

                const data = (await engine.query(districtQuery)) as Record<
                    string,
                    {
                        organisationUnits: {
                            id: string;
                            name: string;
                            level: number;
                        }[];
                    }
                >;

                Object.values(data).forEach((d) => {
                    assignedDistricts = assignedDistricts.concat(
                        d.organisationUnits,
                    );
                });
            }
            return {
                ...programStage,
                programStageSections: programStage.programStageSections.map(
                    (section) => ({
                        ...section,
                        dataElements: section.dataElements.map(
                            (element) => element.id,
                        ),
                    }),
                ),
                programStageDataElements: new Map(
                    programStage.programStageDataElements.map(
                        ({ compulsory, dataElement, displayInReports }) => [
                            dataElement.id,
                            { ...dataElement, compulsory, displayInReports },
                        ],
                    ),
                ),
                assignedDistricts: orderBy(
                    assignedDistricts,
                    ["name"],
                    ["asc"],
                ).map((ou) => ({ label: ou.name, value: ou.id })),
                programRuleVariables,
                programRules,
            };
        },
    });
