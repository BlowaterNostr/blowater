import { Component, h } from "https://esm.sh/preact@10.17.1";

import { emitFunc } from "../event-bus.ts";
import { Filter } from "./filter.tsx";
import { FilterContent } from "./filter.tsx";

type Props = {
    relay: string;
    currentSelected: string | undefined;
    filters: string[];
    emit: emitFunc<FilterContent>;
};

export class PublicFilterList extends Component<Props> {
    render() {
        return (
            <div>
                <Filter emit={this.props.emit}></Filter>
            </div>
        );
    }
}
