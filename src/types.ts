import { TablePaginationConfig } from "antd";
import { FilterValue } from "antd/es/table/interface";
import { z } from "zod";
const UserSchema = z.object({
    uid: z.string(),
    username: z.string(),
    firstName: z.string(),
    surname: z.string(),
});
export const EventSchema = z.object({
    programStage: z.string(),
    programType: z.string(),
    orgUnit: z.string(),
    program: z.string(),
    event: z.string(),
    status: z.string().optional(),
    orgUnitName: z.string().optional(),
    eventDate: z.string(),
    created: z.string().optional(),
    lastUpdated: z.string().optional(),
    deleted: z.boolean(),
    attributeOptionCombo: z.string().optional(),
    dataValues: z.array(
        z.object({
            lastUpdated: z.string().optional(),
            created: z.string().optional(),
            dataElement: z.string(),
            value: z.string(),
            providedElsewhere: z.boolean(),
            createdBy: UserSchema.optional(),
            updatedBy: UserSchema.optional(),
        }),
    ),
    notes: z.array(z.unknown()).optional(),
});
export const EventWithValuesSchema = EventSchema.extend({
    dataValues: z.record(z.string(), z.string().nullable()),
    notes: z.array(z.unknown()),
}).partial();
export const SMSSchema = z.object({
    created: z.string(),
    lastUpdated: z.string(),
    translations: z.array(z.unknown()),
    createdBy: z.object({
        id: z.string(),
        code: z.null(),
        name: z.string(),
        displayName: z.string(),
        username: z.string(),
    }),
    favorites: z.array(z.unknown()),
    sharing: z.object({
        external: z.boolean(),
        users: z.object({}),
        userGroups: z.object({}),
    }),
    user: z.object({
        id: z.string(),
        code: z.null(),
        name: z.string(),
        displayName: z.string(),
        username: z.string(),
    }),
    access: z.object({
        manage: z.boolean(),
        externalize: z.boolean(),
        write: z.boolean(),
        read: z.boolean(),
        update: z.boolean(),
        delete: z.boolean(),
    }),
    favorite: z.boolean(),
    id: z.string(),
    attributeValues: z.array(z.unknown()),
    smsencoding: z.string(),
    sentdate: z.string(),
    receiveddate: z.string(),
    originator: z.string(),
    gatewayid: z.string(),
    text: z.string(),
    smsstatus: z.string(),
    forwarded: z.boolean().optional(),
    event: EventWithValuesSchema.optional(),
});

export const SMSSearchParams = z.object({
    page: z.number().min(1).optional().default(1),
    pageSize: z.number().min(1).max(100).optional().default(10),
    q: z.string().optional().default(""),
    dates: z.string().optional(),
});

export const ProgramStageSchema = z.object({
    programStageDataElements: z.array(
        z.object({
            dataElement: z.object({
                code: z.string(),
                name: z.string(),
                formName: z.string(),
                valueType: z.string(),
                optionSet: z.object({
                    options: z.array(
                        z.object({
                            code: z.string(),
                            name: z.string(),
                            id: z.string(),
                        }),
                    ),
                }),
                optionSetValue: z.boolean(),
                id: z.string(),
            }),
            compulsory: z.boolean(),
            displayInReports: z.boolean(),
        }),
    ),
    programStageSections: z.array(
        z.object({
            name: z.string(),
            description: z.string(),
            dataElements: z.array(z.object({ id: z.string() })),
            sortOrder: z.number(),
            displayName: z.string(),
        }),
    ),
});

export const ProgramRuleActionSchema = z.object({
    programRuleActionType: z.enum([
        "HIDEFIELD",
        "SHOWFIELD",
        "ASSIGN",
        "DISPLAYTEXT",
        "ERROR",
        "SHOWWARNING",
    ]),
    dataElement: z
        .object({ displayName: z.string(), id: z.string() })
        .optional(),
    id: z.string(),
    attributeValues: z.array(z.unknown()),
    templateUid: z.string().optional(),
    option: z.object({ id: z.string(), displayName: z.string() }).optional(),
    optionGroup: z
        .object({ id: z.string(), displayName: z.string() })
        .optional(),
    trackedEntityAttribute: z
        .object({ id: z.string(), displayName: z.string() })
        .optional(),
    programStage: z
        .object({ id: z.string(), displayName: z.string() })
        .optional(),
    programStageSection: z
        .object({ id: z.string(), displayName: z.string() })
        .optional(),
    value: z.string().optional(),
});

export const ProgramRuleSchema = z.object({
    name: z.string(),
    translations: z.array(z.unknown()),
    description: z.string(),
    programRuleActions: z.array(ProgramRuleActionSchema),
    condition: z.string(),
    priority: z.number(),
    displayName: z.string(),
    id: z.string(),
    attributeValues: z.array(z.unknown()),
});

export const ProgramRuleVariableSchema = z.object({
    name: z.string(),
    program: z.object({ id: z.string() }),
    dataElement: z.object({ id: z.string() }),
    useCodeForOptionSet: z.boolean(),
    displayName: z.string(),
    id: z.string(),
    attributeValues: z.array(z.unknown()),
    programRuleVariableSourceType: z.string(),
    valueType: z.enum(["TEXT", "NUMBER", "BOOLEAN", "DATE"]),
});

export type SMS = z.infer<typeof SMSSchema>;
export type Event = z.infer<typeof EventSchema>;
export type EventWithValues = z.infer<typeof EventWithValuesSchema>;
export type SMSSearchParams = z.infer<typeof SMSSearchParams>;
export type ProgramStage = z.infer<typeof ProgramStageSchema>;

export type ProgramRule = z.infer<typeof ProgramRuleSchema>;

export type ProgramRuleAction = z.infer<typeof ProgramRuleActionSchema>;

export type ProgramRuleVariable = z.infer<typeof ProgramRuleVariableSchema>;

export type ProgramRuleResult = {
    assignments: Record<string, any>;
    hiddenFields: Set<string>;
    shownFields: Set<string>;
    messages: string[];
    warnings: string[];
};
export type OnChange = {
    pagination: TablePaginationConfig;
    filters: Record<string, FilterValue | null>;
};
