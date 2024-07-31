import {foreignKey, index, mysqlEnum, mysqlTable, primaryKey} from "drizzle-orm/mysql-core";


const table = mysqlTable("something", {
    foo: mysqlEnum("foo", ["bar", "baz"]),
}, t => ({
    idx: primaryKey({
        columns: [t.foo],
        name: "idx",
    }),
    fk: foreignKey({
        columns: [t.foo],
        foreignColumns: [t.foo],
    }),
}))
