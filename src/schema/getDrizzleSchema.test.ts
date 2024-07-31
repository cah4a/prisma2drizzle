import { expect, describe, test } from "vitest";
import { getSchema } from "@mrleebo/prisma-ast";
import { getDrizzleSchema } from "schema/getDrizzleSchema";
import { find } from "lodash";

describe("provider detection", () => {
    test.each(["mysql", "postgresql", "sqlite"])("%s", (provider) => {
        const schema = getSchema(`
            datasource db {
              provider = "${provider}"
              url      = env("DATABASE_URL")
            }
        `);

        const result = getDrizzleSchema(schema);
        expect(result.provider).toBe(provider);
    });
});

describe("fields", () => {
    test.each([
        [
            "id Int?",
            {
                name: "id",
                dbName: "id",
                type: "Int",
                isNullable: true,
                isPrimary: false,
                isArray: false,
            },
        ],
        [
            "id Int[]",
            {
                name: "id",
                dbName: "id",
                type: "Int",
                isNullable: false,
                isPrimary: false,
                isArray: true,
            },
        ],
        [
            `text String @db.Text`,
            {
                name: "text",
                dbName: "text",
                type: "String",
                isNullable: false,
                isPrimary: false,
                isArray: false,
                dbTypeHint: {
                    arg: undefined,
                    type: "Text",
                },
            },
        ],
        [
            `test String @db.VarChar(1024) @map("foo")`,
            {
                name: "test",
                dbName: "foo",
                type: "String",
                isNullable: false,
                isPrimary: false,
                isArray: false,
                dbTypeHint: {
                    arg: 1024,
                    type: "VarChar",
                },
            },
        ],
        [
            "id Int @id @default(autoincrement())",
            {
                name: "id",
                dbName: "id",
                type: "Int",
                default: { fn: "autoincrement" },
                isNullable: false,
                isPrimary: true,
                isArray: false,
            },
        ],
        [
            "id DateTime @default(now())",
            {
                name: "id",
                dbName: "id",
                type: "DateTime",
                default: { fn: "now" },
                isNullable: false,
                isPrimary: false,
                isArray: false,
            },
        ],
        [
            "email String @unique",
            {
                name: "email",
                dbName: "email",
                type: "String",
                isUnique: {
                    name: undefined,
                    sort: "Asc",
                },
                isNullable: false,
                isPrimary: false,
                isArray: false,
            },
        ],
        [
            `email String @unique(map: "email_idx", sort: Desc)`,
            {
                name: "email",
                dbName: "email",
                type: "String",
                isUnique: {
                    name: "email_idx",
                    sort: "Desc",
                },
                isNullable: false,
                isPrimary: false,
                isArray: false,
            },
        ],
        [
            `value MyEnumValue @default(FOO)`,
            {
                name: "value",
                dbName: "value",
                type: "MyEnumValue",
                default: { value: "FOO" },
                isNullable: false,
                isPrimary: false,
                isArray: false,
            },
        ],
    ])("%s", (input, result) => {
        const schema = getSchema(`
            datasource db {
              provider = "mysql"
              url      = env("DATABASE_URL")
            }
            
            model Foo {
              ${input}
            }
        `);

        const { tables } = getDrizzleSchema(schema);
        const table = find(tables, { name: "Foo" });

        expect(table?.fields[0]).toEqual(result);
    });

    test("field @ignore", () => {
        const schema = getSchema(
            ["model Foo {", "  someField Int? @ignore", "}"].join("\n"),
        );

        const { tables } = getDrizzleSchema(schema);
        const table = find(tables, { name: "Foo" });

        expect(table?.fields).toHaveLength(0);
    });
});

describe("foreignKeys", () => {
    test.each([
        [
            "user User @relation(fields: [userId], references: [id], onUpdate: Restrict)",
            {
                dbName: undefined,
                name: "user",
                to: "User",
                fromFields: ["userId"],
                toFields: ["id"],
                onUpdate: "Restrict",
                onDelete: undefined,
            },
        ],
        [
            `user User @relation(name: "Test", map: "db_name", fields: [userId], references: [id], onUpdate: NoAction, onDelete: Cascade)`,
            {
                dbName: "db_name",
                name: "Test",
                to: "User",
                fromFields: ["userId"],
                toFields: ["id"],
                onUpdate: "NoAction",
                onDelete: "Cascade",
            },
        ],
        [
            `user User @relation(name: "Test", map: "db_name", fields: [userId], references: [id], onUpdate: SetNull, onDelete: SetDefault)`,
            {
                dbName: "db_name",
                name: "Test",
                to: "User",
                fromFields: ["userId"],
                toFields: ["id"],
                onUpdate: "SetNull",
                onDelete: "SetDefault",
            },
        ],
        [
            "user User @relation(fields: [firstName, lastName], references: [name, surname])",
            {
                dbName: undefined,
                fromFields: ["firstName", "lastName"],
                name: "user",
                onDelete: undefined,
                onUpdate: undefined,
                to: "User",
                toFields: ["name", "surname"],
            },
        ],
    ])("%s", (input, result) => {
        const schema = getSchema(`
            datasource db {
              provider = "mysql"
              url      = env("DATABASE_URL")
            }
            
            model Foo {
              ${input}
            }
        `);

        const { tables } = getDrizzleSchema(schema);
        const table = find(tables, { name: "Foo" });

        expect(table?.foreignKeys[0]).toEqual(result);
    });
});

