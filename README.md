# Prisma to Drizzle Generator

## Features

-   Generates a Drizzle schema from a Prisma schema file
-   Generates Drizzle relations (one-to-one, one-to-many, many-to-one, many-to-many)
-   Supports disambiguation relations

## Supported Databases Dialects

-   MySQL
-   PostgreSQL (TBD)
-   SQLite (TBD)

## Usage

Install the generator as a development dependency:

```bash
npm install -D prisma-to-drizzle-generator
```

```bash
yarn add -D prisma-to-drizzle-generator
```

```bash
pnpm install -D prisma-to-drizzle-generator
```

Add the generator to your Prisma schema:

```prisma
generator drizzle {
  provider = "prisma-to-drizzle-generator"
  output   = "./drizzle/schema.ts"
}
```

Run the generator:

```bash
prisma generate
```

## Compat Mode

The generator supports a compat mode if you are using or migrating from database managed by prisma:

```prisma
generator drizzle {
  provider = "prisma-to-drizzle-generator"
  output   = "./drizzle/schema.ts"
  compat   = true
}
```

## Contributing

If you have any questions or suggestions, please open an issue or a pull request.
