import { SMRuntimeException } from "@src/exceptions";

export function requiresTruthy<T>(value: any, message?: string) : asserts value is NonNullable<T> {
    if (!value) {
        throw new SMRuntimeException(message || "value was null or not defined");
    }
}