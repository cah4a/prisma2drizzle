import {
    DrizzleEnum,
    DrizzleField,
    DrizzleForeignKey,
    DrizzleIndex,
    DrizzleRelation,
    DrizzleSchema,
    DrizzleTable,
} from "schema/drizzleSchema";
import {isEmpty, snakeCase, uniq} from "lodash";

const dialects = {
    mysql: {
        table: "mysqlTable",
        fieldFn(field: DrizzleField, enums: DrizzleEnum[]) {
            const type =
                field.type +
                (field.dbTypeHint ? ` @db.${field.dbTypeHint.type}` : "");

            switch (type) {
                case "Int":
                case "Int @db.Int":
                    return { fn: "int" };
                case "Int @db.TinyInt":
                    return { fn: "tinyint" };
                case "Int @db.SmallInt":
                    return { fn: "smallint" };
                case "Int @db.MediumInt":
                    return { fn: "mediumint" };
                case "Int @db.UnsignedInt":
                    return { fn: "int", arg: [`{ unsigned: true }`] };
                case "Int @db.UnsignedTinyInt":
                    return { fn: "tinyint", arg: [`{ unsigned: true }`] };
                case "Int @db.UnsignedSmallInt":
                    return { fn: "smallint", arg: [`{ unsigned: true }`] };
                case "Int @db.UnsignedMediumInt":
                    return { fn: "mediumint", arg: [`{ unsigned: true }`] };
                case "BigInt":
                case "BigInt @db.BigInt":
                    return { fn: "bigint", arg: [`{ mode: "bigint", unsigned: false }`] };
                case "BigInt @db.UnsignedBigInt":
                    return { fn: "bigint", arg: [`{ mode: "bigint", unsigned: true }`] };
                case "String @db.Text":
                    return { fn: "text" };
                case "String @db.TinyText":
                    return { fn: "tinytext" };
                case "String @db.MediumText":
                    return { fn: "mediumtext" };
                case "String @db.LongText":
                    return { fn: "longtext" };
                case "String":
                    return { fn: "varchar", arg: [`{ length: 255 }`] };
                case "String @db.VarChar":
                    return {
                        fn: "varchar",
                        arg: [`{ length: ${field.dbTypeHint?.arg ?? 255} }`],
                    };
                case "String @db.Char":
                    return {
                        fn: "char",
                        arg: [`{ length: ${field.dbTypeHint?.arg ?? 255} }`],
                    };
                case "Boolean":
                case "Boolean @db.TinyInt":
                    return { fn: "boolean" };
                case "Boolean @db.Bit":
                    if (field.dbTypeHint?.arg !== 1) {
                        throw new Error(
                            `Expected 1 as bit length to use it as boolean`,
                        );
                    }
                    return { fn: "binary", arg: [`{ length: 1 }`] };
                case "DateTime":
                case "DateTime @db.DateTime":
                    return { fn: "datetime" };
                case "DateTime @db.Timestamp":
                    return { fn: "timestamp" };
                case "DateTime @db.Time":
                    return { fn: "time" };
                case "DateTime @db.Date":
                    return { fn: "date" };
                case "DateTime @db.Year":
                    return { fn: "year" };
                case "Float":
                case "Float @db.Float":
                    return { fn: "float" };
                case "Float @db.Real":
                    return { fn: "real" };
                case "Json":
                case "Json @db.Json":
                    return { fn: "json" };
                default:
                    const enumeration = enums.find((e) => e.name === type);

                    if (enumeration) {
                        return {
                            fn: "mysqlEnum",
                            arg: [literal(enumeration.values)],
                        };
                    }

                    throw new Error(`Unknown field type ${type}`);
            }
        },
    },
};

type DialectType = keyof typeof dialects;
type Dialect = (typeof dialects)[keyof typeof dialects];

class ImportsCollector {
    private coreImports = new Set<string>();
    private basicImports = new Set<string>();

    constructor(private dialect: string) {}

    core(name: string) {
        this.coreImports.add(name);
    }

    basic(name: string) {
        this.basicImports.add(name);
    }

    toString() {
        const imports = [];

        if (this.coreImports.size > 0) {
            imports.push(
                `import { ${Array.from(this.coreImports).join(
                    ", ",
                )} } from "drizzle-orm/${this.dialect}-core"`,
            );
        }

        if (this.basicImports.size > 0) {
            imports.push(
                `import { ${Array.from(this.basicImports).join(
                    ", ",
                )} } from "drizzle-orm"`,
            );
        }

        return imports.join("\n");
    }
}

export function generateSchema(
    schema: DrizzleSchema,
) {
    if (!schema.provider) {
        throw new Error("Provider is required");
    }

    const imports = new ImportsCollector(schema.provider);

    const tables: string[] = [];

    if (schema.provider in dialects) {
        for (const table of schema.tables) {
            tables.push(generateTable(table, schema.enums, schema.provider as DialectType, imports));
        }

        return imports.toString() + "\n\n" + tables.join("\n\n");
    }

    if (schema.provider === "postgres") {
        throw new Error("Postgres is not supported yet. Please open an issue on GitHub if you need it.")
    }

    if (schema.provider === "sqlite") {
        throw new Error("SQLite is not supported yet. Please open an issue on GitHub if you need it.")
    }

    throw new Error(`Unsupported dialect ${schema.provider}`);
}

