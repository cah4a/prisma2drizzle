import {
    mysqlTable,
    index,
    int,
    varchar,
    timestamp,
    mediumtext,
    boolean,
    primaryKey,
} from "drizzle-orm/mysql-core";
import {
    type InferSelectModel,
    type InferInsertModel,
    relations,
} from "drizzle-orm";

export const User = mysqlTable(
    "User",
    {
        id: int("id").autoincrement().primaryKey().notNull(),
        email: varchar("email", { length: 255 }).unique().notNull(),
        name: varchar("name", { length: 255 }).notNull(),
        createdAt: timestamp("createdAt").defaultNow().notNull(),
        updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    },
    (table) => ({
        nameEmailIdx: index("name_email_idx").on(table.name, table.email),
    }),
);

export type UserSelectModel = InferSelectModel<typeof User>;

export type UserInsertModel = InferInsertModel<typeof User>;

export const UserRelations = relations(User, ({ many }) => ({
    author: many(Post),
    reviewer: many(Post, { relationName: "Reviewer" }),
}));

export const Post = mysqlTable("Post", {
    id: int("id").autoincrement().primaryKey().notNull(),
    authorId: int("authorId")
        .notNull()
        .references(() => User.id),
    reviewerId: int("reviewerId").references(() => User.id),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).unique().notNull(),
    uuid: varchar("uuid", { length: 255 }).default("uuid()").notNull(),
    text: mediumtext("text"),
    isActive: boolean("isActive").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PostSelectModel = InferSelectModel<typeof Post>;

export type PostInsertModel = InferInsertModel<typeof Post>;

export const PostRelations = relations(Post, ({ one, many }) => ({
    author: one(User, { fields: [Post.authorId], references: [User.id] }),
    reviewer: one(User, {
        relationName: "Reviewer",
        fields: [Post.reviewerId],
        references: [User.id],
    }),
    tags: many(TagToPost),
}));

export const Tag = mysqlTable("Tag", {
    id: int("id").autoincrement().primaryKey().notNull(),
    name: varchar("name", { length: 255 }).unique().notNull(),
});

export type TagSelectModel = InferSelectModel<typeof Tag>;

export type TagInsertModel = InferInsertModel<typeof Tag>;

export const TagRelations = relations(Tag, ({ many }) => ({
    posts: many(TagToPost),
}));

export const TagToPost = mysqlTable(
    "_TagToPost",
    {
        tagId: int("A")
            .notNull()
            .references(() => Tag.id),
        postId: int("B")
            .notNull()
            .references(() => Post.id),
    },
    (table) => ({ pk: primaryKey({ columns: [table.tagId, table.postId] }) }),
);

export type TagToPostSelectModel = InferSelectModel<typeof TagToPost>;

export type TagToPostInsertModel = InferInsertModel<typeof TagToPost>;

export const TagToPostRelations = relations(TagToPost, ({ one }) => ({
    Tag: one(Tag, { fields: [TagToPost.tagId], references: [Tag.id] }),
    Post: one(Post, { fields: [TagToPost.postId], references: [Post.id] }),
}));
