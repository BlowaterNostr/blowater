/** @jsx h */
import { h, render } from "https://esm.sh/preact@10.17.1";
import { testEventBus } from "./_setup.test.ts";
import { SignIn } from "./sign-in.tsx";

render(
    <SignIn
        emit={testEventBus.emit}
    />,
    document.body,
);
