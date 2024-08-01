import {
    Attribute,
    Field,
    Model,
    Schema,
    BlockAttribute,
    Enum,
} from "@mrleebo/prisma-ast";
import {
    DrizzleEnum,
    DrizzleField,
    DrizzleForeignKey,
    DrizzleIndex,
    DrizzleRelation,
    DrizzleSchema,
    DrizzleTable,
} from "schema/drizzleSchema";
import { camelCase, filter, find, get, keyBy, lowerFirst } from "lodash";
import { paramsParser, type } from "schema/paramsParser";
import { exportName } from "schema/exportName";

type PivotTables = Record<
    string,
    {
        name?: string;
        alias?: string;
        joint: string;
        field: "A" | "B";
        from: string;
        to: string;
        fromKey: string;
        toKey: string;
    }
>;

const mapFieldAttribute = paramsParser({
    name: { type: type.string, required: true },
});

const dbTypeAttribute = paramsParser({
    length: { type: type.number },
});

const indexAttribute = paramsParser({
    map: { type: type.string },
    sort: { type: type.either("Asc", "Desc") },
    clustered: { type: type.boolean },
    length: { type: type.number },
});

const defaultAttribute = paramsParser({
    value: {
        type: type.oneOf({
            scalar: type.scalar,
            fn: type.fn,
            literal: type.literal,
        }),
    },
});

const indexFieldAttribute = paramsParser({
    sort: { type: type.either("Asc", "Desc") },
});

const compoundIndexAttribute = paramsParser({
    fields: {
        type: type.array(
            type.oneOf({
                literal: type.literal,
                fn: type.fn,
            }),
        ),
        required: true,
    },
    name: { type: type.string },
    map: { type: type.string },
});

const relationAttribute = paramsParser({
    name: { type: type.string },
    map: { type: type.string },
});

const foreignAttribute = paramsParser({
    fields: { type: type.array(type.literal), required: true },
    references: { type: type.array(type.literal), required: true },
    name: { type: type.string },
    map: { type: type.string },
    onDelete: {
        type: type.either(
            "Cascade",
            "Restrict",
            "NoAction",
            "SetNull",
            "SetDefault",
        ),
    },
    onUpdate: {
        type: type.either(
            "Cascade",
            "Restrict",
            "NoAction",
            "SetNull",
            "SetDefault",
        ),
    },
});

export function getDrizzleSchema(schema: Schema): DrizzleSchema {
    const result: DrizzleSchema = {
        tables: [],
        enums: [],
        provider: getProvider(schema),
    };

    const models = new Map<string, Model>(
        schema.list
            .filter((block): block is Model => block.type === "model")
            .map((model) => [model.name, model]),
    );

    const pivotTables = collectPivotTables(models);

    for (const block of schema.list) {
        if (block.type === "model") {
            if (find(block.properties, { name: "ignore", group: undefined })) {
                continue;
            }

            const modelTable = table(block, models, pivotTables);
            result.tables.push(modelTable);
        }

        if (block.type === "enum") {
            result.enums.push(enumerate(block));
        }
    }

    for (const pivot of Object.values(
        keyBy(Object.values(pivotTables), "joint"),
    )) {
        const from = find(
            result.tables.find((t) => t.name === pivot.from)?.fields,
            { isPrimary: true },
        );

        if (!from) {
            throw new Error(`Table ${pivot.from} primaryKey not found`);
        }

        const to = find(
            result.tables.find((t) => t.name === pivot.to)?.fields,
            { isPrimary: true },
        );

        if (!to) {
            throw new Error(`Table ${pivot.to} primaryKey not found`);
        }

        result.tables.push({
            name: exportName(pivot.joint),
            dbName: "_" + pivot.joint,
            fields: [
                {
                    name: pivot.fromKey,
                    dbName: "A",
                    type: from.type,
                    dbTypeHint: from.dbTypeHint,
                    isNullable: from.isNullable,
                },
                {
                    name: pivot.toKey,
                    dbName: "B",
                    type: to.type,
                    dbTypeHint: to.dbTypeHint,
                    isNullable: from.isNullable,
                },
            ],
            indexes: [
                {
                    kind: "primary",
                    name: "pk",
                    fields: [
                        { name: pivot.fromKey, sort: "Asc" },
                        { name: pivot.toKey, sort: "Asc" },
                    ],
                },
            ],
            foreignKeys: [
                {
                    name: "A",
                    fromFields: [pivot.fromKey],
                    toFields: [from.name],
                    to: pivot.from,
                },
                {
                    name: "B",
                    fromFields: [pivot.toKey],
                    toFields: [to.name],
                    to: pivot.to,
                },
            ],
            relations: [
                {
                    name: pivot.from,
                    alias: pivot.alias
                        ? `${pivot.alias}_${pivot.fromKey}`
                        : undefined,
                    kind: "foreign",
                    to: pivot.from,
                    fields: [pivot.fromKey],
                    references: [from.name],
                },
                {
                    name: pivot.to,
                    alias: pivot.alias
                        ? `${pivot.alias}_${pivot.toKey}`
                        : undefined,
                    kind: "foreign",
                    to: pivot.to,
                    fields: [pivot.toKey],
                    references: [to.name],
                },
            ],
        });
    }

    return result;
}

