/* jsx h */
import { Component, h } from "preact";
import { emitFunc } from "../event-bus.ts";
import { Empty } from "./_helper.ts";

type Props = {
    emit: emitFunc<FilterContent>;
};

export class Filter extends Component<Props, Empty> {
    render() {
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
