/** @jsx h */
import { h } from "https://esm.sh/preact@10.17.1";
import { render } from "https://esm.sh/preact@10.17.1";
import { testEventBus } from "./_setup.test.ts";
import { SignInOld } from "./signIn.tsx";

render(
    <SignInOld
        emit={testEventBus.emit}
    />,
    document.body,
);

for await (const e of testEventBus.onChange()) {
    console.log(e);
}
