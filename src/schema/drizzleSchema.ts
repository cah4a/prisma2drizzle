export type RelationAction =
    | "Cascade"
    | "Restrict"
    | "NoAction"
    | "SetNull"
    | "SetDefault";

export type DrizzleDialect = "sqlite" | "mysql" | "postgres";

export type DrizzleSchema = {
    tables: DrizzleTable[];
    enums: DrizzleEnum[];
    provider: string | null;
};

export type DrizzleTable = {
    name: string;
    dbName: string;
    fields: DrizzleField[];
    indexes: DrizzleIndex[];
    foreignKeys: DrizzleForeignKey[];
    relations: DrizzleRelation[];
};

export type DrizzleRelation =
    | {
          name: string;
          alias?: string;
          kind: "foreign";
          to: string;
          fields: string[];
          references: string[];
      }
    | {
          name: string;
          alias?: string;
          kind: "many" | "one";
          to: string;
      };

export type DrizzleField = {
    isArray?: boolean;
    isPrimary?: boolean;
    name: string;
    dbName: string;
    type: string;
    dbTypeHint?: { type: string; arg?: number };
    isNullable: boolean;
    default?:
        | { value: number | string | boolean | bigint | null }
        | {
              fn:
                  | "autoincrement"
                  | "now"
                  | "uuid"
                  | "guid"
                  | "cuid"
                  | "cuid2"
                  | string;
          };
    update?: { fn: "now" };
    isUnique?: { name?: string; sort: "Asc" | "Desc" };
};

export type DrizzleForeignKey = {
    name: string;
    dbName?: string;
    to: string;
    fromFields: string[];
    toFields: string[];
    onDelete?: RelationAction;
    onUpdate?: RelationAction;
};

export type DrizzleIndex = {
    name: string;
    dbName?: string;
    kind: "primary" | "unique" | "index";
    fields: { name: string; sort: "Asc" | "Desc" }[];
};

export type DrizzleEnum = {
    name: string;
    dbName: string;
    values: string[];
};
