export type Code = { code: string };

type Placeholder =
    | Code
    | string
    | number
    | boolean
    | null
    | undefined
    | Placeholder[];

export const code = (code: string) => ({ code });

export function placeholderToCode(placeholder: Placeholder): string {
    if (typeof placeholder === "string") {
        return JSON.stringify(placeholder);
    }

    if (typeof placeholder === "number") {
        return `${placeholder}`;
    }

    if (typeof placeholder === "boolean") {
        return `${placeholder}`;
    }

    if (placeholder === null) {
        return "null";
    }

    if (placeholder === undefined) {
        return "undefined";
    }

    if (Array.isArray(placeholder)) {
        return placeholder.map(placeholderToCode).join(", ");
    }

    return placeholder.code;
}

export function template(
    strings: TemplateStringsArray,
    ...placeholders: Placeholder[]
): Code {
    let code = "";

    for (const item of strings) {
        code += item;
        if (placeholders.length) {
            const placeholder = placeholders.shift();
            code += placeholderToCode(placeholder);
        }
    }

    return { code };
}
