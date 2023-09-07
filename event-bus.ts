import { chan, multi } from "https://raw.githubusercontent.com/BlowaterNostr/csp/master/csp.ts";

export class EventBus<T> implements EventEmitter<T> {
    private readonly c = chan<T>();
    private readonly caster = multi<T>(this.c);

    emit = async (event: T) => {
        await this.c.put(event);
    };

    onChange() {
        return this.caster.copy();
    }
}

export type EventEmitter<T> = {
    emit: (event: T) => void;
};
export type emitFunc<T extends { type: string }> = (event: T) => void;
