import { SMRuntimeException } from "@src/base/SMRuntimeException";

export function requiresTruthy<T>(value: T, message?: string) : asserts value is NonNullable<T> {
    if (!value) {
        throw new SMRuntimeException(message || "value was null or not defined");
    }
}