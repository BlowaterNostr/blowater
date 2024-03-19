import { Component, h } from "https://esm.sh/preact@10.17.1";
import { PublicKey } from "../../libs/nostr.ts/key.ts";
import { emitFunc } from "../event-bus.ts";

type Props = {
    emit: emitFunc<FilterContent>;
};

export class Filter extends Component<Props, {}> {
    render() {
        const authors: PublicKey[] = [];
        return (
            <div class="border flex flex-col items-center">
                <div class="flex flex-row border">
                    <input
                        placeholder={"search content"}
                        onInput={(e) => {
                            this.props.emit({
                                type: "FilterContent",
                                content: e.currentTarget.value,
                            });
                        }}
                    >
                    </input>
                </div>
            </div>
        );
    }
}

export type FilterContent = {
    type: "FilterContent";
    content: string;
};
