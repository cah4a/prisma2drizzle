import { lowerFirst } from "lodash";
import pluralize from "pluralize";

export function exportName(
    prismaName: string,
    style: "prisma" | "drizzle" = "prisma",
) {
    if (style === "drizzle") {
        return pluralize(lowerFirst(prismaName));
    }

    return prismaName;
}
