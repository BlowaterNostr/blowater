import { h, render } from "https://esm.sh/preact@10.17.1";
import { ChannelList } from "./channel-list.tsx";

render(<ChannelList channels={["general", "games", "work"]}></ChannelList>, document.body);