describe("relations", () => {
    test("reference", () => {
        const schema = getSchema(`
            datasource db {
              provider = "mysql"
              url      = env("DATABASE_URL")
            }
        
            model Foo {
              user User @relation(fields: [userId], references: [id])
              userId Int
            }
            
            model User {
              id Int @id
              foos Foo[]
            }
        `);

        const { tables } = getDrizzleSchema(schema);
        const fooTable = find(tables, { name: "Foo" });
        const userTable = find(tables, { name: "User" });

        expect(fooTable?.relations).toMatchObject([
            {
                kind: "foreign",
                alias: undefined,
                to: "User",
                name: "user",
                fields: ["userId"],
                references: ["id"],
            },
        ]);

        expect(userTable?.relations).toMatchObject([
            {
                kind: "many",
                to: "Foo",
                name: "foos",
            },
        ]);
    });

    test("named reference", () => {
        const schema = getSchema(
            [
                "model Foo {",
                '  user User @relation(name: "user_relation", fields: [userId], references: [id])',
                "  userId Int",
                "}",
                "model User {",
                "  id Int @id",
                '  foos Foo[] @relation(name: "user_relation")',
                "}",
            ].join("\n"),
        );

        const { tables } = getDrizzleSchema(schema);
        const fooTable = find(tables, { name: "Foo" });
        const userTable = find(tables, { name: "User" });

        expect(fooTable?.relations).toMatchObject([
            {
                kind: "foreign",
                alias: "user_relation",
                to: "User",
                name: "user",
                fields: ["userId"],
                references: ["id"],
            },
        ]);

        expect(userTable?.relations).toMatchObject([
            {
                kind: "many",
                alias: "user_relation",
                to: "Foo",
                name: "foos",
            },
        ]);
    });

    test("multikey", () => {
        const schema = getSchema(
            [
                "model Foo {",
                "  firstName String",
                "  lastName String",
                "  user User @relation(fields: [firstName, lastName], references: [firstName, lastName])",
                "}",
                "model User {",
                "  id Int @id",
                "  firstName String",
                "  lastName String",
                "  foos Foo[]",
                "}",
            ].join("\n"),
        );

        const { tables } = getDrizzleSchema(schema);
        const fooTable = find(tables, { name: "Foo" });
        //const userTable = find(tables, {name: "user"});

        expect(fooTable?.relations).toMatchObject([
            {
                kind: "foreign",
                alias: undefined,
                to: "User",
                name: "user",
                fields: ["firstName", "lastName"],
                references: ["firstName", "lastName"],
            },
        ]);
    });
});

describe("model properties", () => {
    test.each([
        [
            `@@map("TableAlias")`,
            {
                dbName: "TableAlias",
            },
        ],
        [
            `@@map(name: "TableAlias")`,
            {
                dbName: "TableAlias",
            },
        ],
    ])("%s", (input, result) => {
        const schema = getSchema(["model Foo {", `  ${input}`, "}"].join("\n"));

        const { tables } = getDrizzleSchema(schema);
        const table = find(tables, { name: "Foo" });

        expect(table).toMatchObject(result);
    });

    test.each([
        [
            `@@index([name, email])`,
            {
                name: "nameEmailIdx",
                kind: "index",
                fields: [
                    { name: "name", sort: "Asc" },
                    { name: "email", sort: "Asc" },
                ],
            },
        ],
        [
            `@@index(map: "name_email_idx", [name, email(sort: Desc)])`,
            {
                name: "nameEmailIdx",
                dbName: "name_email_idx",
                kind: "index",
                fields: [
                    { name: "name", sort: "Asc" },
                    { name: "email", sort: "Desc" },
                ],
            },
        ],
        [
            `@@unique(name: "nameEmailIdx", [name, email(sort: Desc)])`,
            {
                name: "nameEmailIdx",
                kind: "unique",
                fields: [
                    { name: "name", sort: "Asc" },
                    { name: "email", sort: "Desc" },
                ],
            },
        ],
        [
            `@@id([name, email])`,
            {
                name: "nameEmailPKey",
                kind: "primary",
                fields: [
                    { name: "name", sort: "Asc" },
                    { name: "email", sort: "Asc" },
                ],
            },
        ],
    ])("%s", (input, result) => {
        const schema = getSchema(["model Foo {", `  ${input}`, "}"].join("\n"));

        const { tables } = getDrizzleSchema(schema);
        const table = find(tables, { name: "Foo" });

        expect(table?.indexes[0]).toEqual(result);
    });

    test("@@ignore", () => {
        const schema = getSchema(["model Foo {", "  @@ignore", "}"].join("\n"));

        const { tables } = getDrizzleSchema(schema);
        expect(tables).toHaveLength(0);
    });
});

describe("enums", () => {
    test("enum declaration", () => {
        const schema = getSchema(
            [
                "enum FooBar {",
                "  FIRST",
                `  SECOND`,
                `  @@map("foo_bar_alias")`,
                "}",
            ].join("\n"),
        );

        const { enums } = getDrizzleSchema(schema);
        expect(enums).toEqual([
            {
                name: "FooBar",
                dbName: "foo_bar_alias",
                values: ["FIRST", "SECOND"],
            },
        ]);
    });
});
