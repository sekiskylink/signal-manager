import { QueryKey, useInfiniteQuery } from "@tanstack/react-query";
import type { Table } from "dexie";
import { useLiveQuery } from "dexie-react-hooks";
import { ProgramRule, ProgramRuleResult, ProgramRuleVariable } from "../types";
import { Dictionary } from "lodash";

interface UseDexieInfiniteTableQueryOptions<T> {
    table: Table<T, any>;
    fetchFn: (page: number) => Promise<{
        events: T[];
        pager: {
            page: number;
            isLastPage: boolean;
        };
    }>;
    queryKey: QueryKey;
    filterFn?: (item: T) => boolean;
}

export const nextAction = (dataValues: Dictionary<string>) => {
    if (dataValues["VaO1WnueBpu"]) {
        return { next: "", active: ["0", "1", "2", "3"] };
    }
    if (dataValues["FidiishnZJZ"] === "Discard") {
        return { next: "", active: ["0", "1", "2"] };
    }
    if (dataValues["FidiishnZJZ"] === "Alert") {
        return { next: "3", active: ["0", "1", "2", "3"] };
    }
    if (dataValues["RZMTtSyhdHY"] === "Discard") {
        return { next: "", active: ["0", "1"] };
    }
    if (dataValues["RZMTtSyhdHY"] === "Relevant") {
        return { next: "2", active: ["0", "1", "2"] };
    }
    return { next: "0", active: ["0", "1"] };
};

export const currentStatus = (values: any) => {
    if (values.dataValues?.["VaO1WnueBpu"]) {
        return { text: "Assessed", color: "green" };
    }
    if (values.dataValues?.["FidiishnZJZ"]) {
        return { text: "Verified", color: "yellow" };
    }

    if (values.dataValues?.["RZMTtSyhdHY"]) {
        return { text: "Triaged", color: "red" };
    }
    return { text: "Open", color: "gray" };
};

export const signalStatus = (values: any) => {
    if (values.dataValues?.["VaO1WnueBpu"]) {
        if (values.dataValues?.["x84ZTtD0Z8u"]) {
            if (values.dataValues?.["x84ZTtD0Z8u"] === "Low") {
                return { text: "Closed", color: "green" };
            }
            if (values.dataValues?.["x84ZTtD0Z8u"] === "Moderate") {
                return { text: "Under Monitoring", color: "blue" };
            }
            if (values.dataValues?.["x84ZTtD0Z8u"] === "High") {
                return { text: "Actioned", color: "orange" };
            }
            if (values.dataValues?.["x84ZTtD0Z8u"] === "Very High") {
                return { text: "Critical", color: "crimson" };
            }
            return { text: "Closed", color: "green" };
        }
        return { text: "Assessed", color: "green" };
    }
    if (values.dataValues?.["FidiishnZJZ"] === "Discard") {
        return { text: "Verified", color: "red" };
    }
    if (values.dataValues?.["FidiishnZJZ"] === "Alert") {
        return { text: "Alerted", color: "orange" };
    }
    if (values.dataValues?.["RZMTtSyhdHY"] === "Relevant") {
        return { text: "Reviewed", color: "blue" };
    }

    if (values.dataValues?.["RZMTtSyhdHY"] === "Discard") {
        if (values.dataValues?.["LxWNKdd93lq"] === "Yes") {
            return { text: "Duplicate", color: "red" };
        }
        return { text: "Triaged", color: "gray" };
    }
    return { text: "New", color: "gray" };
};
export const signalLevel = (values: any) => {
    const { x84ZTtD0Z8u: riskLevel } = values.dataValues;
    console.log("Risk level:", riskLevel);
    if (riskLevel === "Very High") {
        return "crimson";
    }
    if (riskLevel === "High") {
        return "red";
    }
    if (riskLevel === "Moderate") {
        return "orange";
    }
    if (riskLevel === "Low") {
        return "yellow";
    }
    return "";
};

export function useDexieInfiniteTableQuery<T>({
    table,
    fetchFn,
    queryKey,
    filterFn,
}: UseDexieInfiniteTableQueryOptions<T>) {
    const query = useInfiniteQuery({
        queryKey,
        initialPageParam: 1,
        queryFn: async ({ pageParam = 1 }) => {
            const res = await fetchFn(pageParam);
            if (res.events?.length) {
                await table.bulkPut(res.events);
            }
            return res;
        },
        getNextPageParam: (lastPage, allPages) =>
            lastPage.pager.isLastPage ? undefined : allPages.length + 1,
        refetchOnWindowFocus: false,
    });
    const localData = useLiveQuery(async () => {
        const coll = filterFn
            ? table.orderBy("lastUpdated").filter(filterFn).reverse()
            : table.orderBy("lastUpdated").reverse();
        return coll.toArray();
    }, [filterFn]);
    return {
        data: localData ?? [],
        fetchNextPage: query.fetchNextPage,
        hasNextPage: query.hasNextPage,
        isFetchingNextPage: query.isFetchingNextPage,
        isFetching: query.isFetching,
    };
}

