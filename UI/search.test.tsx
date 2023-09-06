/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { EventBus } from "../event-bus.ts";
import { Search } from "./search.tsx";
import { SearchUpdate } from "./search_model.ts";

const eventBus = new EventBus<SearchUpdate>();

render(
    <Search
        deps={{
            eventEmitter: eventBus,
        }}
        model={{
            isSearching: false,
            searchResults: [],
        }}
    />,
    document.body,
);

for await (const event of eventBus.onChange()) {
    console.log(event);
}