function table(
    model: Model,
    models: Map<string, Model>,
    pivotTables: PivotTables = {},
): DrizzleTable {
    const result: DrizzleTable = {
        name: exportName(model.name),
        dbName: model.name,
        fields: [],
        indexes: [],
        foreignKeys: [],
        relations: [],
    };

    for (const property of model.properties) {
        switch (property.type) {
            case "attribute":
                if (property.name === "map") {
                    try {
                        result.dbName = mapFieldAttribute(property.args).name;
                    } catch (e) {
                        throw new Error(
                            `Parse @@map property failed: ${e.message} in table ${model.name}`,
                        );
                    }
                } else if (property.name === "id") {
                    result.indexes.push(index("primary", property));
                } else if (property.name === "unique") {
                    result.indexes.push(index("unique", property));
                } else if (property.name === "index") {
                    result.indexes.push(index("index", property));
                } else {
                    throw new Error(
                        `Unknown attribute ${property.name} in table ${model.name}`,
                    );
                }
                break;
            case "field":
                const ignore = find(property.attributes, {
                    name: "ignore",
                    group: undefined,
                });

                if (ignore) {
                    break;
                }

                const rel = find(property.attributes, {
                    name: "relation",
                    group: undefined,
                });

                if (rel && !property.array) {
                    const { fk, relation } = foreignKey(property, rel, model);
                    result.foreignKeys.push(fk);
                    result.relations.push(relation);
                    break;
                }

                const pivot = pivotTables[`${model.name}.${property.name}`];

                const refTable =
                    typeof property.fieldType === "string"
                        ? models.get(property.fieldType)
                        : undefined;

                if (pivot) {
                    result.relations.push({
                        kind: "many",
                        alias: pivot.alias
                            ? `${pivot.alias}_${pivot.fromKey}`
                            : undefined,
                        name: property.name,
                        to: exportName(pivot.joint),
                    });
                    break;
                } else if (refTable) {
                    if (typeof property.fieldType !== "string") {
                        throw new Error(
                            `Expected string, got ${property.fieldType.name} function`,
                        );
                    }

                    const params = rel
                        ? relationAttribute(rel.args)
                        : undefined;

                    result.relations.push({
                        alias: params?.map ?? params?.name,
                        kind: property.array ? "many" : "one",
                        name: property.name,
                        to: exportName(property.fieldType),
                    });
                    break;
                }

                result.fields.push(field(property, model));
                break;
            case "break":
            case "comment":
                break;
            default:
                throw new Error(
                    `Unknown property type ${get(
                        property,
                        "type",
                        "<null>",
                    )} in table ${model.name}`,
                );
        }
    }

    return result;
}

function index(kind: DrizzleIndex["kind"], def: BlockAttribute) {
    const params = compoundIndexAttribute(def.args);

    const fields: DrizzleIndex["fields"] = params.fields.map((item) => {
        switch (item.type) {
            case "literal":
                return { name: item.value, sort: "Asc" };
            case "fn":
                const { sort } = indexFieldAttribute(item.value.params);
                return { name: item.value.name, sort: sort ?? "Asc" };
        }
    });

    const postfix = {
        primary: "_pKey",
        unique: "_unq",
        index: "_idx",
    }[kind];

    const genName = camelCase(
        fields.map((item) => item.name).join("_") + postfix,
    );

    return {
        kind,
        name: params.name || genName,
        dbName: params.map,
        fields,
    } satisfies DrizzleIndex;
}

function foreignKey(
    field: Field,
    relation: Attribute,
    model: Model,
): { fk: DrizzleForeignKey; relation: DrizzleRelation } {
    if (typeof field.fieldType !== "string") {
        throw new Error(
            `Expected string, got ${field.fieldType.name} function`,
        );
    }

    const params = foreignAttribute(relation.args);

    if (params.fields.length !== params.references.length) {
        throw new Error(
            `Relation fields and references count mismatch in table ${model.name}`,
        );
    }

    const to = exportName(field.fieldType);

    return {
        fk: {
            name: params.name || field.name,
            to,
            dbName: params.map,
            fromFields: params.fields,
            toFields: params.references,
            onUpdate: params.onUpdate,
            onDelete: params.onDelete,
        },
        relation: {
            name: field.name,
            alias: params.name,
            kind: "foreign",
            to,
            fields: params.fields,
            references: params.references,
        },
    };
}