export function generateTable(
    table: DrizzleTable,
    enums: DrizzleEnum[],
    dialect: DialectType,
    imports?: ImportsCollector,
) {
    const d = dialects[dialect];

    imports?.core(d.table);
    imports?.basic("type InferSelectModel");
    imports?.basic("type InferInsertModel");

    const enhancers = Object.fromEntries([
        ...table.indexes.map((idx) => [idx.name, generateIndex(idx, imports)]),
        ...table.foreignKeys
            .filter((fk) => fk.fromFields.length > 1)
            .map((idx) => [idx.name, generateForeignKey(idx, imports)]),
    ]);

    const fields = table.fields.map(
        (field) =>
            `${field.name}: ${generateField(field, table, enums, d, imports)}`,
    );

    const args = [literal(table.dbName), `{ ${fields.join(", ")} }`];

    if (!isEmpty(enhancers)) {
        args.push(`(table) => (${object(enhancers)})`);
    }

    const exports = [
        `export const ${table.name} = ${d.table}(${args.join(", ")});`,
        `export type ${table.name}SelectModel = InferSelectModel<typeof ${table.name}>`,
        `export type ${table.name}InsertModel = InferInsertModel<typeof ${table.name}>`,
    ];

    if (table.relations.length > 0) {
        imports?.basic("relations");

        const relations = Object.fromEntries(
            table.relations.map(
                (relation) =>
                    [relation.name, generateRelation(relation, table)] as const,
            ),
        );

        const relationKinds = uniq(
            table.relations.map((relation) =>
                relation.kind === "many" ? "many" : "one",
            ),
        );

        exports.push(
            `export const ${table.name}Relations = relations(${
                table.name
            }, ({${relationKinds.join(", ")}}) => (${object(relations)}));`,
        );
    }

    return exports.join("\n\n");
}

function generateRelation(relation: DrizzleRelation, table: DrizzleTable) {
    const relationName = relation.alias ? literal(relation.alias) : undefined;

    if (relation.kind === "foreign") {
        return `one(${relation.to}, ${object({
            relationName,
            fields: array(
                relation.fields.map((name) => `${table.name}.${name}`),
            ),
            references: array(
                relation.references.map((name) => `${relation.to}.${name}`),
            ),
        })})`;
    }

    const arg = relationName ? object({ relationName }) : "";

    if (relation.kind === "many") {
        return `many(${relation.to}, ${arg})`;
    }

    return `one(${relation.to}, ${arg})`;
}

function generateIndex(index: DrizzleIndex, imports?: ImportsCollector) {
    const columns = index.fields.map(({ name, sort }) => {
        const field = `table.${name}`;

        if (sort === "Desc") {
            imports?.basic("sql");
            return "sql`${" + field + "} DESC`";
        }

        return field;
    });

    if (index.kind === "primary") {
        imports?.core("primaryKey");
        return `primaryKey(${object({
            name: index.dbName ? literal(index.dbName) : undefined,
            columns: array(columns),
        })})`;
    }

    const fn = index.kind === "unique" ? "uniqueIndex" : "index";
    const indexName = index.dbName ?? snakeCase(index.name);

    imports?.core(fn);

    return `${fn}(${literal(indexName)}).on(${columns.join(", ")})`;
}

function generateForeignKey(
    fk: DrizzleForeignKey,
    importsCollector?: ImportsCollector,
) {
    const arg = {
        name: fk.dbName ? literal(fk.dbName) : undefined,
        columns: array(fk.fromFields.map((name) => `table.${name}`)),
        foreignColumns: array(fk.toFields.map((name) => `${fk.to}.${name}`)),
    };

    importsCollector?.core("foreignKey");

    return `foreignKey(${object(arg)})`;
}

function generateField(
    field: DrizzleField,
    table: DrizzleTable,
    enums: DrizzleEnum[],
    dialect: Dialect,
    imports?: ImportsCollector,
) {
    const { fn, arg } = dialect.fieldFn(field, enums);
    const args = [literal(field.dbName), ...(arg ?? [])];
    const modifiers = [];

    imports?.core(fn);

    if (field.default) {
        if ("value" in field.default) {
            modifiers.push(`.default(${literal(field.default.value)})`);
        } else if (field.default.fn === "autoincrement") {
            modifiers.push(`.${field.default.fn}()`);
        }
    }

    if (field.isPrimary) {
        modifiers.push(".primaryKey()");
    } else if (field.isUnique) {
        // You can't have both primary and unique
        modifiers.push(
            `.unique(${
                field.isUnique.name ? literal(field.isUnique.name) : ""
            })`,
        );
    }

    if (!field.isNullable) {
        modifiers.push(".notNull()");
    }

    if (field.isArray) {
        modifiers.push(".array()");
    }

    const fk = table.foreignKeys.find(
        (fk) => fk.fromFields.length === 1 && fk.fromFields[0] === field.name,
    );

    if (fk) {
        modifiers.push(`.references(() => ${fk.to}.${fk.toFields[0]})`);
    }

    return `${fn}(${args.join(", ")})${modifiers.join("")}`;
}

function literal(value: unknown) {
    if (typeof value === "bigint") {
        return value.toString();
    }

    return JSON.stringify(value);
}

function object(record: Record<string, string | undefined>) {
    return `{ ${Object.entries(record)
        .filter(([_, value]) => value !== undefined)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ")} }`;
}

function array(values: string[]) {
    return `[${values.join(", ")}]`;
}