export function getUniqueNumber() {
    const time = Date.now() % 100000; // 5 digits
    const rand = Math.floor(Math.random() * 100); // 2 digits
    return time * 100 + rand; // 7 digits max
}

export function executeProgramRules({
    programRules,
    programRuleVariables,
    dataValues,
}: {
    programRules: ProgramRule[];
    programRuleVariables: ProgramRuleVariable[];
    dataValues: Record<string, any>;
}): ProgramRuleResult {
    const variableValues: Record<string, any> = {};
    for (const variable of programRuleVariables) {
        let value: any = null;

        if (
            variable.dataElement &&
            dataValues.hasOwnProperty(variable.dataElement.id)
        ) {
            value = dataValues[variable.dataElement.id];
        }
        variableValues[variable.name] = value ?? null;
    }
    // Step 2: Safely evaluate rule condition
    const evaluateCondition = (condition: string): boolean => {
        // Updated regex to match variable names with spaces: #{variable name with spaces}
        const safeCond = condition.replace(/#\{([^}]+)\}/g, (_, name) => {
            const val = variableValues[name];
            // Always wrap values in quotes to handle strings with spaces, dashes, dates, special chars
            if (val === null || val === undefined) {
                return "''";
            }
            if (typeof val === "boolean") {
                return String(val);
            }
            if (typeof val === "number") {
                return String(val);
            }
            // For strings, dates, and any other type: escape and quote
            // This handles: spaces, dashes, colons (dates like 2024-01-15 or 2024-01-15T10:30:00)
            const stringVal = String(val);
            const escaped = stringVal
                .replace(/\\/g, "\\\\")  // Escape backslashes first
                .replace(/'/g, "\\'");    // Then escape single quotes
            return `'${escaped}'`;
        });

        try {
            // Replace comparison operators with strict versions
            // Split by quotes, only replace in non-quoted sections
            let parts = safeCond.split("'");
            for (let i = 0; i < parts.length; i += 2) {
                // Only process parts outside of quotes (even indices)
                // Order matters: replace != first, then == (but not !=, <=, >=, ===)
                parts[i] = parts[i]
                    .replace(/!=/g, "!==")
                    .replace(/([^!<>=])={2}(?!=)/g, "$1===")  // == to === (but not !==, ===)
                    .replace(/([^!<>=])=(?!=)/g, "$1===");     // Single = to === (but not !=, <=, >=, ==)
            }
            const normalizedCond = parts.join("'");

            console.log("Normalized condition:", normalizedCond);
            const value = new Function(`return (${normalizedCond})`)();
            return value;
        } catch (err) {
            console.warn(`Invalid condition: ${condition}`, safeCond, err);
            return false;
        }
    };

    // Step 3: Run through rules and collect actions
    const result: ProgramRuleResult = {
        assignments: {},
        hiddenFields: new Set(),
        shownFields: new Set(),
        messages: [],
        warnings: [],
    };

    for (const rule of programRules) {
        const isTrue = evaluateCondition(rule.condition);
        if (!isTrue) continue;
        for (const action of rule.programRuleActions) {
            switch (action.programRuleActionType) {
                case "ASSIGN":
                    if (action.dataElement) {
                        result.assignments[action.dataElement.id] =
                            action.value;
                        console.log(
                            "Assigned",
                            action.dataElement.id,
                            "=",
                            action.value,
                        );
                    }
                    break;
                case "HIDEFIELD":
                    if (action.dataElement) {
                        result.hiddenFields.add(action.dataElement.id);
                        // Clear the value when hiding the field to avoid stale data
                        result.assignments[action.dataElement.id] = '';
                        console.log("Hidden field:", action.dataElement.id, "and cleared its value");
                    }
                    break;
                case "SHOWFIELD":
                    if (action.dataElement) {
                        result.shownFields.add(action.dataElement.id);
                    }
                    break;
                case "DISPLAYTEXT":
                    if (action.value) {
                        result.messages.push(action.value);
                    }
                    break;
                case "ERROR":
                    if (action.value) {
                        result.messages.push(`Error: ${action.value}`);
                    }
                    break;
                case "SHOWWARNING":
                    if (action.value) {
                        result.warnings.push(action.value);
                    }
                    break;
            }
        }
    }

    return result;
}
