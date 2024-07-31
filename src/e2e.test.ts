import { expect, test } from "vitest";
import { getDrizzleSchema } from "schema/getDrizzleSchema";
import { getSchema } from "@mrleebo/prisma-ast";
import * as fs from "fs/promises";
import { generateSchema } from "generators/generator";
import { format } from "prettier";
import * as path from "node:path";

test("models", async () => {
    const source = await fs.readFile(path.join(__dirname, "__fixtures__/schema.prisma"), "utf-8");
    const schema = getSchema(source);
    const drizzleSchema = getDrizzleSchema(schema);
    const result = generateSchema(drizzleSchema);
    const resultFormatted = await format(result, {
        parser: "typescript",
        tabWidth: 4,
    });
    await expect(resultFormatted).toMatchFileSnapshot(
        path.join(__dirname, "__snapshots__/output.mysql.ts")
    );
});
