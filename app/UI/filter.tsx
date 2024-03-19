import {
    Attributes,
    Component,
    ComponentChild,
    ComponentChildren,
    h,
    Ref,
} from "https://esm.sh/preact@10.17.1";
import { map } from "./_helper.ts";
import { PublicKey } from "../../libs/nostr.ts/key.ts";

export class Filter extends Component<{}, {}> {
    render() {
        const authors: PublicKey[] = [];
        return (
            <div class="border flex flex-col items-center">
                <div class="flex flex-row border">
                    <div class="mx-2">text</div>
                    <input placeholder={"search content"}></input>
                </div>
                <div>
                    <div>Authors</div>
                    {authors.map((author) => <div>{author.bech32()}</div>)}
                </div>
                <button class="border">save filter</button>
            </div>
        );
    }
}