function field(field: Field, model: Model) {
    if (typeof field.fieldType !== "string") {
        throw new Error(
            `Expected string, got ${field.fieldType.name} function`,
        );
    }

    const result: DrizzleField = {
        name: field.name,
        dbName: field.name,
        type: field.fieldType,
        isNullable: !!field.optional,
        isArray: field.array,
        isPrimary: false,
    };

    for (const attribute of field.attributes || []) {
        if (attribute.group === "db") {
            result.dbTypeHint = {
                type: attribute.name,
                arg: dbTypeAttribute(attribute.args).length,
            };
            continue;
        }

        switch (attribute.name) {
            case "map":
                try {
                    result.dbName = mapFieldAttribute(attribute.args).name;
                } catch (e) {
                    throw new Error(
                        `Parse @@map property failed: ${e.message} in table ${model.name}`,
                    );
                }
                break;
            case "default":
                try {
                    const param = defaultAttribute(attribute.args).value;

                    switch (param?.type) {
                        case "scalar":
                            result.default = { value: param.value };
                            break;
                        case "fn":
                            result.default = { fn: param.value.name };
                            break;
                        case "literal":
                            result.default = { value: param.value };
                            break;
                    }
                } catch (e) {
                    throw new Error(
                        `Parse ${model.name} @@default property failed: ${e.message}`,
                    );
                }
                break;
            case "unique":
                const attr = indexAttribute(attribute.args);
                result.isUnique = {
                    name: attr.map,
                    sort: attr.sort ?? "Asc",
                };
                break;
            case "id":
                result.isPrimary = true;
                break;
            case "updatedAt":
                result.update = { fn: "now" };
                result.default = { fn: "now" };
                break;
            case "createdAt":
                result.default = { fn: "now" };
                break;
            default:
                throw new Error(
                    `Unknown attribute ${attribute.name} in table ${model.name}`,
                );
        }
    }

    return result;
}

function enumerate(enumeration: Enum) {
    const result: DrizzleEnum = {
        name: enumeration.name,
        dbName: enumeration.name,
        values: [],
    };

    for (const enumerator of enumeration.enumerators) {
        if (enumerator.type === "enumerator") {
            result.values.push(enumerator.name);
        }

        const attribute = enumerator as object;
        if (isAttribute(attribute) && attribute.name === "map") {
            if (attribute.kind === "object") {
                result.dbName =
                    mapFieldAttribute(attribute.args).name || result.dbName;
            } else if (attribute.kind === "field") {
                throw new Error("Enumeration mapping is not supported");
            }
        }
    }

    return result;
}

function isAttribute(value: object): value is Attribute | BlockAttribute {
    return value && "type" in value && value.type === "attribute";
}

function collectPivotTables(models: Map<string, Model>) {
    const relations: PivotTables = {};

    for (const model of models.values()) {
        const fields = filter(
            model.properties,
            (p): p is Field => p.type === "field" && !!p.array,
        );

        for (const fromField of fields) {
            if (typeof fromField.fieldType !== "string") {
                continue;
            }

            const refModel = models.get(fromField.fieldType);

            if (!refModel) {
                continue;
            }

            const rel = find(fromField.attributes, {
                name: "relation",
                group: undefined,
            });

            const name = relationAttribute(rel?.args || []).name;

            const refFields = refModel.properties.filter(
                (p): p is Field =>
                    p.type === "field" &&
                    p.fieldType === model.name &&
                    !!p.array,
            );

            if (!refFields.length) {
                continue;
            }

            const reversed =
                model.name.length === refModel.name.length
                    ? model.name < refModel.name
                    : model.name.length < refModel.name.length;

            const from = reversed ? model.name : refModel.name;
            const to = reversed ? refModel.name : model.name;

            relations[`${model.name}.${fromField.name}`] = {
                name,
                joint: name || `${from}To${to}`,
                alias: name,
                field: reversed ? "A" : "B",
                from: exportName(from),
                to: exportName(to),
                fromKey: lowerFirst(from) + "Id",
                toKey: lowerFirst(to) + "Id",
            };
        }
    }

    return relations;
}

function getProvider(schema: Schema) {
    for (const item of schema.list) {
        if (item.type !== "datasource") {
            continue;
        }

        for (const assignment of item.assignments) {
            if (
                assignment.type === "assignment" &&
                assignment.key === "provider"
            ) {
                return type.string(assignment.value);
            }
        }
    }

    return null;
}
