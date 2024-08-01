import meow from "meow";
import chalk from "chalk";
import * as fs from "fs/promises";
import { getSchema } from "@mrleebo/prisma-ast";
import { getDrizzleSchema } from "schema/getDrizzleSchema";
import { generateSchema } from "generators/generator";
import { format } from "prettier";
import * as process from "process";

const cli = meow(
    `
        Usage
          $ prizzle <input>
    
        Options
          --schema, -s  Prisma schema file
          --out, -o Drizzle schema file to generate
    `,
    {
        importMeta: import.meta,
        flags: {
            schema: {
                type: "string",
                shortFlag: "s",
            },
            out: {
                type: "string",
                shortFlag: "o",
            },
        },
    },
);

(async () => {
    const schemaFile = await findSchemaFile();
    const outputFile = await findOutputFile();

    const source = await fs.readFile(schemaFile, "utf-8");
    const schema = getSchema(source);
    const drizzleSchema = getDrizzleSchema(schema);
    const result = generateSchema(drizzleSchema);
    const resultFormatted = await format(result, {
        parser: "typescript",
        tabWidth: 4,
    });
    await fs.writeFile(outputFile, resultFormatted);
    console.log("Generated " + outputFile);
})();

async function findSchemaFile() {
    if (cli.flags.schema) {
        if (!(await hasFile(cli.flags.schema))) {
            console.error(
                chalk.bgRed(`Schema file ${cli.flags.schema} not exists`),
            );
            process.exit(1);
        }

        return cli.flags.schema;
    }

    if (await hasFile("schema.prisma")) {
        return "schema.prisma";
    }

    if (await hasFile("prisma/schema.prisma")) {
        return "prisma/schema.prisma";
    }

    console.error(chalk.bgRed("No schema file found"));
    console.log(
        "Please specify a schema file with --schema or place a schema.prisma file in the current directory.",
    );
    process.exit(1);
}

async function findOutputFile() {
    if (cli.flags.out) {
        return cli.flags.out;
    }

    return "schema.ts";
}

async function hasFile(file: string) {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}
