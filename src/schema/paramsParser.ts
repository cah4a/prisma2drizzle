import {
    AttributeArgument,
    RelationArray,
    Value,
    Func,
    KeyValue,
} from "@mrleebo/prisma-ast";
import { entries, isArray, isBoolean, isNumber, isString } from "lodash";

type TypeParse<T = unknown> = (value: Value) => T;

type Signature = {
    [key: string]: {
        type: TypeParse;
        required?: boolean;
    };
};

type OneOfTypes<T extends Record<string, TypeParse>> = {
    [key in keyof T]: {
        type: key;
        value: ReturnType<T[key]>;
    };
}[keyof T];

type ParamsParser<T extends Signature> = {
    [key in keyof T]:
        | ReturnType<T[key]["type"]>
        | (T[key]["required"] extends true ? never : undefined);
};

export function paramsParser<T extends Signature>(signature: T) {
    return (values?: (AttributeArgument | Value)[]): ParamsParser<T> => {
        const result: Record<string, unknown> = {};
        const positional = [] as Value[];

        for (const attr of values ?? []) {
            const value = isAttributeArgument(attr) ? attr.value : attr;

            if (isKeyValue(value)) {
                const item = signature[value.key];

                if (item) {
                    try {
                        result[value.key] = item.type(value.value);
                    } catch (e) {
                        throw new Error(
                            `Parse ${value.key} argument error: ${e.message}`,
                        );
                    }
                } else {
                    throw new Error(`Unknown argument: ${value.key}`);
                }
            } else {
                positional.push(value);
            }
        }

        const following = entries(signature).filter(
            ([name]) => !(name in result),
        );

        for (const value of positional) {
            const item = following.shift();

            if (!item) {
                throw new Error(`Too many arguments`);
            }

            const [name, { type }] = item;

            try {
                result[name] = type(value);
            } catch (e) {
                throw new Error(`Parse ${name} argument error: ${e.message}`);
            }
        }

        const requiredParams = following
            .filter(([, { required }]) => required)
            .map(([name]) => name);

        if (requiredParams.length) {
            throw new Error(
                `Missing required params: ${requiredParams.join(", ")}`,
            );
        }

        return result as ParamsParser<T>;
    };
}

export const type = {
    string(value: Value) {
        if (isString(value)) {
            value = JSON.parse(value);
        }

        if (isString(value)) {
            return value;
        }

        throw new Error(`Expected string`);
    },
    number(value: Value) {
        if (isString(value)) {
            value = JSON.parse(value);
        }

        if (isNumber(value)) {
            return value;
        }

        throw new Error(`Expected string`);
    },

    scalar(value: Value): boolean | string | number | null {
        if (isString(value)) {
            value = JSON.parse(value);
        }

        if (isString(value) || isNumber(value) || isBoolean(value)) {
            return value;
        }

        if (value === null) {
            return null;
        }

        throw new Error(`Expected scalar`);
    },

    boolean(value: Value) {
        if (isString(value)) {
            value = JSON.parse(value);
        }

        if (isBoolean(value)) {
            return value;
        }

        throw new Error(`Expected boolean`);
    },

    literal(value: Value) {
        if (isString(value)) {
            return value;
        }

        throw new Error(`Expected string`);
    },

    either<T extends string[]>(...variants: T) {
        return (value: Value): T[number] => {
            if (isString(value)) {
                if (variants.includes(value)) {
                    return value;
                }

                throw new Error(`Expected one of ${variants.join(", ")}`);
            }

            throw new Error(`Expected one of ${variants.join(", ")}`);
        };
    },

    fn(value: Value) {
        if (isFunctionCall(value)) {
            return {
                name: value.name,
                params: value.params,
            };
        }

        throw new Error(`Expected function`);
    },

    relations(value: Value) {
        if (isArrayType(value)) {
            return value.args;
        }

        throw new Error(`Expected relations list`);
    },

    oneOf<T extends Record<string, TypeParse>>(types: T) {
        return (value: Value): OneOfTypes<T> => {
            for (const [type, parse] of Object.entries(types)) {
                try {
                    return {
                        type,
                        value: parse(value) as any,
                    };
                } catch (e) {
                    // ignore
                }
            }

            throw new Error(
                `Expected one of ${Object.values(types)
                    .map((item) => item.name)
                    .join(", ")}`,
            );
        };
    },
    array<T>(item: TypeParse<T>) {
        return (value: Value): T[] => {
            if (isArray(value)) {
                return value.map(item);
            }

            if (isArrayType(value)) {
                return value.args.map(item);
            }

            throw new Error(`Expected array`);
        };
    },
};

function isKeyValue(arg?: KeyValue | Value | Func): arg is KeyValue {
    return !!(
        arg &&
        typeof arg === "object" &&
        "type" in arg &&
        arg.type === "keyValue"
    );
}

function isArrayType(arg?: KeyValue | Value | Func): arg is RelationArray {
    return !!(
        arg &&
        typeof arg === "object" &&
        "type" in arg &&
        arg.type === "array"
    );
}

function isFunctionCall(arg?: KeyValue | Value | Func): arg is Func {
    return !!(
        arg &&
        typeof arg === "object" &&
        "type" in arg &&
        arg.type === "function"
    );
}

function isAttributeArgument(arg?: unknown): arg is AttributeArgument {
    return !!(
        arg &&
        typeof arg === "object" &&
        "type" in arg &&
        arg.type === "attributeArgument"
    );
}
