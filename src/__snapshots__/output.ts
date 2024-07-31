import {
    mysqlTable,
    index,
    int,
    varchar,
    datetime,
    mediumtext,
    boolean,
    primaryKey,
} from "drizzle-orm/mysql-core";
import { relations } from "drizzle-orm";

export const users = mysqlTable(
    "User",
    {
        id: int("id").autoincrement().primaryKey().notNull(),
        email: varchar("email", { length: 255 }).unique().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        createdAt: datetime("createdAt").notNull(),
        updatedAt: datetime("updatedAt").notNull(),
    },
    (table) => ({
        nameEmailIdx: index("name_email_idx").on(table.name, table.email),
    }),
);

export const usersRelations = relations(users, ({ many }) => ({
    author: many(posts),
    reviewer: many(posts, { relationName: "reviewer" }),
}));

export const posts = mysqlTable("Post", {
    id: int("id").autoincrement().primaryKey().notNull(),
    authorId: int("authorId")
        .notNull()
        .references(() => users.id),
    reviewerId: int("reviewerId").references(() => users.id),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    text: mediumtext("text"),
    isActive: boolean("isActive").default(false).notNull(),
    createdAt: datetime("createdAt").notNull(),
    updatedAt: datetime("updatedAt").notNull(),
});

export const postsRelations = relations(posts, ({ one, many }) => ({
    author: one(users, { fields: [posts.authorId], references: [users.id] }),
    reviewer: one(users, {
        relationName: "reviewer",
        fields: [posts.reviewerId],
        references: [users.id],
    }),
    tags: many(tagsToPosts),
}));

export const tags = mysqlTable("Tag", {
    id: int("id").autoincrement().primaryKey().notNull(),
    name: varchar("name", { length: 255 }).unique().notNull(),
});

export const tagsRelations = relations(tags, ({ many }) => ({
    posts: many(tagsToPosts),
}));

export const tagsToPosts = mysqlTable(
    "_TagsToPosts",
    {
        tagId: int("A")
            .notNull()
            .references(() => tags.id),
        postId: int("B")
            .notNull()
            .references(() => posts.id),
    },
    (table) => ({ pk: primaryKey({ columns: [table.tagId, table.postId] }) }),
);

export const tagsToPostsRelations = relations(tagsToPosts, ({ one }) => ({
    tagId: one(tags, { fields: [tagsToPosts.tagId], references: [tags.id] }),
    postId: one(posts, {
        fields: [tagsToPosts.postId],
        references: [posts.id],
    }),
}));
