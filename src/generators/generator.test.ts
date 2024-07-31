import { describe, test, expect } from "vitest";
import { generateTable } from "generators/generator";
import { format } from "prettier";

describe("generator", () => {
    test("columns", async () => {
        const code = generateTable(
            {
                name: "test",
                dbName: "test",
                fields: [
                    {
                        name: "id",
                        dbName: "id",
                        type: "Int",
                        default: { fn: "autoincrement" },
                        isNullable: false,
                        isPrimary: true,
                        isArray: false,
                    },
                    {
                        name: "name",
                        dbName: "name",
                        type: "String",
                        dbTypeHint: { type: "Text" },
                        default: { value: "John Doe" },
                        isNullable: true,
                        isPrimary: false,
                        isArray: false,
                    },
                    {
                        name: "email",
                        dbName: "email",
                        type: "String",
                        isNullable: false,
                        isPrimary: false,
                        isArray: false,
                        isUnique: {
                            name: "my_custom_name",
                            sort: "Asc",
                        },
                    },
                ],
                indexes: [],
                foreignKeys: [],
                relations: [],
            },
            [],
            "mysql",
        );

        expect(await format(code, { parser: "typescript" }))
            .toMatchInlineSnapshot(`
              "export const test = mysqlTable(\\"test\\", {
                id: int(\\"id\\").autoincrement().primaryKey().notNull(),
                name: text(\\"name\\").default(\\"John Doe\\"),
                email: varchar(\\"email\\", { length: 255 }).unique(\\"my_custom_name\\").notNull(),
              });

              export type testSelectModel = InferSelectModel<typeof test>;

              export type testInsertModel = InferInsertModel<typeof test>;
              "
            `);
    });

    test("enums", async () => {
        const code = generateTable(
            {
                name: "test",
                dbName: "test",
                fields: [
                    {
                        name: "id",
                        dbName: "id",
                        type: "Int",
                        default: { fn: "autoincrement" },
                        isNullable: false,
                        isPrimary: true,
                        isArray: false,
                    },
                    {
                        name: "status",
                        dbName: "status",
                        type: "Status",
                        isNullable: false,
                        isPrimary: false,
                        isArray: false,
                    },
                ],
                indexes: [],
                foreignKeys: [],
                relations: [],
            },
            [
                {
                    name: "Status",
                    dbName: "status",
                    values: ["Active", "Inactive"],
                },
            ],
            "mysql",
        );

        expect(await format(code, { parser: "typescript" }))
            .toMatchInlineSnapshot(`
              "export const test = mysqlTable(\\"test\\", {
                id: int(\\"id\\").autoincrement().primaryKey().notNull(),
                status: mysqlEnum(\\"status\\", [\\"Active\\", \\"Inactive\\"]).notNull(),
              });

              export type testSelectModel = InferSelectModel<typeof test>;

              export type testInsertModel = InferInsertModel<typeof test>;
              "
            `);
    });

    test("reference", async () => {
        const code = generateTable(
            {
                name: "test",
                dbName: "test",
                fields: [
                    {
                        name: "id",
                        dbName: "id",
                        type: "Int",
                        default: { fn: "autoincrement" },
                        isNullable: false,
                        isPrimary: true,
                        isArray: false,
                    },
                    {
                        name: "userId",
                        dbName: "user_id",
                        type: "Int",
                        isNullable: false,
                        isPrimary: false,
                        isArray: false,
                    },
                ],
                indexes: [],
                foreignKeys: [
                    {
                        name: "userId",
                        to: "user",
                        fromFields: ["userId"],
                        toFields: ["id"],
                    },
                ],
                relations: [],
            },
            [],
            "mysql",
        );

        expect(await format(code, { parser: "typescript" }))
            .toMatchInlineSnapshot(`
              "export const test = mysqlTable(\\"test\\", {
                id: int(\\"id\\").autoincrement().primaryKey().notNull(),
                userId: int(\\"user_id\\")
                  .notNull()
                  .references(() => user.id),
              });

              export type testSelectModel = InferSelectModel<typeof test>;

              export type testInsertModel = InferInsertModel<typeof test>;
              "
            `);
    });

    test("indexes", async () => {
        const code = generateTable(
            {
                name: "test",
                dbName: "test",
                fields: [
                    {
                        name: "id",
                        dbName: "id",
                        type: "Int",
                        default: { fn: "autoincrement" },
                        isNullable: false,
                        isPrimary: true,
                        isArray: false,
                    },
                    {
                        name: "userId",
                        dbName: "user_id",
                        type: "Int",
                        isNullable: false,
                        isPrimary: false,
                        isArray: false,
                    },
                ],
                indexes: [
                    {
                        dbName: "user_pk",
                        name: "userPk",
                        kind: "primary",
                        fields: [{ name: "id", sort: "Asc" }],
                    },
                    {
                        dbName: "user_id_idx",
                        name: "userIdIdx",
                        kind: "index",
                        fields: [{ name: "userId", sort: "Asc" }],
                    },
                    {
                        dbName: "user_id_unique",
                        name: "userIdUnique",
                        kind: "unique",
                        fields: [{ name: "id", sort: "Asc" }, { name: "userId", sort: "Desc" }],
                    },
                ],
                foreignKeys: [],
                relations: [],
            },
            [],
            "mysql",
        );

        expect(await format(code, { parser: "typescript" }))
            .toMatchInlineSnapshot(`
              "export const test = mysqlTable(
                \\"test\\",
                {
                  id: int(\\"id\\").autoincrement().primaryKey().notNull(),
                  userId: int(\\"user_id\\").notNull(),
                },
                (table) => ({
                  userPk: primaryKey({ name: \\"user_pk\\", columns: [table.id] }),
                  userIdIdx: index(\\"user_id_idx\\").on(table.userId),
                  userIdUnique: uniqueIndex(\\"user_id_unique\\").on(
                    table.id,
                    sql\`\${table.userId} DESC\`,
                  ),
                }),
              );

              export type testSelectModel = InferSelectModel<typeof test>;

              export type testInsertModel = InferInsertModel<typeof test>;
              "
            `);
    });

    test("multiref", async () => {
        const code = generateTable(
            {
                name: "test",
                dbName: "test",
                fields: [
                    {
                        name: "id",
                        dbName: "id",
                        type: "Int",
                        default: { fn: "autoincrement" },
                        isNullable: false,
                        isPrimary: true,
                        isArray: false,
                    },
                    {
                        name: "userId",
                        dbName: "user_id",
                        type: "Int",
                        isNullable: false,
                        isPrimary: false,
                        isArray: false,
                    },
                ],
                indexes: [],
                foreignKeys: [
                    {
                        name: "nameReference",
                        dbName: "name_reference",
                        to: "user",
                        fromFields: ["firstName", "lastName"],
                        toFields: ["firstName", "lastName"],
                    },
                ],
                relations: [],
            },
            [],
            "mysql",
        );

        expect(await format(code, { parser: "typescript" }))
            .toMatchInlineSnapshot(`
              "export const test = mysqlTable(
                \\"test\\",
                {
                  id: int(\\"id\\").autoincrement().primaryKey().notNull(),
                  userId: int(\\"user_id\\").notNull(),
                },
                (table) => ({
                  nameReference: foreignKey({
                    name: \\"name_reference\\",
                    columns: [table.firstName, table.lastName],
                    foreignColumns: [user.firstName, user.lastName],
                  }),
                }),
              );

              export type testSelectModel = InferSelectModel<typeof test>;

              export type testInsertModel = InferInsertModel<typeof test>;
              "
            `);
    });
});
