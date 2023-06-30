/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.11.3";
import { EventBus } from "../event-bus.ts";
import { Search, SearchUpdate } from "./search.tsx";

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
